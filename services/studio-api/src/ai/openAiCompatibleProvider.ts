import type { WidgetSpec } from '@classroom-widgets/widget-spec';
import {
  generationPrompt,
  MODERATION_SYSTEM_PROMPT,
  moderationPrompt,
  patchPrompt,
  repairPrompt,
  SYSTEM_PROMPT,
} from './prompts';
import type { ModelProvider, ModerationDecision, TeacherBrief } from './provider';
import { ModelProviderError } from './provider';

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
}

export interface OpenAiCompatibleProviderOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
  fetch?: typeof globalThis.fetch;
}

export class OpenAiCompatibleProvider implements ModelProvider {
  readonly name: string;
  private readonly fetchImplementation: typeof globalThis.fetch;

  constructor(private readonly options: OpenAiCompatibleProviderOptions) {
    this.name = `openai-compatible:${options.model}`;
    // Cloudflare Workers requires host functions to retain their global receiver.
    this.fetchImplementation = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  generate(brief: TeacherBrief): Promise<unknown> {
    return this.complete(SYSTEM_PROMPT, generationPrompt(brief), 16_000);
  }

  patch(current: WidgetSpec, instruction: string): Promise<unknown> {
    return this.complete(SYSTEM_PROMPT, patchPrompt(current, instruction), 16_000);
  }

  repair(candidate: unknown, issues: Parameters<typeof repairPrompt>[1]): Promise<unknown> {
    return this.complete(SYSTEM_PROMPT, repairPrompt(candidate, issues), 16_000);
  }

  async moderate(spec: WidgetSpec): Promise<ModerationDecision> {
    const result = await this.complete(MODERATION_SYSTEM_PROMPT, moderationPrompt(spec), 500);
    if (
      result === null ||
      typeof result !== 'object' ||
      typeof Reflect.get(result, 'safe') !== 'boolean' ||
      !Array.isArray(Reflect.get(result, 'categories')) ||
      !(Reflect.get(result, 'categories') as unknown[]).every((value) => typeof value === 'string')
    ) {
      throw new ModelProviderError('Model provider returned an invalid safety decision.', true);
    }
    const reason = Reflect.get(result, 'reason');
    return {
      safe: Reflect.get(result, 'safe') as boolean,
      categories: Reflect.get(result, 'categories') as string[],
      ...(typeof reason === 'string' ? { reason: reason.slice(0, 500) } : {}),
    };
  }

  private async complete(
    systemPrompt: string,
    userPrompt: string,
    maximumTokens: number,
  ): Promise<unknown> {
    let response: Response;
    try {
      response = await this.fetchImplementation(
        `${this.options.baseUrl.replace(/\/$/, '')}/chat/completions`,
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${this.options.apiKey}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: this.options.model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            response_format: { type: 'json_object' },
            max_tokens: maximumTokens,
            temperature: 0.2,
            ...(this.options.baseUrl.includes('api.deepseek.com')
              ? { thinking: { type: 'disabled' } }
              : {}),
          }),
          signal: AbortSignal.timeout(45_000),
        },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Model request failed.';
      throw new ModelProviderError(message, true);
    }

    const body = (await response.json().catch(() => null)) as ChatCompletionResponse | null;
    if (!response.ok) {
      const message = body?.error?.message ?? `Model provider returned HTTP ${response.status}.`;
      throw new ModelProviderError(message, response.status === 429 || response.status >= 500);
    }

    const content = body?.choices?.[0]?.message?.content;
    if (!content) throw new ModelProviderError('Model provider returned no JSON content.', true);

    try {
      return JSON.parse(content) as unknown;
    } catch {
      throw new ModelProviderError('Model provider returned malformed JSON.', true);
    }
  }
}
