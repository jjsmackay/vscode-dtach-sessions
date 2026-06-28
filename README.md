# >_ dtach Sessions

A minimal VS Code extension that lists [dtach](https://github.com/crigler/dtach)
sessions in a sidebar and attaches to them in ordinary integrated terminals.
Because dtach is pure passthrough, native terminal select, copy, scroll, and
search all keep working. There's no webview or PTY proxy.

Built for the Remote-SSH workflow: the extension runs on the **remote** extension
host (`extensionKind: ["workspace"]`), where the dtach sockets and binary live.

## Requirements

- `dtach` on the remote host. If it is not on the extension host `PATH`
  (the extension host does **not** source your `.bashrc`), set
  `dtachSessions.dtachPath` to an absolute path such as
  `/home/you/.local/bin/dtach`.
- For the **Kill** command: `lsof` (preferred) or `pgrep` on the host. Kill uses
  `lsof -t <socket>` to find the owning process and falls back to a
  regex-escaped `pgrep -f` if `lsof` is unavailable; it then removes the socket.
- For **live Claude status** (optional): `python3` on the host, and a Linux host
  (the forwarder reads `/proc`). Other hosts simply show no status.

## Features

- **Session list** — sidebar showing sockets in `<socketDir>` that end in `.dtach`
  and are actually sockets (default `~/.dtach-sessions`). Sessions are ordered most
  recently modified first, each row showing a relative age (e.g. `2h ago`); a row
  whose terminal is open in the current window is marked **attached** with a green
  icon. Refreshes manually via the title-bar button, automatically when the view
  becomes visible, and shortly after a session is created.
- **Attach** — click a row to open a terminal running `dtach -a <socket> -r winch`.
  The `-r winch` forces a redraw so a live TUI renders immediately. Clicking a
  session that already has an open terminal focuses it instead of opening a second.
  By default (`dtachSessions.reflectProcessTitle`) the terminal is created without
  a fixed name so the running program's title drives the tab (e.g. an agent CLI's
  live status), while the session name labels the sidebar row. Until the program
  sets its own title, the tab falls back to the session name (dtach is launched
  with that as its process label via `argv[0]`). Set the option to `false` to pin
  the session name on the tab instead. See the title note below for limits.
- **Create** — the `+` button prompts for a name (validated against empty,
  whitespace, and slashes) and opens `dtach -A <socket> -r winch $SHELL`. Sockets
  are named `<prefix><name>_<hash>.dtach`; the `_<hash>` is a stable id that lets a
  session be renamed without losing track of its process. Set
  `dtachSessions.startupCommand` to auto-run a program (e.g. `claude`) in new
  sessions.
- **Open in Detach Session** — right-click a folder in the Explorer. The session
  is named after the folder: if one already exists it is attached (reusing its
  open terminal if any), otherwise a new session is created with the shell rooted
  in that folder.
- **Switch Session** — a command-palette command (`dtach Sessions: Switch Session`)
  to fuzzy-find and attach a session without leaving the keyboard.
- **Rename** — right-click a row → Rename. Moves the socket (keeping its id) and
  relabels the open terminal. The live session survives.
- **Detach / Attach** — each row carries an inline icon for its primary action:
  attached rows show a blue **pause** (detach — close this window's terminal,
  leave the dtach server running); detached rows show a **play** (attach). The
  same actions are on the right-click menu.
- **Restart** — the inline restart icon (or right-click → Restart, with
  confirmation) terminates the dtach server and opens a fresh shell under the
  same name, re-running `startupCommand`. Use it to relaunch a session that's
  wedged; in-session scrollback does not survive.
- **Copy** — right-click a row → Copy Socket Path / Copy Attach Command for
  scripting or SSH.
- **Kill** — the inline trash icon (or right-click → Kill), with confirmation,
  terminates the dtach server and removes its socket. Select multiple rows to
  kill them together, or use **Kill All Sessions** from the view's `…` menu. The
  owning process is resolved by the session id, so renamed sessions are killed
  cleanly rather than orphaned.
- **Live Claude status** — each row shows the run-state of a Claude Code instance
  running inside it: **working**, **tool: `<name>`**, or **waiting** (blocked on
  you); idle sessions just show their age. The row **icon** reflects it too — a
  spinner while busy, an amber bell when waiting on you, the usual terminal icon
  at rest — and the row's relative time becomes **activity-relative** (time in
  state / since Claude last acted) whenever status is available, instead of the
  socket's mtime. Run **dtach Sessions: Install Claude Status Hooks** once (or
  accept the one-time prompt) to wire a small forwarder into
  `~/.claude/settings.json`; it merges alongside any hooks you already have, and
  **Uninstall Claude Status Hooks** removes only its entries. Sessions already
  running Claude pick up status after a restart, since Claude reads hooks at
  session start. See the status note below. Linux hosts only.

