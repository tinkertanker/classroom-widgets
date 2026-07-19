import type {
  ExpressionEvaluationResult,
  NumericExpression,
} from "./types.js";

export interface ExpressionEvaluationOptions {
  maxDepth?: number;
  maxNodes?: number;
}

export const DEFAULT_EXPRESSION_LIMITS = Object.freeze({
  maxDepth: 12,
  maxNodes: 128,
});

interface EvaluationState {
  nodeCount: number;
  readonly maxDepth: number;
  readonly maxNodes: number;
  readonly variables: Readonly<Record<string, number>>;
}

function failure(code: string, message: string): ExpressionEvaluationResult {
  return { ok: false, code, message };
}

function finiteResult(value: number): ExpressionEvaluationResult {
  return Number.isFinite(value)
    ? { ok: true, value }
    : failure("non-finite-result", "The expression produced a non-finite value.");
}

function evaluateNode(
  expression: NumericExpression,
  state: EvaluationState,
  depth: number,
): ExpressionEvaluationResult {
  state.nodeCount += 1;
  if (state.nodeCount > state.maxNodes) {
    return failure(
      "expression-too-large",
      `The expression exceeds the ${state.maxNodes}-node safety limit.`,
    );
  }
  if (depth > state.maxDepth) {
    return failure(
      "expression-too-deep",
      `The expression exceeds the ${state.maxDepth}-level safety limit.`,
    );
  }

  switch (expression.kind) {
    case "literal":
      return finiteResult(expression.value);

    case "constant":
      return { ok: true, value: expression.name === "pi" ? Math.PI : Math.E };

    case "variable": {
      if (!Object.hasOwn(state.variables, expression.variableId)) {
        return failure(
          "unknown-variable",
          `The expression refers to unknown variable “${expression.variableId}”.`,
        );
      }
      const value = state.variables[expression.variableId];
      return value === undefined || !Number.isFinite(value)
        ? failure(
            "invalid-variable-value",
            `Variable “${expression.variableId}” must have a finite numeric value.`,
          )
        : { ok: true, value };
    }

    case "unary": {
      const operand = evaluateNode(expression.operand, state, depth + 1);
      if (!operand.ok) return operand;

      switch (expression.operator) {
        case "negate":
          return finiteResult(-operand.value);
        case "absolute":
          return finiteResult(Math.abs(operand.value));
        case "squareRoot":
          return operand.value < 0
            ? failure("math-domain", "Cannot take the square root of a negative value.")
            : finiteResult(Math.sqrt(operand.value));
        case "sine":
          return finiteResult(Math.sin(operand.value));
        case "cosine":
          return finiteResult(Math.cos(operand.value));
        case "tangent":
          return finiteResult(Math.tan(operand.value));
        case "floor":
          return finiteResult(Math.floor(operand.value));
        case "ceiling":
          return finiteResult(Math.ceil(operand.value));
        case "round":
          return finiteResult(Math.round(operand.value));
      }
    }

    case "binary": {
      const left = evaluateNode(expression.left, state, depth + 1);
      if (!left.ok) return left;
      const right = evaluateNode(expression.right, state, depth + 1);
      if (!right.ok) return right;

      switch (expression.operator) {
        case "add":
          return finiteResult(left.value + right.value);
        case "subtract":
          return finiteResult(left.value - right.value);
        case "multiply":
          return finiteResult(left.value * right.value);
        case "divide":
          return right.value === 0
            ? failure("division-by-zero", "Cannot divide by zero.")
            : finiteResult(left.value / right.value);
        case "power":
          return finiteResult(Math.pow(left.value, right.value));
        case "minimum":
          return finiteResult(Math.min(left.value, right.value));
        case "maximum":
          return finiteResult(Math.max(left.value, right.value));
      }
    }

    case "clamp": {
      const value = evaluateNode(expression.value, state, depth + 1);
      if (!value.ok) return value;
      const minimum = evaluateNode(expression.minimum, state, depth + 1);
      if (!minimum.ok) return minimum;
      const maximum = evaluateNode(expression.maximum, state, depth + 1);
      if (!maximum.ok) return maximum;
      if (minimum.value > maximum.value) {
        return failure(
          "invalid-clamp-bounds",
          "A clamp expression’s minimum cannot exceed its maximum.",
        );
      }
      return finiteResult(Math.min(Math.max(value.value, minimum.value), maximum.value));
    }
  }
}

/**
 * Evaluates a constrained expression by walking its AST. This function never
 * compiles source text and never uses `eval` or `Function`.
 */
export function evaluateNumericExpression(
  expression: NumericExpression,
  variables: Readonly<Record<string, number>>,
  options: ExpressionEvaluationOptions = {},
): ExpressionEvaluationResult {
  const maxDepth = options.maxDepth ?? DEFAULT_EXPRESSION_LIMITS.maxDepth;
  const maxNodes = options.maxNodes ?? DEFAULT_EXPRESSION_LIMITS.maxNodes;

  if (!Number.isSafeInteger(maxDepth) || maxDepth < 1 || maxDepth > 64) {
    return failure("invalid-limit", "maxDepth must be an integer from 1 to 64.");
  }
  if (!Number.isSafeInteger(maxNodes) || maxNodes < 1 || maxNodes > 1024) {
    return failure("invalid-limit", "maxNodes must be an integer from 1 to 1024.");
  }

  return evaluateNode(
    expression,
    { nodeCount: 0, maxDepth, maxNodes, variables },
    1,
  );
}
