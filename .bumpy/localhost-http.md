---
chromascope: major
---

URLs without a scheme for loopback hosts (`localhost`, `*.localhost`, `127.x.x.x` and `[::1]`) now default to `http://` instead of `https://`, so `chromascope diff localhost:3000` works against a local dev server. Other hosts still default to `https://`.
