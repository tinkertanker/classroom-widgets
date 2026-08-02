import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  validateHtmlArtifact,
  validateSeedManifest,
} from "./lib/studio-html-artifact.mjs";

interface SeedRecord {
  id: string;
  filename: string;
  title: string;
  summary: string;
  subject: string;
  level: string;
  locale: string;
  learningObjective: string;
  tags: string[];
}

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const sourceDirectory = path.join(repoRoot, "examples", "studio-html");
const bundledDirectory = path.join(
  repoRoot,
  "apps",
  "ipad",
  "Resources",
  "Examples",
);

async function main(): Promise<void> {
  const sourceManifest = JSON.parse(
    await readFile(path.join(sourceDirectory, "manifest.json"), "utf8"),
  ) as { seeds?: SeedRecord[] };
  const manifestIssues = validateSeedManifest(sourceManifest, {
    expectedCount: 14,
  });
  if (manifestIssues.length > 0 || !sourceManifest.seeds) {
    throw new Error(
      `The canonical Studio seed manifest is invalid:\n${manifestIssues
        .map((issue: { message: string }) => `- ${issue.message}`)
        .join("\n")}`,
    );
  }

  const expectedManifest = sourceManifest.seeds.map((seed) => ({
    id: seed.id,
    title: seed.title,
    summary: seed.summary,
    subject: seed.subject,
    level: seed.level,
    locale: seed.locale,
    learningObjective: seed.learningObjective,
    tags: seed.tags,
    htmlFile: seed.filename,
  }));
  const bundledManifest = JSON.parse(
    await readFile(path.join(bundledDirectory, "manifest.json"), "utf8"),
  ) as unknown;
  if (JSON.stringify(bundledManifest) !== JSON.stringify(expectedManifest)) {
    throw new Error("The bundled iPad example manifest is stale.");
  }

  const expectedFiles = new Set(["manifest.json"]);
  for (const seed of sourceManifest.seeds) {
    expectedFiles.add(seed.filename);
    const [source, bundled] = await Promise.all([
      readFile(path.join(sourceDirectory, seed.filename), "utf8"),
      readFile(path.join(bundledDirectory, seed.filename), "utf8"),
    ]);
    const validation = validateHtmlArtifact(bundled);
    if (!validation.valid) {
      throw new Error(`Bundled Studio example ${seed.id} is invalid.`);
    }
    if (source !== bundled) {
      throw new Error(`Bundled Studio example ${seed.id} is stale.`);
    }
  }

  const bundledFiles = (
    await readdir(bundledDirectory, { withFileTypes: true })
  )
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name);
  const unexpectedFiles = bundledFiles.filter(
    (file) => !expectedFiles.has(file),
  );
  const missingFiles = [...expectedFiles].filter(
    (file) => !bundledFiles.includes(file),
  );
  if (unexpectedFiles.length > 0 || missingFiles.length > 0) {
    throw new Error(
      `The bundled Studio gallery has mismatched files: ${[
        ...missingFiles.map((file) => `missing ${file}`),
        ...unexpectedFiles.map((file) => `unexpected ${file}`),
      ].join(", ")}.`,
    );
  }

  process.stdout.write(
    `Studio iPad resources match all ${sourceManifest.seeds.length} canonical HTML examples.\n`,
  );
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(
    `${message}\nRun npm run ipad:prepare to refresh generated iPad resources.\n`,
  );
  process.exitCode = 1;
});
