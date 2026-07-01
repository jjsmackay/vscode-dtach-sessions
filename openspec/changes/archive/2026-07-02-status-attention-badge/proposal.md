## Why

The live Claude status feature (v0.2.0) surfaces run-state on each session row,
but two gaps remain. A session that goes **waiting** (Claude blocked on the
user) is only visible when the panel is open and on screen — the most
time-sensitive state is the easiest to miss. Separately, killing a session from
the panel removes its socket but leaves its `status/<hash>.json` file behind,
because extension-driven kills never fire Claude's `SessionEnd` hook; the orphan
files are harmless cruft the provider ignores, but they accumulate.

## What Changes

- Show a count of **waiting** sessions as a badge on the dtach Sessions
  activity-bar icon (VS Code `TreeView.badge`), so an attention-needing session
  is visible even when the view is collapsed or hidden. The count covers only
  sessions whose effective (post-decay) state is `waiting`; `working`/`tool`/idle
  do not contribute. A zero count clears the badge. The badge is gated on
  `showClaudeStatus` and recomputes on every tree refresh.
- Have `killOne()` remove the session's `status/<hash>.json` file alongside the
  socket, so extension-driven kills leave no orphan status file. This flows
  through every kill path (single, multi-select, Kill All) and Restart, since
  they all compose `killOne()`.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `session-status`: adds an activity-bar attention badge counting waiting
  sessions, derived from the same effective-state source as the row badge/icon
  and gated on the status feature being enabled.
- `session-kill`: kill now also removes the session's per-hash status file, not
  just its socket, so no orphan status file is left behind.

## Impact

- `src/provider.ts`: new `countWaiting()` helper (reuses `readStatuses` +
  `effectiveState`); `statusDir` already exported for the kill path.
- `src/extension.ts`: `activate()` sets `view.badge` from `countWaiting()` on
  every `onDidChangeTreeData`; `killOne()` removes `statusDir(...)/<hash>.json`.
- No config, command, or forwarder (`scripts/claude-status-hook.py`) changes.
- Linux-only and GUI-visible: the badge can only be eyeballed in-editor; the
  status-file cleanup is shell-verifiable.
