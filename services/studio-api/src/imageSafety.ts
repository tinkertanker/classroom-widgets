import { HttpError } from './http';

export interface ImageSafetyInspector {
  inspect(bytes: Uint8Array, mediaType: string): Promise<void>;
}

interface WorkersAIImageBinding {
  run(model: string, input: Record<string, unknown>): Promise<unknown>;
}

interface VisionAnswer {
  answer?: string;
}

interface WorkersAIEnvelope {
  result?: VisionAnswer;
}

const MODEL = '@cf/moondream/moondream3.1-9B-A2B';
const QUESTION = `Classify this teacher-uploaded classroom image.
Reply on the first line with exactly SAFE or UNSAFE, then one short reason.
Mark UNSAFE if it contains any visible person or face, nudity or sexual content, graphic injury,
weapons or illegal drugs, hateful symbols, or visible personal information such as a pupil name,
email address, phone number, identity number or class list.
Ordinary diagrams, worksheets, teacher sketches and logos are SAFE when none of those are present.`;

export class CloudflareImageSafetyInspector implements ImageSafetyInspector {
  constructor(private readonly ai: WorkersAIImageBinding) {}

  async inspect(bytes: Uint8Array, mediaType: string): Promise<void> {
    let result: unknown;
    try {
      result = await this.ai.run(MODEL, {
        task: 'query',
        image: `data:${mediaType};base64,${base64(bytes)}`,
        question: QUESTION,
        reasoning: false,
        temperature: 0,
        max_tokens: 80,
        stream: false,
      });
    } catch (error) {
      const diagnostic = error instanceof Error
        ? `${error.name}: ${error.message}`
        : String(error);
      console.error(`Image safety review failed: ${diagnostic}`);
      throw new HttpError(
        503,
        'IMAGE_SAFETY_REVIEW_UNAVAILABLE',
        'The image safety check is temporarily unavailable. Try again shortly.',
      );
    }

    const answer = result !== null && typeof result === 'object'
      ? (
          (result as VisionAnswer).answer ??
          (result as WorkersAIEnvelope).result?.answer
        )?.trim()
      : undefined;
    if (!answer) {
      console.error(`Image safety review returned no answer: ${serialiseDiagnostic(result)}`);
      throw new HttpError(
        503,
        'IMAGE_SAFETY_REVIEW_UNAVAILABLE',
        'The image safety check is temporarily unavailable. Try again shortly.',
      );
    }
    if (!/^SAFE\b/i.test(answer)) {
      throw new HttpError(
        422,
        'IMAGE_NOT_ALLOWED',
        'Choose a classroom image without people, personal information or unsafe content.',
      );
    }
  }
}

function serialiseDiagnostic(value: unknown): string {
  try {
    return JSON.stringify(value)?.slice(0, 1_000) ?? String(value);
  } catch {
    return Object.prototype.toString.call(value);
  }
}

function base64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 32_768;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, Math.min(bytes.length, offset + chunkSize));
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}
