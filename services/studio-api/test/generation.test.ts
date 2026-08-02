import { describe, expect, it, vi } from "vitest";
import {
  generateArtifact,
  referencedAssetIds,
  validateHtmlOutput,
} from "../src/generation";
import type { ModelProvider } from "../src/ai/provider";
import { OpenAiCompatibleProvider } from "../src/ai/openAiCompatibleProvider";
const html =
  '<!doctype html><html><head><style>body{color:black}</style></head><body>Hello<img src="assets/asset-one"><script>document.body.dataset.ok="1"</script></body></html>';
describe("HTML generation contract", () => {
  it("accepts complete self-contained HTML and extracts managed assets", () => {
    expect(validateHtmlOutput({ html })).toEqual({ html });
    expect(referencedAssetIds(html)).toEqual(["asset-one"]);
  });
  it("allows exactly one repair", async () => {
    const provider = {
      name: "fixed",
      generate: vi.fn().mockResolvedValueOnce({ html: "bad" }),
      repair: vi.fn().mockResolvedValueOnce({ html }),
      revise: vi.fn(),
      moderate: vi.fn(),
    } as unknown as ModelProvider;
    await expect(
      generateArtifact(provider, {
        level: "P5",
        subject: "Maths",
        learningObjective: "Fractions",
        studentAction: "Choose",
      }),
    ).resolves.toEqual({ html });
    expect(provider.repair).toHaveBeenCalledOnce();
  });
  it("rejects external scripts and unknown output fields", () => {
    expect(() =>
      validateHtmlOutput({
        html: html.replace("<script>", '<script src="https://x.test/a.js">'),
        extra: true,
      }),
    ).toThrow();
  });

  it.each([
    '<base href="/spoof/">',
    '<iframe src="assets/x"></iframe>',
    '<img src="https://example.test/x.png">',
    '<a href="javascript:alert(1)">x</a>',
    '<form action="/submit"></form>',
    '<script>fetch("/secret")</script>',
    '<script>new WebSocket("wss://x")</script>',
    '<script>navigator.serviceWorker.register("/sw.js")</script>',
    "<script data-studio-report></script>",
    "<img src=https://example.test/x.png>",
    "<style>body{background:url(https://example.test/x.png)}</style>",
    '<img srcset="https://example.test/x.png 2x">',
    '<meta http-equiv="refresh" content="0;url=https://example.test">',
    '<style>@import "https://example.test/theme.css";</style>',
  ])("rejects unsafe HTML capability: %s", (capability) => {
    expect(() =>
      validateHtmlOutput({
        html: html.replace("<body>", `<body>${capability}`),
      }),
    ).toThrow();
  });

  it("rejects malformed design cards and extracts exact quoted managed assets", () => {
    expect(() =>
      validateHtmlOutput({ html, designCard: { title: "", tags: [""] } }),
    ).toThrow();
    expect(
      referencedAssetIds(
        '<img src="assets/one"><a href=\'assets/two\'></a><img src="assets/one?x">',
      ),
    ).toEqual(["one", "two"]);
  });

  it("requires head and body elements so server controls can always be injected", () => {
    expect(() =>
      validateHtmlOutput({
        html: "<!doctype html><html><main>Activity</main></html>",
      }),
    ).toThrow("Invalid generated HTML");
  });

  it("repairs malformed provider JSON once and disables DeepSeek thinking", async () => {
    const requests: Record<string, unknown>[] = [];
    const responses = [
      "{malformed",
      JSON.stringify({ html }),
    ];
    const provider = new OpenAiCompatibleProvider({
      baseUrl: "https://api.deepseek.com",
      apiKey: "secret",
      model: "deepseek-v4-flash",
      fetch: vi.fn(async (_url, init) => {
        requests.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
        return Response.json({
          choices: [{ message: { content: responses.shift() } }],
        });
      }),
    });

    await expect(
      generateArtifact(provider, {
        level: "P5",
        subject: "Maths",
        learningObjective: "Fractions",
        studentAction: "Choose",
      }),
    ).resolves.toEqual({ html });
    expect(requests).toHaveLength(2);
    expect(requests[0]).toMatchObject({ thinking: { type: "disabled" } });
  });

  it("does not send provider-specific thinking options to generic endpoints", async () => {
    let body: Record<string, unknown> | undefined;
    const provider = new OpenAiCompatibleProvider({
      baseUrl: "https://models.example.test/v1",
      apiKey: "secret",
      model: "model",
      fetch: vi.fn(async (_url, init) => {
        body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return Response.json({
          choices: [{ message: { content: JSON.stringify({ html }) } }],
        });
      }),
    });
    await provider.generate(
      {
        level: "P5",
        subject: "Maths",
        learningObjective: "Fractions",
        studentAction: "Choose",
      },
      [],
    );
    expect(body).not.toHaveProperty("thinking");
  });
});
