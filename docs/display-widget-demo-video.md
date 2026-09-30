# Display widget demo video

[`classroom-widgets-display-widget-demo-v4.mp4`](../media/display-widget-demo/classroom-widgets-display-widget-demo-v4.mp4)
is a 92-second narrated walkthrough of the desktop app's Display widget and the
move-widget-between-screens shortcuts. [`poster.jpg`](../media/display-widget-demo/poster.jpg)
is its title card, which is also embedded in the MP4 as cover art. Both live in
[`media/display-widget-demo/`](../media/display-widget-demo/), with the render pipeline in
[`media/display-widget-demo/pipeline/`](../media/display-widget-demo/pipeline/).

Below, `pipeline/...` paths are relative to `media/display-widget-demo/`, and bare paths such
as `out/`, `audio/` and `assets/` are inside `pipeline/`, where the commands run. `packages/...`
paths start from the repo root.

| File | Details |
| --- | --- |
| `classroom-widgets-display-widget-demo-v4.mp4` | 1920×1080, 30 fps, H.264 + AAC 192 kb/s, 91.6 s, about 9.8 MB, loudness −14 LUFS |
| `poster.jpg` | Frame 0 (the complete title card), 1920×1080 |
| `pipeline/` | Everything needed to re-render the video from source |

## Not part of any app

`media/display-widget-demo/` sits at the repo root, outside every package, so no app ships it:

- **Web app and Docker images.** Vite only copies `packages/teacher/public` and
  `packages/student/public` into their builds. The Dockerfiles copy named
  `packages/*` folders, never the repo root, and `.dockerignore` lists `media` so the
  folder is not even sent as build context. nginx serves only the teacher build.
- **Desktop apps.** The macOS, Windows and Linux bundles copy `packages/teacher/build`
  plus their own package folders, and nothing from the repo root.
- **Releases.** The release workflow uploads only the built installers, disk images and
  archives.

Do not move the video into `packages/teacher/public`: everything in there ships with the
web app and is copied into every desktop bundle.

## Narration

Spoken text as synthesised (on-screen captions show the ⌃ ⌥ ⌘ symbols instead):

1. Here's how to use Classroom Widgets on the desktop with a second screen, like a projector.
2. First, plug in your projector or second monitor.
3. In System Settings, open Displays, and set it to Extended display, not Mirror. On
   Windows, choose Extend these displays.
4. Now your laptop is your working screen, and the projector is what the class sees.
5. Press Control, Option, Command and zero to open the Display widget. You can change this
   shortcut in Settings.
6. It shows a live view of the projector, so you can see what the class sees without turning
   round.
7. And it floats over your desktop, like all the other widgets.
8. Click anywhere in the preview, and your pointer jumps to that spot on the projector. Then
   click as normal.
9. Press the same shortcut again to hide it.
10. You can send widgets between displays easily too. Control, Option, Command and one opens a
    timer, on your working screen.
11. When it's ready, press Control, Option, Command and the right arrow to send it to the next
    screen.
12. And over it goes. To bring it back, use the left arrow instead.
13. You can change all of these shortcuts in Settings, under Shortcuts.
14. That's it. No more craning your neck to find your pointer on the other screen. And no more
    accidentally showing your browser tabs to the class.

[`pipeline/script.json`](../media/display-widget-demo/pipeline/script.json) is the source of truth: each chunk is `[spoken text, caption]`.

## Shortcuts shown

These are the defaults. Windows and Linux use Ctrl + Alt + Shift in place of ⌃ ⌥ ⌘.

| Action | macOS | Windows / Linux | Source |
| --- | --- | --- | --- |
| Show or hide the Display widget | ⌃⌥⌘0 | Ctrl+Alt+Shift+0 | `packages/macos-dashboard/Sources/ClassroomWidgetsDashboard/WidgetLaunchShortcuts.swift:45,51`; `packages/windows-dashboard/Source/DisplayShortcutLogic.cs:6`; `packages/linux-dashboard/src/main/widgetShortcuts.ts:29` |
| Open the Timer | ⌃⌥⌘1 | Ctrl+Alt+Shift+1 | Digits 1 to 9 go to widgets in launch-menu order: `WidgetLaunchShortcuts.swift:43-45,76-81`; `packages/windows-dashboard/Source/DashboardSettings.cs:35`; `widgetShortcuts.ts:40` |
| Move widget to next display | ⌃⌥⌘→ | Ctrl+Alt+Shift+Right | `packages/macos-dashboard/Sources/ClassroomWidgetsDashboard/DashboardSettings.swift:49-50`; `packages/windows-dashboard/Source/MoveWidgetShortcutLogic.cs:21`; `widgetShortcuts.ts:33` |
| Move widget to previous display | ⌃⌥⌘← | Ctrl+Alt+Shift+Left | `DashboardSettings.swift:48,50`; `MoveWidgetShortcutLogic.cs:20`; `widgetShortcuts.ts:32` |

