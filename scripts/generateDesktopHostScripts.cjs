#!/usr/bin/env node

/**
 * Generates the Swift, C# and TypeScript copies of the scripts the desktop
 * apps inject into their widget web views, from
 * packages/shared/desktopHostScripts.json.
 *
 *   node scripts/generateDesktopHostScripts.cjs          # write the files
 *   node scripts/generateDesktopHostScripts.cjs --check  # fail if any is stale
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SOURCE = 'packages/shared/desktopHostScripts.json';
const definitions = JSON.parse(fs.readFileSync(path.join(ROOT, SOURCE), 'utf8'));

const OUTPUTS = {
  swift: 'packages/macos-dashboard/Sources/ClassroomWidgetsDashboard/Generated/DesktopHostScripts.swift',
  csharp: 'packages/windows-dashboard/Source/Generated/DesktopHostScripts.cs',
  tsShared: 'packages/shared/constants/desktopHostScripts.ts',
  tsLinux: 'packages/linux-dashboard/src/main/generated/desktopHostScripts.ts'
};

const HEADER_LINES = [
  'AUTO-GENERATED FILE - DO NOT EDIT',
  `Generated from ${SOURCE} by scripts/generateDesktopHostScripts.cjs.`,
  "Run 'pnpm generate:desktop-scripts' to regenerate."
];

const pascal = (name) => name[0].toUpperCase() + name.slice(1);
const upperSnake = (name) => name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase();

// Splits a template into literal text and parameter references, resolving
// {{globals.x}} and {{events.x}} to their values.
function parseTemplate(name, script) {
  const parts = [];
  const pattern = /\{\{([\w.]+)\}\}/g;
  let literal = '';
  let index = 0;
  for (const match of script.template.matchAll(pattern)) {
    literal += script.template.slice(index, match.index);
    index = match.index + match[0].length;
    const reference = match[1];
    const [scope, key] = reference.split('.');
    if (key !== undefined) {
      const table = definitions[scope];
      if (!table || typeof table[key] !== 'string') throw new Error(`${name}: unknown reference {{${reference}}}`);
      literal += table[key];
      continue;
    }
    if (!(reference in script.params)) throw new Error(`${name}: undeclared parameter {{${reference}}}`);
    if (literal) parts.push({ literal });
    literal = '';
    parts.push({ param: reference });
  }
  literal += script.template.slice(index);
  if (literal) parts.push({ literal });
  for (const param of Object.keys(script.params)) {
    if (!parts.some((part) => part.param === param)) throw new Error(`${name}: parameter ${param} is never used`);
    if (!['json', 'method'].includes(script.params[param])) throw new Error(`${name}: ${param} has unknown kind`);
  }
  for (const part of parts) {
    if (part.literal && /[\u0000-\u001f]/.test(part.literal)) throw new Error(`${name}: control characters are not allowed`);
  }
  return parts;
}

const scripts = Object.entries(definitions.scripts).map(([name, script]) => ({
  name,
  description: script.description,
  params: Object.entries(script.params).map(([param, kind]) => ({ name: param, kind })),
  parts: parseTemplate(name, script)
}));

for (const method of definitions.panelHostMethods) {
  if (!/^[a-zA-Z]+$/.test(method)) throw new Error(`Invalid panel host method ${method}`);
}
if (!definitions.shortenerProviders.includes(definitions.defaultShortenerProvider)) {
  throw new Error('defaultShortenerProvider must be one of shortenerProviders');
}

// Double-quoted string literal for Swift, C# and TypeScript. Only quotes,
// backslashes and printable characters reach here.
const quote = (value) => `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
const tsQuote = (value) => `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const number = (value) => String(value);

function generateSwift() {
  const lines = HEADER_LINES.map((line) => `// ${line}`);
  lines.push(
    '',
    '/// The JavaScript injected into widget web views, shared with the Windows and',
    '/// Linux apps. A JSON parameter must already be JSON-encoded, or name an',
    '/// argument bound by callAsyncJavaScript.',
    'enum DesktopHostScripts {',
    '    /// Window globals the teacher app reads.',
    '    enum Global {'
  );
  for (const [key, value] of Object.entries(definitions.globals)) {
    lines.push(`        static let ${key} = ${quote(value)}`);
  }
  lines.push('    }', '');
  for (const [key, value] of Object.entries(definitions.events)) {
    lines.push(`    static let ${key}Event = ${quote(value)}`);
  }
  lines.push(
    `    static let shortenerProviders = [${definitions.shortenerProviders.map(quote).join(', ')}]`,
    `    static let defaultShortenerProvider = ${quote(definitions.defaultShortenerProvider)}`,
    '    static let outputVolumePresets: [(label: String, volume: Double)] = [',
    ...definitions.outputVolumePresets.map((preset, index, all) =>
      `        (label: ${quote(preset.label)}, volume: ${number(preset.volume)})${index < all.length - 1 ? ',' : ''}`),
    '    ]',
    '',
    '    /// Keeps a provider within the supported set.',
    '    static func normalizeShortenerProvider(_ provider: String?) -> String {',
    '        guard let provider, shortenerProviders.contains(provider) else { return defaultShortenerProvider }',
    '        return provider',
    '    }',
    '',
    '    enum PanelHostMethod: String {',
    ...definitions.panelHostMethods.map((method) => `        case ${method}`),
    '    }'
  );
  for (const script of scripts) {
    lines.push('', `    /// ${script.description}`);
    const body = script.parts.map((part) => {
      if (part.literal) return part.literal.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      const param = script.params.find((candidate) => candidate.name === part.param);
      return param.kind === 'method' ? `\\(${part.param}.rawValue)` : `\\(${part.param})`;
    }).join('');
    if (script.params.length === 0) {
      lines.push(`    static let ${script.name} = "${body}"`);
    } else {
      const signature = script.params.map((param) =>
        `${param.kind === 'method' ? '_ ' : ''}${param.name}: ${param.kind === 'method' ? 'PanelHostMethod' : 'String'}`).join(', ');
      lines.push(
        `    static func ${script.name}(${signature}) -> String {`,
        `        "${body}"`,
        '    }'
      );
    }
  }
  lines.push('}', '');
  return lines.join('\n');
}

function generateCSharp() {
  const lines = ['// <auto-generated />', ...HEADER_LINES.map((line) => `// ${line}`)];
  lines.push(
    '#nullable enable',
    '',
    'namespace ClassroomWidgets;',
    '',
    '/// <summary>A <c>window.classroomPanelHost</c> method.</summary>',
    'public enum PanelHostMethod',
    '{',
    ...definitions.panelHostMethods.map((method, index, all) => `    ${pascal(method)}${index < all.length - 1 ? ',' : ''}`),
    '}',
    '',
    '/// <summary>',
    '/// The JavaScript injected into widget web views, shared with the macOS and',
    '/// Linux apps. A JSON parameter must already be JSON-encoded.',
    '/// </summary>',
    'public static class DesktopHostScripts',
    '{',
    '    /// <summary>Window globals the teacher app reads.</summary>',
    '    public static class Global',
    '    {'
  );
  for (const [key, value] of Object.entries(definitions.globals)) {
    lines.push(`        public const string ${pascal(key)} = ${quote(value)};`);
  }
  lines.push('    }', '');
  for (const [key, value] of Object.entries(definitions.events)) {
    lines.push(`    public const string ${pascal(key)}Event = ${quote(value)};`);
  }
  lines.push(
    `    public static readonly string[] ShortenerProviders = [${definitions.shortenerProviders.map(quote).join(', ')}];`,
    `    public const string DefaultShortenerProvider = ${quote(definitions.defaultShortenerProvider)};`,
    '    public static readonly (string Label, double Volume)[] OutputVolumePresets =',
    '    [',
    ...definitions.outputVolumePresets.map((preset, index, all) =>
      `        (${quote(preset.label)}, ${number(preset.volume)})${index < all.length - 1 ? ',' : ''}`),
    '    ];',
    '',
    '    /// <summary>Keeps a provider within the supported set.</summary>',
    '    public static string NormalizeShortenerProvider(string? provider)',
    '        => provider is not null && ShortenerProviders.Contains(provider) ? provider : DefaultShortenerProvider;',
    '',
    '    private static string MethodName(PanelHostMethod method) => method switch',
    '    {',
    ...definitions.panelHostMethods.map((method) => `        PanelHostMethod.${pascal(method)} => ${quote(method)},`),
    '        _ => throw new ArgumentOutOfRangeException(nameof(method))',
    '    };'
  );
  for (const script of scripts) {
    lines.push('', `    /// <summary>${script.description}</summary>`);
    const body = script.parts.map((part) => {
      if (part.literal) return quote(part.literal);
      const param = script.params.find((candidate) => candidate.name === part.param);
      return param.kind === 'method' ? `MethodName(${part.param})` : part.param;
    }).join(' + ');
    if (script.params.length === 0) {
      lines.push(`    public const string ${pascal(script.name)} = ${body};`);
    } else {
      const signature = script.params.map((param) =>
        `${param.kind === 'method' ? 'PanelHostMethod' : 'string'} ${param.name}`).join(', ');
      lines.push(`    public static string ${pascal(script.name)}(${signature})`, `        => ${body};`);
    }
  }
  lines.push('}', '');
  return lines.join('\n');
}

function generateTypeScript() {
  const lines = HEADER_LINES.map((line) => `// ${line}`);
  lines.push(
    '',
    '/**',
    ' * The JavaScript the desktop apps inject into widget web views, and the window',
    ' * globals the teacher app reads. A JSON parameter must already be JSON-encoded.',
    ' */',
    '',
    'export const DESKTOP_GLOBALS = {',
    ...Object.entries(definitions.globals).map(([key, value]) => `  ${key}: ${tsQuote(value)},`),
    '} as const;',
    ''
  );
  for (const [key, value] of Object.entries(definitions.events)) {
    lines.push(`export const ${upperSnake(key)}_EVENT = ${tsQuote(value)};`);
  }
  lines.push(
    '',
    `export const SHORTENER_PROVIDER_IDS = [${definitions.shortenerProviders.map(tsQuote).join(', ')}] as const;`,
    'export type ShortenerProviderId = typeof SHORTENER_PROVIDER_IDS[number];',
    `export const DEFAULT_SHORTENER_PROVIDER_ID: ShortenerProviderId = ${tsQuote(definitions.defaultShortenerProvider)};`,
    '',
    'export const OUTPUT_VOLUME_PRESETS: readonly { label: string; volume: number }[] = [',
    ...definitions.outputVolumePresets.map((preset) => `  { label: ${tsQuote(preset.label)}, volume: ${number(preset.volume)} },`),
    '];',
    '',
    '/** Keeps a provider within the supported set. */',
    'export function normalizeShortenerProvider(provider: unknown): ShortenerProviderId {',
    '  return (SHORTENER_PROVIDER_IDS as readonly unknown[]).includes(provider)',
    '    ? provider as ShortenerProviderId',
    '    : DEFAULT_SHORTENER_PROVIDER_ID;',
    '}',
    '',
    `export const PANEL_HOST_METHODS = [${definitions.panelHostMethods.map(tsQuote).join(', ')}] as const;`,
    'export type PanelHostMethod = typeof PANEL_HOST_METHODS[number];',
    '',
    'export const desktopHostScripts = {'
  );
  for (const script of scripts) {
    lines.push(`  /** ${script.description} */`);
    const body = script.parts.map((part) => (part.literal
      ? part.literal.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')
      : `\${${part.param}}`)).join('');
    if (script.params.length === 0) {
      lines.push(`  ${script.name}: \`${body}\`,`);
    } else {
      const signature = script.params.map((param) =>
        `${param.name}: ${param.kind === 'method' ? 'PanelHostMethod' : 'string'}`).join(', ');
      lines.push(`  ${script.name}: (${signature}): string => \`${body}\`,`);
    }
  }
  lines.push('} as const;', '');
  return lines.join('\n');
}

const typeScript = generateTypeScript();
const contents = {
  [OUTPUTS.swift]: generateSwift(),
  [OUTPUTS.csharp]: generateCSharp(),
  [OUTPUTS.tsShared]: typeScript,
  [OUTPUTS.tsLinux]: typeScript
};

const check = process.argv.includes('--check');
const stale = [];
for (const [relative, content] of Object.entries(contents)) {
  const file = path.join(ROOT, relative);
  // A Windows checkout with core.autocrlf turns LF into CRLF; that is not a change.
  const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n') : null;
  if (current === content) continue;
  if (check) {
    stale.push(relative);
  } else {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
    console.log(`Wrote ${relative}`);
  }
}
if (stale.length > 0) {
  console.error(`Desktop host scripts are out of date; run 'pnpm generate:desktop-scripts':\n  ${stale.join('\n  ')}`);
  process.exit(1);
}
