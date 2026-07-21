import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  validateWidgetSpec,
  type WidgetComponent,
  type WidgetSpec,
} from "../../packages/widget-spec/src/index.js";

const FAMILY_NAMES = [
  "quiz-retrieval",
  "matching-sorting-sequencing",
  "diagram-hotspots",
  "graph-simulation",
  "ready-tools",
] as const;

type Family = (typeof FAMILY_NAMES)[number];

interface Expectations {
  componentKinds: WidgetComponent["kind"][];
  minimumInteractiveComponents: number;
  requiresInstructionText?: boolean;
  minimumFeedbackComponents?: number;
  minimumAssets?: number;
  minimumVariables?: number;
  minimumHotspots?: number;
  minimumPlotSeries?: number;
}

interface CorpusCase {
  file: string;
  family: Family;
  subject: string;
  level: string;
  expect: Expectations;
}

interface CorpusManifest {
  minimumCorpusSize: number;
  minimumPerFamily: Record<Family, number>;
  requiredSubjects: string[];
  requiredLevels: string[];
  requiredSubjectLevels: Record<string, string[]>;
  cases: CorpusCase[];
}

const INTERACTIVE_KINDS = new Set<WidgetComponent["kind"]>([
  "choiceQuestion",
  "shortAnswerQuestion",
  "matching",
  "sorting",
  "sequencing",
  "hotspots",
  "numberControl",
  "toggleControl",
  "selectControl",
  "timer",
  "randomiser",
  "taskList",
  "trafficLight",
]);

const FEEDBACK_KINDS = new Set<WidgetComponent["kind"]>([
  "choiceQuestion",
  "shortAnswerQuestion",
  "matching",
  "sorting",
  "sequencing",
]);

const repoRoot = resolve(process.env.INIT_CWD ?? process.cwd());
const manifestPath = resolve(repoRoot, "evals/widget-spec/corpus.json");
const failures: string[] = [];

function record(condition: boolean, message: string): void {
  if (!condition) failures.push(message);
}

function countBy<T extends string>(values: readonly T[]): Map<T, number> {
  const counts = new Map<T, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return counts;
}

function flattenComponents(spec: WidgetSpec): WidgetComponent[] {
  return spec.screens.flatMap((screen) => screen.components);
}

function checkGeneralQuality(entry: CorpusCase, spec: WidgetSpec): void {
  const label = entry.file;
  const components = flattenComponents(spec);
  const kinds = new Set(components.map((component) => component.kind));
  const interactiveCount = components.filter((component) => INTERACTIVE_KINDS.has(component.kind)).length;
  const feedbackComponents = components.filter((component) => FEEDBACK_KINDS.has(component.kind));
  const hotspots = components
    .filter((component): component is Extract<WidgetComponent, { kind: "hotspots" }> => component.kind === "hotspots")
    .flatMap((component) => component.hotspots);
  const plotSeries = components
    .filter((component): component is Extract<WidgetComponent, { kind: "plot" }> => component.kind === "plot")
    .flatMap((component) => component.series);

  record(spec.metadata.subject === entry.subject, `${label}: expected subject ${entry.subject}`);
  record(spec.metadata.level === entry.level, `${label}: expected level ${entry.level}`);
  record(typeof spec.metadata.locale === "string", `${label}: metadata.locale is required for the example corpus`);
  record(
    (spec.metadata.learningObjective?.length ?? 0) >= 24,
    `${label}: learning objective must be explicit and substantial`,
  );
  record(
    (spec.metadata.tags?.length ?? 0) >= 3,
    `${label}: include at least three discoverability tags`,
  );
  if (entry.expect.requiresInstructionText ?? true) {
    record(
      components.some((component) => component.kind === "text" && component.role === "instruction"),
      `${label}: include student-facing instructions`,
    );
  }
  record(
    interactiveCount >= entry.expect.minimumInteractiveComponents,
    `${label}: expected at least ${entry.expect.minimumInteractiveComponents} interactive components; found ${interactiveCount}`,
  );
  entry.expect.componentKinds.forEach((kind) => {
    record(kinds.has(kind), `${label}: expected component kind ${kind}`);
  });
  record(
    feedbackComponents.length >= (entry.expect.minimumFeedbackComponents ?? 0),
    `${label}: expected at least ${entry.expect.minimumFeedbackComponents ?? 0} feedback components; found ${feedbackComponents.length}`,
  );
  record(
    spec.assets.length >= (entry.expect.minimumAssets ?? 0),
    `${label}: expected at least ${entry.expect.minimumAssets ?? 0} assets; found ${spec.assets.length}`,
  );
  record(
    spec.variables.length >= (entry.expect.minimumVariables ?? 0),
    `${label}: expected at least ${entry.expect.minimumVariables ?? 0} variables; found ${spec.variables.length}`,
  );
  record(
    hotspots.length >= (entry.expect.minimumHotspots ?? 0),
    `${label}: expected at least ${entry.expect.minimumHotspots ?? 0} hotspots; found ${hotspots.length}`,
  );
  record(
    plotSeries.length >= (entry.expect.minimumPlotSeries ?? 0),
    `${label}: expected at least ${entry.expect.minimumPlotSeries ?? 0} plot series; found ${plotSeries.length}`,
  );

  feedbackComponents.forEach((component) => {
    if (!("feedback" in component)) return;
    record(component.feedback.correct.length >= 12, `${label}: ${component.id} correct feedback is too terse`);
    record(component.feedback.incorrect.length >= 12, `${label}: ${component.id} incorrect feedback is too terse`);
    record(
      component.feedback.correct !== component.feedback.incorrect,
      `${label}: ${component.id} must give distinct correct and incorrect feedback`,
    );
  });

  components.forEach((component) => {
    if (component.kind === "hotspots") {
      record(component.altText.length >= 24, `${label}: ${component.id} needs useful diagram alternative text`);
      component.hotspots.forEach((hotspot) => {
        record(hotspot.reveal.length >= 32, `${label}: ${hotspot.id} reveal needs explanatory detail`);
      });
    }
    if (component.kind === "plot") {
      record((component.description?.length ?? 0) >= 24, `${label}: ${component.id} needs an axis-aware description`);
    }
  });

  record(!JSON.stringify(spec).includes("TODO"), `${label}: unresolved TODO marker found`);
}

