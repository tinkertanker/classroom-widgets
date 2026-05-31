const fs = require("fs");
const path = require("path");

const root = process.cwd();
const packagesDir = path.join(root, "packages");
const targets = [path.join(root, "node_modules")];

if (fs.existsSync(packagesDir)) {
  for (const name of fs.readdirSync(packagesDir)) {
    targets.push(path.join(packagesDir, name, "node_modules"));
  }
}

for (const target of targets) {
  fs.rmSync(target, { recursive: true, force: true });
}
