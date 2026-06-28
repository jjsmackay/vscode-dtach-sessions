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
The extension SHALL contribute an "Open in Detach Session" command to the Explorer folder context menu (`explorer/context` with `when: explorerResourceIsFolder`). The session SHALL be named after the folder's basename (sanitized to a valid session name), without prompting. If a session with that name already exists it SHALL be opened (its open terminal reused if present, otherwise attached); otherwise a new session SHALL be created with the shell's working directory set to that folder.

#### Scenario: Folder has no session yet
- **WHEN** the user right-clicks a folder `detach-sessions` with no existing session
- **THEN** a session named `detach-sessions` is created with its shell rooted in that folder

#### Scenario: Folder already has a session
- **WHEN** the user right-clicks a folder `detach-sessions` whose session already exists
- **THEN** that existing session is opened (reusing its terminal if one is open) rather than creating a duplicate

#### Scenario: Folder name needs sanitizing
- **WHEN** the user right-clicks a folder named `My Project`
- **THEN** the session name is `My-Project` (whitespace and slashes replaced)

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

#### Scenario: Name collision bumps a digit
- **WHEN** the user creates a session named `foo` and `.claude-foo.dtach` already exists
- **THEN** the session is created as `foo-2` (or the next free suffix) and the user is notified

#### Scenario: Folder default is pre-deduplicated
- **WHEN** the user right-clicks a folder `foo` whose session already exists
- **THEN** the name input is pre-filled with the next free name (e.g. `foo-2`)

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