If you change a default in the apps, update the video (or at least this table).

## How it was made

- **Voice:** [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) v1.0, fp32 ONNX, run
  with `kokoro-onnx` 0.6.1. The voice is a blend of 60% `bm_george` and
  40% `bm_fable` (weighted average of the two style vectors), speed 1.1, `en-gb`
  phonemes, with "one" corrected to /wʌn/. It was picked from eight British voices using
  pitch-range and clarity measurements (`pipeline/voicetest/`). Both the model and the
  voices come from the npm registry, because huggingface.co and GitHub release downloads
  were blocked in the build container: the model from `kokoro-fp32a-shards`,
  `kokoro-fp32b-shards` and `kokoro-fp32c-shards` 1.0.0 (19 shards, concatenated; the
  SHA-256 is checked), and the voices from `kokoro-js` 1.2.1 `voices/b*.bin`.
- **Music and sound effects:** synthesised in Python by `pipeline/mix.py` (110 BPM,
  C major, C–G/B–Am–F). There are no samples or third-party audio. The music ducks under
  the voice.
- **Timer:** the real teacher-app Timer, captured frame by frame from the dev server with
  Playwright (`pipeline/capture/capture_timer.mjs`).
- **Everything else:** an HTML page (`pipeline/compose/`) that draws any frame on demand.
  Playwright renders it at 30 fps into ffmpeg. All scene timings are derived from the
  narration lengths (`pipeline/build_timeline.mjs`), so new narration re-times the video
  automatically.

## Re-rendering

Tested with Node 22 and Python 3.11; any Python from 3.10 to 3.13 works (kokoro-onnx 0.6.1
needs `>=3.10,<3.14`), including the 3.12 that ships with Ubuntu 24.04. A full render
takes about five minutes.

1. Install the system tools:
   `sudo apt install ffmpeg fonts-dejavu-core python3-venv`
2. Install the Node dependencies, from `media/display-widget-demo/pipeline`:
   `npm ci && npx playwright install --with-deps chromium`
3. Install the Python dependencies into a virtual environment, from the same folder (a
   bare `pip install` is refused on Ubuntu 24.04 by PEP 668):
   `python3 -m venv .venv && . .venv/bin/activate && pip install kokoro-onnx==0.6.1 soundfile numpy`
   (add `praat-parselmouth` only if you want to run `voicetest/`). Keep the venv active
   for the remaining steps; in a new shell, run `. .venv/bin/activate` again. The scripts
   call `python3` from `PATH`, so they pick up the venv.
4. Download the voice model, about 325 MB, into `pipeline/tts/`: `./fetch_tts.sh`
   (set `KOKORO_DIR=/absolute/path` to keep it elsewhere)
5. From the repo root, start the teacher dev server for the Timer capture:
   `pnpm install && pnpm dev:teacher` (set `TEACHER_URL` if it is not on
   `http://127.0.0.1:3000`)
6. Render: `./make.sh`. It writes
   `out/classroom-widgets-display-widget-demo-v4.mp4` and `out/poster.jpg`. Copy both up
   to `media/display-widget-demo/` to publish them.

`make.sh` runs these steps: `prepare_assets.sh` → `tts.py` → `build_timeline.mjs` →
`capture/capture_timer.mjs` → `mix.py` → `render.mjs` → two-pass loudnorm → mux →
poster/cover art. To skip the slow steps after a first run:

- `SKIP_TTS=1 ./make.sh` reuses `audio/*.wav` and `audio/durations.json` (the model is
  then not needed)
- `SKIP_CAPTURE=1 ./make.sh` reuses `assets/timer/*.png` (the dev server is then not needed)

To preview frames without a full render, run `node build_timeline.mjs` and then
`node render.mjs --stills 0,30,62.5`. The stills are written to `out/stills/`.

`prepare_assets.sh` copies the logo (`packages/teacher/public/logo-mark.png`), the
menu-bar glyph ([`assets/app-icon/menu-bar-glyph.svg`](../assets/app-icon/menu-bar-glyph.svg) at the repo root), Poppins (`@fontsource/poppins`)
and DejaVu Sans Bold (for the arrow glyphs) into `pipeline/assets/`, so none of them are
duplicated in git. The only committed asset is `assets/lowpoly-bg-blur.jpg`, a blurred
copy of the board background used behind the title cards. Everything the pipeline
downloads or generates is git-ignored (`pipeline/.gitignore`).
