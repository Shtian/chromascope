# Demo

The GIFs in the main README are recorded with real results. Each recorder runs the built CLI against `site/index.html`, plays the results in a player page and encodes the frames with ffmpeg (`frames.mjs`).

- `docs/agent-demo.gif`: `record-agent.mjs` plays `agent.html`. A coding agent highlights the Pro card, sees in the diff that its CSS changed every card, fixes the selector and compares again.
- `docs/demo.gif`: `record.mjs` plays `terminal.html`. A cross-browser diff, the saved diff image, and a CI step failing with `--fail-above`.

To record them again (needs ffmpeg on `PATH`):

```bash
pnpm build && node docs/demo/record-agent.mjs && node docs/demo/record.mjs
```
