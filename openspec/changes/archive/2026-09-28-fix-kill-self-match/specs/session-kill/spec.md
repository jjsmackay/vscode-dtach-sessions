# Spec Delta

## MODIFIED Requirements

### Requirement: Process termination and socket cleanup
The kill SHALL resolve the owning process via `lsof -t <socket>` on the session's current socket path. If `lsof` is unavailable or returns nothing (e.g. the socket was renamed, so its path no longer matches the dtach process argv), it SHALL fall back to `pgrep -f '_<hash>\.dtach'` using the hash extracted from the current filename — a rename-invariant anchor present in the process argv. For a legacy socket with no hash, it SHALL fall back to `pgrep -f <pattern>` where `<pattern>` is the socket path with regex metacharacters escaped. Termination SHALL use `SIGKILL` for every resolved process, so that a wedged attach client — which blocks `SIGTERM` and would otherwise survive — is reliably terminated along with the master. After terminating any resolved process, it SHALL remove the socket with `rm -f <socket>`. Socket removal SHALL proceed even if no process is found (stale socket cleanup).
The resolved set SHALL NOT include the shell running the kill: its own command
line carries the socket path, so the `pgrep` fallback matches it, and killing it
would abort the kill before the socket is removed.

The kill SHALL also remove the session's per-hash status file
(`<socketDir>/status/<hash>.json`) when the socket basename carries a hash, so
that an extension-driven kill — which never fires Claude's `SessionEnd` hook —
leaves no orphan status file behind. Removal SHALL be best-effort: a missing
status file (the common case, when no Claude ran in the session) SHALL NOT be an
error, and a legacy socket with no hash SHALL simply skip status-file removal.

#### Scenario: Live session killed via lsof
- **WHEN** a dtach process holds the socket at its launch path and `lsof` is available
- **THEN** the PID returned by `lsof -t <socket>` is killed with `SIGKILL` and the socket file is removed

#### Scenario: Renamed session killed via hash anchor
- **WHEN** the socket was renamed so `lsof -t <socket>` and a full-path `pgrep` return nothing
- **THEN** the kill resolves the PID via `pgrep -f '_<hash>\.dtach'`, terminates it with `SIGKILL`, and removes the socket

#### Scenario: Legacy socket without a hash
- **WHEN** the socket has no `_<hash>` segment and `lsof` returns nothing
- **THEN** the kill falls back to `pgrep -f` with the regex-escaped socket path, kills the matches with `SIGKILL`, and removes the socket file

#### Scenario: Wedged client is force-killed
- **WHEN** the resolved processes include an attach client that blocks `SIGTERM`
- **THEN** that client is terminated by `SIGKILL` and does not survive the kill

#### Scenario: Stale socket with no process
- **WHEN** the socket file exists but no process holds it
- **THEN** the socket file is still removed and no error is shown

#### Scenario: Status file removed alongside the socket
- **WHEN** a session with a hashed socket and a `status/<hash>.json` file is killed
- **THEN** both the socket and that session's `status/<hash>.json` file are removed, while other sessions' status files are untouched

#### Scenario: Kill with no status file present
- **WHEN** a session is killed but has no `status/<hash>.json` file (no Claude ran in it)
- **THEN** the kill removes the socket and reports no error over the absent status file

#### Scenario: Killing a dead session removes its socket
- **WHEN** the user kills a session whose master is gone, so the `pgrep` fallback's only match is the shell running the kill
- **THEN** that shell is not terminated, and the socket file is removed
