import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { OpenAiCompatibleProvider } from "../../services/studio-api/src/ai/openAiCompatibleProvider";
import type {
  DesignCard,
  Exemplar,
  TeacherBrief,
} from "../../services/studio-api/src/ai/provider";
import {
  InvalidModelOutputError,
  validateHtmlOutput,
} from "../../services/studio-api/src/generation";
import { assessArtifact } from "./artifact-eval.mjs";

interface EvalCase {
  id: string;
  brief: TeacherBrief;
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

interface SeedManifest {
  seeds: Array<{
    id: string;
    filename: string;
    subject: string;
    level: string;
    descriptor: string;
    designCard: DesignCard;
  }>;
}

const repoRoot = resolve(process.env.INIT_CWD ?? process.cwd());
const model = process.env.EVAL_MODEL ?? "deepseek-v4-flash";
const baseUrl = (
  process.env.EVAL_BASE_URL ?? "https://api.deepseek.com"
).replace(/\/$/, "");
const apiKey = process.env.DEEPSEEK_API_KEY ?? process.env.AI_API_KEY;
if (!apiKey)
  throw new Error(
    "Set DEEPSEEK_API_KEY or AI_API_KEY to run the live artifact eval.",
  );
const provider = new OpenAiCompatibleProvider({ baseUrl, apiKey, model });

function serialise(candidate: unknown): string {
  return typeof candidate === "string" ? candidate : JSON.stringify(candidate);
}

function normalise(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function loadExemplars(): Promise<Exemplar[]> {
  const directory = resolve(repoRoot, "examples/studio-html");
  const manifest = JSON.parse(
    await readFile(resolve(directory, "manifest.json"), "utf8"),
  ) as SeedManifest;
  return Promise.all(
    manifest.seeds.map(async (seed) => ({
      revisionId: `${seed.id}-seed`,
      html: await readFile(resolve(directory, seed.filename), "utf8"),
      designCard: seed.designCard,
      descriptor: seed.descriptor,
    })),
  );
}

async function evaluate(entry: EvalCase, seeds: Exemplar[], manifest: SeedManifest) {
  const request = {
    locale: entry.locale,
    expectedInteractions: entry.expectedInteractions,
    contentTerms: entry.contentTerms,
  };
  const subject = normalise(entry.brief.subject);
  const level = normalise(entry.brief.level);
  const exemplars = manifest.seeds
    .map((seed, index) => ({ seed, exemplar: seeds[index]! }))
    .filter(({ seed }) => normalise(seed.subject) === subject)
    .sort(
      (a, b) =>
        Number(normalise(b.seed.level) === level) -
        Number(normalise(a.seed.level) === level),
    )
    .slice(0, 2)
    .map(({ exemplar }) => exemplar);
  const started = performance.now();
  let output = await provider.generate(entry.brief, exemplars);
  let productionIssues: string[] = [];
  let productionValid = false;
  try {
    output = validateHtmlOutput(output);
    productionValid = true;
  } catch (error) {
    if (!(error instanceof InvalidModelOutputError)) throw error;
    productionIssues = error.issues;
  }
  const firstAssessment = assessArtifact(serialise(output), request);
  const firstPassValid = productionValid && firstAssessment.valid;
  let repairAttempts = 0;
  if (!productionValid) {
    repairAttempts += 1;
    output = await provider.repair(output, productionIssues);
    try {
      output = validateHtmlOutput(output);
      productionValid = true;
      productionIssues = [];
    } catch (error) {
      if (!(error instanceof InvalidModelOutputError)) throw error;
      productionIssues = error.issues;
    }
  }
  const assessment = assessArtifact(serialise(output), request);
  return {
    id: entry.id,
    firstPassValid,
    finalValid: productionValid && assessment.valid,
    repairAttempts,
    latencyMs: Math.round(performance.now() - started),
    exemplarRevisionIds: exemplars.map((exemplar) => exemplar.revisionId),
    heuristicChecks: assessment.checks,
    issues: [
      ...productionIssues.map((message) => ({ code: "production", message })),
      ...assessment.issues,
    ],
  };
}

async function main() {
  const manifest = JSON.parse(
    await readFile(
      resolve(repoRoot, "evals/model/artifact-requests.json"),
      "utf8",
    ),
  ) as Manifest;
  const seedManifest = JSON.parse(
    await readFile(
      resolve(repoRoot, "examples/studio-html/manifest.json"),
      "utf8",
    ),
  ) as SeedManifest;
  const exemplars = await loadExemplars();
  const results = [];
  for (const entry of manifest.cases) {
    process.stdout.write(`Evaluating ${entry.id}… `);
    const result = await evaluate(entry, exemplars, seedManifest);
    console.log(result.finalValid ? "valid" : "failed");
    results.push(result);
  }
  const checks = results.flatMap((result) => result.heuristicChecks);
  const summary = {
    ranAt: new Date().toISOString(),
    model,
    cases: results.length,
    firstPassRate:
      results.filter((result) => result.firstPassValid).length / results.length,
    finalPassRate:
      results.filter((result) => result.finalValid).length / results.length,
    heuristicFidelityRate:
      checks.filter((check: { passed: boolean }) => check.passed).length /
      checks.length,
    medianLatencyMs: results
      .map((result) => result.latencyMs)
      .sort((a, b) => a - b)[Math.floor(results.length / 2)],
    results,
  };
  await mkdir(resolve(repoRoot, "evals/model/results"), { recursive: true });
  await writeFile(
    resolve(repoRoot, "evals/model/results/latest.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
  );
  console.log(JSON.stringify(summary, null, 2));
  if (
    summary.firstPassRate < manifest.minimumFirstPassRate ||
    summary.finalPassRate < manifest.minimumFinalPassRate ||
    summary.heuristicFidelityRate < manifest.minimumHeuristicFidelityRate
  )
    process.exitCode = 1;
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
