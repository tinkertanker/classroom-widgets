import type { ErrorObject } from "ajv";
import widgetSpecV1Schema from "../schema/widget-spec-v1.schema.json" with { type: "json" };
import { DEFAULT_EXPRESSION_LIMITS } from "./expression.js";
import validateStructure from "./generated/widget-spec-validator.js";
import type {
  ImageContent,
  ItemContent,
  NumericExpression,
  ValidationIssue,
  ValidationResult,
  VariableSpec,
  WidgetComponent,
  WidgetSpec,
} from "./types.js";

const MAX_SERIALISED_SPEC_BYTES = 512 * 1024;
const MAX_INPUT_DEPTH = 64;
const MAX_INPUT_NODES = 20_000;

const FORBIDDEN_KEYS = new Set([
  "__proto__",
  "classname",
  "code",
  "constructor",
  "css",
  "endpoint",
  "fetch",
  "headers",
  "href",
  "html",
  "javascript",
  "network",
  "prototype",
  "request",
  "script",
  "src",
  "style",
  "url",
]);

const FORBIDDEN_CONTENT_PATTERNS: ReadonlyArray<{
  readonly pattern: RegExp;
  readonly description: string;
}> = [
  {
    pattern: /<\s*(?:script|iframe|object|embed|link|style)\b/i,
    description: "executable or embeddable HTML",
  },
  { pattern: /javascript\s*:/i, description: "a JavaScript URL" },
  { pattern: /data\s*:\s*text\/html/i, description: "an inline HTML document" },
];

const EXPECTED_KIND_BY_DEFINITION: Readonly<Record<string, string>> = {
  numberVariable: "number",
  booleanVariable: "boolean",
  choiceVariable: "choice",
  literalExpression: "literal",
  constantExpression: "constant",
  variableExpression: "variable",
  unaryExpression: "unary",
  binaryExpression: "binary",
  clampExpression: "clamp",
  textContent: "text",
  imageContent: "image",
  circleHotspot: "circle",
  rectangleHotspot: "rectangle",
  textComponent: "text",
  imageComponent: "image",
  timerComponent: "timer",
  randomiserComponent: "randomiser",
  taskListComponent: "taskList",
  trafficLightComponent: "trafficLight",
  choiceQuestionComponent: "choiceQuestion",
  shortAnswerQuestionComponent: "shortAnswerQuestion",
  matchingComponent: "matching",
  sortingComponent: "sorting",
  sequencingComponent: "sequencing",
  hotspotsComponent: "hotspots",
  numberControlComponent: "numberControl",
  toggleControlComponent: "toggleControl",
  selectControlComponent: "selectControl",
  valueDisplayComponent: "valueDisplay",
  plotComponent: "plot",
};

function escapeJsonPointer(value: string): string {
  return value.replaceAll("~", "~0").replaceAll("/", "~1");
}

function childPath(path: string, key: string | number): string {
  return `${path}/${escapeJsonPointer(String(key))}`;
}

function normalisePath(path: string): string {
  return path.length === 0 ? "/" : path;
}

function unescapeJsonPointer(value: string): string {
  return value.replaceAll("~1", "/").replaceAll("~0", "~");
}

function nearestDiscriminator(input: unknown, instancePath: string): string | undefined {
  const values: unknown[] = [input];
  let current = input;
  const segments = instancePath
    .split("/")
    .slice(1)
    .map(unescapeJsonPointer);
  for (const segment of segments) {
    if (current === null || typeof current !== "object") break;
    current = Array.isArray(current)
      ? current[Number.parseInt(segment, 10)]
      : Reflect.get(current, segment);
    values.push(current);
  }

  for (let index = values.length - 1; index >= 0; index -= 1) {
    const value = values[index];
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      const kind = Reflect.get(value, "kind");
      if (typeof kind === "string") return kind;
    }
  }
  return undefined;
}

