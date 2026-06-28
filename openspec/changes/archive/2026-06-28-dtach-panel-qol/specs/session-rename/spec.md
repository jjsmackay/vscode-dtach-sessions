## ADDED Requirements

### Requirement: Rename session command
The extension SHALL provide a "Rename" command in the tree item right-click context menu. Activating it SHALL prompt for a new name (validated with the same rules as create), move the session's socket file to `<socketDir>/<socketPrefix><newName>_<hash>.dtach` — preserving the session's existing `<hash>` and changing only the name part — and refresh the tree. Because the dtach server's listening socket is bound to the socket inode, moving the socket file SHALL preserve the live session for clients that connect via the new path. Because the `<hash>` is preserved, the session SHALL remain resolvable by Kill via the hash anchor.

#### Scenario: Rename a session
- **WHEN** the user right-clicks a session `web` (socket `web_a1b2c3.dtach`), selects Rename, enters `api`, and confirms
- **THEN** the socket file is moved to `<socketDir>/<socketPrefix>api_a1b2c3.dtach`, the tree shows `api`, and `web` no longer appears

#### Scenario: Renamed session is still killable
- **WHEN** the user renames `web_a1b2c3.dtach` to `api_a1b2c3.dtach` and then invokes Kill on it
- **THEN** Kill resolves the dtach process via the preserved hash (`pgrep -f '_a1b2c3\.dtach'`), terminates it, and removes the socket

#### Scenario: User cancels rename
- **WHEN** the user activates Rename but dismisses the input box
- **THEN** the socket file is unchanged and the tree is unchanged

#### Scenario: New name invalid
- **WHEN** the user enters a name that is empty, whitespace-only, or contains `/` or whitespace
- **THEN** the input box shows a validation message and the rename cannot be submitted

#### Scenario: New name collides with an existing session
- **WHEN** the user renames `web` to `api` and a session displaying as `api` already exists
- **THEN** the rename is refused with a message and no socket file is overwritten

### Requirement: Rename updates an open terminal
If a terminal in the current window is attached to the renamed session, the extension SHALL ensure the terminal carries the new display name so the tab title stays consistent. Because VS Code provides no terminal-rename API, the extension MAY dispose the old terminal and reattach the session under the new name. Terminal reuse SHALL subsequently resolve to the session under its new name.

#### Scenario: Open terminal reflects the new name
- **WHEN** the user renames a session whose terminal is currently open in this window
- **THEN** after the rename a terminal attached to the session carries the new name

#### Scenario: No open terminal
- **WHEN** the user renames a session that has no open terminal in this window
- **THEN** the rename succeeds and only the socket file and tree are updated