async function main(): Promise<void> {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as CorpusManifest;
  const familyCounts = countBy(manifest.cases.map((entry) => entry.family));
  const subjectCounts = countBy(manifest.cases.map((entry) => entry.subject));
  const levelCounts = countBy(manifest.cases.map((entry) => entry.level));
  const seenIds = new Set<string>();
  const seenTitles = new Set<string>();

  record(
    manifest.cases.length >= manifest.minimumCorpusSize,
    `corpus: expected at least ${manifest.minimumCorpusSize} examples; found ${manifest.cases.length}`,
  );
  FAMILY_NAMES.forEach((family) => {
    const minimum = manifest.minimumPerFamily[family];
    record(Number.isInteger(minimum) && minimum >= 1, `corpus: ${family} needs a positive integer minimum`);
    if (Number.isInteger(minimum) && minimum >= 1) {
      record(
        (familyCounts.get(family) ?? 0) >= minimum,
        `corpus: ${family} needs at least ${minimum} examples`,
      );
    }
  });
  manifest.requiredSubjects.forEach((subject) => {
    record((subjectCounts.get(subject) ?? 0) > 0, `corpus: missing required subject ${subject}`);
  });
  manifest.requiredLevels.forEach((level) => {
    record((levelCounts.get(level) ?? 0) > 0, `corpus: missing required level ${level}`);
  });
  Object.entries(manifest.requiredSubjectLevels).forEach(([subject, levels]) => {
    levels.forEach((level) => {
      record(
        manifest.cases.some((entry) => entry.subject === subject && entry.level === level),
        `corpus: missing required ${subject} example at level ${level}`,
      );
    });
  });

  for (const entry of manifest.cases) {
    const source = JSON.parse(await readFile(resolve(repoRoot, entry.file), "utf8")) as unknown;
    const validation = validateWidgetSpec(source);
    if (!validation.valid) {
      failures.push(
        `${entry.file}: WidgetSpec validation failed\n${validation.errors
          .map((issue) => `  ${issue.path} [${issue.code}] ${issue.message}`)
          .join("\n")}`,
      );
      continue;
    }

    const spec = validation.value;
    record(!seenIds.has(spec.id), `${entry.file}: duplicate corpus ID ${spec.id}`);
    record(!seenTitles.has(spec.metadata.title), `${entry.file}: duplicate corpus title ${spec.metadata.title}`);
    seenIds.add(spec.id);
    seenTitles.add(spec.metadata.title);
    checkGeneralQuality(entry, spec);
  }

  if (failures.length > 0) {
    console.error(`WidgetSpec corpus evaluation failed with ${failures.length} finding(s):`);
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exitCode = 1;
    return;
  }

  console.log(`WidgetSpec corpus evaluation passed: ${manifest.cases.length} examples.`);
  console.log(`Families: ${FAMILY_NAMES.map((family) => `${family}=${familyCounts.get(family) ?? 0}`).join(", ")}`);
  console.log(`Subjects: ${[...subjectCounts].map(([subject, count]) => `${subject}=${count}`).join(", ")}`);
  console.log(`Levels: ${[...levelCounts].map(([level, count]) => `${level}=${count}`).join(", ")}`);
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
