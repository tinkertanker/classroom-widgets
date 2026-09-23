export const meta = {
  name: 'icon-system-round',
  description: 'Nine designers each craft one universal icon-system concept (colour icon + monochrome glyph)',
  phases: [{ title: 'Design', detail: 'one concept per designer, max effort' }],
}

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'tagline', 'concept', 'glyphNotes', 'icon', 'glyph'],
  properties: {
    name: { type: 'string', description: 'short concept name, 2-4 words' },
    tagline: { type: 'string', description: 'one sentence pitch' },
    concept: { type: 'string', description: '3-5 sentences: the idea, why it fits the product, colour decisions, and how icon and glyph are the same mark' },
    glyphNotes: { type: 'string', description: '1-2 sentences on the 18px read and what the silhouette is' },
    icon: { type: 'string', description: 'complete colour app-icon <svg> markup, viewBox 0 0 1024 1024' },
    glyph: { type: 'string', description: 'complete monochrome glyph <svg> markup, viewBox 0 0 1024 1024, #000 fills only' },
  },
}

const makePrompt = d => `
You are a world-class app icon designer on a small studio team. Produce ONE complete icon-system concept for the brief below: a colour app icon AND a monochrome menu-bar/tray glyph that are unmistakably the same mark.

${args.brief.replaceAll('{{SLUG}}', d.slug)}

## YOUR ASSIGNED DIRECTION — "${d.title}"
${d.brief}

## Process
1. Design the GLYPH first: sketch three silhouettes mentally, test each at 18px in your head (what survives? what could it be confused with?), pick the strongest.
2. Then build the colour icon as the "full" rendering of that same silhouette: plate, light (one consistent top-left light, no highlight bars parallel to edges), depth via soft warm-grey-green shadows, family palette.
3. Self-check: ids prefixed; glyph uses only #000; no element thinner than 64 units in the glyph; icon has ≤ 3 focal elements; the two would be recognised as the same brand on a desktop side by side.
Return only via StructuredOutput.`

phase('Design')
const results = await parallel(args.directions.map(d => () =>
  agent(makePrompt(d), { label: `design:${d.slug}`, phase: 'Design', effort: 'max', schema: SCHEMA })
    .then(r => r && { ...r, slug: d.slug, direction: d.title })
))
return results.filter(Boolean)