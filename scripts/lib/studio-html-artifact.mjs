import vm from 'node:vm';

export const MAX_HTML_BYTES = 200_000;

const REQUIRED_MANIFEST_FIELDS = [
  'id',
  'filename',
  'title',
  'summary',
  'subject',
  'level',
  'locale',
  'learningObjective',
  'tags',
  'interactionPattern',
  'descriptor',
  'designCard',
];

export function validateHtmlArtifact(html, options = {}) {
  const issues = [];
  const bytes = Buffer.byteLength(html, 'utf8');
  const add = (code, message) => issues.push({ code, message });

  if (bytes > (options.maxBytes ?? MAX_HTML_BYTES)) add('size', `HTML is ${bytes} bytes; maximum is ${options.maxBytes ?? MAX_HTML_BYTES}.`);
  if (!/^\s*<!doctype html>/i.test(html)) add('doctype', 'A complete HTML document must begin with <!doctype html>.');
  if (!/<html\b[^>]*>[\s\S]*<\/html>\s*$/i.test(html)) add('document', 'A complete <html> document is required.');
  if (!/<head\b[^>]*>[\s\S]*<\/head>/i.test(html) || !/<body\b[^>]*>[\s\S]*<\/body>/i.test(html)) {
    add('document', 'Both <head> and <body> are required.');
  }
  if (!/<html\b[^>]*\blang=["'][^"']+["']/i.test(html)) add('locale', 'The <html> element needs a lang attribute.');
  if (!/<meta\b[^>]*name=["']viewport["']/i.test(html)) add('viewport', 'A viewport meta tag is required for touch devices.');
  if (!/<title\b[^>]*>[^<]+<\/title>/i.test(html)) add('title', 'A non-empty document title is required.');
  if (!/<style\b[^>]*>[\s\S]*<\/style>/i.test(html)) add('inline-css', 'Include readable inline CSS.');
  if (!/<script\b[^>]*>[\s\S]*<\/script>/i.test(html)) add('inline-js', 'Include inline JavaScript for the interaction.');

  const forbidden = [
    [/<script\b[^>]*\bsrc\s*=/i, 'external-script', 'External script sources are not allowed.'],
    [/<link\b[^>]*\brel=["']?(?:stylesheet|modulepreload|preload)/i, 'external-resource', 'External styles and preload links are not allowed.'],
    [/@import\s|\bimport\s*(?:\(|["'{*])|\brequire\s*\(/i, 'package-import', 'Package and stylesheet imports are not allowed.'],
    [/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(|\bnavigator\.sendBeacon\s*\(/i, 'network', 'Network APIs are not allowed.'],
  ];
  forbidden.forEach(([pattern, code, message]) => {
    if (pattern.test(html)) add(code, message);
  });

  for (const match of html.matchAll(/\b(?:src|srcset|href|xlink:href|action|formaction|poster)\s*=\s*(?:(["'])(.*?)\1|([^\s>]+))/gi)) {
    const value = (match[2] ?? match[3] ?? '').trim();
    if (value && !value.startsWith('#') && !value.startsWith('data:') && !/^assets\/[A-Za-z0-9_-]+$/.test(value)) {
      add('external-resource', `External resource reference is not allowed: ${value}.`);
    }
  }
  for (const match of html.matchAll(/\burl\(\s*(?:(["'])(.*?)\1|([^\s)]+))\s*\)/gi)) {
    const value = (match[2] ?? match[3] ?? '').trim();
    if (value && !value.startsWith('#') && !value.startsWith('data:') && !/^assets\/[A-Za-z0-9_-]+$/.test(value)) {
      add('external-resource', `External CSS resource is not allowed: ${value}.`);
    }
  }

  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (/\bsrc\s*=/.test(match[1])) continue;
    try {
      new vm.Script(match[2]);
    } catch (error) {
      add('javascript-syntax', `Inline JavaScript does not parse: ${error.message}`);
    }
  }

  return { valid: issues.length === 0, bytes, issues };
}

export function validateSeedManifest(manifest, options = {}) {
  const issues = [];
  if (!manifest || typeof manifest !== 'object' || !Array.isArray(manifest.seeds)) {
    return [{ code: 'manifest', message: 'Manifest must contain a seeds array.' }];
  }
  if (manifest.schemaVersion !== '1.0') issues.push({ code: 'schema-version', message: 'Manifest schemaVersion must be "1.0".' });
  if (options.expectedCount !== undefined && manifest.seeds.length !== options.expectedCount) {
    issues.push({ code: 'seed-count', message: `Manifest must contain exactly ${options.expectedCount} seeds; found ${manifest.seeds.length}.` });
  }
  const ids = new Set();
  const filenames = new Set();
  const titles = new Set();
  manifest.seeds.forEach((seed, index) => {
    const label = `Seed ${index + 1}`;
    if (!seed || typeof seed !== 'object') {
      issues.push({ code: 'manifest', message: `${label} must be an object.` });
      return;
    }
    REQUIRED_MANIFEST_FIELDS.filter((field) => !['tags', 'designCard'].includes(field)).forEach((field) => {
      if (typeof seed[field] !== 'string' || seed[field].trim() === '') issues.push({ code: 'manifest-field', message: `${label} needs a non-empty string ${field}.` });
    });
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(typeof seed.id === 'string' ? seed.id : '')) issues.push({ code: 'seed-id', message: `${label} has an unstable ID.` });
    if (!/^[a-z0-9-]+\.html$/.test(typeof seed.filename === 'string' ? seed.filename : '')) issues.push({ code: 'filename', message: `${label} has an invalid HTML filename.` });
    if (!Array.isArray(seed.tags) || seed.tags.length < 3 || seed.tags.length > 20 || !seed.tags.every((tag) => typeof tag === 'string' && tag.trim() && tag.length <= 50)) issues.push({ code: 'tags', message: `${label} needs 3–20 non-empty string tags of at most 50 characters.` });
    if (!seed.designCard || typeof seed.designCard !== 'object' || Array.isArray(seed.designCard)) issues.push({ code: 'design-card', message: `${label} needs an object designCard.` });
    for (const [value, set, name] of [[seed.id, ids, 'ID'], [seed.filename, filenames, 'filename'], [seed.title, titles, 'title']]) {
      if (set.has(value)) issues.push({ code: 'duplicate', message: `${label} duplicates ${name} ${value}.` });
      set.add(value);
    }
  });
  return issues;
}

export function seedApiRecord(seed, html) {
  return {
    seedId: seed.id,
    title: seed.title,
    summary: seed.summary,
    artifact: { html, designCard: seed.designCard },
    metadata: {
      subject: seed.subject,
      level: seed.level,
      locale: seed.locale,
      learningObjective: seed.learningObjective,
      tags: seed.tags,
      interactionPattern: seed.interactionPattern,
      descriptor: seed.descriptor,
    },
  };
}

export function serializeSeedFixtures(records) {
  const catalogue = {
    schemaVersion: '1.0',
    generatedFrom: 'examples/studio-html/manifest.json',
    seeds: records,
  };
  return {
    catalogue: `${JSON.stringify(catalogue)}\n`,
    ndjson: `${records.map((record) => JSON.stringify(record)).join('\n')}\n`,
  };
}
