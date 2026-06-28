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

### Requirement: Terminal name
The terminal created for an attach SHALL be named after the session (display name, not the socket path).

#### Scenario: Terminal label
- **WHEN** attaching to `~/.claude-web.dtach`
- **THEN** the terminal tab title is `web`

### Requirement: Configurable dtach binary
The attach command SHALL use the binary named by the `dtachSessions.dtachPath` setting (default `dtach`) as the terminal `shellPath`. The same setting SHALL be used by the create and kill commands.

#### Scenario: Default binary
- **WHEN** `dtachPath` is unset
- **THEN** the terminal `shellPath` is `dtach`, resolved against the extension-host PATH

#### Scenario: Absolute binary path
- **WHEN** `dtachPath` is set to `/home/user/.local/bin/dtach`
- **THEN** the terminal `shellPath` is that absolute path

### Requirement: Reuse existing terminal
Clicking a session that already has a live terminal SHALL focus that terminal rather than opening a second attach. The lookup SHALL query the live `vscode.window.terminals` list (matching the socket in a terminal's launch args, falling back to the terminal name) rather than an in-memory map, so reuse survives a window reload — which restores terminals but restarts the extension host.

#### Scenario: Repeat click focuses existing terminal
- **WHEN** user clicks a session that already has a live terminal
- **THEN** the existing terminal is shown and no second terminal is created

#### Scenario: Reuse after window reload
- **WHEN** the user reloads the window with a session's terminal open, then clicks that session
- **THEN** the restored terminal is focused and no second terminal is created

#### Scenario: Click after terminal closed
- **WHEN** the user closed the session's terminal and then clicks the session again
- **THEN** a new terminal is created and attached

### Requirement: Native terminal features
Because the terminal is an ordinary integrated terminal with dtach as the shell process, the extension SHALL NOT intercept or translate mouse events, clipboard operations, or scroll input. These MUST pass through to the dtach-attached program unchanged.

#### Scenario: Mouse select
- **WHEN** the user drag-selects text in an attached terminal
- **THEN** the selection is handled by the VS Code terminal renderer natively
