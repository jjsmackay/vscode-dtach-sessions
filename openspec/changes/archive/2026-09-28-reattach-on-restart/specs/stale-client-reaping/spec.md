# Spec Delta

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
`-A` master process is never included. A candidate SHALL be classified as stale
when its pid is not among the resolved `processId`s of this window's live
terminals matched to that socket. Detection SHALL be non-mutating.

#### Scenario: A connected client is detected
- **WHEN** a socket has a live master and a connected `dtach -a` client, and no
  window terminal is matched to the socket
- **THEN** detection returns the connected client's pid (it is not hidden by a
  master-only candidate resolution)

#### Scenario: Ghost client alongside a live terminal
- **WHEN** a socket has two `-a` clients — one whose pid matches a live window
  terminal for that socket, and one that does not
- **THEN** only the non-matching client is classified as stale

#### Scenario: Master is never stale
- **WHEN** the candidate resolution returns the `-A` master process for a socket
- **THEN** the master is excluded from the candidate set and never classified as stale

#### Scenario: Restored terminal after reload is not stale
- **WHEN** the window has been reloaded and the session reattached, and the
  reattached terminal's `processId` resolves to a live `-a` client on the socket
- **THEN** that client's pid matches the live-terminal set and it is not classified as stale

#### Scenario: Client left behind by a closed window is stale
- **WHEN** the window was closed or reloaded, its transient attach terminal's
  client survived (e.g. the SSH link dropped before it could exit), and the
  session is reattached on startup
- **THEN** the surviving client's pid matches no live terminal in the window, it
  is classified as stale, and the reattach reaps it before creating the new
  terminal
