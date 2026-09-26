# App Icon

Classroom Widgets uses one mark everywhere: the **Nibbled Timer**. It is the
timer widget's rainbow ring, die-cut like one of the app's stickers, with the
time already spent cut away as a notch at upper left. The app's own hamster
stands on the track in that notch, facing the band's end, as if it has nibbled
the spent time away.

| Size | What shows |
| --- | --- |
| 64px and up (Dock, Start, app grid, PWA, About) | The full drawing, with the hamster copied verbatim from the timer's `creatures.tsx` markup and given its own sticker border |
| 16–32px (favicons, small `.ico`/`.icns` entries) | A flat master: the same composition with the hamster simplified to two circles (orange body, tan head) on the track |
| Menu bar and tray | One-colour glyph: the notched ring with the two-circle hamster in the notch, cut free of the ring by a gap |

The macOS dark appearance darkens the plate and tones down the sticker, and
fills the face with the sticker's colour. The band, track and hamster look the
same as in the light icon.

The sizes were tuned by eye in an interactive tuner and live as the `LARGE`,
`SMALL` and `GLYPH` constants at the top of the generator.

## Where each platform gets it

All raster files are generated and committed. Run the generator after any change:

```sh
pnpm generate:icons
```

[`scripts/generateAppIcons.mjs`](../scripts/generateAppIcons.mjs) draws every
variant from the same parameters and rasterises them with `@resvg/resvg-js`, so
no browser or platform tool is needed. It writes:

- **Sources:** `assets/app-icon/` (colour, dark appearance, small master, maskable, menu-bar glyph, preview).
- **macOS:** `Assets/AppIconSource.{svg,png}`, `Assets/AppIcon.iconset/`, `Resources/AppIcon.icns`, and the Icon Composer package `Assets/ClassroomWidgets.icon` (amber fill plus one full-bleed timer layer).
- **Windows:** `Assets/AppIcon.ico` (exe, installer), plus `TrayIcon-Black.ico` and `TrayIcon-White.ico`.
- **Linux:** `assets/icon.png` (electron-builder makes the hicolor set from it) and `assets/tray-icon.png`.
- **Web:** teacher `logo.{svg,png}`, `favicon.{svg,ico}`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`; student `favicon.{svg,ico}`, also copied into `packages/server/public/student` (the checked-in student build) and `packages/server/public`.

## Menu bar and tray

- **macOS** draws the glyph in code as a template image:
  [`DashboardMenuBarIcon.swift`](../packages/macos-dashboard/Sources/ClassroomWidgetsDashboard/DashboardMenuBarIcon.swift).
  Keep its proportions in step with `GLYPH` and `HAMSTER_DOTS` in the generator.
  `make(size:remaining:)` can draw the ring for any share of the dial, so the
  item can count down with a running timer: the notch widens, and at time's up
  only the thin track is left. The ring never spins.
- **Windows** switches between the black and white glyph to match the taskbar
  (`SystemUsesLightTheme`), and updates when the theme changes.
- **Linux** panels can be light or dark and Electron cannot tell which, so the
  tray uses the colour small master without its plate.

## Rules

- No numerals in the timer face.
- Any hamster must be the app's hamster (or the two-circle simplification of it).
- Keep the band's round caps and the spent notch: they stop the ring reading as
  a refresh arrow, a spinner or the letter C.
- The maskable icon keeps the ring inside the 80% safe circle.
