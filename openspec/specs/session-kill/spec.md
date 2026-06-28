# session-kill Specification

## Purpose

Killing a dtach session: terminating the owning server process and cleaning up its socket file, with explicit confirmation and safe process matching.

## Requirements

### Requirement: Kill command
The extension SHALL provide a "Kill" command in the tree item right-click context menu. Activating it SHALL terminate the dtach server process holding the socket and remove the socket file.

#### Scenario: Kill a session
- **WHEN** user right-clicks a session row, selects Kill, and confirms
- **THEN** the dtach process whose arguments contain the socket path is killed, the socket file is removed, and the tree refreshes

### Requirement: Confirmation before kill
The kill command SHALL require explicit user confirmation before terminating the session.

#### Scenario: User confirms
- **WHEN** the confirmation dialog is shown and the user confirms
- **THEN** the kill proceeds

#### Scenario: User cancels
- **WHEN** the confirmation dialog is shown and the user dismisses or declines it
- **THEN** no process is killed, no socket is removed, and the tree is unchanged

### Requirement: Process termination and socket cleanup
The kill SHALL resolve the owning process via `lsof -t <socket>` and terminate the returned PID(s). If `lsof` is unavailable, it SHALL fall back to `pgrep -f <pattern>` where `<pattern>` is the socket path with regex metacharacters escaped. After terminating any resolved process, it SHALL remove the socket with `rm -f <socket>`. Socket removal SHALL proceed even if no process is found (stale socket cleanup).

#### Scenario: Live session killed via lsof
- **WHEN** a dtach process holds the socket and `lsof` is available
- **THEN** the PID returned by `lsof -t <socket>` is killed and the socket file is removed

#### Scenario: lsof unavailable
- **WHEN** `lsof` is not installed on the host
- **THEN** the kill falls back to `pgrep -f` with the regex-escaped socket path, kills the matches, and removes the socket file

#### Scenario: Stale socket with no process
- **WHEN** the socket file exists but no process holds it
- **THEN** the socket file is still removed and no error is shown

### Requirement: Safe pattern matching
The fallback `pgrep` pattern SHALL have regex metacharacters in the socket path escaped, so that path characters such as `.` match literally and do not match unrelated processes.

#### Scenario: Metacharacters escaped
- **WHEN** the socket path contains `.` characters and the kill falls back to `pgrep`
- **THEN** the `.` characters are matched literally and processes whose command lines merely resemble the path under regex wildcards are not killed
