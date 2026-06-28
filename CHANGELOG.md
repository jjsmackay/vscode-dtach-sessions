# Changelog

All notable changes to the **dtach Sessions** extension are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
