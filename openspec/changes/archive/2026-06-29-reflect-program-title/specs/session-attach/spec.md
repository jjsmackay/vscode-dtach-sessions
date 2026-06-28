## ADDED Requirements

### Requirement: Reflect process title setting
The extension SHALL provide a `dtachSessions.reflectProcessTitle` boolean setting, default `true`. The setting controls terminal naming for attach and create: when `true`, attach/create terminals are created without an API `name` so the attached program's title drives the tab; when `false`, the extension pins the session display name as the terminal name.

#### Scenario: Default value
- **WHEN** the setting is not configured
- **THEN** `reflectProcessTitle` resolves to `true`

#### Scenario: Disabled
- **WHEN** the user sets `dtachSessions.reflectProcessTitle` to `false`
- **THEN** attach/create terminals are named after the session

## MODIFIED Requirements

### Requirement: Terminal name
Terminal naming for an attach SHALL depend on `dtachSessions.reflectProcessTitle`.

When `reflectProcessTitle` is `false`, the terminal SHALL be created with an API `name` equal to the session display name (not the socket path).

When `reflectProcessTitle` is `true` (the default), the terminal SHALL be created **without** an API `name`. Because dtach is pure passthrough, an attached program's title — set via an OSC window-title escape sequence — reaches the VS Code terminal and, with no API name overriding it, drives the tab title and updates live. The session's stable identity remains the sidebar row, not the tab.

#### Scenario: Reflect disabled keeps the session name
- **WHEN** `reflectProcessTitle` is `false` and the user attaches to session `api`
- **THEN** the terminal is created with `name: "api"` and the tab title is `api`

#### Scenario: Reflect enabled surfaces the program title
- **WHEN** `reflectProcessTitle` is `true` and the user attaches to a session whose program sets a window title via OSC
- **THEN** the terminal is created without an API name and the tab shows the program's title, updating as the program changes it

#### Scenario: Reflect enabled with a plain shell
- **WHEN** `reflectProcessTitle` is `true` and the attached program is a plain shell that sets no title
- **THEN** the tab shows VS Code's default process/shell title rather than the session name

### Requirement: Reuse existing terminal
Clicking a session that already has a live terminal SHALL focus that terminal rather than opening a second attach. The lookup SHALL query the live `vscode.window.terminals` list rather than an in-memory map, so reuse survives a window reload — which restores terminals but restarts the extension host.

A terminal SHALL be matched to a session by, in order: (1) the socket path in the terminal's launch args (`shellArgs`); then (2) a persisted `socket → processId` association recorded at attach/create time, compared against the terminal's `processId`. The pid fallback is required because a window reload destroys a restored terminal's `shellArgs` while preserving its `processId`, and because — when `reflectProcessTitle` is `true` — there is no API name to match on. When `reflectProcessTitle` is `false`, an additional fallback to `terminal.name === session display name` MAY be used.

The persisted association SHALL be recorded in `workspaceState` when a terminal is attached or created, and SHALL be removed when that terminal is closed.

#### Scenario: Repeat click focuses existing terminal
- **WHEN** user clicks a session that already has a live terminal
- **THEN** the existing terminal is shown and no second terminal is created

#### Scenario: Reuse after window reload
- **WHEN** the user reloads the window with a session's terminal open, then clicks that session
- **THEN** the restored terminal is matched by its persisted `processId` and focused, and no second terminal is created

#### Scenario: Click after terminal closed
- **WHEN** the user closed the session's terminal and then clicks the session again
- **THEN** a new terminal is created and attached, and a fresh `socket → processId` association is recorded
