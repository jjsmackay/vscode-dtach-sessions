# Spec Delta

## MODIFIED Requirements

### Requirement: Liveness detection for listed sessions

The extension SHALL determine, for every listed session, whether a dtach master
is still serving its socket, and SHALL make that determination available to the
attach path and to status presentation.

Detection SHALL read the kernel's bound-unix-socket table (`/proc/net/unix`) and
treat a session as alive when a listening entry there belongs to its socket. The
table records the path a socket was bound at, which a rename does not update, so
for a socket named with a `_<hash>` id an entry SHALL belong to it when the
entry's file name ends in that `_<hash>.dtach`, whatever the socket is called
now. A socket with no `_<hash>` SHALL match on its absolute path or its file
name. Detection
SHALL NOT open a connection to the socket, and SHALL NOT spawn a subprocess, so
that a live master and its attached clients are never disturbed by the check.

Detection SHALL be performed as part of listing sessions, so that it is current
on every tree refresh rather than resolved once per activation.

When the liveness source cannot be read (a non-Linux remote host, or a restricted
environment), every session SHALL be treated as alive, preserving the behaviour
that existed before liveness detection.

Liveness SHALL NOT introduce a distinct presentation of its own: a session with
no master remains listed, keeps its name, and continues to present as detached.
Its recorded Claude status is suppressed as required below, which is the only
way liveness reaches the row's badge, icon, or status ordering.

#### Scenario: Socket with a live master

- **WHEN** the tree is refreshed and a session's socket path appears in the kernel's bound-socket table
- **THEN** the session is treated as alive

#### Scenario: Renamed session with a live master

- **WHEN** a live session `api_a1b2c3` is renamed to `backend_a1b2c3`, so the kernel's table still records the socket as bound at `api_a1b2c3.dtach`
- **THEN** the session is treated as alive, and clicking it attaches rather than restarting it, with no restart message and no startup command sent

#### Scenario: Socket left behind by a host reboot

- **WHEN** the tree is refreshed after the remote host has restarted, so socket files remain but no dtach master is running
- **THEN** every such session is treated as dead, while still being listed

#### Scenario: Master killed without unlinking its socket

- **WHEN** a dtach master is terminated with `SIGKILL` (e.g. by the OOM killer) so its socket file survives
- **THEN** that session is treated as dead on the next refresh

#### Scenario: Detection does not disturb a live session

- **WHEN** liveness is evaluated for a session that is attached and running
- **THEN** no connection is made to its socket and no subprocess is spawned, and the attached terminal is unaffected

#### Scenario: Liveness source unavailable

- **WHEN** the kernel bound-socket table cannot be read
- **THEN** all sessions are treated as alive and behaviour matches that of the extension before liveness detection existed
