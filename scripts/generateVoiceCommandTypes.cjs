#!/usr/bin/env node

/**
 * Generate voice command types from shared JSON definition
 * This ensures frontend and backend stay in sync
 */

const fs = require('fs');
const path = require('path');

const SHARED_DIR = path.join(__dirname, '../shared');
const SRC_DIR = path.join(__dirname, '../src/shared/constants');
const SERVER_DIR = path.join(__dirname, '../server/src/shared/constants');

// Read the shared definitions
const definitionsPath = path.join(SHARED_DIR, 'voiceCommandDefinitions.json');
const definitions = JSON.parse(fs.readFileSync(definitionsPath, 'utf8'));

console.log('📖 Reading voice command definitions...');
console.log(`   Version: ${definitions.version}`);
console.log(`   Widgets: ${Object.keys(definitions.widgets).length}`);

// Generate TypeScript constants for frontend
function generateTypeScriptFile() {
  const widgets = definitions.widgets;

  let content = `// AUTO-GENERATED FILE - DO NOT EDIT
// Generated from shared/voiceCommandDefinitions.json
// Run 'npm run generate:voice-types' to regenerate

/**
 * Voice Command Widget Definitions
 * This file is auto-generated to ensure consistency between frontend and backend
 */

export interface WidgetDefinition {
  displayName: string;
  targetName: string;
  widgetType: string;
  aliases?: string[];
  actions: ActionDefinition[];
}

export interface ActionDefinition {
  name: string;
  description: string;
  parameters?: Record<string, ParameterDefinition>;
}

export interface ParameterDefinition {
  type: string;
  description: string;
  default?: any;
  enum?: string[];
}

/**
 * All widget definitions from shared config
 */
export const VOICE_WIDGET_DEFINITIONS: Record<string, WidgetDefinition> = ${JSON.stringify(widgets, null, 2)};

/**
 * Widget target name to WidgetType mapping
 * Use this for executeLaunchWidget
 */
export const VOICE_WIDGET_TARGET_MAP: Record<string, string> = {
`;

  // Add target mappings
  for (const [key, widget] of Object.entries(widgets)) {
    content += `  '${widget.targetName.toLowerCase()}': '${widget.widgetType}',\n`;

    // Add aliases
    if (widget.aliases) {
      for (const alias of widget.aliases) {
        content += `  '${alias.toLowerCase()}': '${widget.widgetType}',\n`;
      }
    }
  }

  content += `};

/**
 * All valid action names
 */
export const VOICE_ACTION_NAMES = [
`;

  // Collect all actions
  const allActions = new Set();
  for (const widget of Object.values(widgets)) {
    for (const action of widget.actions) {
      allActions.add(action.name);
    }
  }

  for (const action of Array.from(allActions).sort()) {
    content += `  '${action}',\n`;
  }

  content += `] as const;

export type VoiceActionName = typeof VOICE_ACTION_NAMES[number];
`;

  return content;
}

// Generate JavaScript constants for backend
function generateJavaScriptFile() {
  const widgets = definitions.widgets;

  let content = `// AUTO-GENERATED FILE - DO NOT EDIT
// Generated from shared/voiceCommandDefinitions.json
// Run 'npm run generate:voice-types' to regenerate

/**
 * Voice Command Widget Definitions
 * This file is auto-generated to ensure consistency between frontend and backend
 */

/**
 * All widget definitions from shared config
 */
const VOICE_WIDGET_DEFINITIONS = ${JSON.stringify(widgets, null, 2)};

/**
 * Widget target name to WidgetType mapping
 */
const VOICE_WIDGET_TARGET_MAP = {
`;

  // Add target mappings
  for (const [key, widget] of Object.entries(widgets)) {
    content += `  '${widget.targetName.toLowerCase()}': '${widget.widgetType}',\n`;

    // Add aliases
    if (widget.aliases) {
      for (const alias of widget.aliases) {
        content += `  '${alias.toLowerCase()}': '${widget.widgetType}',\n`;
      }
    }
  }

  content += `};

/**
 * All valid action names
 */
const VOICE_ACTION_NAMES = [
`;

  // Collect all actions
  const allActions = new Set();
  for (const widget of Object.values(widgets)) {
    for (const action of widget.actions) {
      allActions.add(action.name);
    }
  }

  for (const action of Array.from(allActions).sort()) {
    content += `  '${action}',\n`;
  }

  content += `];

/**
 * Generate Ollama system prompt documentation from definitions
 */
function generateOllamaWidgetDocs() {
  let docs = '';

  for (const [key, widget] of Object.entries(VOICE_WIDGET_DEFINITIONS)) {
    docs += \`**\${widget.displayName.toUpperCase()} WIDGET:**\\n\`;

    for (const action of widget.actions) {
      docs += \`- \${action.name}\`;

      if (action.parameters) {
        const params = Object.entries(action.parameters).map(([name, param]) => {
          if (param.enum) {
            return \`\${name}: "\${param.enum.join('"|"')}"\`;
          }
          return \`\${name}: \${param.type}\`;
        }).join(', ');
        docs += \`: { \${params} }\`;
      }

      docs += \`\\n  Examples: \${action.description}\\n\`;
    }

    docs += '\\n';
  }

  // Add valid target list
  const targets = Object.values(VOICE_WIDGET_DEFINITIONS).map(w => \`"\${w.targetName}"\`);
  docs += \`**Valid LAUNCH_WIDGET targets (use camelCase):**\\n\`;
  docs += targets.join(', ') + '\\n';

  return docs;
}

module.exports = {
  VOICE_WIDGET_DEFINITIONS,
  VOICE_WIDGET_TARGET_MAP,
  VOICE_ACTION_NAMES,
  generateOllamaWidgetDocs
};
`;

  return content;
}

// Write the files
console.log('\\n📝 Generating TypeScript file for frontend...');
const tsContent = generateTypeScriptFile();
const tsPath = path.join(SRC_DIR, 'voiceCommandDefinitions.ts');
fs.mkdirSync(path.dirname(tsPath), { recursive: true });
fs.writeFileSync(tsPath, tsContent);
console.log(`   ✅ Written: ${tsPath}`);

console.log('\\n📝 Generating JavaScript file for backend...');
const jsContent = generateJavaScriptFile();
const jsPath = path.join(SERVER_DIR, 'voiceCommandDefinitions.js');
fs.mkdirSync(path.dirname(jsPath), { recursive: true });
fs.writeFileSync(jsPath, jsContent);
console.log(`   ✅ Written: ${jsPath}`);

console.log('\\n✨ Voice command types generated successfully!');
console.log('   Frontend: src/shared/constants/voiceCommandDefinitions.ts');
console.log('   Backend:  server/src/shared/constants/voiceCommandDefinitions.js');
