## Why

A dtach master tees its pty byte-stream to every attached client under a single
shared window size, with no server-side retained screen buffer and no way to
evict a client. When a terminal dies uncleanly (window close, SSH drop, crash)
its `dtach -a` client can wedge — blocked in `select()` on the socket, never
noticing the tty is gone — and, because a wedged client blocks `SIGTERM`, it
lingers for days. On the next attach a fresh client joins the same master
alongside the ghost: two clients, one winsize, no buffer to repaint from. The
result is a live cursor on a blank screen. The extension has no way to detect or
clear these orphaned clients, and its own `killOne` uses plain `kill`, so it
cannot reap a wedged client either.

## What Changes

- Add automatic **reap-on-attach**: before spawning a fresh client for a socket,
  terminate any pre-existing `-a` client processes that are not this window's
  live terminal, so the new attach is the sole client and redraws cleanly.
- Gate reap-on-attach behind a new `dtachSessions.reapStaleClientsOnAttach`
  setting (default `true`), so users who attach the same socket from multiple
  windows can opt out.
- Add a manual **"Reap Stale Clients"** command, per-session (row action) and
  across all sessions (view title bar), to cover the case where a session is
  already showing in this window so reap-on-attach never fires.
- Fix `killOne` to escalate to `SIGKILL` so wedged clients (which block
  `SIGTERM`) are actually terminated.
- Detection is by pid identity: a client is stale when its pid is not among the
  live window terminals' resolved `processId`s for that socket — exact for the
  single-live-client model and safe across window reload.

## Capabilities

### New Capabilities
- `stale-client-reaping`: Detecting orphaned dtach `-a` client processes on a
  socket and terminating them, both automatically on attach (config-gated) and
  via manual per-session and all-sessions commands.

### Modified Capabilities
- `session-attach`: Attaching to a session with no live terminal in this window
  SHALL first reap stale clients on the socket (when the setting is enabled)
  before creating the fresh client.
- `session-kill`: Process termination SHALL escalate to `SIGKILL` so a wedged
  client that blocks `SIGTERM` is reliably terminated.

## Impact

- `src/extension.ts` — `showOrCreateTerminal`/`attach` gain an async reap step
  before terminal creation; `killOne` signal escalation; new command handlers
  and registrations for manual reap (per-session + all).
- `src/provider.ts` — stale-client detection helper (resolve `-a` clients on a
  socket, subtract live-window pids).
- `package.json` — new `dtachSessions.reapStaleClientsOnAttach` setting; new
  command + menu contributions for the reap actions.
- Runs on the remote extension host; detection reads `/proc/<pid>/cmdline`
  (Linux), consistent with existing lsof/pgrep process resolution.
- No breaking changes; new behaviour is on by default but reversible via the
  setting, and reaping a client is non-destructive (the master and its program
  survive).
