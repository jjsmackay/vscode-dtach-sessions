## Why

The session pane can only create sessions two ways: the view-title `+`, which
roots the shell at `$HOME`, and — indirectly — the Explorer's "Open in Detach
Session", which roots at a folder. Once you are working inside the pane there is
no way to spin up another session in a directory you already have open. The
Explorer feature (multiple sessions per folder) has no pane-side counterpart.

## What Changes

- Add a right-click **"New Session Here"** command on session rows. It creates a
  fresh session rooted in the selected session's working directory, joining that
  session's name family (next free numeric suffix).
- Reuse the existing pieces: `sessionCwd` (best-effort live cwd, already used by
  Restart), the numeric-suffix dedup, and `createSession(name, cwd)`. The cwd
  probe works on detached rows too (detach kills only the client; the master and
  its shell survive).
- When the working directory can't be resolved (no `/proc`/`lsof`, probe fails),
  fall back silently to `$HOME` — the same behaviour as Restart.
- Context-menu only (no inline icon; the inline row is already full).

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `session-create`: add a requirement for a per-row "New Session Here" command
  that creates a family sibling rooted in an existing session's working
  directory.

## Impact

- `src/extension.ts`: new command handler composing `sessionCwd` + family-base
  derivation + `createDeduped`; command registration.
- `package.json`: command contribution + `view/item/context` menu entry.
- No new configuration, dependencies, or persisted state.
