# Proposal

## Why

The kernel's bound-socket table (`/proc/net/unix`) records the path a socket
was **bound** at, and renaming the file doesn't update it. So after a rename,
liveness looks for a path the kernel never recorded and reports the live session
as dead. Clicking the row then takes the restart-in-place path: `dtach -A`
attaches to the still-running master, but the user is told the session was
restarted and its output lost, and the configured `startupCommand` is typed into
the live session. This has been broken since 0.5.0; startup reattach
(`reattach-on-restart`) exposed it by skipping a renamed session as dead.

## What Changes

- Liveness matches a socket's **rename-invariant `_<hash>`** against the bound
  table, not its current path: a listening entry whose basename ends in
  `_<hash>.dtach` is that session's master, whatever the file is called now.
- Sockets with no `_<hash>` (the pre-hash naming) keep the current match on the
  absolute path or basename.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `session-liveness`: the detection requirement matches by session hash, and
  gains a scenario for a renamed session.

## Impact

- `src/provider.ts`: `socketIsBound` (and its doc comment). Every caller
  (`listSessions`, `refreshWhenReady`) goes through it, so no other code changes.
- `CLAUDE.md` liveness gotcha.
