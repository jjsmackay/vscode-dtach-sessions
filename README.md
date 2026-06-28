# dtach Sessions

A minimal VS Code extension that lists [dtach](https://github.com/crigler/dtach)
sessions in a sidebar and attaches to them in ordinary integrated terminals.
Because dtach is pure passthrough, native terminal select, copy, scroll, and
search all keep working — there is no webview or PTY proxy.

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
  relabels the open terminal. The live session is preserved.
- **Detach** — right-click a row → Detach to close this window's terminal while
  leaving the dtach server running for later reattachment.
- **Copy** — right-click a row → Copy Socket Path / Copy Attach Command for
  scripting or SSH.
- **Kill** — right-click a row → Kill (with confirmation) to terminate the dtach
  server and remove its socket. Select multiple rows to kill them together, or use
  **Kill All Sessions** from the view's `…` menu. The owning process is resolved by
  the session id, so renamed sessions are killed cleanly rather than orphaned.

## Configuration

| Setting | Default | Description |
| --- | --- | --- |
| `dtachSessions.socketDir` | `~/.dtach-sessions` | Directory holding the sockets (`~` expands to home). Created on first session. |
| `dtachSessions.socketPrefix` | `` (empty) | Filename prefix; files are `<prefix><name>_<hash>.dtach`. See the migration note below. |
| `dtachSessions.startupCommand` | `` (empty) | Command run inside a session's shell on create (not reattach), e.g. `claude`. |
| `dtachSessions.redrawMethod` | `winch` | `-r` value on attach/create. One of `winch`, `ctrl_l`, `none`. See note below. |
| `dtachSessions.dtachPath` | `dtach` | Path to the dtach binary; set absolute if not on PATH. |

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
   and socket removed — renaming did not orphan it.
6. Reopen the remote window, click a session → it is still there and reattaches.
7. Select several rows → Kill, or use Kill All from the `…` menu → all gone.
8. Drag-select and right-click-copy work natively in the attached terminal.
