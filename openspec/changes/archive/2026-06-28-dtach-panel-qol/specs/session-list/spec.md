## MODIFIED Requirements

### Requirement: Socket discovery
The extension SHALL read the configured socket directory (default `~/.dtach-sessions`) and return all entries whose names end with `.dtach`, start with the configured prefix (`socketPrefix`), and are sockets (`fs.statSync(entry).isSocket()`). The prefix SHALL default to empty (`""`), so that the `.dtach` suffix plus the socket-type check are the discriminator and the dedicated directory acts as the namespace. The directory path SHALL be resolved by expanding a leading `~` to `os.homedir()`.

#### Scenario: Sockets present
- **WHEN** the socket directory contains socket files ending in `.dtach`
- **THEN** each appears as a tree item with a display name equal to the basename with the configured prefix, the `_<hash>` segment, and trailing `.dtach` stripped

#### Scenario: Non-socket .dtach file ignored
- **WHEN** the directory contains a regular (non-socket) file named `notes.dtach`
- **THEN** it does not appear in the tree

#### Scenario: Empty default prefix lists every socket
- **WHEN** `socketPrefix` is the default empty string and the directory contains `web_a1b2c3.dtach` and `api_d4e5f6.dtach`
- **THEN** both appear as `web` and `api`

#### Scenario: Non-socket files are ignored
- **WHEN** the directory contains files that do not end in `.dtach` (e.g. `.DS_Store`, a swap file, a note)
- **THEN** those files do not appear in the tree

#### Scenario: Non-empty prefix still filters
- **WHEN** `socketPrefix` is set to `claude-` and the directory contains `claude-web_a1b2c3.dtach` and `other_d4e5f6.dtach`
- **THEN** only `web` appears

#### Scenario: No matching sockets
- **WHEN** the socket directory contains no files ending in `.dtach`
- **THEN** the tree view shows the welcome empty-state and no error is shown

#### Scenario: Socket directory does not exist
- **WHEN** the configured socket directory path does not exist
- **THEN** the tree view shows the welcome empty-state and no error is shown (a missing default directory is normal before the first session)

#### Scenario: Socket directory cannot be read
- **WHEN** the socket directory exists but cannot be read (e.g. permissions)
- **THEN** the tree view is empty and an error message is shown to the user

### Requirement: Tree view display
The extension SHALL render the session list in a dedicated VS Code activity-bar sidebar container. Each socket SHALL be displayed as a single-level tree item with no children.

#### Scenario: Display name derivation with default prefix
- **WHEN** the socket basename is `web_a1b2c3.dtach` and the prefix is the default empty string
- **THEN** the tree item label is `web` (the `_<hash>` and trailing `.dtach` stripped)

#### Scenario: Display name derivation with a configured prefix
- **WHEN** the socket basename is `claude-web_a1b2c3.dtach` and the prefix is `claude-`
- **THEN** the tree item label is `web` (configured prefix, `_<hash>`, and `.dtach` suffix stripped)

#### Scenario: Legacy socket without a hash
- **WHEN** the socket basename is `web.dtach` (no `_<hash>` segment)
- **THEN** the tree item label is `web` (only the prefix and `.dtach` stripped)

## ADDED Requirements

### Requirement: Welcome empty-state
When the session list is empty, the view SHALL display a welcome empty-state (a `viewsWelcome` contribution) with explanatory text and a button that invokes the create command, rather than a blank panel.

#### Scenario: Empty panel shows call-to-action
- **WHEN** no sessions exist and the user opens the view
- **THEN** the view shows welcome text and a "New Session" button

#### Scenario: Welcome button creates a session
- **WHEN** the user clicks the "New Session" button in the empty-state
- **THEN** the create command runs

### Requirement: Sort by recency with relative age
The extension SHALL order sessions by socket file modification time, most recently modified first, and SHALL display a relative age (e.g. "2h ago") as the tree item description. The age is a weak activity hint derived from the socket mtime, not a guarantee of in-session activity.

#### Scenario: Most recent first
- **WHEN** the directory contains sockets with differing modification times
- **THEN** the tree lists them with the most recently modified at the top

#### Scenario: Relative age shown
- **WHEN** a session's socket was last modified two hours ago
- **THEN** the tree item description reads approximately "2h ago"

### Requirement: Terminal-open indicator
Sessions that have a live terminal in the current window SHALL be visually distinguished from sessions with no open terminal, using the existing terminal lookup (matching the socket in a terminal's launch args, falling back to the terminal name). The indicator SHALL update automatically when a terminal opens or closes — the extension SHALL refresh the tree on the terminal open/close lifecycle events, not only on manual refresh.

#### Scenario: Attached session is marked
- **WHEN** a session has a live terminal open in the current window
- **THEN** its tree item is visually distinguished (e.g. a distinct icon or description marker) from sessions with no open terminal

#### Scenario: Indicator clears when terminal closes
- **WHEN** the user closes or detaches a session's terminal
- **THEN** the tree refreshes automatically and that session is no longer marked as having an open terminal

#### Scenario: Indicator sets when a terminal opens
- **WHEN** the user attaches a session and its terminal opens
- **THEN** the tree refreshes automatically and that session is marked as having an open terminal
