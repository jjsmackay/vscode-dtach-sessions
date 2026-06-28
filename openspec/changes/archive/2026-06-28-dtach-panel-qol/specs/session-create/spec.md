## MODIFIED Requirements

### Requirement: Socket path construction
The socket path SHALL be `<socketDir>/<socketPrefix><name>_<hash>.dtach` with `~` expanded to `os.homedir()`, where `<hash>` is the session's stable id (see "Stable session id"). The `socketPrefix` SHALL default to empty (`""`).

#### Scenario: Default config
- **WHEN** `socketDir` is `~/.dtach-sessions`, `socketPrefix` is the default empty string, name is `web`, and the hash is `a1b2c3`
- **THEN** socket path is `/home/<user>/.dtach-sessions/web_a1b2c3.dtach`

#### Scenario: Configured prefix
- **WHEN** `socketPrefix` is set to `claude-`, name is `web`, and the hash is `a1b2c3`
- **THEN** socket path is `/home/<user>/.dtach-sessions/claude-web_a1b2c3.dtach`

## ADDED Requirements

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
