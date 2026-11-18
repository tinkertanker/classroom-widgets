# Background Music tracks

Every track here comes from [FreePD.com](https://freepd.com), whose catalogue
was "licensed CC0 1.0 Universal Public Domain Dedication"
([archived home page](https://web.archive.org/web/20240104044209/https://freepd.com/)).
CC0 allows redistribution and modification without attribution; the widget
still names the composer while a track plays.

FreePD has since gone offline, so each source below is the Internet Archive copy
of the file's original `freepd.com/music/` URL. The FreePD category page named
in the table lists the track, its composer and the CC0 terms.

| File | Title | Composer | FreePD page | Licence | Source |
| --- | --- | --- | --- | --- | --- |
| `study-and-relax.mp3` | Study and Relax | Kevin MacLeod | Misc | CC0 1.0 | [archive](https://web.archive.org/web/20241230054434/https://freepd.com/music/Study%20and%20Relax.mp3) |
| `city-sunshine.mp3` | City Sunshine | Kevin MacLeod | Upbeat | CC0 1.0 | [archive](https://web.archive.org/web/20250107032552/https://freepd.com/music/City%20Sunshine.mp3) |
| `funshine.mp3` | Funshine | Kevin MacLeod | Upbeat | CC0 1.0 | [archive](https://web.archive.org/web/20250107032521/https://freepd.com/music/Funshine.mp3) |
| `fresh-focus.mp3` | Fresh Focus | Kevin MacLeod | Upbeat | CC0 1.0 | [archive](https://web.archive.org/web/20250106221710/https://freepd.com/music/Fresh%20Focus.mp3) |
| `wisdom-in-the-sun.mp3` | Wisdom in the Sun | Kevin MacLeod | Misc | CC0 1.0 | [archive](https://web.archive.org/web/20241217193421/https://freepd.com/music/Wisdom%20in%20the%20Sun.mp3) |
| `connecting-rainbows.mp3` | Connecting Rainbows | Kevin MacLeod | World | CC0 1.0 | [archive](https://web.archive.org/web/20250714150331/https://freepd.com/music/Connecting%20Rainbows.mp3) |
| `fake-it-til-you-fake-it.mp3` | Fake It Til You Fake It | Kevin MacLeod | Misc | CC0 1.0 | [archive](https://web.archive.org/web/20241217203833/https://freepd.com/music/Fake%20It%20Til%20You%20Fake%20It.mp3) |
| `night-in-venice.mp3` | Night in Venice | Kevin MacLeod | Romantic | CC0 1.0 | [archive](https://web.archive.org/web/20250808162756/https://freepd.com/music/Night%20in%20Venice.mp3) |

## Encoding

The originals are 128 to 320 kbps MP3s with very different loudness
(−10.8 to −23.5 LUFS). Each file here has its trailing silence trimmed, is
levelled to about −18 LUFS (true peak −1.5 dBTP), so switching moods does not
jump in volume and the music sits under the app's sound effects, and is
re-encoded as 80 kbps stereo MP3 (about 13 MB for all eight):

```sh
ffmpeg -i "Original.mp3" -map 0:a:0 -map_metadata -1 \
  -af "areverse,silenceremove=start_periods=1:start_threshold=-60dB,areverse,loudnorm=I=-18:TP=-1.5:LRA=11:<measured values>:linear=true" \
  -c:a libmp3lame -b:a 80k -ac 2 out.mp3
```

`<measured values>` are the `measured_I`, `measured_TP`, `measured_LRA`,
`measured_thresh` and `offset` from a first `loudnorm` pass with
`print_format=json`.
