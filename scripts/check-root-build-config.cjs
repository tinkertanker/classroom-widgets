const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const rootPackagePath = path.join(rootDir, 'package.json');
const rootPackage = JSON.parse(fs.readFileSync(rootPackagePath, 'utf8'));

const buildScript = rootPackage.scripts && rootPackage.scripts.build;
const buildAllScript = rootPackage.scripts && rootPackage.scripts['build:all'];

if (!buildScript) {
  throw new Error('Root package.json must define scripts.build');
}

// Workspace packages are declared in pnpm-workspace.yaml, not package.json.
// Parse the (simple, flat) `packages:` list without pulling in a YAML dep.
function readWorkspaceGlobs() {
  const workspaceFile = path.join(rootDir, 'pnpm-workspace.yaml');
  const lines = fs.readFileSync(workspaceFile, 'utf8').split(/\r?\n/);
  const globs = [];
  let inPackages = false;
  for (const rawLine of lines) {
    const line = rawLine.replace(/#.*$/, '');
    if (/^packages:\s*$/.test(line)) {
      inPackages = true;
      continue;
    }
    if (inPackages) {
      const match = line.match(/^\s*-\s*['"]?([^'"]+?)['"]?\s*$/);
      if (match) {
        globs.push(match[1]);
      } else if (line.trim() !== '') {
        // A non-list, non-blank line ends the packages block.
        break;
      }
    }
  }
  return globs;
}

const workspaceGlobs = readWorkspaceGlobs();

// If the parser found nothing, pnpm-workspace.yaml has drifted into a shape this
// hand-rolled reader does not understand (e.g. an inline `packages: [...]` list).
// Fail loudly rather than let every downstream check pass vacuously.
if (workspaceGlobs.length === 0) {
  throw new Error(
    'check-root-build-config: parsed no packages from pnpm-workspace.yaml — the parser is out of date'
  );
}

// This reader only handles plain directory paths. A real glob (`packages/*`)
// would need fs traversal; assert instead of crashing with a raw ENOENT.
const buildableWorkspaces = workspaceGlobs
  .map((workspacePath) => {
    if (workspacePath.includes('*')) {
      throw new Error(
        `check-root-build-config: glob workspace path "${workspacePath}" is not supported by this check`
      );
    }
    const packagePath = path.join(rootDir, workspacePath, 'package.json');
    const workspacePackage = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

    return {
      name: workspacePackage.name,
      hasBuild: Boolean(workspacePackage.scripts && workspacePackage.scripts.build),
    };
  })
  .filter((workspace) => workspace.hasBuild);

// `pnpm --recursive --if-present build` (or the `-r` short form) fans the build
// out to every workspace package that defines a build script.
const usesRecursiveFanout =
  /\spnpm\s/.test(` ${buildScript} `) &&
  /\s(--recursive|-r)(?:\s|$)/.test(` ${buildScript} `) &&
  /\s--if-present(?:\s|$)/.test(` ${buildScript} `);

const explicitlyBuildsEveryWorkspace = buildableWorkspaces.every((workspace) =>
  buildScript.includes(`--filter ${workspace.name}`) ||
  buildScript.includes(`--filter=${workspace.name}`)
);

if (!usesRecursiveFanout && !explicitlyBuildsEveryWorkspace) {
  throw new Error(
    `Root scripts.build must cover buildable workspaces: ${buildableWorkspaces
      .map((workspace) => workspace.name)
      .join(', ')}`
  );
}

if (buildAllScript && buildAllScript !== 'pnpm run build') {
  throw new Error('Root scripts.build:all must stay aligned with scripts.build');
}
