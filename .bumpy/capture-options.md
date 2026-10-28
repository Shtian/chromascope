---
chromascope: minor
---

Add capture options to `diff` for fast, repeatable runs.

- `--browsers <list>` captures only the listed browsers, and `--base <browser>` picks the browser the others are compared against. Diff images are named `diff-<base>-<browser>.png`.
- `--viewport <width>x<height>` and `--device-scale-factor <n>` set the page size.
- `--timeout <ms>` limits every navigation, wait and capture, so a wrong `--element` selector fails fast.
- `--wait-until <load|domcontentloaded|networkidle>` and `--wait-for <selector>` wait until the page is ready before capturing.
- Captures wait for web fonts, disable animations and hide the text caret, so an unchanged page captures the same way every time.
- `--element` now captures the first matching element instead of failing when the selector matches several.
