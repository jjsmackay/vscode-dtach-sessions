## 1. Detection helper

> Implemented in `extension.ts` (not `provider.ts`): the helpers depend on
> `resolvePidsCommand`, `exec`, and the pid registry, which all live in
> `extension.ts`, and per CLAUDE.md command-flow machinery stays there.

- [x] 1.1 Add a helper that resolves the `-a` client pids on a socket, then
  filters to clients by reading `/proc/<pid>/cmdline` for the `-a` flag,
  excluding the `-A` master. — `clientPidsOnSocket`. **Fixed after verify FAIL:**
  candidates are now the **union** of `lsof -t` and a cmdline `pgrep`
  (`pgrepSocketCommand`), because `lsof -t` on a unix socket returns only the
  listening master, not connected peers; filter hardened to `-a && !-A` (awk) so
  the master is excluded even if a session name looks like a flag.
- [x] 1.2 Add a helper that, given a session, returns the stale client pids:
  candidate `-a` clients minus the resolved `processId`s of this window's live
  terminals matched to that socket (via `findTerminalForSocket`/registry). —
  `staleClientPids`
- [x] 1.3 Implement the conservative guard: if any matched terminal's
  `processId` is unresolved, return no stale pids (skip reaping) rather than
  risk a self-kill; await all matched pids before diffing.

## 2. Reaping primitive (extension.ts)

- [x] 2.1 Add a `reapStaleClients(session)` function that computes stale pids via
  the detection helper and terminates them with `SIGKILL`; return the count
  reaped. Never touch the master or the socket file.

## 3. Reap-on-attach

- [x] 3.1 Add the `dtachSessions.reapStaleClientsOnAttach` setting to
  `package.json` (boolean, default `true`) with a description; surface it via
  `config()` in `provider.ts`.
- [x] 3.2 Make `showOrCreateTerminal` await a reap on the create-fresh branch
  (when `findTerminalForSocket` returns nothing) when the setting is enabled,
  before `createTerminal`. Keep the reuse branch reap-free.
- [x] 3.3 Thread the resulting async through the create-fresh callers (`attach`,
  inline play, `quickSwitch`, `openInFolder`, and `createSession` where it
  attaches) so ordering with tracking/`refreshWhenReady` is preserved.
- [x] 3.4 Keep reap-on-attach silent (no notification).

## 4. killOne SIGKILL fix

- [x] 4.1 Change `killOne` to terminate resolved processes with `kill -9` so a
  wedged client that blocks `SIGTERM` is reliably killed alongside the master.

## 5. Manual reap commands

- [x] 5.1 Add a per-session "Reap Stale Clients" command handler that calls
  `reapStaleClients` and reports the count (including "no stale clients found").
- [x] 5.2 Add a "Reap All Stale Clients" command handler that maps the reap over
  all listed sessions and reports the total.
- [x] 5.3 Register both commands in `activate()` and contribute them in
  `package.json`: the per-session command in the row context menu, the reap-all
  command in the view title bar.

## 6. Verification

- [x] 6.1 `npm run compile` clean.
- [x] 6.2 Detection + reap logic re-verified headless against a real dtach
  master + connected `dtach -a` client (pty-backed): `clientPidsOnSocket` returns
  the connected client's pid (master excluded), reap (`kill -9`) leaves the
  master and socket intact, the pid-diff spares the "own terminal" pid, and a
  wedged ghost (pty owner killed) is detected and reaped. Passed after the 1.1 fix.
- [ ] 6.3 Confirm reload safety **in-editor**: with a session's terminal open,
  reload the window, reattach, and verify the restored client is NOT reaped.
  (Logic verified by pid-diff; needs a live VS Code to observe.)
- [ ] 6.4 Confirm the opt-out **in-editor**: set `reapStaleClientsOnAttach`
  false and verify a fresh attach does not reap.
- [ ] 6.5 Confirm manual per-session and reap-all commands report correct counts
  and leave masters/sockets intact **in-editor**.
- [x] 6.6 Confirm `killOne` removes a wedged client: `killOne` now uses the same
  `resolvePidsCommand` set with `kill -9`, verified to terminate a `SIGTERM`-
  blocking client.
- [x] 6.7 Update `README.md` (feature + setting) and the `CLAUDE.md` gotchas
  note on client reaping / SIGKILL.
