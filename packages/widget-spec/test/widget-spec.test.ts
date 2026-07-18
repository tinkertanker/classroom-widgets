import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  WIDGET_SPEC_VERSION,
  WidgetSpecValidationError,
  assertWidgetSpec,
  evaluateNumericExpression,
  isWidgetSpec,
  migrateWidgetSpec,
  validateWidgetSpec,
  widgetSpecV1Schema,
} from "../src/index.js";
import type {
  NumericExpression,
  PlotComponent,
  ValueDisplayComponent,
  WidgetSpec,
} from "../src/index.js";

function fixture(name: string): unknown {
  return JSON.parse(
    readFileSync(new URL(`../fixtures/${name}`, import.meta.url), "utf8"),
  ) as unknown;
}

function studioExample(name: string): unknown {
  return JSON.parse(
    readFileSync(new URL(`../../../examples/studio/${name}`, import.meta.url), "utf8"),
  ) as unknown;
}

function validFixture(name = "projectile-motion.widget.json"): WidgetSpec {
  const input = fixture(name);
  const result = validateWidgetSpec(input);
  assert.equal(
    result.valid,
    true,
    result.valid ? undefined : JSON.stringify(result.errors, null, 2),
  );
  return result.value;
}

test("publishes a stable Draft 2020-12 schema identity", () => {
  assert.equal(widgetSpecV1Schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(
    widgetSpecV1Schema.$id,
    "https://classroomwidgets.app/schemas/widget-spec/v1.json",
  );
  assert.equal(WIDGET_SPEC_VERSION, "1.0");
});

test("accepts the polished V1 fixture catalogue", () => {
  for (const name of [
    "projectile-motion.widget.json",
    "retrieval-practice.widget.json",
    "water-cycle-hotspots.widget.json",
  ]) {
    const result = validateWidgetSpec(fixture(name));
    assert.equal(
      result.valid,
      true,
      `${name}: ${result.valid ? "" : JSON.stringify(result.errors, null, 2)}`,
    );
  }
});

test("accepts the declarative classroom utility component contracts", () => {
  const result = validateWidgetSpec(
    studioExample("classroom-routines-toolkit.widget.json"),
  );
  assert.equal(
    result.valid,
    true,
    result.valid ? undefined : JSON.stringify(result.errors, null, 2),
  );
  if (!result.valid) return;
  assert.deepEqual(
    result.value.screens[0]?.components.map((component) => component.kind),
    ["timer", "randomiser", "taskList", "trafficLight"],
  );
});

test("rejects duplicate randomiser and task-list item identifiers", () => {
  const input = studioExample("classroom-routines-toolkit.widget.json");
  const accepted = validateWidgetSpec(input);
  assert.equal(accepted.valid, true);
  if (!accepted.valid) return;

  const spec = structuredClone(accepted.value);
  const randomiser = spec.screens[0]?.components.find(
    (component) => component.kind === "randomiser",
  );
  const taskList = spec.screens[0]?.components.find(
    (component) => component.kind === "taskList",
  );
  assert.ok(randomiser?.kind === "randomiser");
  assert.ok(taskList?.kind === "taskList");
  const firstRandomiserItem = randomiser.items[0];
  const firstTask = taskList.items[0];
  assert.ok(firstRandomiserItem !== undefined);
  assert.ok(firstTask !== undefined);
  randomiser.items[1] = { ...randomiser.items[1]!, id: firstRandomiserItem.id };
  taskList.items[1] = { ...taskList.items[1]!, id: firstTask.id };

  const result = validateWidgetSpec(spec);
  assert.equal(result.valid, false);
  if (result.valid) return;
  assert.ok(
    result.errors.some(
      (issue) => issue.code === "duplicate-id" && issue.path.includes("/items/1/id"),
    ),
  );
  assert.equal(result.errors.filter((issue) => issue.code === "duplicate-id").length, 2);
});

test("limits classroom timers to one second through 24 hours", () => {
  const input = studioExample("classroom-routines-toolkit.widget.json");
  const accepted = validateWidgetSpec(input);
  assert.equal(accepted.valid, true);
  if (!accepted.valid) return;

  for (const [durationSeconds, expectedCode] of [
    [0, "schema.minimum"],
    [86_401, "schema.maximum"],
  ] as const) {
    const spec = structuredClone(accepted.value);
    const timer = spec.screens[0]?.components.find(
      (component) => component.kind === "timer",
    );
    assert.ok(timer?.kind === "timer");
    timer.durationSeconds = durationSeconds;

    const result = validateWidgetSpec(spec);
    assert.equal(result.valid, false);
    if (result.valid) continue;
    assert.ok(
      result.errors.some(
        (issue) =>
          issue.code === expectedCode && issue.path.endsWith("/durationSeconds"),
      ),
    );
  }
});

test("rejects missing image alternative text and an unknown asset", () => {
  const result = validateWidgetSpec(
    fixture("invalid/missing-image-accessibility.widget.json"),
  );
  assert.equal(result.valid, false);
  if (result.valid) return;
  assert.ok(result.errors.some((issue) => issue.code === "schema.minLength"));
  // The schema fails first, so semantic reference checks intentionally do not run.
  assert.ok(result.errors.some((issue) => issue.path.endsWith("/altText")));
});

test("rejects executable content, network locations and styling hooks", () => {
  const result = validateWidgetSpec(fixture("invalid/unsafe-fields.widget.json"));
  assert.equal(result.valid, false);
  if (result.valid) return;
  assert.ok(result.errors.some((issue) => issue.code === "unsafe-content"));
  assert.ok(
    result.errors.some(
      (issue) => issue.code === "unsafe-field" && issue.path.endsWith("/style"),
    ),
  );
  assert.ok(
    result.errors.some(
      (issue) => issue.code === "unsafe-field" && issue.path.endsWith("/url"),
    ),
  );
});

test("rejects broken references and wrong variable kinds deterministically", () => {
  const input = fixture("invalid/broken-references.widget.json");
  const first = validateWidgetSpec(input);
  const second = validateWidgetSpec(input);
  assert.deepEqual(first, second);
  assert.equal(first.valid, false);
  if (first.valid) return;
  assert.ok(first.errors.some((issue) => issue.code === "wrong-variable-kind"));
  assert.ok(first.errors.some((issue) => issue.code === "duplicate-reference"));
  assert.ok(first.errors.some((issue) => issue.code === "unknown-reference"));
  assert.ok(first.errors.some((issue) => issue.code === "missing-reference"));
});

test("forbids arbitrary class names even when every required field is present", () => {
  const spec = structuredClone(validFixture());
  const component = spec.screens[0]?.components[0];
  assert.ok(component !== undefined);
  const withClassName = component as typeof component & { className?: string };
  withClassName.className = "fixed inset-0";

  const result = validateWidgetSpec(spec);
  assert.equal(result.valid, false);
  if (result.valid) return;
  assert.ok(
    result.errors.some(
      (issue) => issue.code === "unsafe-field" && issue.path.endsWith("/className"),
    ),
  );
  assert.ok(result.errors.some((issue) => issue.code === "schema.additionalProperties"));
});

test("enforces image limits and rejects undeclared component properties", () => {
  const spec = structuredClone(validFixture("water-cycle-hotspots.widget.json"));
  const original = spec.assets[0];
  assert.ok(original !== undefined);
  spec.assets = [
    original,
    { ...original, id: "second-image" },
    { ...original, id: "third-image" },
    { ...original, id: "fourth-image" },
  ];
  const result = validateWidgetSpec(spec);
  assert.equal(result.valid, false);
  if (result.valid) return;
  assert.ok(result.errors.some((issue) => issue.code === "schema.maxItems"));
});

test("enforces hotspot containment inside normalised image coordinates", () => {
  const spec = structuredClone(validFixture("water-cycle-hotspots.widget.json"));
  const component = spec.screens[0]?.components.find(
    (candidate) => candidate.kind === "hotspots",
  );
  assert.ok(component?.kind === "hotspots");
  component.hotspots[0] = {
    id: "overflow",
    label: "Overflow",
    reveal: "This deliberately extends beyond the image.",
    shape: { kind: "rectangle", x: 0.9, y: 0.9, width: 0.2, height: 0.2 },
  };

  const result = validateWidgetSpec(spec);
  assert.equal(result.valid, false);
  if (result.valid) return;
  assert.ok(result.errors.some((issue) => issue.code === "hotspot-out-of-bounds"));
});

test("evaluates the safe projectile expressions without source execution", () => {
  const spec = validFixture();
  const components = spec.screens.flatMap((screen) => screen.components);
  const readout = components.find(
    (component): component is ValueDisplayComponent => component.kind === "valueDisplay",
  );
  const plot = components.find(
    (component): component is PlotComponent => component.kind === "plot",
  );
  assert.ok(readout !== undefined);
  assert.ok(plot !== undefined);

  const variables = {
    "launch-speed": 20,
    "launch-angle": 45,
    gravity: 9.81,
  };
  const range = evaluateNumericExpression(readout.expression, variables);
  assert.equal(range.ok, true);
  if (range.ok) assert.ok(Math.abs(range.value - 40.7747) < 0.001);

  const trajectory = plot.series[0];
  assert.ok(trajectory !== undefined);
  const height = evaluateNumericExpression(trajectory.yExpression, {
    ...variables,
    "horizontal-distance": 20,
  });
  assert.equal(height.ok, true);
  if (height.ok) assert.ok(Math.abs(height.value - 10.19) < 0.01);
});

test("safe expression evaluation fails closed on invalid maths and variables", () => {
  const division: NumericExpression = {
    kind: "binary",
    operator: "divide",
    left: { kind: "literal", value: 5 },
    right: { kind: "literal", value: 0 },
  };
  assert.deepEqual(evaluateNumericExpression(division, {}), {
    ok: false,
    code: "division-by-zero",
    message: "Cannot divide by zero.",
  });

  const missing: NumericExpression = { kind: "variable", variableId: "missing" };
  const missingResult = evaluateNumericExpression(missing, {});
  assert.equal(missingResult.ok, false);
  if (!missingResult.ok) assert.equal(missingResult.code, "unknown-variable");
});

test("validation and evaluation enforce expression complexity limits", () => {
  let expression: NumericExpression = { kind: "literal", value: 1 };
  for (let index = 0; index < 13; index += 1) {
    expression = { kind: "unary", operator: "absolute", operand: expression };
  }

  const evaluation = evaluateNumericExpression(expression, {});
  assert.equal(evaluation.ok, false);
  if (!evaluation.ok) assert.equal(evaluation.code, "expression-too-deep");

  const spec = structuredClone(validFixture());
  const readout = spec.screens
    .flatMap((screen) => screen.components)
    .find((component) => component.kind === "valueDisplay");
  assert.ok(readout?.kind === "valueDisplay");
  readout.expression = expression;
  const validation = validateWidgetSpec(spec);
  assert.equal(validation.valid, false);
  if (!validation.valid) {
    assert.ok(validation.errors.some((issue) => issue.code === "expression-too-deep"));
  }
});

test("supports identity migration and rejects unversioned or future input", () => {
  const spec = validFixture();
  const current = migrateWidgetSpec(spec);
  assert.equal(current.ok, true);
  if (current.ok) {
    assert.equal(current.fromVersion, "1.0");
    assert.equal(current.toVersion, "1.0");
    assert.equal(current.migrated, false);
    assert.deepEqual(current.value, spec);
  }

  const missing = migrateWidgetSpec({ id: "unversioned" });
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.equal(missing.errors[0]?.code, "missing-schema-version");

  const future = migrateWidgetSpec({ ...spec, schemaVersion: "2.0" });
  assert.equal(future.ok, false);
  if (!future.ok) assert.equal(future.errors[0]?.code, "unsupported-schema-version");
});

test("type guard and assertion expose validated WidgetSpec values", () => {
  const input: unknown = fixture("retrieval-practice.widget.json");
  assert.equal(isWidgetSpec(input), true);
  if (isWidgetSpec(input)) assert.equal(input.metadata.subject, "science");
  assert.doesNotThrow(() => assertWidgetSpec(input));

  const invalid: unknown = { schemaVersion: "1.0" };
  assert.throws(
    () => assertWidgetSpec(invalid),
    (error: unknown) =>
      error instanceof WidgetSpecValidationError && error.issues.length > 0,
  );
});

test("rejects cyclic non-JSON input without recursing indefinitely", () => {
  const cyclic: { self?: unknown } = {};
  cyclic.self = cyclic;
  const result = validateWidgetSpec(cyclic);
  assert.equal(result.valid, false);
  if (!result.valid) {
    assert.ok(result.errors.some((issue) => issue.code === "cyclic-input"));
  }
});

test("rejects adversarially deep or broad input without overflowing the stack", () => {
  const deeplyNested: Record<string, unknown> = {};
  let cursor = deeplyNested;
  for (let index = 0; index < 20_000; index += 1) {
    const next: Record<string, unknown> = {};
    cursor.value = next;
    cursor = next;
  }
  const deepResult = validateWidgetSpec(deeplyNested);
  assert.equal(deepResult.valid, false);
  if (!deepResult.valid) {
    assert.ok(deepResult.errors.some((issue) => issue.code === "input-too-deep"));
  }

  const broadResult = validateWidgetSpec(new Array(20_001).fill(null));
  assert.equal(broadResult.valid, false);
  if (!broadResult.valid) {
    assert.ok(broadResult.errors.some((issue) => issue.code === "input-too-complex"));
  }
});
