## Why

When a dtach session runs an agent CLI such as Claude Code, the program drives the terminal title via an OSC escape sequence — a live status glyph plus what it is doing. dtach passes that sequence through untouched, but the extension pins the terminal's name at creation, and VS Code's API title source overrides the program's title. So the tab shows the static session name and the live status is lost. Letting the program's title surface gives a self-updating, zero-config "what's it doing" signal in the tab — with no hook, sidecar, or PTY proxy.

## What Changes

- Add a `dtachSessions.reflectProcessTitle` boolean setting (default `true`). When `true`, attach/create terminals are made **without** an API `name`, so the attached program's OSC title shows in the tab and updates live. When `false`, the extension pins the session display name as today.
- Make session reattach survive a window reload **independently of the terminal name**. At attach/create the extension records the terminal's `processId` against its socket in `workspaceState`; reuse-lookup matches on launch args first, then on persisted pid. This is required because dropping the name removes the existing name-based reload fallback, and a reload destroys a restored terminal's `shellArgs` while preserving its `processId`.
- Retire the name-based branch of the reuse lookup as the post-reload mechanism (the pid map replaces it; the name match remains valid only when `reflectProcessTitle` is `false`).

## Capabilities

### New Capabilities
<!-- none — this modifies existing behaviour -->

### Modified Capabilities
- `session-attach`: terminal naming becomes conditional on `reflectProcessTitle`; the reuse-existing-terminal lookup gains a persisted `processId` fallback so reattach survives reload without depending on the terminal name.
- `session-create`: a newly created session's terminal follows the same `reflectProcessTitle` naming rule.

## Impact

- **Code**: `src/extension.ts` (terminal creation in attach/create, pid recording, reuse lookup, terminal-close cleanup); `src/provider.ts` (`config()` gains `reflectProcessTitle`; `findTerminalForSocket` gains the pid fallback). `package.json` contributes the new setting.
- **Behaviour**: with the default on, tabs show the attached program's title (e.g. `bash`/cwd for a plain shell, the live status for an agent CLI) rather than the session name. The sidebar row remains the stable session-identity surface. Users who prefer the session name on the tab set `reflectProcessTitle: false`.
- **No new dependencies**; no change to the dtach invocation or the pure-passthrough model.
