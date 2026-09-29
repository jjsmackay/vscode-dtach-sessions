## 1. Settle the stale-terminal signal (on the host, before any code)

- [ ] 1.1 Attach a client from a throwaway terminal, then kill that terminal (not the client) so the client is orphaned; record `readlink /proc/<pid>/fd/0`, the `tty_nr` field of `/proc/<pid>/stat`, and `/proc/<pid>/fdinfo/0`
- [ ] 1.2 Open new terminals until one is allocated the orphan's old `/dev/pts/N`; record the same fields and check whether the orphan is still distinguishable
- [ ] 1.3 Record the same fields for a live VS Code client and a live SSH client
- [ ] 1.4 Choose the signal (design D5) and record the table in `design.md`; if no signal survives pts reuse, adopt the D5 fallback and update the `stale-client-reaping` delta to match

## 2. Shared stale-client rule in the extension

- [ ] 2.1 Add a `/proc` helper in `src/provider.ts` returning live / gone / unknown for a client pid's terminal, per 1.4
- [ ] 2.2 Rewrite `staleClientPids` in `src/extension.ts` to classify by that helper; unknown ⇒ live; drop the pid comparison with `findTerminalForSocket` (or keep it as a second condition under the D5 fallback)
- [ ] 2.3 Confirm reap-on-attach, Reap Stale Clients and Reap All Stale Clients all go through the new rule, and `killOne` is unchanged

## 3. `dts` companion

- [ ] 3.1 `scripts/dts.py`: config loading (file → `DTS_*` → defaults, `~` expansion)
- [ ] 3.2 Session listing: prefix/suffix filter, display name, hash, `/proc/net/unix` liveness (absolute path or basename), attached = any live `-a` client
- [ ] 3.3 Status read with `effectiveState` semantics (120 s decay for `working`/`tool`, dead ⇒ none)
- [ ] 3.4 `new`: fresh hash with collision retry, `dtach -n` in cwd, wait for bind, `dtach -p` the startup command; fallback to `bash -c` if `-p` is unsupported; `-a` flag
- [ ] 3.5 `a`: name resolution (ask on duplicates), reap by the rule from 1.4, restart in place when dead with the one-line notice, `exec` into `dtach -a`
- [ ] 3.6 `kill`: confirm (`-y` skips), `SIGKILL` master and clients, remove socket and status file
- [ ] 3.7 No-argument picker: numbered menu, "+ new" entry, stdlib only
- [ ] 3.8 `dts --help`, and clear errors for dtach not found / no sessions / unknown name

## 4. Install and config in the extension

- [ ] 4.1 Install Shell Companion / Uninstall Shell Companion commands in `package.json` and `src/extension.ts`
- [ ] 4.2 Config writer for the five keys; call it from Install and from `onDidChangeConfiguration` while `~/.dtach-sessions/bin/dts` exists
- [ ] 4.3 Install message with the `PATH` line to add; no shell rc edits
- [ ] 4.4 Confirm `scripts/dts.py` is packaged in the `.vsix`

## 5. Docs

- [ ] 5.1 `README.md`: companion usage, a Termux:Widget one-tap example (`ssh -t <host> dts new …`), the shared-winsize caveat, acceptance checks from section 6
- [ ] 5.2 `CLAUDE.md` Gotchas: the on-disk contract both front ends honour, the stale-terminal rule and why the pid comparison went, why `dtach -p` over `bash -c`

## 6. Verification

- [ ] 6.1 `npm run compile` clean
- [ ] 6.2 `dts new x` over SSH → session is live and running the startup command, appears in the sidebar, the Claude status badge updates, and it's reachable from the Claude app
- [ ] 6.3 Sidebar-created session → listed by `dts ls` with matching run-state
- [ ] 6.4 Attach from VS Code while a Termux client is live → the Termux client survives; attach from `dts` while a VS Code client is live → VS Code survives
- [ ] 6.5 Orphan a client (kill its terminal) → next attach from either front end reaps it and doesn't land on a blank screen, including after pts reuse
- [ ] 6.6 `kill -9` a master → `dts ls` shows it dead with no run-state; `dts a` restarts it in place under the same hash
- [ ] 6.7 Change `startupCommand` in settings → config file updates; Uninstall leaves sockets, status and hook untouched
