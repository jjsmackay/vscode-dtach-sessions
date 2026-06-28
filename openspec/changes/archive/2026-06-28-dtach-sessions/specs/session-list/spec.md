## ADDED Requirements

### Requirement: Socket discovery
The extension SHALL read the configured socket directory (default `~/.dtach-sessions`) and return all files whose names start with the configured prefix and end with `.dtach`. The directory path SHALL be resolved by expanding a leading `~` to `os.homedir()`.

#### Scenario: Sockets present
- **WHEN** the socket directory contains files matching `<prefix>*.dtach`
- **THEN** each matching file appears as a tree item with a display name equal to the basename with the configured prefix and trailing `.dtach` stripped

#### Scenario: No matching sockets
- **WHEN** the socket directory contains no files matching the pattern
- **THEN** the tree view is empty and no error is shown

#### Scenario: Socket directory does not exist
- **WHEN** the configured socket directory path does not exist
- **THEN** the tree view is empty and no error is shown (a missing default directory is normal before the first session)

#### Scenario: Socket directory cannot be read
- **WHEN** the socket directory exists but cannot be read (e.g. permissions)
- **THEN** the tree view is empty and an error message is shown to the user

### Requirement: Tree view display
The extension SHALL render the session list in a dedicated VS Code activity-bar sidebar container. Each socket SHALL be displayed as a single-level tree item with no children.

#### Scenario: Display name derivation
- **WHEN** the socket basename is `.claude-web.dtach` and the prefix is `.claude-`
- **THEN** the tree item label is `web` (configured prefix and `.dtach` suffix stripped)

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