## Configuration

| Setting | Default | Description |
| --- | --- | --- |
| `dtachSessions.socketDir` | `~/.dtach-sessions` | Directory holding the sockets (`~` expands to home). Created on first session. |
| `dtachSessions.socketPrefix` | `` (empty) | Filename prefix; files are `<prefix><name>_<hash>.dtach`. See the migration note below. |
| `dtachSessions.startupCommand` | `` (empty) | Command run inside a session's shell on create (not reattach), e.g. `claude`. |
| `dtachSessions.redrawMethod` | `winch` | `-r` value on attach/create. One of `winch`, `ctrl_l`, `none`. See note below. |
| `dtachSessions.dtachPath` | `dtach` | Path to the dtach binary; set absolute if not on PATH. |
| `dtachSessions.reflectProcessTitle` | `true` | Create attach terminals without a fixed name so the running program's title (e.g. an agent CLI's live status) drives the tab. The session name still labels the sidebar row. Set `false` to pin the session name on the tab. |
| `dtachSessions.showClaudeStatus` | `true` | Show a Claude Code instance's live run-state (working / tool / waiting / idle) on each session row. Requires the status hooks (see Features). Linux hosts only. |

**Migration note (prefix default):** the default `socketPrefix` is now empty
(was `.claude-`). Sockets created by older versions are named `.claude-*.dtach`
and will not appear under the new default. To keep seeing them, set
`dtachSessions.socketPrefix` back to `.claude-`, or kill and recreate those
sessions under the new naming.

**Redraw note:** `winch` repaints on reattach only when the terminal size
differs from the size at detach — reattaching at the same size can leave a TUI
blank until the next resize. `ctrl_l` forces a redraw regardless of size, but it
sends a literal Ctrl-L to the program, which some TUIs (including Claude) treat
as a clear-screen keystroke. Pick whichever trade-off suits your workflow.

**Title note (`reflectProcessTitle`):** VS Code only honours an escape-set tab
title from a process it detects as an agent CLI (Claude Code, Copilot, Gemini),
so the extension can't seed the tab itself — when you *resume* an idle agent it
won't re-emit its title until it next changes state, so the tab shows the
session-name fallback until then. Separately, agent CLIs running under dtach may
log a VS Code IPC/extension-install error and lose editor integration on
reattach: dtach freezes the program's environment at creation, so the
`VSCODE_IPC_HOOK_CLI` socket it inherited goes stale when you reattach from a
different window. Both are inherent to a detached-session model and harmless to
the program itself; set `reflectProcessTitle: false` if you'd rather just pin the
session name on the tab.

**Status note (`showClaudeStatus`):** the forwarder maps each Claude session to
its row by walking `/proc` from the firing hook up to the dtach master process,
reading the socket path (and its `_<hash>` id) from that process's command line
— so status follows a session across rename and reattach, and works for sessions
created outside the extension too. It is a no-op when not running under dtach, so
the host-global hook is harmless to your other Claude sessions. A session that
exits without a clean stop (crash, killed connection) decays from *working* back
to its age after a couple of minutes rather than sticking. Sessions whose socket
predates the `_<hash>` id scheme show no status.

## Build

```sh
npm install
npm run compile          # tsc -p ./  ->  out/
npx @vscode/vsce package # -> dtach-sessions-<version>.vsix
```

## Install onto the remote host

In a Remote-SSH window: Command Palette → **Extensions: Install from VSIX…** →
select the `.vsix`. VS Code uploads and installs it remote-side. Reload the
remote window.

## Acceptance checks

1. `+` → `web` creates `~/.dtach-sessions/web_<hash>.dtach`, opens a shell, and a
   `web` row appears (showing a relative age).
2. Clicking the row opens a terminal; a live TUI renders immediately, and the row
   shows as **attached** (green icon).
3. With `startupCommand` set to `claude`, a freshly created session auto-runs it.
4. Right-click `web` → Rename → `api`: the socket becomes `api_<hash>.dtach`, the
   row and terminal relabel, and the session stays live.
5. Right-click `api` → Kill → process gone (verify with `pgrep -f _<hash>.dtach`)
   and socket removed; renaming did not orphan it.
6. Reopen the remote window, click a session → it is still there and reattaches.
7. Select several rows → Kill, or use Kill All from the `…` menu → all gone.
8. Drag-select and right-click-copy work natively in the attached terminal.
