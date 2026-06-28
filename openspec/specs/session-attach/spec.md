# session-attach Specification

## Purpose

Attaching to a dtach session by opening a native VS Code integrated terminal whose shell process is `dtach`, with no webview or PTY proxy in between.

## Requirements

### Requirement: Attach on click
The extension SHALL open an integrated terminal attached to a dtach session when the user clicks a tree item. The terminal SHALL be created using `vscode.window.createTerminal` with `shellPath: 'dtach'` and `shellArgs` derived from the socket path and configured redraw method.

#### Scenario: Attach with winch redraw
- **WHEN** user clicks a session row and `redrawMethod` is `winch`
- **THEN** a terminal opens running `dtach -a <socket> -r winch` and is immediately focused

#### Scenario: Attach with ctrl_l redraw
- **WHEN** user clicks a session row and `redrawMethod` is `ctrl_l`
- **THEN** a terminal opens running `dtach -a <socket> -r ctrl_l`

#### Scenario: Attach with no redraw
- **WHEN** user clicks a session row and `redrawMethod` is `none`
- **THEN** a terminal opens running `dtach -a <socket>` with no `-r` flag

### Requirement: Reflect process title setting
The extension SHALL provide a `dtachSessions.reflectProcessTitle` boolean setting, default `true`. The setting controls terminal naming for attach and create: when `true`, attach/create terminals are created without an API `name` so the attached program's title drives the tab; when `false`, the extension pins the session display name as the terminal name.

#### Scenario: Default value
- **WHEN** the setting is not configured
- **THEN** `reflectProcessTitle` resolves to `true`

#### Scenario: Disabled
- **WHEN** the user sets `dtachSessions.reflectProcessTitle` to `false`
- **THEN** attach/create terminals are named after the session

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

### Requirement: Configurable dtach binary
The attach command SHALL use the binary named by the `dtachSessions.dtachPath` setting (default `dtach`) as the terminal `shellPath`. The same setting SHALL be used by the create and kill commands.

#### Scenario: Default binary
- **WHEN** `dtachPath` is unset
- **THEN** the terminal `shellPath` is `dtach`, resolved against the extension-host PATH

#### Scenario: Absolute binary path
- **WHEN** `dtachPath` is set to `/home/user/.local/bin/dtach`
- **THEN** the terminal `shellPath` is that absolute path

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

### Requirement: Native terminal features
Because the terminal is an ordinary integrated terminal with dtach as the shell process, the extension SHALL NOT intercept or translate mouse events, clipboard operations, or scroll input. These MUST pass through to the dtach-attached program unchanged.

#### Scenario: Mouse select
- **WHEN** the user drag-selects text in an attached terminal
- **THEN** the selection is handled by the VS Code terminal renderer natively

### Requirement: Quick-switch picker
The extension SHALL provide a command-palette command that opens a quick-pick listing the current sessions (most recent first), with which the user can fuzzy-find and select a session to attach. Selecting a session SHALL attach it using the same reuse-or-create behaviour as clicking its tree row.

#### Scenario: Switch to a session from the palette
- **WHEN** the user runs the quick-switch command and selects `api`
- **THEN** the `api` session is attached, reusing its open terminal if one exists

#### Scenario: No sessions
- **WHEN** the user runs the quick-switch command and no sessions exist
- **THEN** the quick-pick reports that there are no sessions and nothing is attached

#### Scenario: User dismisses the picker
- **WHEN** the user opens the quick-switch picker and dismisses it
- **THEN** no session is attached

### Requirement: Copy socket path and attach command
The extension SHALL provide context-menu commands to copy a session's socket path, and its full attach command (`dtach -a <socket> -r <redraw>`), to the clipboard.

#### Scenario: Copy socket path
- **WHEN** the user right-clicks a session and selects "Copy Socket Path"
- **THEN** the absolute socket path is placed on the clipboard

#### Scenario: Copy attach command
- **WHEN** the user right-clicks a session and selects "Copy Attach Command"
- **THEN** the clipboard contains the attach command for that socket using the configured redraw method and dtach binary

### Requirement: Detach command
The extension SHALL provide a "Detach" command that closes the current window's terminal for a session without terminating the dtach server, leaving the session alive for later reattachment. If no terminal is open for the session, the command SHALL be a no-op.

#### Scenario: Detach an open session
- **WHEN** the user invokes Detach on a session whose terminal is open in this window
- **THEN** the terminal is disposed, the dtach session remains alive, and the session still appears in the tree

#### Scenario: Detach with no open terminal
- **WHEN** the user invokes Detach on a session with no open terminal in this window
- **THEN** nothing happens and no error is shown
