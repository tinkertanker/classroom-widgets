import {
  generationPrompt,
  MODERATION_SYSTEM_PROMPT,
  repairPrompt,
  revisionPrompt,
  SYSTEM_PROMPT,
} from "./prompts";
import type {
  DesignCard,
  Exemplar,
  ModelProvider,
  ModerationDecision,
  TeacherBrief,
} from "./provider";
import { ModelProviderError } from "./provider";
export interface OpenAiCompatibleProviderOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
  fetch?: typeof fetch;
}
export class OpenAiCompatibleProvider implements ModelProvider {
  readonly name: string;
  private f: typeof fetch;
  constructor(private o: OpenAiCompatibleProviderOptions) {
    this.name = `openai-compatible:${o.model}`;
    this.f = o.fetch ?? globalThis.fetch.bind(globalThis);
  }
  generate(b: TeacherBrief, e: Exemplar[]) {
    return this.complete(SYSTEM_PROMPT, generationPrompt(b, e), 32000);
  }
  revise(h: string, c: DesignCard | undefined, i: string, b: TeacherBrief) {
    return this.complete(SYSTEM_PROMPT, revisionPrompt(h, c, i, b), 32000);
  }
  repair(c: unknown, i: string[]) {
    return this.complete(SYSTEM_PROMPT, repairPrompt(c, i), 32000);
  }
  async moderate(html: string): Promise<ModerationDecision> {
    const r = await this.complete(MODERATION_SYSTEM_PROMPT, html, 500, true);
    if (
      !r ||
      typeof r !== "object" ||
      typeof Reflect.get(r, "safe") !== "boolean" ||
      !Array.isArray(Reflect.get(r, "categories"))
    )
      throw new ModelProviderError("Invalid moderation response", true);
    return {
      safe: Reflect.get(r, "safe") as boolean,
      categories: Reflect.get(r, "categories") as string[],
    };
  }
  private async complete(
    system: string,
    user: string,
    max_tokens: number,
    requireJson = false,
  ): Promise<unknown> {
    let response: Response;
    try {
      response = await this.f(
        `${this.o.baseUrl.replace(/\/$/, "")}/chat/completions`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${this.o.apiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: this.o.model,
            messages: [
              { role: "system", content: system },
              { role: "user", content: user },
            ],
            response_format: { type: "json_object" },
            max_tokens,
            temperature: 0.2,
            ...(new URL(this.o.baseUrl).hostname === "api.deepseek.com"
              ? { thinking: { type: "disabled" } }
              : {}),
          }),
          signal: AbortSignal.timeout(45000),
        },
      );
    } catch (e) {
      throw new ModelProviderError(
        e instanceof Error ? e.message : "Model failed",
        true,
      );
    }
    const body = (await response.json().catch(() => null)) as {
      choices?: { message?: { content?: string } }[];
      error?: { message?: string };
    } | null;
    if (!response.ok)
      throw new ModelProviderError(
        body?.error?.message ?? `HTTP ${response.status}`,
        response.status === 429 || response.status >= 500,
      );
    const text = body?.choices?.[0]?.message?.content;
    if (!text) throw new ModelProviderError("No model output", true);
    try {
      return JSON.parse(text);
    } catch {
      if (requireJson)
        throw new ModelProviderError("Malformed model JSON", false);
      return text;
    }
  }
}
