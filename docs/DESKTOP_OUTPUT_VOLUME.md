# Desktop output volume

The macOS, Windows, and Linux dashboards offer Mute and four levels in both
Settings and each floating widget's volume menu:

| Label | Audio gain |
| --- | --- |
| Mute | 0 |
| 1 ■□□□ | 0.10 |
| 2 ■■□□ | 0.25 |
| 3 ■■■□ | 0.50 |
| 4 ■■■■ | 1.00 |

More filled blocks mean louder output: 1 is softest and 4 is loudest.
These gains control widget audio, not the operating system's volume. They do not
describe perceived loudness. The persisted `outputVolume` remains a raw gain;
older values outside the presets appear as Custom and are not changed just by
opening Settings. Selecting a level replaces the saved value.

## Linux acceptance check

From the repository root, build the real teacher app and Linux shell:

```sh
pnpm --filter @classroom-widgets/teacher build:desktop
npm --prefix packages/linux-dashboard ci
npm --prefix packages/linux-dashboard run build
```

From `packages/linux-dashboard`, with Xvfb, xdotool, and ImageMagick installed:

```sh
CLASSROOM_WIDGETS_TEST_EVIDENCE_DIR="$PWD/../../.amp/in/artifacts/desktop-volume-linux" \
  xvfb-run -a -s '-screen 0 2560x1600x24' \
  node_modules/.bin/electron --no-sandbox --force-device-scale-factor=2 test/volume.e2e.cjs
```

The check uses isolated temporary preferences and two real Sound Effects panels.
It selects all five choices through Settings and through native-menu keyboard
input, plays a bundled sound, checks each audio element's gain, verifies live
Settings/tooltip synchronization, and reloads preferences from disk. It also checks
that a saved legacy gain of 0.75 stays Custom. It writes `volume-e2e.json` and
screenshots to the evidence directory. Failed checks retain the JSON result and
any screenshots captured before the failure.

### Digital-output measurement in an Amp orb

For loopback measurement without physical speakers, start an isolated PulseAudio
server with a virtual sink (requires `pulseaudio` and `parec`):

```sh
mkdir -m 700 -p /tmp/volume-audio
amp orb service start volume-audio --command \
  'pulseaudio -n --daemonize=no --exit-idle-time=-1 --load="module-native-protocol-unix socket=/tmp/volume-audio/native auth-anonymous=1" --load="module-null-sink sink_name=volume_test"'
```

Run the same acceptance command with these additional environment variables:

```sh
PULSE_SERVER=unix:/tmp/volume-audio/native \
CLASSROOM_WIDGETS_TEST_AUDIO_MONITOR=volume_test.monitor \
CLASSROOM_WIDGETS_TEST_EVIDENCE_DIR="$PWD/../../.amp/in/artifacts/desktop-volume-linux" \
  xvfb-run -a -s '-screen 0 2560x1600x24' \
  node_modules/.bin/electron --no-sandbox --force-device-scale-factor=2 test/volume.e2e.cjs
```

The log then also records PCM peaks and verifies silent mute and the four output
ratios against full volume, allowing 0.02 absolute tolerance for resampling and
source clipping. This measures digital output, not acoustic or perceived loudness.
Stop the temporary server afterward:

```sh
amp orb service stop volume-audio
rmdir /tmp/volume-audio
```

## Native macOS and Windows acceptance

Build and launch the dashboard from the exact candidate revision on its own OS.
Open Settings and two floating widgets, then select Mute and Levels 1–4 through
both Settings and the widget menu. Check the menu selection, tooltips, persisted
gain, and audio gains in the embedded web views; changing one panel's volume must
update both panels and an already-open Settings window. Repeat with a saved
non-preset gain and verify Custom does not change it. Capture the settings, open
menu, muted, and custom states, and retain build/test output with the tested SHA.
