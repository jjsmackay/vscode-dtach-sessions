# session-create Specification

## Purpose

Creating new dtach sessions — by name from the view title bar or for a folder from the Explorer context menu — including name validation, collision handling, shell selection, and socket path/directory setup.

## Requirements

### Requirement: Create session command
The extension SHALL provide a "+" command in the view title bar. Activating it SHALL prompt the user for a session name, then open an integrated terminal running `dtach -A <socket> -r <redraw> <shell>`.

#### Scenario: Successful create
- **WHEN** user activates the create command, enters `api`, and `redrawMethod` is `winch`
- **THEN** a terminal opens running `dtach -A ~/.claude-api.dtach -r winch /bin/bash` (or `$SHELL`) and the tree refreshes

#### Scenario: User cancels input
- **WHEN** user activates the create command but dismisses the input box
- **THEN** no terminal is opened and the tree is unchanged

### Requirement: Open session for a folder
The extension SHALL contribute a single "Open in Detach Session" command to the Explorer folder context menu (`explorer/context` with `when: explorerResourceIsFolder`). Activating it SHALL always open a QuickPick (never silently reuse or create). The QuickPick's input box SHALL be prefilled with the folder's basename sanitised to a valid session name, and SHALL remain editable. The QuickPick SHALL present, below the input:

- one "Attach" item for each existing session whose name is in the folder's name family — the basename itself and any `basename-N` numeric-suffix siblings — ordered newest-first, each item's description showing that session's live status label; and
- one "New session" item whose label reflects the current input value.

Selecting an "Attach" item SHALL open that session (reusing its open terminal if present, otherwise attaching). Selecting the "New session" item SHALL create a new session with the shell's working directory set to the folder, using the input value deduped via the numeric-suffix rule (see "Unique session name on collision"). Dismissing the QuickPick SHALL open and create nothing.

Reuse ("Attach") items SHALL remain selectable while the user edits the input value; the QuickPick's default value-based item filtering SHALL NOT hide them.

Matching is by name (basename) only; session working directory is not persisted, so two unrelated folders sharing a basename share one name family.

#### Scenario: Folder has no session yet
- **WHEN** the user right-clicks a folder `detach-sessions` with no existing session and accepts the prefilled input
- **THEN** the QuickPick shows only a "New session" item, and on accept a session named `detach-sessions` is created with its shell rooted in that folder

#### Scenario: Folder already has sessions
- **WHEN** the user right-clicks a folder `detach-sessions` with existing sessions `detach-sessions` and `detach-sessions-2`
- **THEN** the QuickPick lists an "Attach" item for each (newest-first, with status), plus a "New session" item, and selecting an "Attach" item opens that session rather than creating a duplicate

#### Scenario: Create a second session for a folder
- **WHEN** the user right-clicks a folder `detach-sessions` whose session already exists and selects the "New session" item
- **THEN** a new session is created rooted in that folder, named `detach-sessions-2` (next free numeric suffix)

#### Scenario: Custom name in the input box
- **WHEN** the user right-clicks a folder `detach-sessions`, edits the input to `runner`, and selects "New session"
- **THEN** a new session named `runner` is created rooted in that folder, and the "Attach" items for the `detach-sessions` family remain visible while editing

#### Scenario: Folder name needs sanitizing
- **WHEN** the user right-clicks a folder named `My Project`
- **THEN** the input box is prefilled with `My-Project` (whitespace and slashes replaced)

#### Scenario: User dismisses the QuickPick
- **WHEN** the user right-clicks a folder and dismisses the QuickPick
- **THEN** no terminal is opened and no session is created

### Requirement: Name validation
The create input box SHALL validate the entered name via `validateInput` and reject any name that is empty, is whitespace-only, or contains `/`, whitespace, or other characters that would break the constructed socket path. Rejection SHALL show an inline validation message and prevent submission.

#### Scenario: Name contains a slash
- **WHEN** user enters a name containing `/`
- **THEN** the input box shows a validation message and the name cannot be submitted

#### Scenario: Empty name
- **WHEN** user enters an empty or whitespace-only name
- **THEN** the input box shows a validation message and the name cannot be submitted

#### Scenario: Valid name accepted
- **WHEN** user enters `api`
- **THEN** the input validates and the create proceeds

### Requirement: Unique session name on collision
Create SHALL always produce a new session. If the chosen name's socket already exists, the extension SHALL append the smallest free numeric suffix (`-2`, `-3`, ...) and use that name, informing the user when the name was changed. The underlying `dtach -A` remains idempotent, but it is given an unused socket so it creates rather than reattaches.

For the folder QuickPick, the input box is prefilled with the raw basename (not pre-deduplicated); deduplication is applied when the "New session" item is accepted.

#### Scenario: Name collision bumps a digit
- **WHEN** the user creates a session named `foo` and `.claude-foo.dtach` already exists
- **THEN** the session is created as `foo-2` (or the next free suffix) and the user is notified

#### Scenario: Folder input prefilled with raw basename
- **WHEN** the user right-clicks a folder `foo` whose session already exists
- **THEN** the QuickPick input is prefilled with `foo` (not `foo-2`), and accepting "New session" creates `foo-2`

### Requirement: New session in an existing session's directory
The extension SHALL contribute a "New Session Here" command to the session row
context menu (`view/item/context`). Activating it on a session SHALL create a new
session whose shell working directory is that session's best-effort working
directory, named in the source session's name family — the family base (the
source name with any trailing `-N` numeric suffix removed) deduped via the
numeric-suffix rule (see "Unique session name on collision"). The command SHALL
NOT attach to or reuse any existing session; it always creates.

