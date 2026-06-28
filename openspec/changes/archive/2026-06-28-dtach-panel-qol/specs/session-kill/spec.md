## MODIFIED Requirements

### Requirement: Process termination and socket cleanup
The kill SHALL resolve the owning process via `lsof -t <socket>` on the session's current socket path. If `lsof` is unavailable or returns nothing (e.g. the socket was renamed, so its path no longer matches the dtach process argv), it SHALL fall back to `pgrep -f '_<hash>\.dtach'` using the hash extracted from the current filename — a rename-invariant anchor present in the process argv. For a legacy socket with no hash, it SHALL fall back to `pgrep -f <pattern>` where `<pattern>` is the socket path with regex metacharacters escaped. After terminating any resolved process, it SHALL remove the socket with `rm -f <socket>`. Socket removal SHALL proceed even if no process is found (stale socket cleanup).

#### Scenario: Live session killed via lsof
- **WHEN** a dtach process holds the socket at its launch path and `lsof` is available
- **THEN** the PID returned by `lsof -t <socket>` is killed and the socket file is removed

#### Scenario: Renamed session killed via hash anchor
- **WHEN** the socket was renamed so `lsof -t <socket>` and a full-path `pgrep` return nothing
- **THEN** the kill resolves the PID via `pgrep -f '_<hash>\.dtach'`, terminates it, and removes the socket

#### Scenario: Legacy socket without a hash
- **WHEN** the socket has no `_<hash>` segment and `lsof` returns nothing
- **THEN** the kill falls back to `pgrep -f` with the regex-escaped socket path, kills the matches, and removes the socket file

#### Scenario: Stale socket with no process
- **WHEN** the socket file exists but no process holds it
- **THEN** the socket file is still removed and no error is shown

## ADDED Requirements

### Requirement: Kill multiple selected sessions
When the tree view has multiple items selected, the kill command SHALL operate on every selected session. A single confirmation SHALL cover the whole selection, and the same termination-and-cleanup behaviour SHALL apply to each session.

#### Scenario: Kill a multi-selection
- **WHEN** the user selects three sessions, invokes Kill, and confirms once
- **THEN** all three dtach servers are terminated, their sockets removed, their terminals closed, and the tree refreshes

#### Scenario: Cancel a multi-selection kill
- **WHEN** the user selects several sessions, invokes Kill, and declines the confirmation
- **THEN** no session is killed and the tree is unchanged

### Requirement: Kill all sessions
The extension SHALL provide a "Kill All" command in the view title bar overflow. Activating it SHALL, after a single confirmation that states how many sessions will be killed, terminate every listed session and remove its socket.

#### Scenario: Kill all
- **WHEN** the user invokes Kill All with three sessions present and confirms
- **THEN** all three sessions are terminated, their sockets removed, and the tree is empty

#### Scenario: Kill all with no sessions
- **WHEN** the user invokes Kill All and no sessions exist
- **THEN** the command reports there is nothing to kill and does nothing
