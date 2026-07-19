import {
  SUPPORTED_WIDGET_SPEC_VERSIONS,
  WIDGET_SPEC_VERSION,
} from "./types.js";
import type {
  ValidationIssue,
  WidgetSpecMigrationResult,
  WidgetSpecVersion,
} from "./types.js";
import { validateWidgetSpec } from "./validation.js";

function declaredVersion(input: unknown): string | undefined {
  if (input === null || typeof input !== "object" || Array.isArray(input)) return undefined;
  const version = Reflect.get(input, "schemaVersion");
  return typeof version === "string" ? version : undefined;
}

export function isSupportedWidgetSpecVersion(
  version: string,
): version is WidgetSpecVersion {
  return (SUPPORTED_WIDGET_SPEC_VERSIONS as readonly string[]).includes(version);
}

export function canMigrateWidgetSpecVersion(
  version: string,
): version is WidgetSpecVersion {
  // The registry intentionally has no implicit or lossy legacy conversion.
  // Add an explicit, tested migration step here when schema v2 is introduced.
  return isSupportedWidgetSpecVersion(version);
}

/**
 * Migrates a specification to the current version, then validates the result.
 * V1 is the first public schema, so the only supported operation today is an
 * identity migration. Unsupported or missing versions fail closed.
 */
export function migrateWidgetSpec(input: unknown): WidgetSpecMigrationResult {
  const version = declaredVersion(input);
  if (version === undefined) {
    const errors: ValidationIssue[] = [
      {
        path: "/schemaVersion",
        code: "missing-schema-version",
        message: "schemaVersion is required before a widget can be migrated.",
      },
    ];
    return { ok: false, errors };
  }
  if (!canMigrateWidgetSpecVersion(version)) {
    return {
      ok: false,
      errors: [
        {
          path: "/schemaVersion",
          code: "unsupported-schema-version",
          message: `WidgetSpec version “${version}” cannot be migrated by this release.`,
        },
      ],
    };
  }

  const validation = validateWidgetSpec(input);
  if (!validation.valid) return { ok: false, errors: validation.errors };

  return {
    ok: true,
    value: validation.value,
    fromVersion: version,
    toVersion: WIDGET_SPEC_VERSION,
    migrated: false,
    notes: [],
  };
}
