## ADDED Requirements

### Requirement: Reap stale clients before creating a fresh attach
The extension SHALL, when an attach would create a new terminal for a session —
i.e. this window has no live terminal matched to the socket — and
`dtachSessions.reapStaleClientsOnAttach` is enabled, reap the socket's stale
clients and wait for the reap to complete before creating the terminal. This
SHALL apply to every path that creates a fresh attach terminal (row click,
inline play action, quick-switch, and open-in-folder attaching to an existing
session). Reuse of an already-open terminal SHALL NOT trigger a reap. Reaping
here SHALL follow the `stale-client-reaping` capability: clients only, never the
master, terminated with `SIGKILL`, non-destructive to the session.

#### Scenario: Fresh attach reaps first
- **WHEN** the setting is enabled and the user attaches to a session with a stale
  client but no live terminal in this window
- **THEN** the stale client is terminated, and only then is the new attach
  terminal created, so the new client is the sole client on the socket

#### Scenario: Reuse skips reaping
- **WHEN** the user attaches to a session that already has a live terminal in this window
- **THEN** the existing terminal is focused and no reap occurs

#### Scenario: Opt-out disables reap-on-attach
- **WHEN** `reapStaleClientsOnAttach` is `false` and the user attaches to a
  session with a stale client
- **THEN** the fresh terminal is created without reaping and the new client joins
  the existing clients
