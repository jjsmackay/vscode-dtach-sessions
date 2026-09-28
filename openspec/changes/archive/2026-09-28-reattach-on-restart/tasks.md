# Tasks

## 1. Spike: confirm the VS Code behaviour the design leans on

- [x] 1.1 With a throwaway build that sets `isTransient: true` and logs `exitStatus.reason` in `onDidCloseTerminal`, reload the remote window: verify the attach terminal is gone after reload (not reconnected) and log whether a close fired and with which reason
- [x] 1.2 Same build, full VS Code close/reopen: verify no plain-bash tab is revived for the session and that ordinary terminals still restore
- [x] 1.3 Closing the tab (trash icon), Ctrl-\ detach, and the Detach command each report a non-`Shutdown` reason; record the observed reasons in design.md D2 (tab close observed as `User`; Ctrl-\ and Detach covered by 5.3). If any shutdown close reports `Unknown`, stop and revisit D2 before continuing

## 2. Attached-sessions list (replaces the pid map)

- [x] 2.1 Replace `PID_MAP_KEY` / `pidMap` / `updatePidMap` / `persistPid` / `dropPid` with an ordered attached-sockets list under `dtachSessions.attachedSockets` (add, remove, re-key helpers); verify `npm run compile` is clean
- [x] 2.2 `trackTerminal` adds the socket; rename re-keys it (both `reflectProcessTitle` branches); kill and restart remove it (kill and restart dispose the terminal, so the close handler removes them — reason `Extension`/`Process`); verify in 5.x
- [x] 2.3 `onDidCloseTerminal` removes the socket unless `exitStatus.reason === TerminalExitReason.Shutdown`; the in-memory registry is still unregistered on every close
- [x] 2.4 One-off migration on activate: seed the list from the old pid map's keys if present, then delete the old key
- [x] 2.5 Delete `reconcileTerminals` and its activate call; update the doc comments on the registry and `findTerminalForSocket` in `src/provider.ts` (registry now only covers rename-while-attached; drop reload/pid wording) and fix the wrong comment at the top of `src/extension.ts`

## 3. Transient terminals

- [x] 3.1 Set `isTransient: true` in every branch of the `TerminalOptions` built in `showOrCreateTerminal`; verify all create/attach/restart/rename-relaunch paths go through it (`grep createTerminal src/`)
- [x] 3.2 Add a `preserveFocus`/no-show option to `showOrCreateTerminal` for the reattach path; interactive attach keeps `term.show()`

## 4. Reattach on startup

- [x] 4.1 Add `dtachSessions.reattachOnStartup` (boolean, default `true`) to `package.json` and `config()`; verify it appears in Settings with a description
- [x] 4.2 On activate, when enabled: for each listed socket in order, join against `listSessions()`; reattach present+alive sessions with no live terminal via the normal `-a` path with `reapOnCreate` true, sequentially; prune missing or dead entries without starting anything; refresh the tree after
- [x] 4.3 Document the setting and the reload trade-off (scrollback/tab order/splits reset; redraw repaints) in `README.md`, and replace acceptance check 6 with restart and reload reattach checks
- [x] 4.4 Update `CLAUDE.md` Gotchas: replace the reload pid-registry explanation (including the `reflectProcessTitle` paragraph's reference to it) with the transient + attached-list + `exitStatus.reason` model

## 5. Verification (against a packaged `.vsix` over Remote-SSH)

- [x] 5.1 Attach two sessions, fully close and reopen VS Code: both reattach, rows show attached, no plain-bash husk tabs, focus not stolen
- [x] 5.2 Reload the window: sessions reattach once each (no duplicates), redraw repaints the TUI
- [x] 5.3 Detach one (tab close, Detach command, Ctrl-\), reload: only the still-attached one comes back
- [x] 5.4 Kill a session's master (`pkill -9 -f _<hash>.dtach`), reload: no terminal created, no master started, no dtachPath warning, entry pruned
- [x] 5.5 Rename an attached session with `reflectProcessTitle` on and off, reload: it reattaches under the new name
- [x] 5.6 `reattachOnStartup: false`, reload: nothing reattaches, no husks, click attaches as usual
- [x] 5.7 Upgrade path: install the previous `.vsix`, attach a session, upgrade and reload: the session reattaches, the old tab's client is reaped (tab shows exited), no second live client remains (`pgrep -af -- "-a .*_<hash>.dtach"`)
- [ ] 5.8 Walk the full README acceptance list for regressions (not run: landed without it, 2026-09-28)
