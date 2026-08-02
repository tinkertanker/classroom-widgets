import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { assessArtifact } from './artifact-eval.mjs';

interface EvalCase {
  id: string;
  brief: Record<string, unknown>;
  locale: string;
  expectedInteractions: string[];
  contentTerms: string[];
}

interface Manifest {
  minimumFirstPassRate: number;
  minimumFinalPassRate: number;
  minimumHeuristicFidelityRate: number;
  cases: EvalCase[];
}

const repoRoot = resolve(process.env.INIT_CWD ?? process.cwd());
const model = process.env.EVAL_MODEL ?? 'deepseek-v4-flash';
const baseUrl = (process.env.EVAL_BASE_URL ?? 'https://api.deepseek.com').replace(/\/$/, '');
const apiKey = process.env.DEEPSEEK_API_KEY ?? process.env.AI_API_KEY;
if (!apiKey) throw new Error('Set DEEPSEEK_API_KEY or AI_API_KEY to run the live artifact eval.');

async function complete(messages: Array<{ role: string; content: string }>): Promise<string> {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, response_format: { type: 'json_object' }, messages }),
  });
  const body = await response.json() as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } };
  const content = body.choices?.[0]?.message?.content;
  if (!response.ok || !content) throw new Error(body.error?.message ?? `Provider returned HTTP ${response.status}.`);
  return content;
}

async function evaluate(entry: EvalCase) {
  const system = 'Create one compact classroom widget as a complete, readable, self-contained HTML document with inline CSS and JavaScript. Use no packages, external assets, or network requests. Make controls touch-friendly and normally fit one screen. Return only JSON: {"html":"...","designCard":{"layout":"...","accent":"...","interaction":"..."}}.';
  const request = { locale: entry.locale, expectedInteractions: entry.expectedInteractions, contentTerms: entry.contentTerms };
  const started = performance.now();
  const messages = [{ role: 'system', content: system }, { role: 'user', content: JSON.stringify(entry.brief) }];
  let output = await complete(messages);
  let assessment = assessArtifact(output, request);
  const firstPassValid = assessment.valid;
  let repairAttempts = 0;
  while (!assessment.valid && repairAttempts < 2) {
    repairAttempts += 1;
    messages.push({ role: 'assistant', content: output });
    messages.push({ role: 'user', content: `Repair the artifact and return the same JSON shape. Findings: ${assessment.issues.map((issue: { code: string; message: string }) => `${issue.code}: ${issue.message}`).join('; ')}` });
    output = await complete(messages);
    assessment = assessArtifact(output, request);
  }
  return {
    id: entry.id,
    firstPassValid,
    finalValid: assessment.valid,
    repairAttempts,
    latencyMs: Math.round(performance.now() - started),
    heuristicChecks: assessment.checks,
    issues: assessment.issues,
  };
}

async function main() {
  const manifest = JSON.parse(await readFile(resolve(repoRoot, 'evals/model/artifact-requests.json'), 'utf8')) as Manifest;
  const results = [];
  for (const entry of manifest.cases) {
    process.stdout.write(`Evaluating ${entry.id}… `);
    const result = await evaluate(entry);
    console.log(result.finalValid ? 'valid' : 'failed');
    results.push(result);
  }
  const checks = results.flatMap((result) => result.heuristicChecks);
  const summary = {
    ranAt: new Date().toISOString(), model, cases: results.length,
    firstPassRate: results.filter((result) => result.firstPassValid).length / results.length,
    finalPassRate: results.filter((result) => result.finalValid).length / results.length,
    heuristicFidelityRate: checks.filter((check: { passed: boolean }) => check.passed).length / checks.length,
    medianLatencyMs: results.map((result) => result.latencyMs).sort((a, b) => a - b)[Math.floor(results.length / 2)],
    results,
  };
  await mkdir(resolve(repoRoot, 'evals/model/results'), { recursive: true });
  await writeFile(resolve(repoRoot, 'evals/model/results/latest.json'), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));
  if (summary.firstPassRate < manifest.minimumFirstPassRate || summary.finalPassRate < manifest.minimumFinalPassRate || summary.heuristicFidelityRate < manifest.minimumHeuristicFidelityRate) process.exitCode = 1;
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
