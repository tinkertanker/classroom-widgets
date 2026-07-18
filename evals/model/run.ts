import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  validateWidgetSpec,
  type ValidationIssue,
  type WidgetSpec,
} from '../../packages/widget-spec/src/index.js';
import { OpenAiCompatibleProvider } from '../../services/studio-api/src/ai/openAiCompatibleProvider.js';
import type { TeacherBrief } from '../../services/studio-api/src/ai/provider.js';
import { patchWidgetSpec } from '../../services/studio-api/src/generation.js';

interface EvalCase {
  id: string;
  family: string;
  expectedKinds: string[];
  brief: TeacherBrief;
}

interface Manifest {
  minimumFirstPassRate: number;
  minimumFinalPassRate: number;
  minimumFamilyFidelityRate: number;
  cases: EvalCase[];
}

interface CaseResult {
  id: string;
  family: string;
  firstPassValid: boolean;
  finalValid: boolean;
  familyFidelity: boolean;
  repairAttempts: number;
  latencyMs: number;
  issues: ValidationIssue[];
  spec?: WidgetSpec;
}

const repoRoot = resolve(process.env.INIT_CWD ?? process.cwd());
const model = process.env.EVAL_MODEL ?? 'deepseek-v4-flash';
const apiKey = process.env.DEEPSEEK_API_KEY ?? process.env.AI_API_KEY;
if (!apiKey) throw new Error('Set DEEPSEEK_API_KEY or AI_API_KEY to run the live model eval.');

const provider = new OpenAiCompatibleProvider({
  baseUrl: process.env.EVAL_BASE_URL ?? 'https://api.deepseek.com',
  apiKey,
  model,
});

async function evaluate(entry: EvalCase): Promise<CaseResult> {
  const started = performance.now();
  let candidate = await provider.generate(entry.brief);
  let validation = validateWidgetSpec(candidate);
  const firstPassValid = validation.valid;
  let repairAttempts = 0;
  while (!validation.valid && repairAttempts < 2) {
    repairAttempts += 1;
    candidate = await provider.repair(candidate, validation.errors);
    validation = validateWidgetSpec(candidate);
  }
  if (!validation.valid) {
    return {
      id: entry.id,
      family: entry.family,
      firstPassValid,
      finalValid: false,
      familyFidelity: false,
      repairAttempts,
      latencyMs: Math.round(performance.now() - started),
      issues: validation.errors,
    };
  }

  const kinds = new Set(validation.value.screens.flatMap((screen) => screen.components.map((item) => item.kind)));
  const familyFidelity = entry.expectedKinds.every((kind) => kinds.has(kind));
  return {
    id: entry.id,
    family: entry.family,
    firstPassValid,
    finalValid: true,
    familyFidelity,
    repairAttempts,
    latencyMs: Math.round(performance.now() - started),
    issues: [],
    spec: validation.value,
  };
}

async function mapConcurrent<T, R>(items: T[], concurrency: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      const item = items[index];
      if (item !== undefined) results[index] = await work(item);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

async function main() {
  const manifest = JSON.parse(
    await readFile(resolve(repoRoot, 'evals/model/requests.json'), 'utf8'),
  ) as Manifest;
  const results = await mapConcurrent(manifest.cases, 3, async (entry) => {
    process.stdout.write(`Evaluating ${entry.id}… `);
    const result = await evaluate(entry);
    console.log(result.finalValid ? 'valid' : 'failed');
    return result;
  });

  const patchCandidates = results.filter((result) => result.spec).slice(0, 4);
  let patchPasses = 0;
  for (const result of patchCandidates) {
    try {
      await patchWidgetSpec(
        provider,
        result.spec!,
        'Make the student instructions more concise while preserving every activity and answer.',
      );
      patchPasses += 1;
    } catch {
      // Counted below; the detailed generation result remains available.
    }
  }

  const firstPassRate = results.filter((result) => result.firstPassValid).length / results.length;
  const finalPassRate = results.filter((result) => result.finalValid).length / results.length;
  const familyFidelityRate = results.filter((result) => result.familyFidelity).length / results.length;
  const patchReliabilityRate = patchCandidates.length === 0 ? 0 : patchPasses / patchCandidates.length;
  const summary = {
    ranAt: new Date().toISOString(),
    provider: provider.name,
    cases: results.length,
    firstPassRate,
    finalPassRate,
    familyFidelityRate,
    patchReliabilityRate,
    medianLatencyMs: results.map((result) => result.latencyMs).sort((a, b) => a - b)[Math.floor(results.length / 2)],
    results: results.map(({ spec: _spec, ...result }) => result),
  };

  await mkdir(resolve(repoRoot, 'evals/model/results'), { recursive: true });
  await writeFile(
    resolve(repoRoot, 'evals/model/results/latest.json'),
    `${JSON.stringify(summary, null, 2)}\n`,
    'utf8',
  );
  console.log(JSON.stringify(summary, null, 2));

  if (
    firstPassRate < manifest.minimumFirstPassRate ||
    finalPassRate < manifest.minimumFinalPassRate ||
    familyFidelityRate < manifest.minimumFamilyFidelityRate ||
    patchReliabilityRate < 1
  ) {
    process.exitCode = 1;
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
