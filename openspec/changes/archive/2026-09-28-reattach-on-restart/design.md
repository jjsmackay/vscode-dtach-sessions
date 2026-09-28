# Design

## Context

Attach terminals are created as ordinary persistent terminals. VS Code treats
them two ways:

- **Reload**: reconnects the live pty, but the restored `Terminal` has lost its
  `shellArgs`. We rebuild identity by matching `processId` against a persisted
  `socket → pid` map in `workspaceState` (`reconcileTerminals`).
- **Full restart**: the pty host's revive path replays the serialised buffer and
  spawns a new process. The result is a plain bash with a new pid. The pid map
  can't match it, and with `reflectProcessTitle` on there's no API name either.
  It's unidentifiable.

The pid map is cleared from `onDidCloseTerminal`, so it holds exactly the
sessions attached in this window.

## Goals / Non-Goals

**Goals:**
- One mechanism for both restart and reload: VS Code restores nothing, and the
  extension reattaches.
- Keep reattach inside the existing fresh-attach path (reaping, liveness,
  launch-failure warning), with no parallel code path.

**Non-Goals:**
- Preserving VS Code's scrollback replay, tab order or split layout across
  reload. dtach keeps no buffer; the `-r` redraw is what we get.
- Reattaching across windows or workspaces. The list is per window
  (`workspaceState`), as the pid map was.
- Reviving dead sessions on startup.

## Decisions

### D1. `isTransient: true` on every attach/create terminal, not husk detection
Set it in the one place that builds `TerminalOptions` (`showOrCreateTerminal`).
It covers attach, create, restart-in-place and rename-relaunch.

*Alternative*: keep persistence and detect revived husks on activate, then
dispose and reattach. Rejected because there's no reliable signal: new pid,
stripped args, no name. Guessing risks disposing a user's own shell.

### D2. Distinguish window shutdown from user close with `exitStatus.reason`
The attached list must survive the window closing, but drop a session the user
closed. `onDidCloseTerminal` can't tell these apart by itself.
`TerminalExitStatus.reason === TerminalExitReason.Shutdown` (API 1.71;
engines are `^1.90`) marks a close caused by the window going away. On
`Shutdown` we keep the entry; on `User`, `Process`, `Extension` or `Unknown` we
drop it. `Process` covers the dtach client exiting (Ctrl-\ detach, master died),
which is correct: the session isn't attached any more.

*Alternatives*: set a flag in `deactivate()` (ordering against terminal close
events isn't guaranteed), or defer removal on a timer the dying host never runs
(racy). `reason` is the API built for exactly this.

Whether the ext host even receives close events during shutdown doesn't
matter: if it doesn't, nothing is removed, which is also correct.

*Observed (2026-09-28, VS Code 1.139.1, Remote-SSH)*: reload and full close
both report `Shutdown` (1) for every session terminal; closing a tab reports
`User` (3). No `Unknown` seen. VS Code's hidden metadata-probe terminals report
`Process` (2) but are never in the list.

### D3. Attached list replaces the pid map; reconcile code is deleted
Store an ordered `string[]` of sockets under a new key
(`dtachSessions.attachedSockets`). Add on `trackTerminal`, re-key on rename,
remove per D2 and on kill/restart. Order is insertion order, so reattach
recreates tabs in roughly their original order.

With no restored terminals, `reconcileTerminals`, `persistPid`/`dropPid` and
the pid map go away. The in-memory registry (`registerTerminal`/`rekeyTerminal`)
stays: after a rename with `reflectProcessTitle` on, the live terminal's args
still name the old socket, and the registry is what matches it.

### D4. Reattach runs on activate through the normal attach path
After the tree provider exists: if `reattachOnStartup`, walk the list, join it
against `listSessions()`, and for each entry that is present, `alive` and has no
live terminal, call the same `showOrCreateTerminal(... reapOnCreate: true)` the
attach command uses. Entries that are missing or dead are pruned. Run
sequentially so reaps and `processId` resolution don't interleave.

Reattach passes a flag to skip `term.show()`, so it doesn't steal focus or pop
the panel open. The tabs exist; clicking a row focuses one as before.

### D5. Dead sessions are skipped, not restarted in place
Restarting would run `startupCommand` (e.g. `claude`) on every host reboot for
sessions nobody asked for. Clicking a dead row still restarts it, so no
capability is lost.

### D6. Setting
`dtachSessions.reattachOnStartup`, boolean, default `true`. It only gates
reattach. Transience is unconditional, because a revived husk is never what the
user wants.

## Risks / Trade-offs

- [Reload loses scrollback, tab order and splits] → Accepted and documented. The
  redraw restores the current screen, which is what matters for TUIs like
  Claude. Users who lean on shell scrollback can use a pager or tmux inside the
  session.
- [Panel open at restart with no persistent terminals left → VS Code spawns a
  default shell] → Only when the user had no other terminals. It's a normal
  shell, not a husk posing as a session. Accepted.
- [dtach missing on host → one fast-close warning per reattached session] →
  Rare and self-explanatory. Could be de-duplicated later without a spec change.
- [`reason` not populated on some backend (reports `Unknown`)] → We'd drop the
  entry and not reattach, falling back to today's "click to attach". This is the
  first thing to verify (tasks 1.x).
- [Upgrade: terminals restored under the old non-transient scheme] → Seed the
  new list from the old pid map's keys on first activate, then delete the old
  key. Old-style restored terminals can't be matched. The reattach's stale-client
  reap kills their clients (pid not in this window's live set), so the old tab
  goes to "exited" and the new tab is the only client. That's a one-off; the
  user closes the dead tab.

## Migration Plan

Ships as a minor release. First activate after upgrade migrates the key (above).
Rollback: the previous version ignores the new key and falls back to its pid map
(which will be empty), so the worst case is sessions start detached.
