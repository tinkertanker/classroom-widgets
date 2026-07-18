import Ajv2020 from "ajv/dist/2020.js";
import standaloneCode from "ajv/dist/standalone/index.js";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const schemaPath = resolve(packageRoot, "schema/widget-spec-v1.schema.json");
const outputPath = resolve(packageRoot, "src/generated/widget-spec-validator.js");

const schema = JSON.parse(await readFile(schemaPath, "utf8"));
const ajv = new Ajv2020({
  allErrors: true,
  code: { esm: true, source: true },
  strict: true,
  validateFormats: false,
});
const validate = ajv.compile(schema);
const generated = standaloneCode(ajv, validate)
  .replace(
    '"use strict";',
    '"use strict";import equal from "ajv/dist/runtime/equal.js";import ucs2length from "ajv/dist/runtime/ucs2length.js";',
  )
  .replace(
    'const func0 = require("ajv/dist/runtime/equal").default;',
    'const func0 = typeof equal === "function" ? equal : equal.default;',
  )
  .replace(
    'const func1 = require("ajv/dist/runtime/ucs2length").default;',
    'const func1 = typeof ucs2length === "function" ? ucs2length : ucs2length.default;',
  );

if (generated.includes('require(')) {
  throw new Error('The standalone validator contains an unsupported CommonJS runtime helper.');
}

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(
  outputPath,
  `// Generated from schema/widget-spec-v1.schema.json. Do not edit by hand.\n${generated}\n`,
  "utf8",
);