The working directory SHALL be resolved the same way as Restart: probe the
session's shell via `/proc`/`lsof`. When it cannot be resolved (no such tooling,
probe fails, or process gone), the new session SHALL be rooted at `$HOME`
silently, with no error. Because detach kills only the client while the dtach
master and its shell survive, the probe succeeds for detached sessions as well
as attached ones.

The command SHALL appear in the context menu only (no inline row icon).

#### Scenario: New session in an attached session's directory
- **WHEN** the user right-clicks an attached session `api` whose shell is at `/srv/api` and selects "New Session Here"
- **THEN** a new session named `api-2` (next free numeric suffix) is created with its shell rooted at `/srv/api`

#### Scenario: Source name is already a family sibling
- **WHEN** the user selects "New Session Here" on a session `api-2` and `api`, `api-2` already exist
- **THEN** the family base `api` is used and the new session is named `api-3` (not `api-2-2`)

#### Scenario: Working directory cannot be resolved
- **WHEN** the user selects "New Session Here" but the session's shell working directory cannot be determined
- **THEN** a new family sibling is created rooted at `$HOME` and no error is shown

#### Scenario: Detached source session
- **WHEN** the user selects "New Session Here" on a detached session whose master and shell are still alive at `/srv/api`
- **THEN** the working directory resolves to `/srv/api` and the new session is rooted there

### Requirement: Shell selection
The shell started inside the new dtach session SHALL be the value of the `$SHELL` environment variable. If `$SHELL` is unset or empty, the extension SHALL fall back to `/bin/bash`.

#### Scenario: SHELL set
- **WHEN** `$SHELL` is `/usr/bin/zsh`
- **THEN** the terminal runs `dtach -A <socket> -r winch /usr/bin/zsh`

#### Scenario: SHELL unset
- **WHEN** `$SHELL` is not set
- **THEN** the terminal runs `dtach -A <socket> -r winch /bin/bash`

### Requirement: Socket path construction
The socket path SHALL be `<socketDir>/<socketPrefix><name>_<hash>.dtach` with `~` expanded to `os.homedir()`, where `<hash>` is the session's stable id (see "Stable session id"). The `socketPrefix` SHALL default to empty (`""`).

#### Scenario: Default config
- **WHEN** `socketDir` is `~/.dtach-sessions`, `socketPrefix` is the default empty string, name is `web`, and the hash is `a1b2c3`
- **THEN** socket path is `/home/<user>/.dtach-sessions/web_a1b2c3.dtach`

#### Scenario: Configured prefix
- **WHEN** `socketPrefix` is set to `claude-`, name is `web`, and the hash is `a1b2c3`
- **THEN** socket path is `/home/<user>/.dtach-sessions/claude-web_a1b2c3.dtach`

### Requirement: Socket directory creation
The create command SHALL ensure the socket directory exists (creating it recursively) before launching dtach, so the default dedicated directory works on first use. If the directory cannot be created, it SHALL show an error and not launch.

#### Scenario: Directory created on first session
- **WHEN** the socket directory does not yet exist and the user creates a session
- **THEN** the directory is created and the session launches

#### Scenario: Directory cannot be created
- **WHEN** the socket directory cannot be created (e.g. permissions)
- **THEN** an error is shown and no terminal is opened

### Requirement: Stable session id
On create, the extension SHALL generate a random 6-character lowercase-hex hash (e.g. `crypto.randomBytes(3).toString('hex')`) and embed it in the socket filename as `<name>_<hash>.dtach`. The hash is the session's rename-invariant identity: because it is part of the dtach process's launch argv, the process remains resolvable by the hash even after the socket file is moved. If the generated hash collides with an existing socket of the same name, the extension SHALL regenerate it.

#### Scenario: Hash embedded on create
- **WHEN** the user creates a session named `web`
- **THEN** the socket file is named `web_<hash>.dtach` where `<hash>` is 6 hex characters, and the dtach process argv contains that path

#### Scenario: Display name omits the hash
- **WHEN** the socket file is `web_a1b2c3.dtach`
- **THEN** the tree item label is `web` (the `_<hash>` and `.dtach` are stripped)

### Requirement: Created terminal naming
A terminal opened by the create command (by name or for a folder) SHALL follow the same naming rule as attach: when `dtachSessions.reflectProcessTitle` is `true` (the default) it SHALL be created without an API `name` so the program's title drives the tab; when `false` it SHALL be named after the session display name. On create, the extension SHALL record a `socket → processId` association in `workspaceState` so the new terminal participates in reuse-after-reload identically to an attached one.

#### Scenario: Create with reflect enabled
- **WHEN** `reflectProcessTitle` is `true` and the user creates a session `web`
- **THEN** the terminal is created without an API name, and a `socket → processId` association for `web` is recorded

#### Scenario: Create with reflect disabled
- **WHEN** `reflectProcessTitle` is `false` and the user creates a session `web`
- **THEN** the terminal is created with `name: "web"` and the tab title is `web`

### Requirement: Startup command on create
The extension SHALL provide a `dtachSessions.startupCommand` setting (default empty). When non-empty, the configured command SHALL be sent to a session's shell immediately after the session is created (not when attaching to or reusing an existing session), so a fresh session can auto-run a program such as `claude`.

#### Scenario: Startup command runs on create
- **WHEN** `startupCommand` is `claude` and the user creates a new session
- **THEN** after the shell starts, `claude` is sent to the terminal followed by a newline

#### Scenario: Empty startup command does nothing
- **WHEN** `startupCommand` is empty and the user creates a session
- **THEN** only the shell starts and no command is sent

#### Scenario: Startup command does not run on reattach
- **WHEN** `startupCommand` is non-empty and the user opens a session that already exists
- **THEN** the existing session is attached and the startup command is not sent again
