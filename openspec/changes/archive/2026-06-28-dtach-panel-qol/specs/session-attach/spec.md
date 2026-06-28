## ADDED Requirements

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
