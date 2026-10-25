# Social previews

Crawler-visible metadata lives in `packages/teacher/index.html`. All routes use
the site-wide artwork. `og:image` and `twitter:image` use `og-image-v2.jpg`;
`og:video` advertises the matching six-second `og-video-v2.mp4`.

The image is the reliable fallback. The MP4 is silent H.264, 1200×630 at 30 fps,
with its index at the front (`faststart`). Playback and looping are up to the
receiving app, not guaranteed by Open Graph. X deliberately keeps its existing
`summary_large_image` card; a Player Card would need a separate HTTPS player and
platform validation. The landing-page demo is unchanged.

## Regenerate

From the repository root, after `pnpm install --frozen-lockfile`:

```sh
bash media/og-image/render.sh
# Faster artwork-only iteration (does not update the video):
bash media/og-image/render.sh --still
```

Requires Node, ImageMagick 7 (`magick`), ffmpeg with libx264, an agent-browser
Chrome installation, and access to Google Fonts. Set `CHROME_PATH` to use a
different Chrome executable. The renderer reuses the teacher workspace's
`playwright-core`; no separate npm installation is needed.

Edit `media/og-image/card.html`. The artwork preserves the existing warm
low-poly background, Poppins typeface, and the app's hamster from
`scripts/generateAppIcons.mjs`. `window.renderAt(seconds)` controls all motion;
the JPEG is frame 3s. Append `?animate` when opening the composition locally to
preview the loop (respects reduced motion). Rendering waits for fonts and image
decoding, captures at 2× resolution, then downsamples to 1200×630.

Always regenerate both assets before delivery. After a published revision,
bump the filenames in the renderer and metadata: images have immutable caching,
and social platforms cache previews independently. Keep old files for cached
metadata. Do not change the existing app icons when editing this composition.

## Verify

```sh
pnpm --filter @classroom-widgets/teacher build
cmp packages/teacher/public/og-image-v2.jpg packages/teacher/build/og-image-v2.jpg
cmp packages/teacher/public/og-video-v2.mp4 packages/teacher/build/og-video-v2.mp4
magick identify packages/teacher/build/og-image-v2.jpg
ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate,pix_fmt:format=duration,size \
  -of json packages/teacher/build/og-video-v2.mp4
```

Inspect the JPEG and the whole MP4, especially the hop, blink, nod and loop seam.
Check the built HTML without JavaScript and verify both media URLs return the
right MIME types. After deployment, test actual link shares in the target apps;
HTTP checks and local playback do not establish third-party preview support.
