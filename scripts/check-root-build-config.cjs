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

const workspacePaths = rootPackage.workspaces || [];
const buildableWorkspaces = workspacePaths
  .map((workspacePath) => {
    const packagePath = path.join(rootDir, workspacePath, 'package.json');
    const workspacePackage = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

    return {
      name: workspacePackage.name,
      hasBuild: Boolean(workspacePackage.scripts && workspacePackage.scripts.build),
    };
  })
  .filter((workspace) => workspace.hasBuild);

const usesWorkspaceFanout =
  /\s--workspaces(?:\s|$)/.test(` ${buildScript} `) &&
  /\s--if-present(?:\s|$)/.test(` ${buildScript} `);

const explicitlyBuildsEveryWorkspace = buildableWorkspaces.every((workspace) =>
  buildScript.includes(`-w ${workspace.name}`) ||
  buildScript.includes(`--workspace ${workspace.name}`) ||
  buildScript.includes(`--workspace=${workspace.name}`)
);

if (!usesWorkspaceFanout && !explicitlyBuildsEveryWorkspace) {
  throw new Error(
    `Root scripts.build must cover buildable workspaces: ${buildableWorkspaces
      .map((workspace) => workspace.name)
      .join(', ')}`
  );
}

if (buildAllScript && buildAllScript !== 'npm run build') {
  throw new Error('Root scripts.build:all must stay aligned with scripts.build');
}
