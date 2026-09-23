export const meta = {
  name: 'icon-system-eval',
  description: 'Nine evaluator lenses each score all nine icon-system concepts from rendered contact sheets',
  phases: [{ title: 'Evaluate', detail: 'nine lenses × nine concepts' }],
}

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['evaluations', 'top3', 'general'],
  properties: {
    evaluations: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['slug', 'distinctiveness', 'brandFit', 'appRecognition', 'glyphLegibility', 'smallSize', 'crossPlatform', 'originality', 'overall', 'verdict', 'riff'],
        properties: {
          slug: { type: 'string' },
          distinctiveness: { type: 'integer', minimum: 1, maximum: 10 },
          brandFit: { type: 'integer', minimum: 1, maximum: 10 },
          appRecognition: { type: 'integer', minimum: 1, maximum: 10, description: 'would a teacher who uses the app recognise it from this icon (timer ring, randomiser, stickers, confetti)?' },
          glyphLegibility: { type: 'integer', minimum: 1, maximum: 10 },
          smallSize: { type: 'integer', minimum: 1, maximum: 10 },
          crossPlatform: { type: 'integer', minimum: 1, maximum: 10 },
          originality: { type: 'integer', minimum: 1, maximum: 10 },
          overall: { type: 'integer', minimum: 1, maximum: 10 },
          verdict: { type: 'string', description: 'one or two sentences, specific and honest' },
          riff: { type: 'string', description: 'one concrete change that would most improve it, or a merge with another concept' },
        },
      },
    },
    top3: { type: 'array', items: { type: 'string' }, description: 'slugs, best first' },
    general: { type: 'string', description: '3-5 sentences: patterns across the set, what is missing, what direction the next round should push' },
  },
}

const LENSES = [
  { key: 'mac', persona: 'a senior Apple-platform designer who knows the macOS Human Interface Guidelines and Icon Composer intimately: squircle discipline, layering, how icons behave in dark and tinted appearances, and what a menu-bar template image must be (single colour, alpha, reads at 18pt next to Wi-Fi/battery/clock).' },
  { key: 'winlinux', persona: 'a Windows Fluent and GNOME/KDE desktop icon specialist: how a mark survives as a 16–256 .ico, as a full-bleed rounded square in a Linux app grid, and as a 16px WHITE system-tray glyph on a dark taskbar or GNOME top bar next to network/volume symbols.' },
  { key: 'tray', persona: 'a menu-bar and system-tray legibility obsessive: you judge ONLY the tiny monochrome glyph — silhouette clarity at 18px and 16px, confusion risk with system icons (grid/launchpad, wifi, settings, clock, chat, copy), whether it looks like a generic dot grid, and whether it is recognisably the same mark as the colour icon.' },
  { key: 'brand', persona: 'a brand strategist for education software: distinctiveness and ownability versus Classroomscreen, Google Classroom, Canva, Notion, Widgetsmith, Microsoft 365 and Slack; memorability; whether the mark can carry a whole identity (web, docs, marketing) for years.' },
  { key: 'teacher', persona: 'a working secondary-school teacher who uses classroom tools daily and is the actual end user: gut appeal, whether it says "classroom tools I would trust", warmth versus corporate coldness, and what you would guess the app does from the icon alone.' },
  { key: 'a11y', persona: 'an accessibility and small-size legibility expert: contrast, colour-blind safety (red-green!), whether meaning survives without colour, favicon-at-16px survival, and whether the glyph maintains adequate stroke and counter sizes.' },
  { key: 'artdirector', persona: 'a demanding art director judging originality and craft: is it fresh or a cliché (chalkboards, apples, generic grids, speech bubbles, gears)? is the geometry resolved (consistent radii, optical centring, light logic)? does it have a point of view worth defending?' },
  { key: 'system', persona: 'a product/motion designer thinking of the icon as a SYSTEM: coherence between colour icon and glyph, how it becomes a favicon, PWA icon, in-app logo, loading animation and empty-state illustration; whether the idea has "moves" beyond one static image.' },
  { key: 'risk', persona: "a sceptical risk reviewer: trademark and look-alike risk (Windows logo, Microsoft Office, Slack, Trello, Google Keep, Notion, Figma, Miro, Apple system icons), cultural misreads (medical crosses, hazard symbols, religious symbols), and whether the concept will look dated in three years. Default to harsh." },
]

const makePrompt = lens => `
You are ${lens.persona}

You are one of nine evaluators on an icon-system pitch for "Classroom Widgets" (Tinkertanker): a teacher toolkit of live classroom widgets (timer, randomiser, polls, traffic light...) that runs on the web and as macOS/Windows/Linux desktop apps launched from a menu-bar/tray item. The client wants ONE universal mark: a colour app icon (macOS squircle; full-bleed for Windows/Linux/PWA) and a monochrome menu-bar/tray glyph that are obviously the same idea. The current shipping icon is a calm 3×3 pastel tile grid (liked, but generic) and the current menu-bar item is a generic 3×3 dot grid the client explicitly wants replaced. The brand UI palette is warm (sages, terracottas, dusty roses, cream), but what teachers actually SEE in the app is a warm amber low-poly canvas carrying a big rainbow-ring countdown timer with a little creature running on it, a randomiser slot machine (purple to pink to amber gradient card), bright die-cut stickers (thick white border, tilted) and confetti. The client rejected earlier abstract tile concepts as uninspired and unlike what users see; they want an icon a teacher recognises as \"the app with the rainbow timer and the name picker\", while still being daring and working as a tiny menu-bar glyph. Reference sheet of the real app: /tmp/claude-0/-home-user-classroom-widgets/1019d9be-4c14-5465-b2e2-1ffcd8946341/scratchpad/ref/vernacular.png

## Round ${args.round} concepts (${args.concepts.length})
${args.concepts.map((c, i) => `${i + 1}. slug "${c.slug}" — ${c.name}: ${c.tagline}\n   Designer's concept: ${c.concept}\n   Contact sheet: ${args.sheetDir}/r${args.round}-${c.slug}.png`).join('\n')}

Overview of all concepts side by side: ${args.sheetDir}/r${args.round}-overview.png

## What to do
1. Read the real-app reference sheet (vernacular.png above) first so you know what users see, then the overview image, then EVERY contact sheet (use the Read tool on each PNG path). Each sheet shows: the macOS icon on light and dark desktops, the full-bleed Windows/Linux/PWA version, a 64/32/16 ladder and browser tab, the glyph dropped into a macOS menu bar (light and dark), a Windows taskbar and a GNOME top bar at true size, the icon sitting on the real amber app canvas, the glyph large, and a pixel zoom of the glyph at 36px and 18px.
2. Score every concept 1–10 on: distinctiveness, brandFit (warm Classroom Widgets family), appRecognition (does it look like what users see in the app), glyphLegibility (the tiny monochrome mark), smallSize (icon at 32/16), crossPlatform (works on all four surfaces), originality (daring, not cliché), and overall. Use the full range — a 5 is average, 9–10 is exceptional; do not cluster.
3. Write a specific, honest verdict for each through YOUR lens, and one concrete riff (a change or a merge with another concept) that would most improve it.
4. Name your top 3 (slugs, best first) and write a general note: patterns across the set, what is missing, what the next round should push.
Be opinionated. Judge what is actually rendered, not what the designer claims.
Return only via StructuredOutput.`

phase('Evaluate')
const results = await parallel(LENSES.map(l => () =>
  agent(makePrompt(l), { label: `eval:${l.key}`, phase: 'Evaluate', effort: 'max', schema: SCHEMA })
    .then(r => r && { lens: l.key, ...r })
))
return results.filter(Boolean)
