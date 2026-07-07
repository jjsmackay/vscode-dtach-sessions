# session-list Specification

## Purpose

Discovering dtach sockets on the host and rendering them as a sidebar tree view, kept current through manual refresh and automatic refresh on visibility and after create.

## Requirements

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

### Requirement: Manual refresh
The extension SHALL provide a refresh button in the view title bar. Activating it SHALL re-read the socket directory and update the tree.

#### Scenario: Refresh after new socket appears
- **WHEN** a new `.dtach` socket is created externally and the user clicks Refresh
- **THEN** the new session appears in the tree

### Requirement: Auto-refresh on visibility
The extension SHALL re-read the socket directory and update the tree when the view becomes visible (`onDidChangeVisibility`), so sessions created outside the extension appear without a manual refresh.

#### Scenario: Externally-created session appears on view focus
- **WHEN** a new `.dtach` socket is created outside the extension and the user switches to the view
- **THEN** the tree refreshes and the new session appears without clicking Refresh

### Requirement: Auto-refresh after create
After the create command launches a session, the extension SHALL poll for the socket file (which dtach writes asynchronously) and refresh the tree once it appears, so a newly created session shows without a manual refresh. It SHALL stop polling and refresh after a bounded timeout if the socket never appears.

#### Scenario: Created session appears without manual refresh
- **WHEN** the user creates a session and dtach writes the socket shortly after the terminal opens
- **THEN** the tree refreshes automatically once the socket exists and the session appears

### Requirement: Welcome empty-state
When the session list is empty, the view SHALL display a welcome empty-state (a `viewsWelcome` contribution) with explanatory text and a button that invokes the create command, rather than a blank panel.

#### Scenario: Empty panel shows call-to-action
- **WHEN** no sessions exist and the user opens the view
- **THEN** the view shows welcome text and a "New Session" button

#### Scenario: Welcome button creates a session
- **WHEN** the user clicks the "New Session" button in the empty-state
- **THEN** the create command runs

### Requirement: Configurable session order with relative age
The extension SHALL order sessions according to the `dtachSessions.sortBy` setting, which SHALL default to `created`. It SHALL support the following orders:

- `created` — by socket file modification time (`mtime`), most recent first. Because nothing is ever written to a dtach socket file, `mtime` is pinned at socket creation and does not move on attach or detach; this order is therefore stable for the life of a session (it changes only on restart, which recreates the socket).
- `lastAttached` — by socket inode change time (`ctime`), most recent first. `ctime` advances when a client attaches (and, more loosely, on reap or rename), giving a most-recently-used ordering.
- `name` — by display name, locale-aware ascending (`localeCompare`).
- `status` — by attention priority derived from the effective (post-decay) run-state: `waiting` first, then `working`/`tool`, then `done`, then sessions with no shown state; within each group by shown age, most recent first. When the status feature is off, every session falls into the no-state group and the order degrades to shown age.

Regardless of order, the extension SHALL display a relative age (e.g. "2h ago") as the tree item description. The age SHALL be activity-relative — derived from the session's live status timestamp when a status exists — and SHALL fall back to the socket `mtime` (the creation time) otherwise. The row tooltip SHALL label the socket `mtime` value as the creation time ("created …"), not as a modification time.

#### Scenario: Default order is created, most recent first
- **WHEN** `dtachSessions.sortBy` is unset (default) and the directory contains sockets with differing creation times
- **THEN** the tree lists them by socket `mtime` with the most recently created at the top

#### Scenario: Created order is stable across attach and detach
- **WHEN** the order is `created` and the user attaches to and then detaches from a session
- **THEN** the session's position does not change (socket `mtime` is unaffected by attach/detach)

#### Scenario: Last-attached order surfaces the most recently used
- **WHEN** the order is `lastAttached` and the user attaches to a session that was previously lower in the list
- **THEN** on the next refresh that session sorts to the top (its socket `ctime` advanced)

#### Scenario: Name order is alphabetic
- **WHEN** the order is `name`
- **THEN** sessions are listed by display name in locale-aware ascending order

#### Scenario: Status order puts waiting sessions first
- **WHEN** the order is `status` and one session is `waiting` (needs the user) while others are `working` or have no shown state
- **THEN** the `waiting` session sorts above the `working` sessions, which sort above the sessions with no shown state

#### Scenario: Relative age shown
- **WHEN** a session's last activity (or, absent a status, its socket creation) was two hours ago
- **THEN** the tree item description reads approximately "2h ago"

#### Scenario: Tooltip labels the creation time
- **WHEN** the user hovers a session row
- **THEN** the tooltip presents the socket `mtime` value as a creation time ("created …"), not as "last modified"

### Requirement: Sort order picker command
The extension SHALL contribute a view-title command that opens a QuickPick listing the available orders, marking the currently active order. Selecting an order SHALL persist it to the `dtachSessions.sortBy` setting and refresh the tree.

#### Scenario: Picker shows and changes the active order
- **WHEN** the user activates the sort command and selects an order different from the current one
- **THEN** the choice is written to `dtachSessions.sortBy`, the picker's active-order marker reflects it, and the tree re-renders in the new order

#### Scenario: Active order is marked
- **WHEN** the user opens the sort picker
- **THEN** the entry matching the current `dtachSessions.sortBy` value is visually marked as active

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
