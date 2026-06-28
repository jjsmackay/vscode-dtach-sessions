## Context

dtach is a terminal session manager that detaches a program from its controlling terminal. Sessions are represented as Unix domain socket files. There is no session-listing command; the socket files themselves are the session list.

The extension targets the VS Code Remote-SSH workflow: the user's laptop runs VS Code, the remote Linux host runs dtach and Claude. The extension must therefore execute on the remote extension host, not the local one.

Current state: users must SSH into the host and run `dtach -a <socket> -r winch` manually from the integrated terminal each time they want to reattach.

## Goals / Non-Goals

**Goals:**
- List dtach session sockets from a configurable directory in a VS Code tree view.
- Attach to a session with a single click, opening a normal integrated terminal.
- Create a new named session via a "+" command.
- Kill a session via a right-click context menu.
- Run entirely on the remote extension host with no bundler or npm dependencies beyond VS Code API and Node stdlib.

**Non-Goals:**
- Live/dead liveness probing (stale sockets are harmless with `-A`; errors on `-a` are acceptable).
- Session persistence across host reboots.
- Rename, drag-reorder, notifications, cost/context display.
- Remote Control (`/rc`) integration.
- Webview, PTY proxy, or mouse-event translation.

## Decisions

### extensionKind: ["workspace"]

The extension MUST declare `"extensionKind": ["workspace"]` in package.json. This forces VS Code to load it on the remote extension host under Remote-SSH. Without this, VS Code may run it on the local host, where the dtach sockets don't exist and `fs.readdir` finds nothing.

**Alternatives considered:** `"extensionKind": ["ui", "workspace"]` — rejected because it allows local fallback, which would silently list nothing in the common Remote-SSH case and mask misconfiguration.

### Terminal creation via shellPath/shellArgs

Terminals are created with `vscode.window.createTerminal({ name, shellPath: 'dtach', shellArgs: [...] })`. This makes dtach the shell process, so the terminal is a pure passthrough — mouse, copy, scroll, and search all work natively.

**Alternatives considered:** Sending a command via `terminal.sendText()` after creating a shell terminal — rejected because it requires a functioning shell first and introduces a race between terminal readiness and command dispatch.

### -r winch on every attach and create

Every `dtach -a` and `dtach -A` invocation includes `-r winch`. This sends a SIGWINCH to the detached program on reattach, forcing it to redraw at the terminal's current size. Without it, Claude's TUI renders blank until the pane is manually resized.

**Alternatives considered:** `ctrl_l` (exposed via the `redrawMethod` config) — useful for same-size reattaches; `winch` is the default because it handles size changes and same-size reattaches.

### Socket listing via fs.readdir (no liveness probe)

`fs.readdir(socketDir)` + filter by prefix and `.dtach` suffix is the complete listing implementation. No `net.connect()` liveness probe is performed.

**Rationale:** A stale socket causes `dtach -a` to fail with a clear error; `dtach -A` recreates the session. The overhead of probing every socket on each refresh is unjustified for v1.

### Kill via child_process.exec (lsof → escaped pgrep → rm)

The kill command runs via `child_process.exec`. There is no dtach kill subcommand, so the holding process must be found by its socket. Process resolution is layered for precision:

1. `lsof -t <socket>` returns the exact PID(s) of the socket LISTENer. This was verified empirically to return only the owning dtach process and nothing else.
2. If `lsof` is absent, fall back to `pgrep -f <pattern>` where `<pattern>` is the socket path with regex metacharacters escaped.
3. `kill` the resolved PID(s), then `rm -f <socket>` unconditionally (stale-socket cleanup proceeds even when no process is found).

**Why not pgrep alone:** `pgrep -f` treats its pattern as an ERE. Socket paths contain `.` metacharacters, so an unescaped pattern like `/home/u/.claude-foo.dtach` matches unrelated command lines — verified: the pattern matched `/tmp/Xclaude-fooYdtach-server`. `pgrep -f` is also unanchored and substring-matching, so it can hit live `dtach -a` client terminals and any process whose arguments contain the path. `lsof -t` avoids all of this by matching the socket inode directly. Escaping the pgrep pattern removes the metacharacter hazard in the fallback path, though the unanchored/client-match caveat remains.

**Alternatives considered:** `fuser <socket>` — rejected, not installed on the test host (`lsof` was). Running via a throwaway terminal — rejected because it would flash a terminal window; `exec` is invisible.

### dtach binary located via dtachPath config

A `dtachSessions.dtachPath` setting (default `"dtach"`) supplies the binary for all attach/create/kill invocations. The VS Code extension-host PATH is not the user's login-shell PATH (`.bashrc` is not sourced), so a bare `dtach` can fail to resolve on hosts where the binary lives in `~/.local/bin` or `/usr/local/bin`. The default keeps the common case zero-config; users on non-standard hosts set an absolute path.

**Alternatives considered:** Probing common install locations on activation — rejected as more startup code for marginal benefit over an explicit setting.

### Reuse terminal on repeat attach

The extension tracks terminals it creates, keyed by socket path, and clears entries on `onDidCloseTerminal`. Clicking a session that already has a live terminal calls `.show()` on it rather than opening a second client. dtach permits multiple mirrored clients, but a second terminal for the same session is almost always an accident.

### Auto-refresh on view visibility

The tree refreshes on `onDidChangeVisibility` when the view becomes visible, so sessions created outside the extension appear without a manual click. The manual refresh button is retained. `fs.watch` was considered but rejected for v1 — visibility refresh covers the realistic case with less surface area.

### No bundler for v1

Plain `tsc` compiles `src/*.ts` to `out/*.js`. The VS Code extension host can load CommonJS modules directly, so no webpack/esbuild is needed.

## Risks / Trade-offs

- **`dtach` not resolvable** → `createTerminal` opens a terminal that immediately exits with "command not found". Mitigation: `dtachPath` setting lets the user point at an absolute path; README documents it.
- **Stale socket listed** → Clicking attach opens a terminal that errors immediately. Acceptable; `-A` (create) clears it idempotently.
- **Both `lsof` and `pgrep` unavailable** → Kill removes the socket but cannot terminate the process, leaking an orphaned dtach server until reboot. Very rare on modern Linux. Mitigation: documented in README.
- **Escaped-pgrep fallback still matches clients** → When `lsof` is absent, the fallback may also kill live `dtach -a` client terminals for the same socket. Acceptable: those terminals are attached to the session being killed anyway.
- **Remote-SSH session not active** → Extension is simply not loaded. No mitigation needed; this is expected behaviour.
