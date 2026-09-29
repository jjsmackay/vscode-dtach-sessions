## MODIFIED Requirements

### Requirement: Stale client detection
The extension SHALL identify stale (orphaned) dtach client processes on a
session's socket. The candidate set SHALL be **every** dtach process whose
command line attaches to that socket as a client (a bare `-a` argument
alongside the socket path), and SHALL NOT depend on a resolution mechanism that
can miss connected clients. In particular, a candidate resolution that returns
only the process bound to the socket path (such as `lsof -t <socket>`, which on
Linux lists the listening master but not its connected peers) is insufficient
on its own: the extension SHALL resolve candidates by matching the socket in
process command lines (e.g. a hash-anchored or path `pgrep`), or by a union that
includes that match. Candidates SHALL then be filtered to attach clients by
inspecting each pid's `/proc/<pid>/cmdline` for the `-a` attach flag, so the
`-A` master process is never included.

A candidate SHALL be classified as stale when the terminal it is attached from
no longer exists. Classification SHALL NOT depend on which front end, window, or
device created the client: a live client attached from another VS Code window or
from a shell (including the `dts` companion) SHALL NOT be stale. The check SHALL
distinguish a terminal that has gone from a different terminal that has since
been allocated the same device name. Detection SHALL be non-mutating.

The `dts` companion SHALL apply this same classification.

#### Scenario: A connected client is detected
- **WHEN** a socket has a live master and a connected `dtach -a` client whose terminal has been closed
- **THEN** detection returns that client's pid (it is not hidden by a master-only candidate resolution)

#### Scenario: Orphan alongside a live terminal
- **WHEN** a socket has two `-a` clients — one on a live terminal, one whose terminal has been closed
- **THEN** only the client whose terminal has been closed is classified as stale

#### Scenario: Live client from another device is not stale
- **WHEN** a socket has a live `-a` client attached from an SSH shell and the user attaches from VS Code
- **THEN** the SSH client is not classified as stale and survives the reap

#### Scenario: Reused terminal name does not hide an orphan
- **WHEN** a client's terminal has been closed and a new, unrelated terminal has been allocated the same device name
- **THEN** the client is still classified as stale

#### Scenario: Master is never stale
- **WHEN** the candidate resolution returns the `-A` master process for a socket
- **THEN** the master is excluded from the candidate set and never classified as stale

#### Scenario: Restored terminal after reload is not stale
- **WHEN** the window has been reloaded and a restored terminal's client is still attached on a live terminal
- **THEN** that client is not classified as stale

### Requirement: Conservative handling of unresolved pids
The extension SHALL NOT reap a client whose terminal state it cannot determine:
when the terminal check for a candidate cannot be read (the process exited
mid-check, `/proc` is unreadable, or the signal is ambiguous), that candidate
SHALL be classified as live. It SHALL prefer leaving a client alive over risking
termination of a live one.

#### Scenario: Terminal state unreadable
- **WHEN** a candidate's terminal state cannot be determined
- **THEN** it is not reaped

#### Scenario: Just-created client
- **WHEN** a reap is evaluated while a client attach is still starting up on a live terminal
- **THEN** that client is not reaped
