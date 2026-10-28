---
chromascope: patch
---

Validate URLs with `URL.canParse`. Only `http` and `https` URLs with a host are accepted, and a URL without a scheme gets `https://` even when the host starts with `http` (like `httpbin.org`).

Comparing two zero-size screenshots (for example an empty `--element`) reports 0% pixel change instead of `NaN%`.
