# Making chromascope work well for agents

Investigation for #35: what would make chromascope work well for coding agents, CI jobs and other automation. This write-up records how the CLI behaves today, what to change, and the follow-up tickets.

## How the CLI behaves today

Observed by running the built CLI (`dist/index.js`, chromascope 1.1.3 plus the unreleased changes on `main`) against a local page, with stdout and stderr captured separately.

| Area | Today | Problem for agents |
| --- | --- | --- |
| stdout | Results only, as box-drawing lines with emoji (`┌─ 🍎 WebKit`, `└─ 👉 0.12% pixel change …`) | Has to be parsed with a regex. `--verbose` debug lines also go to stdout (`logger.debug` uses `console.log`), interleaved with the results. |
| stderr | Spinner lines and the error message | When stderr is not a TTY the spinner turns into plain `- Starting ⚙️` / `✔ Captured …` lines, but the emoji stay, also under `CI=1` and `NO_COLOR=1`. |
| Exit codes | `0` on success whatever the pixel change; `1` for every failure | Can't gate on the result, and can't tell a usage error from a broken page. |
| No command | `chromascope` with no arguments prints nothing and exits `0` | An agent exploring the CLI learns nothing. |
| Errors | One line, sometimes followed by Playwright's call log, e.g. `locator.screenshot: Timeout 30000ms exceeded.` | No stable error code and no hint. Only a missing browser gets a remediation hint (`Run chromascope install`). |
| Local URLs | `localhost:3000` becomes `https://localhost:3000/` | Diffing a local dev server, the main agent use case, fails with `net::ERR_SSL_PROTOCOL_ERROR` unless the agent adds `http://`. |
| Artifacts | Only kept with `-s`, in `chromascope-runs/<YYYYMMDDHHMMSS>/`, printed relative to the working directory (unless `--folder` is absolute) | Two runs in the same second share a folder: they overwrite each other's images, and a run without `-s` deletes the other run's folder. Without `-s` there is nothing to look at. |
| Capture controls | Always all three browsers, Chromium as base, 1280×720, `load` event, Playwright's 30s timeout | A wrong `--element` selector hangs for 30s before failing. No way to wait for a selector or network idle, or to limit browsers for speed. |
| Interactivity | Never prompts; works with stdin closed | Good, keep it that way. |

## Recommendations and follow-up tickets

In priority order. Items marked **breaking** change existing behavior, so they should land before the major release planned in #27, to avoid a second major.

1. **Default to `http://` for loopback hosts** (#53, breaking). Small fix, big win for the local development use case.
2. **Clean stdout/stderr split and plain output when not a TTY** (#54, breaking). Results only on stdout; logs, debug, spinners and errors on stderr. Drop spinners, emoji and color when not a TTY, or under `CI`, `NO_COLOR` or a new `-q, --quiet` flag.
3. **Documented exit codes, `--fail-above`, and actionable errors** (#56, breaking). `0` within threshold, `1` above `--fail-above`, `2` usage error, `3` runtime error. Every error gets a stable code and a remediation hint.
4. **Collision-free run folders, `--out`, absolute paths** (#57, breaking). Fixes the run ID collision, and gives agents a predictable place to find the images. Run folder names and printed paths change.
5. **`--json` with a versioned schema** (#55). One JSON document on stdout with run ID, absolute paths, per-browser pixel change and percentage, image size, and total and per-browser capture times. Errors become a JSON error object with the same codes as #56.
6. **Capture controls** (#58): `--browsers`, `--base`, `--viewport`, `--timeout`, `--wait-for`, `--wait-until`, with animations and caret disabled. Share the options with `snapshot`/`compare` from #36.
7. **Self-describing help and `doctor`** (#59). Examples in `--help`, help on a bare `chromascope`, and a `doctor` command that checks Node, browsers and the output folder.
8. **Docs** (#60): `AGENTS.md` for contributors and an agent usage guide in the README, once #54, #55 and #56 have landed.
9. **Agent skill** (#61), after #55, #56 and #36.

Related: #36 (before/after `snapshot`/`compare`) relies on #55 and #56 so an agent can run snapshot → edit → compare on its own.

## Decisions

- **Skill before MCP server.** With `--json` and exit codes, the CLI already is the tool. A skill tells the agent which command to run and how to read the output, and needs no server process or second API to keep stable. Revisit an MCP server only if users need it for clients that can't run shell commands.
- **No config file yet.** Flags cover the agent use case, and an agent can keep its own command line. Revisit once the option set from #58 and #36 is stable.
- **Exit code `1` means "diff above threshold", not "error".** This matches tools like `diff` and `grep`, where `1` is a result and `2`+ is trouble. Changing failures from `1` to `2`/`3` is breaking, which is why #56 belongs in the major release.
- **`--out` instead of `--run-id`.** An agent that wants a predictable path passes `--out <dir>` and gets the artifacts in exactly that folder. A separate `--run-id` adds nothing on top. `--out` has no short flag, because `-o` is already `--folder`.
- **`--json` is versioned.** `schemaVersion` starts at `1`. Adding fields is non-breaking; renaming or removing fields bumps `schemaVersion` and needs a major release.
