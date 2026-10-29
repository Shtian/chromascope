# Demo

`docs/demo.gif` in the main README is recorded with real results. `record.mjs` runs the built CLI against `site/index.html` in every browser, plays the results in `terminal.html` and encodes the frames with ffmpeg.

To record it again (needs ffmpeg on `PATH`):

```bash
pnpm build && node docs/demo/record.mjs
```
