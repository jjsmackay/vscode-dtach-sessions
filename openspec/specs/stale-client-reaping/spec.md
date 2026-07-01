# stale-client-reaping Specification

## Purpose

Detecting and terminating stale (orphaned) dtach client processes on a session's socket — clients left behind when their terminal died (window close, SSH drop) that wedge the shared pty — without harming the dtach master, the socket, or a live client. Reaping runs automatically before a fresh attach and on demand for one or all sessions.

## Requirements

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
- **WHEN** the window has been reloaded and a restored terminal's `processId`
  still resolves to a live `-a` client on the socket
- **THEN** that client's pid matches the live-terminal set and it is not classified as stale

### Requirement: Conservative handling of unresolved pids
The extension SHALL NOT reap clients it cannot rule out as belonging to a live
terminal: when any terminal matched to the socket has an unresolved `processId`
(e.g. a just-created terminal whose `processId` promise has not settled), no
reap SHALL occur. It SHALL prefer leaving a client alive over risking
termination of a live one.

#### Scenario: Just-created terminal pid still resolving
- **WHEN** a reap is evaluated while a matched terminal's `processId` has not yet resolved
- **THEN** no client is reaped until the live-terminal pids are known

### Requirement: Reaping terminates with SIGKILL
Reaping a stale client SHALL terminate it with `SIGKILL`. A plain `SIGTERM`
SHALL NOT be relied upon, because a wedged dtach client blocks `SIGTERM` and
would survive it.

#### Scenario: Wedged client is force-killed
- **WHEN** a stale client that blocks `SIGTERM` is reaped
- **THEN** it is terminated with `SIGKILL` and no longer holds the socket

### Requirement: Reaping is non-destructive to the session
Reaping SHALL only terminate client (`-a`) processes and SHALL never terminate
the dtach master or remove the socket. The session and the program it runs
SHALL survive a reap.

#### Scenario: Session survives a reap
- **WHEN** stale clients on a socket are reaped
- **THEN** the dtach master process and its program continue running, the socket
  file remains, and the session still appears in the tree

### Requirement: Reap stale clients on attach
The extension SHALL provide a `dtachSessions.reapStaleClientsOnAttach` boolean
setting, default `true`. When enabled, attaching to a session for which this
window has no live terminal SHALL reap the socket's stale clients, and the reap
SHALL complete, before the fresh client terminal is created. When disabled, no
automatic reap SHALL occur on attach. Reap-on-attach SHALL NOT emit a
user-facing notification.

#### Scenario: Default value
- **WHEN** the setting is not configured
- **THEN** `reapStaleClientsOnAttach` resolves to `true`

#### Scenario: Ghost reaped before fresh attach
- **WHEN** the setting is enabled and the user attaches to a session that has a
  stale client but no live terminal in this window
- **THEN** the stale client is terminated before the new attach terminal is
  created, so the new client is the sole client on the socket

#### Scenario: Opted out
- **WHEN** the setting is `false` and the user attaches to a session with a stale client
- **THEN** no automatic reap occurs and the fresh client joins the existing clients

#### Scenario: No reap when reusing a terminal
- **WHEN** the user attaches to a session that already has a live terminal in
  this window
- **THEN** the existing terminal is focused and no reap is performed

### Requirement: Manual reap for one session
The extension SHALL provide a "Reap Stale Clients" command in the session row
context menu that reaps the stale clients of that session on demand, regardless
of the `reapStaleClientsOnAttach` setting. On completion it SHALL report how
many clients were reaped, including when none were found.

#### Scenario: Reap a session with a ghost
- **WHEN** the user invokes Reap Stale Clients on a session that has one stale client
- **THEN** the stale client is terminated and the command reports one client reaped

#### Scenario: Reap a session with no ghosts
- **WHEN** the user invokes Reap Stale Clients on a session with no stale clients
- **THEN** nothing is terminated and the command reports that no stale clients were found

### Requirement: Manual reap for all sessions
The extension SHALL provide a "Reap All Stale Clients" command in the view title
bar that reaps stale clients across every listed session in one action,
regardless of the `reapStaleClientsOnAttach` setting. On completion it SHALL
report the total number of clients reaped. This action SHALL be manual only; the
extension SHALL NOT perform an automatic global sweep.

#### Scenario: Reap across multiple sessions
- **WHEN** the user invokes Reap All Stale Clients with ghosts present on two of three sessions
- **THEN** the stale clients on those two sessions are terminated and the command
  reports the total reaped

#### Scenario: Reap all with nothing stale
- **WHEN** the user invokes Reap All Stale Clients and no session has a stale client
- **THEN** nothing is terminated and the command reports that no stale clients were found
