## Context

dtach's client model is the root of the problem. The master tees the pty
byte-stream to every attached client under a single shared winsize, keeps no
retained screen buffer, and offers no server-side way to evict a client (unlike
tmux, which retains per-pane state, sizes clients independently, and has
`detach-client`). A dtach client can only die by signal — and a wedged client
(blocked in `select()` after its tty vanished on window close / SSH drop /
crash) blocks `SIGTERM`, so it lingers indefinitely. When a new client later
attaches to the same master, two clients share one winsize with no buffer to
repaint from: a live cursor on a blank screen.

The extension already has the machinery this fix reuses:
- `resolvePidsCommand` (`extension.ts`) resolves every pid on a socket via
  `lsof -t`, falling back to a hash-anchored / path `pgrep`.
- Each attach/create launches dtach via `bash -c 'exec -a "$0" "$@"' …`, so the
  `exec` replaces bash in place and a terminal's `processId` **is** the dtach
  `-a` client pid.
- `findTerminalForSocket` maps a socket to this window's live terminal (by
  launch args, then a persisted `socket → processId` registry that survives
  reload, then name when `reflectProcessTitle` is off).

Together these give a per-window source of truth for "which client pid is
legitimately mine," which is what makes safe reaping possible.

## Goals / Non-Goals

**Goals:**
- Self-heal the blank-screen-on-reattach case automatically on the common path.
- Give a manual escape hatch for the cases automatic reap cannot reach.
- Make `killOne` actually terminate wedged clients.
- Keep reaping provably safe: never kill the master, never kill this window's
  live client, never lose session data.

**Non-Goals:**
- A UI "ghost present" indicator on rows (observability). Deferred as a possible
  follow-up; this change fixes behaviour, not surfacing.
- Automatic global sweeps (reaping across all sockets on activate/timer).
- Protecting a client that another VS Code window has legitimately attached to
  the same socket — out of the single-live-client model; handled by opt-out.
- Replacing dtach or adding a retained-buffer/detach-client shim.

## Decisions

### Candidate resolution must be cmdline-based, not `lsof`-first
Candidates are **every** dtach process whose argv attaches to the socket,
resolved by matching the socket in command lines (the hash-anchored `pgrep`),
then filtered to `-a` clients via `/proc/<pid>/cmdline` (the `-A` master is
excluded by its flag).

- *Why not reuse `resolvePidsCommand` as-is:* it is `lsof -t <sock> || pgrep …`.
  On Linux `lsof -t` on a unix socket returns only the process **bound** to the
  path — the listening master — not its connected peers. Because `lsof` succeeds
  with the master, the `||` short-circuits and the client-finding `pgrep` never
  runs, so client enumeration returns nothing. Verified on the extension host
  (dtach 0.9): a live `dtach -a` client is invisible to `lsof -t` and only
  `pgrep -f '_<hash>\.dtach'` finds it. `resolvePidsCommand`'s `lsof`-first shape
  is correct for `killOne` (kill the master; healthy clients cascade) but wrong
  for enumerating clients — so client detection resolves via the cmdline/`pgrep`
  path (or a union that includes it), not the shared `lsof`-first command.

### Detection by pid identity (not `/proc` heuristics)
A client is stale iff its pid is not in `{ await t.processId : t ∈
window.terminals matched to the socket }`. Candidates (resolved as above) are
filtered to `-a` clients, then diffed against the live-terminal pids.

- *Why over PPID==1 / dead-tty tests:* the pid-diff is exact for the
  single-live-client model and needs no parentage/tty inference. A
  reparented-to-init heuristic is strictly weaker (misses ghosts whose parent
  survives) and adds complexity for the multi-window case we already handle via
  the toggle. The load-bearing case is **window reload**: the restored
  terminal's pid survives and re-matches, so pid-diff spares it where a naive
  "kill every client on the socket" would murder the user's live session.

### Conservative guard on unresolved pids
`term.processId` is a Promise and can be briefly `undefined` for a just-spawned
terminal. If any matched terminal's pid is unresolved, skip reaping rather than
risk killing a live client mid-spawn. Await all matched pids first. Missing a
ghost is cheaper than a self-kill.

### `SIGKILL`, always, for clients
Reaping and `killOne` both use `SIGKILL`. We verified a wedged client blocks
`SIGTERM` (`SigBlk` bit 15) and only polls for it inside the `select()` loop
that never wakes. Plain `kill` cannot reap it; `-9` cannot be blocked or caught.

### Reap-on-attach fires only at the create-fresh branch
The reap hook sits where `showOrCreateTerminal` decides to create (i.e.
`findTerminalForSocket` returned nothing). That is the one moment any
pre-existing client is, by definition, not this window's live terminal — so it
is the correct and minimal trigger point. This makes `showOrCreateTerminal` (and
its callers on the attach path) async: the reap must *complete* before
`createTerminal`, or the ghost still owns the winsize when the new client joins.

### Three surfaces, layered
Per-session reap is the primitive (also used by reap-on-attach); reap-all is a
`map` over sessions exposed in the title bar for the overnight-idle "everything
is blank" recovery, mirroring terminal-sessions' one-click ergonomics. Automatic
reap is per-attach only; global sweeps stay manual.

### Feedback discipline
Reap-on-attach is silent (fires on every fresh attach; a notification would
nag). Manual commands report a result — count reaped, or "no stale clients
found" — so an explicit action visibly did something.

### Config opt-out, default on
`dtachSessions.reapStaleClientsOnAttach` (default `true`). The only case
automatic reap gets wrong is attaching the same socket from a second live window;
the toggle is the guard for anyone whose workflow needs that.

## Risks / Trade-offs

- **Multi-window same-socket attach** → reap-on-attach in window B would kill
  window A's live client. Mitigation: opt-out setting; and reaping is
  non-destructive, so the worst case is window A must reattach (no data loss).
- **`lsof` absent on the host** → detection relies on the existing `pgrep`
  fallback in `resolvePidsCommand`, same as kill today; `/proc/<pid>/cmdline`
  filtering is Linux-only, consistent with where the extension runs.
- **processId race on rapid re-attach** → the unresolved-pid guard errs toward
  not reaping, trading a possible missed ghost (recoverable via manual reap) for
  never killing a live client.
- **Async attach path** → introducing `await` before terminal creation could
  reorder with `refreshWhenReady`/tracking; ensure tracking and reap ordering
  are preserved on every create-fresh caller.

## Open Questions

None blocking. UI ghost indicator (D-plus) intentionally deferred.