function relevantSchemaErrors(input: unknown, errors: ErrorObject[]): ErrorObject[] {
  const branchFiltered = errors.filter((error) => {
    const definition = /\/\$defs\/([^/]+)/.exec(error.schemaPath)?.[1];
    if (definition === undefined) return true;
    const expectedKind = EXPECTED_KIND_BY_DEFINITION[definition];
    if (expectedKind === undefined) return true;
    const actualKind = nearestDiscriminator(input, error.instancePath);
    return actualKind === undefined || actualKind === expectedKind;
  });

  return branchFiltered.filter((error) => {
    if (error.keyword !== "oneOf" && error.keyword !== "if") return true;
    return !branchFiltered.some(
      (candidate) =>
        candidate !== error &&
        candidate.keyword !== "oneOf" &&
        candidate.keyword !== "if" &&
        (candidate.instancePath === error.instancePath ||
          candidate.instancePath.startsWith(`${error.instancePath}/`)),
    );
  });
}

function sortAndDedupeIssues(issues: ValidationIssue[]): ValidationIssue[] {
  const seen = new Set<string>();
  return issues
    .sort(
      (left, right) =>
        left.path.localeCompare(right.path) ||
        left.code.localeCompare(right.code) ||
        left.message.localeCompare(right.message),
    )
    .filter((issue) => {
      const key = `${issue.path}\u0000${issue.code}\u0000${issue.message}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function schemaErrorPath(error: ErrorObject): string {
  if (error.keyword === "required") {
    const missingProperty = (error.params as { missingProperty?: unknown }).missingProperty;
    if (typeof missingProperty === "string") {
      return normalisePath(childPath(error.instancePath, missingProperty));
    }
  }
  if (error.keyword === "additionalProperties") {
    const property = (error.params as { additionalProperty?: unknown }).additionalProperty;
    if (typeof property === "string") {
      return normalisePath(childPath(error.instancePath, property));
    }
  }
  return normalisePath(error.instancePath);
}

function schemaErrorMessage(error: ErrorObject): string {
  if (error.keyword === "additionalProperties") {
    const property = (error.params as { additionalProperty?: unknown }).additionalProperty;
    if (typeof property === "string") {
      return `Property “${property}” is not allowed.`;
    }
  }
  if (error.keyword === "required") {
    const missingProperty = (error.params as { missingProperty?: unknown }).missingProperty;
    if (typeof missingProperty === "string") {
      return `Required property “${missingProperty}” is missing.`;
    }
  }
  return error.message === undefined
    ? `The value does not satisfy ${error.keyword}.`
    : `The value ${error.message}.`;
}

function mapSchemaErrors(errors: ErrorObject[] | null | undefined): ValidationIssue[] {
  return (errors ?? []).map((error) => ({
    path: schemaErrorPath(error),
    code: `schema.${error.keyword}`,
    message: schemaErrorMessage(error),
  }));
}

function scanForUnsafeInput(input: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const ancestors = new WeakSet<object>();
  type WorkItem =
    | { readonly value: unknown; readonly path: string; readonly depth: number }
    | { readonly exit: object };
  const stack: WorkItem[] = [{ value: input, path: "", depth: 0 }];
  let nodes = 0;

  while (stack.length > 0) {
    const item = stack.pop();
    if (item === undefined) break;
    if ("exit" in item) {
      ancestors.delete(item.exit);
      continue;
    }
    const { value, path, depth } = item;
    if (typeof value === "string") {
      for (const forbidden of FORBIDDEN_CONTENT_PATTERNS) {
        if (forbidden.pattern.test(value)) {
          issues.push({
            path: normalisePath(path),
            code: "unsafe-content",
            message: `Text must not contain ${forbidden.description}.`,
          });
        }
      }
      continue;
    }

    if (value === null || typeof value !== "object") continue;
    nodes += 1;
    if (depth > MAX_INPUT_DEPTH) {
      issues.push({
        path: normalisePath(path),
        code: "input-too-deep",
        message: `A widget specification may be at most ${MAX_INPUT_DEPTH} levels deep.`,
      });
      break;
    }
    if (nodes > MAX_INPUT_NODES) {
      issues.push({
        path: "/",
        code: "input-too-complex",
        message: `A widget specification may contain at most ${MAX_INPUT_NODES} values.`,
      });
      break;
    }
    if (ancestors.has(value)) {
      issues.push({
        path: normalisePath(path),
        code: "cyclic-input",
        message: "A widget specification must be a JSON value and cannot contain cycles.",
      });
      continue;
    }

    ancestors.add(value);
    stack.push({ exit: value });
    if (Array.isArray(value)) {
      if (nodes + value.length > MAX_INPUT_NODES) {
        issues.push({
          path: normalisePath(path),
          code: "input-too-complex",
          message: `A widget specification may contain at most ${MAX_INPUT_NODES} values.`,
        });
        break;
      }
      for (let index = value.length - 1; index >= 0; index -= 1) {
        stack.push({ value: value[index], path: childPath(path, index), depth: depth + 1 });
      }
    } else {
      const entries = Object.entries(value);
      if (nodes + entries.length > MAX_INPUT_NODES) {
        issues.push({
          path: normalisePath(path),
          code: "input-too-complex",
          message: `A widget specification may contain at most ${MAX_INPUT_NODES} values.`,
        });
        break;
      }
      for (let index = entries.length - 1; index >= 0; index -= 1) {
        const pair = entries[index];
        if (!pair) continue;
        const [key, entry] = pair;
        const entryPath = childPath(path, key);
        const normalisedKey = key.toLowerCase();
        if (
          FORBIDDEN_KEYS.has(normalisedKey) ||
          /^on(?:blur|click|error|focus|key|load|mouse|pointer|submit|touch)/i.test(key)
        ) {
          issues.push({
            path: normalisePath(entryPath),
            code: "unsafe-field",
            message: `Field “${key}” is forbidden in a declarative widget specification.`,
          });
        }
        stack.push({ value: entry, path: entryPath, depth: depth + 1 });
      }
    }
  }
  return issues;
}

function findDuplicateIds(
  entries: ReadonlyArray<{ readonly id: string }>,
  path: string,
  label: string,
  issues: ValidationIssue[],
): Set<string> {
  const ids = new Set<string>();
  entries.forEach((entry, index) => {
    if (ids.has(entry.id)) {
      issues.push({
        path: `${path}/${index}/id`,
        code: "duplicate-id",
        message: `${label} ID “${entry.id}” is duplicated.`,
      });
    }
    ids.add(entry.id);
  });
  return ids;
}

function checkImageContent(
  content: ItemContent,
  path: string,
  assetIds: ReadonlySet<string>,
  issues: ValidationIssue[],
): void {
  if (content.kind === "image" && !assetIds.has(content.assetId)) {
    issues.push({
      path: `${path}/assetId`,
      code: "unknown-asset",
      message: `Image asset “${content.assetId}” is not declared in assets.`,
    });
  }
}

interface ExpressionCheckState {
  count: number;
  readonly allowedVariableIds: ReadonlySet<string>;
  readonly issues: ValidationIssue[];
  readonly path: string;
}

function checkExpressionNode(
  expression: NumericExpression,
  state: ExpressionCheckState,
  depth: number,
): void {
  state.count += 1;
  if (state.count === DEFAULT_EXPRESSION_LIMITS.maxNodes + 1) {
    state.issues.push({
      path: state.path,
      code: "expression-too-large",
      message: `Expressions may contain at most ${DEFAULT_EXPRESSION_LIMITS.maxNodes} nodes.`,
    });
    return;
  }
  if (depth === DEFAULT_EXPRESSION_LIMITS.maxDepth + 1) {
    state.issues.push({
      path: state.path,
      code: "expression-too-deep",
      message: `Expressions may be at most ${DEFAULT_EXPRESSION_LIMITS.maxDepth} levels deep.`,
    });
    return;
  }

  switch (expression.kind) {
    case "literal":
    case "constant":
      return;
    case "variable":
      if (!state.allowedVariableIds.has(expression.variableId)) {
        state.issues.push({
          path: `${state.path}/variableId`,
          code: "unknown-numeric-variable",
          message: `Numeric variable “${expression.variableId}” is not available to this expression.`,
        });
      }
      return;
    case "unary":
      checkExpressionNode(expression.operand, state, depth + 1);
      return;
    case "binary":
      checkExpressionNode(expression.left, state, depth + 1);
      checkExpressionNode(expression.right, state, depth + 1);
      return;
    case "clamp":
      checkExpressionNode(expression.value, state, depth + 1);
      checkExpressionNode(expression.minimum, state, depth + 1);
      checkExpressionNode(expression.maximum, state, depth + 1);
      return;
  }
}

function checkExpression(
  expression: NumericExpression,
  path: string,
  allowedVariableIds: ReadonlySet<string>,
  issues: ValidationIssue[],
): void {
  checkExpressionNode(
    expression,
    { count: 0, allowedVariableIds, issues, path },
    1,
  );
}

function expectVariableKind(
  variableId: string,
  expectedKind: VariableSpec["kind"],
  path: string,
  variables: ReadonlyMap<string, VariableSpec>,
  issues: ValidationIssue[],
): void {
  const variable = variables.get(variableId);
  if (variable === undefined) {
    issues.push({
      path,
      code: "unknown-variable",
      message: `Variable “${variableId}” is not declared in variables.`,
    });
  } else if (variable.kind !== expectedKind) {
    issues.push({
      path,
      code: "wrong-variable-kind",
      message: `Variable “${variableId}” must be a ${expectedKind} variable, not ${variable.kind}.`,
    });
  }
}

function exactCoverage(
  expectedIds: ReadonlySet<string>,
  actualIds: readonly string[],
  path: string,
  noun: string,
  issues: ValidationIssue[],
): void {
  const actualSet = new Set(actualIds);
  for (const id of expectedIds) {
    if (!actualSet.has(id)) {
      issues.push({
        path,
        code: "missing-reference",
        message: `${noun} “${id}” has no answer mapping.`,
      });
    }
  }
  actualIds.forEach((id, index) => {
    if (!expectedIds.has(id)) {
      issues.push({
        path: `${path}/${index}`,
        code: "unknown-reference",
        message: `${noun} “${id}” does not exist.`,
      });
    }
    if (actualIds.indexOf(id) !== index) {
      issues.push({
        path: `${path}/${index}`,
        code: "duplicate-reference",
        message: `${noun} “${id}” is mapped more than once.`,
      });
    }
  });
}

function validateComponent(
  component: WidgetComponent,
  path: string,
  assets: ReadonlySet<string>,
  variables: ReadonlyMap<string, VariableSpec>,
  numericVariableIds: ReadonlySet<string>,
  issues: ValidationIssue[],
): void {
  switch (component.kind) {
    case "text":
      return;

    case "image":
      if (!assets.has(component.assetId)) {
        issues.push({
          path: `${path}/assetId`,
          code: "unknown-asset",
          message: `Image asset “${component.assetId}” is not declared in assets.`,
        });
      }
      return;

    case "timer":
    case "trafficLight":
      return;

    case "randomiser":
      findDuplicateIds(component.items, `${path}/items`, "Randomiser item", issues);
      return;

    case "taskList":
      findDuplicateIds(component.items, `${path}/items`, "Task list item", issues);
      return;

    case "choiceQuestion": {
      const optionIds = findDuplicateIds(
        component.options,
        `${path}/options`,
        "Choice option",
        issues,
      );
      component.options.forEach((option, index) =>
        checkImageContent(option.content, `${path}/options/${index}/content`, assets, issues),
      );
      component.correctOptionIds.forEach((id, index) => {
        if (!optionIds.has(id)) {
          issues.push({
            path: `${path}/correctOptionIds/${index}`,
            code: "unknown-option",
            message: `Correct option “${id}” is not present in options.`,
          });
        }
      });
      if (component.selectionMode === "single" && component.correctOptionIds.length !== 1) {
        issues.push({
          path: `${path}/correctOptionIds`,
          code: "single-choice-answer-count",
          message: "A single-choice question must have exactly one correct option.",
        });
      }
      return;
    }

    case "shortAnswerQuestion": {
      const normalised = component.acceptedAnswers.map((answer) => {
        let value = answer;
        if (component.normalisation.trimWhitespace) value = value.trim();
        if (component.normalisation.collapseWhitespace) value = value.replace(/\s+/g, " ");
        if (!component.normalisation.caseSensitive) value = value.toLocaleLowerCase("en");
        return value;
      });
      normalised.forEach((answer, index) => {
        if (answer.length === 0) {
          issues.push({
            path: `${path}/acceptedAnswers/${index}`,
            code: "empty-normalised-answer",
            message: "An accepted answer cannot become empty after normalisation.",
          });
        }
        if (normalised.indexOf(answer) !== index) {
          issues.push({
            path: `${path}/acceptedAnswers/${index}`,
            code: "duplicate-normalised-answer",
            message: `Accepted answer “${component.acceptedAnswers[index]}” duplicates another answer after normalisation.`,
          });
        }
      });
      return;
    }

    case "matching": {
      const itemIds = findDuplicateIds(component.items, `${path}/items`, "Matching item", issues);
      const targetIds = findDuplicateIds(
        component.targets,
        `${path}/targets`,
        "Matching target",
        issues,
      );
      component.items.forEach((item, index) =>
        checkImageContent(item.content, `${path}/items/${index}/content`, assets, issues),
      );
      component.targets.forEach((target, index) =>
        checkImageContent(target.content, `${path}/targets/${index}/content`, assets, issues),
      );
      exactCoverage(
        itemIds,
        component.correctMatches.map((pair) => pair.itemId),
        `${path}/correctMatches`,
        "Matching item",
        issues,
      );
      exactCoverage(
        targetIds,
        component.correctMatches.map((pair) => pair.targetId),
        `${path}/correctMatches`,
        "Matching target",
        issues,
      );
      return;
    }

    case "sorting": {
      const itemIds = findDuplicateIds(component.items, `${path}/items`, "Sorting item", issues);
      const categoryIds = findDuplicateIds(
        component.categories,
        `${path}/categories`,
        "Sorting category",
        issues,
      );
      component.items.forEach((item, index) =>
        checkImageContent(item.content, `${path}/items/${index}/content`, assets, issues),
      );
      exactCoverage(
        itemIds,
        component.correctPlacements.map((placement) => placement.itemId),
        `${path}/correctPlacements`,
        "Sorting item",
        issues,
      );
      component.correctPlacements.forEach((placement, index) => {
        if (!categoryIds.has(placement.categoryId)) {
          issues.push({
            path: `${path}/correctPlacements/${index}/categoryId`,
            code: "unknown-category",
            message: `Sorting category “${placement.categoryId}” does not exist.`,
          });
        }
      });
      return;
    }

    case "sequencing": {
      const itemIds = findDuplicateIds(component.items, `${path}/items`, "Sequence item", issues);
      component.items.forEach((item, index) =>
        checkImageContent(item.content, `${path}/items/${index}/content`, assets, issues),
      );
      exactCoverage(
        itemIds,
        component.correctOrder,
        `${path}/correctOrder`,
        "Sequence item",
        issues,
      );
      return;
    }

    case "hotspots":
      if (!assets.has(component.imageAssetId)) {
        issues.push({
          path: `${path}/imageAssetId`,
          code: "unknown-asset",
          message: `Image asset “${component.imageAssetId}” is not declared in assets.`,
        });
      }
      findDuplicateIds(component.hotspots, `${path}/hotspots`, "Hotspot", issues);
      component.hotspots.forEach((hotspot, index) => {
        const shapePath = `${path}/hotspots/${index}/shape`;
        if (hotspot.shape.kind === "circle") {
          const { centreX, centreY, radius } = hotspot.shape;
          if (
            centreX - radius < 0 ||
            centreX + radius > 1 ||
            centreY - radius < 0 ||
            centreY + radius > 1
          ) {
            issues.push({
              path: shapePath,
              code: "hotspot-out-of-bounds",
              message: "A circular hotspot must fit entirely within the image.",
            });
          }
        } else if (
          hotspot.shape.x + hotspot.shape.width > 1 ||
          hotspot.shape.y + hotspot.shape.height > 1
        ) {
          issues.push({
            path: shapePath,
            code: "hotspot-out-of-bounds",
            message: "A rectangular hotspot must fit entirely within the image.",
          });
        }
      });
      return;

    case "numberControl":
      expectVariableKind(
        component.variableId,
        "number",
        `${path}/variableId`,
        variables,
        issues,
      );
      return;

    case "toggleControl":
      expectVariableKind(
        component.variableId,
        "boolean",
        `${path}/variableId`,
        variables,
        issues,
      );
      return;

    case "selectControl":
      expectVariableKind(
        component.variableId,
        "choice",
        `${path}/variableId`,
        variables,
        issues,
      );
      return;

    case "valueDisplay":
      checkExpression(component.expression, `${path}/expression`, numericVariableIds, issues);
      return;

    case "plot": {
      if (component.domain.minimum >= component.domain.maximum) {
        issues.push({
          path: `${path}/domain`,
          code: "invalid-domain",
          message: "A plot domain’s minimum must be less than its maximum.",
        });
      } else {
        const sampleCount =
          (component.domain.maximum - component.domain.minimum) / component.domain.step;
        if (sampleCount > 2_000) {
          issues.push({
            path: `${path}/domain/step`,
            code: "too-many-plot-samples",
            message: "A plot may use at most 2,000 samples.",
          });
        }
      }
      if (component.range.minimum >= component.range.maximum) {
        issues.push({
          path: `${path}/range`,
          code: "invalid-range",
          message: "A plot range’s minimum must be less than its maximum.",
        });
      }
      if (variables.has(component.domain.variableId)) {
        issues.push({
          path: `${path}/domain/variableId`,
          code: "shadowed-variable",
          message: `Plot domain variable “${component.domain.variableId}” must not duplicate a widget variable.`,
        });
      }
      findDuplicateIds(component.series, `${path}/series`, "Plot series", issues);
      const plotVariableIds = new Set(numericVariableIds);
      plotVariableIds.add(component.domain.variableId);
      component.series.forEach((series, index) =>
        checkExpression(
          series.yExpression,
          `${path}/series/${index}/yExpression`,
          plotVariableIds,
          issues,
        ),
      );
      return;
    }
  }
}

function semanticIssues(spec: WidgetSpec): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const assetIds = findDuplicateIds(spec.assets, "/assets", "Asset", issues);
  findDuplicateIds(spec.screens, "/screens", "Screen", issues);
  const variableIds = findDuplicateIds(spec.variables, "/variables", "Variable", issues);
  const variables = new Map(spec.variables.map((variable) => [variable.id, variable]));
  const numericVariableIds = new Set(
    spec.variables
      .filter((variable) => variable.kind === "number")
      .map((variable) => variable.id),
  );

  spec.variables.forEach((variable, index) => {
    const path = `/variables/${index}`;
    if (variable.kind === "number") {
      if (variable.minimum >= variable.maximum) {
        issues.push({
          path,
          code: "invalid-variable-range",
          message: `Number variable “${variable.id}” must have a minimum below its maximum.`,
        });
      }
      if (variable.initial < variable.minimum || variable.initial > variable.maximum) {
        issues.push({
          path: `${path}/initial`,
          code: "initial-out-of-range",
          message: `Number variable “${variable.id}” starts outside its permitted range.`,
        });
      }
      if (variable.step > variable.maximum - variable.minimum) {
        issues.push({
          path: `${path}/step`,
          code: "step-exceeds-range",
          message: `Number variable “${variable.id}” has a step larger than its range.`,
        });
      }
    } else if (variable.kind === "choice") {
      const optionIds = findDuplicateIds(
        variable.options,
        `${path}/options`,
        "Choice variable option",
        issues,
      );
      if (!optionIds.has(variable.initialOptionId)) {
        issues.push({
          path: `${path}/initialOptionId`,
          code: "unknown-option",
          message: `Initial option “${variable.initialOptionId}” is not declared in options.`,
        });
      }
    }
  });

  const componentIds = new Set<string>();
  spec.screens.forEach((screen, screenIndex) => {
    screen.components.forEach((component, componentIndex) => {
      const path = `/screens/${screenIndex}/components/${componentIndex}`;
      if (componentIds.has(component.id)) {
        issues.push({
          path: `${path}/id`,
          code: "duplicate-id",
          message: `Component ID “${component.id}” is duplicated across screens.`,
        });
      }
      componentIds.add(component.id);
      validateComponent(
        component,
        path,
        assetIds,
        variables,
        numericVariableIds,
        issues,
      );
    });
  });

  // Avoid an accidental collision between top-level identifier namespaces.
  for (const id of assetIds) {
    if (variableIds.has(id)) {
      issues.push({
        path: "/variables",
        code: "cross-namespace-id-collision",
        message: `ID “${id}” is used by both an asset and a variable.`,
      });
    }
  }

  return issues;
}

/** Validates JSON shape, safety limits, references and cross-field invariants. */
export function validateWidgetSpec(input: unknown): ValidationResult {
  const safetyIssues = scanForUnsafeInput(input);
  const terminalSafetyCodes = new Set([
    "cyclic-input",
    "input-too-deep",
    "input-too-complex",
  ]);
  if (safetyIssues.some((issue) => terminalSafetyCodes.has(issue.code))) {
    return { valid: false, errors: sortAndDedupeIssues(safetyIssues) };
  }

  let serialisedLength = 0;
  try {
    serialisedLength = new TextEncoder().encode(JSON.stringify(input)).byteLength;
  } catch {
    safetyIssues.push({
      path: "/",
      code: "not-json-serialisable",
      message: "A widget specification must be serialisable as JSON.",
    });
  }
  if (serialisedLength > MAX_SERIALISED_SPEC_BYTES) {
    safetyIssues.push({
      path: "/",
      code: "spec-too-large",
      message: `A widget specification may be at most ${MAX_SERIALISED_SPEC_BYTES} bytes.`,
    });
  }

  if (safetyIssues.some((issue) => issue.code === "not-json-serialisable")) {
    return { valid: false, errors: sortAndDedupeIssues(safetyIssues) };
  }

  const structurallyValid = validateStructure(input);
  if (!structurallyValid) {
    return {
      valid: false,
      errors: sortAndDedupeIssues([
        ...safetyIssues,
        ...mapSchemaErrors(relevantSchemaErrors(input, validateStructure.errors ?? [])),
      ]),
    };
  }

  const errors = sortAndDedupeIssues([
    ...safetyIssues,
    ...semanticIssues(input),
  ]);
  return errors.length === 0
    ? { valid: true, value: input, errors: [] }
    : { valid: false, errors };
}

export function isWidgetSpec(input: unknown): input is WidgetSpec {
  return validateWidgetSpec(input).valid;
}

export class WidgetSpecValidationError extends Error {
  readonly issues: readonly ValidationIssue[];

  constructor(issues: readonly ValidationIssue[]) {
    const summary = issues
      .slice(0, 3)
      .map((issue) => `${issue.path}: ${issue.message}`)
      .join("; ");
    super(`Invalid WidgetSpec${summary.length > 0 ? ` — ${summary}` : "."}`);
    this.name = "WidgetSpecValidationError";
    this.issues = issues;
  }
}

export function assertWidgetSpec(input: unknown): asserts input is WidgetSpec {
  const result = validateWidgetSpec(input);
  if (!result.valid) throw new WidgetSpecValidationError(result.errors);
}

export { widgetSpecV1Schema };
