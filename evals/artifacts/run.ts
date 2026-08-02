import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import {
  validateHtmlArtifact,
  validateSeedManifest,
} from "../../scripts/lib/studio-html-artifact.mjs";

const repoRoot = path.resolve(process.env.INIT_CWD ?? process.cwd());
const directory = path.join(repoRoot, "examples", "studio-html");

async function main(): Promise<void> {
  const manifest = JSON.parse(
    await readFile(path.join(directory, "manifest.json"), "utf8"),
  );
  const manifestIssues = validateSeedManifest(manifest, { expectedCount: 14 });
  if (manifestIssues.length)
    throw new Error(
      `HTML artifact corpus failed:\n- ${manifestIssues.map((issue: { message: string }) => `manifest: ${issue.message}`).join("\n- ")}`,
    );
  const failures: string[] = [];
  const listed = new Set<string>();
  for (const seed of manifest.seeds ?? []) {
    listed.add(seed.filename);
    let html: string;
    try {
      html = await readFile(path.join(directory, seed.filename), "utf8");
    } catch {
      failures.push(`${seed.id}: source file is missing.`);
      continue;
    }
    const result = validateHtmlArtifact(html);
    result.issues.forEach((issue: { code: string; message: string }) =>
      failures.push(`${seed.id} [${issue.code}]: ${issue.message}`),
    );
    if (!html.includes(`<title>${seed.title}</title>`))
      failures.push(
        `${seed.id}: manifest title differs from the document title.`,
      );
    if (!new RegExp(`<html\\b[^>]*lang=["']${seed.locale}["']`, "i").test(html))
      failures.push(`${seed.id}: manifest locale differs from html lang.`);
  }
  const htmlFiles = (await readdir(directory)).filter((file) =>
    file.endsWith(".html"),
  );
  htmlFiles
    .filter((file) => !listed.has(file))
    .forEach((file) => failures.push(`${file}: not listed in manifest.`));
  if (failures.length)
    throw new Error(
      `Studio HTML artifact corpus failed:\n- ${failures.join("\n- ")}`,
    );
  const subjects = new Set(
    manifest.seeds.map((seed: { subject: string }) => seed.subject),
  );
  const levels = new Set(
    manifest.seeds.map((seed: { level: string }) => seed.level),
  );
  if (
    !["science", "mathematics", "english", "humanities"].every((subject) =>
      subjects.has(subject),
    )
  )
    throw new Error("Core subject coverage is incomplete.");
  if (!["upper-primary", "secondary"].every((level) => levels.has(level)))
    throw new Error("Level coverage is incomplete.");
  console.log(
    `HTML artifact corpus evaluation passed: ${manifest.seeds.length} seeds, ${subjects.size} subjects, ${levels.size} levels.`,
  );
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
