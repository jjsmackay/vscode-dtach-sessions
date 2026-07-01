# Changelog

All notable changes to the **dtach Sessions** extension are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2026-07-01

### Added

- **Stale client reaping.** A dtach client orphaned when its terminal died
  (window close, SSH drop) can wedge on the socket, leaving a later reattach
  with a live cursor on a blank screen. Attaching now reaps these orphans first
  so the new attach is the sole client and redraws cleanly
  (`dtachSessions.reapStaleClientsOnAttach`, on by default; disable if you
  deliberately attach one session from multiple windows). Reap on demand with
  **Reap Stale Clients** (row) or **Reap All Stale Clients** (view title).
  Reaping only ever kills clients — the session and its program keep running.
  Linux remote hosts only.

### Changed

- Kill now terminates sessions with `SIGKILL`, so a wedged client that blocks
  `SIGTERM` no longer survives a kill orphaned on the socket.

## [0.2.0] - 2026-06-29

### Added

- **Live Claude status on session rows.** Each row shows the run-state of a
  Claude Code instance running inside it — working, running a tool, waiting on
  you, or idle. State appears as a text badge and a row icon: a spinner while
  busy and an amber bell when Claude needs your attention. Enable it with the
  **dtach Sessions: Install Claude Status Hooks** command (or the one-time
  prompt); toggle with `dtachSessions.showClaudeStatus` (on by default). Linux
  remote hosts only.
- **Install Claude Status Hooks** and **Uninstall Claude Status Hooks**
  commands. Install wires a small forwarder into `~/.claude/settings.json`,
  merged alongside any hooks you already have; uninstall removes only its
  entries.

### Changed

- When live status is available, a row's relative time is measured from
  Claude's last activity (time in the current state, or since it last acted)
  instead of the socket's mtime.

## [0.1.6] - 2026-06-29

First public release on the Visual Studio Marketplace. Packaging and metadata
only — no behaviour changes.

### Added

- Marketplace gallery icon.

### Changed

- Search-friendly description and expanded keywords for discoverability.
- Repository, bugs, and homepage metadata.

## [0.1.5] - 2026-06-29

### Added

- Reflect the attached program's title in the terminal tab, so an agent CLI's
  live status drives the tab name (`dtachSessions.reflectProcessTitle`, on by
  default).
- Inline detach / attach / restart row actions on each session in the sidebar.

## [0.1.4] - 2026-06-28

### Added

- Panel quality-of-life: rename, quick-switch, copy socket path / attach
  command, detach, and kill-all.

## [0.1.3] - 2026-06-28

### Changed

- Open-or-create semantics for the folder context-menu command.

## [0.1.2] - 2026-06-28

### Fixed

- Dedupe session names on collision.

## [0.1.1] - 2026-06-28

### Added

- Folder context-menu command to create a session.

## [0.1.0] - 2026-06-28

### Added

- Initial release: list `dtach` sockets in a sidebar and attach to them in
  native integrated terminals on the remote extension host, with terminal
  reuse that survives a window reload.

[0.2.0]: https://github.com/jjsmackay/vscode-dtach-sessions/compare/v0.1.6...v0.2.0
[0.1.6]: https://github.com/jjsmackay/vscode-dtach-sessions/compare/v0.1.5...v0.1.6
[0.1.5]: https://github.com/jjsmackay/vscode-dtach-sessions/compare/v0.1.4...v0.1.5
[0.1.4]: https://github.com/jjsmackay/vscode-dtach-sessions/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/jjsmackay/vscode-dtach-sessions/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/jjsmackay/vscode-dtach-sessions/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/jjsmackay/vscode-dtach-sessions/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/jjsmackay/vscode-dtach-sessions/releases/tag/v0.1.0
