---
chromascope: major
---

Make run artifacts safe to use from scripts and coding agents.

- **Breaking:** run IDs now end in a random suffix (`20261028160312-a1b2c3`), so two runs started in the same second no longer overwrite each other or delete each other's folder. The run folder is created exclusively and a collision fails loudly.
- **Breaking:** printed artifact paths are absolute, and `--save-diff` output also lists the Chromium, WebKit and Firefox screenshots.
- New `--out <dir>` flag writes the screenshots and diffs to exactly that folder, without a run ID subfolder, even without `--save-diff`.
- The artifact file names `<browser>.png` and `diff-chromium-<browser>.png` are now documented as stable.
