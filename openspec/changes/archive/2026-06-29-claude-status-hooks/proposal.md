## Why

The panel lists sessions but says nothing about what the agent inside each one
is doing. When several sessions run Claude, you have to attach to each to learn
which is working, which is blocked waiting for you, and which is idle. Surfacing
that run-state inline turns the list into a live dashboard — you can glance and
see which session needs you.

## What Changes

- Add a **status badge** to each session row reflecting the live run-state of a
  Claude Code instance running inside it: **working**, **tool:`<name>`**,
  **waiting** (blocked on user input/permission), or **idle**. The badge is
  appended to the row description and decays to idle/age if a session goes
  quiet without a clean stop, so it never shows a stale-but-wrong state.
- Add a bundled hook **forwarder** (python3) that Claude runs on its lifecycle
  events. It correlates the firing hook to a dtach session by walking `/proc`
  ancestors to the dtach master and extracting the session's rename-invariant
  hash, then writes current state to a per-hash file under the socket directory.
  When no dtach ancestor is found it is a cheap no-op, so it is safe as a
  host-global hook that fires for every Claude session on the machine.
- Add explicit **Install** / **Uninstall** commands that wire the forwarder into
  `~/.claude/settings.json` by merging (never clobbering existing user hooks),
  and a one-time **install nudge** offered only when Claude is detected on the
  host and the hooks are not yet installed.

Out of scope (explicitly): cost, token counts, context-window gauge, model,
turn count, transcript tailing, and any agent other than Claude Code. This
change is status-only.

## Capabilities

### New Capabilities
- `session-status`: showing each session's live Claude run-state in the panel —
  the state vocabulary, how state is sourced (per-hash status files joined to
  sessions by hash), staleness decay, and refresh on status change.
- `claude-status-hooks`: installing, uninstalling, and managing the Claude hook
  integration — the forwarder's correlation and no-op behaviour, the per-hash
  status file it writes, idempotent merge into `~/.claude/settings.json`, the
  stable forwarder install path, and the detection-gated install nudge.

### Modified Capabilities
<!-- None. The status display is additive; existing list/attach behaviour is unchanged. -->

## Impact

- `package.json` — two new commands (`installClaudeHooks`, `uninstallClaudeHooks`);
  optional config setting to enable/disable the status feature.
- `src/provider.ts` — read the sibling `status/` dir, join to sessions by hash
  (legacy no-hash sockets get no status), append the badge to `SessionItem`
  `description`. Does **not** touch `contextValue` (owned by `panel-row-actions`
  for attach-state action gating; the two compose).
- `src/extension.ts` — install/uninstall handlers, the activate-time nudge
  (gated via `globalState`), and a watcher on `status/` driving `refresh()`.
- New bundled python3 forwarder script (under `media/` or `scripts/`), copied to
  a stable path (`~/.dtach-sessions/hook`) on install.
- `README.md` and the `## Gotchas` notes in `CLAUDE.md`.
- No new npm dependencies. Linux remote hosts only (uses `/proc`); degrades to
  no badge elsewhere.
