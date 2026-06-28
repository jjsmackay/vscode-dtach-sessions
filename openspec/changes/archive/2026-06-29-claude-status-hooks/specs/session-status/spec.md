## ADDED Requirements

### Requirement: Live run-state badge per session

The panel SHALL display the live run-state of a Claude Code instance running
inside each session, appended to that session's row description. The state
vocabulary SHALL be exactly: **working**, **tool:`<name>`** (a tool is
running, with its name), **waiting** (blocked on user input or permission), and
**idle** (turn finished or session quiet). A session with no available status
SHALL render no badge and read exactly as it does today.

#### Scenario: Claude working

- **WHEN** the session's Claude is processing a turn
- **THEN** the row shows a "working" badge alongside the existing age/attached description

#### Scenario: Claude running a tool

- **WHEN** the session's Claude is executing a tool named `Bash`
- **THEN** the row shows a "tool: Bash" badge

#### Scenario: Claude waiting on the user

- **WHEN** the session's Claude is blocked awaiting user input or a permission decision
- **THEN** the row shows a "waiting" badge

#### Scenario: No status available

- **WHEN** a session has no status file (e.g. no Claude inside, hooks not installed, or a non-Linux host)
- **THEN** the row shows no run-state badge and its description is unchanged from the no-status behaviour

### Requirement: Status is sourced by joining per-hash status files to sessions

The provider SHALL derive each session's run-state by reading per-hash status
files from a `status/` directory alongside the socket directory and joining
them to listed sessions by the session's rename-invariant hash. Sessions whose
socket basename carries no hash (legacy sockets) SHALL receive no status rather
than an incorrect one.

#### Scenario: Status joined by hash

- **WHEN** a status file exists for the hash of a listed session
- **THEN** that session's row reflects the state recorded in the file

#### Scenario: Legacy socket without a hash

- **WHEN** a listed session's socket basename has no `_<hash>` suffix
- **THEN** that session receives no status badge

### Requirement: Stale transient states decay

A transient state (working, tool) SHALL decay to idle/age when its recorded
event timestamp is older than a staleness threshold, so a Claude that exited
without a clean stop (crash, kill, lost connection) does not remain shown as
working indefinitely. The display SHALL never present a state known to be stale
as current.

#### Scenario: Working state goes stale

- **WHEN** a session's last recorded state is "working" and its timestamp is older than the staleness threshold
- **THEN** the row no longer shows "working" and falls back to idle/age

### Requirement: Panel refreshes on status change

The panel SHALL refresh when status files change so the badge tracks run-state
without manual refresh.

#### Scenario: Status file updated

- **WHEN** a status file in the `status/` directory is created, changed, or removed
- **THEN** the panel re-renders the affected row's badge

### Requirement: Status display composes with attach-state affordances

The status badge SHALL be carried in the row description and SHALL NOT alter the
tree item `contextValue`, which encodes attach state for inline action gating.
Run-state and attach-state SHALL coexist independently on a row.

#### Scenario: Attached, working session

- **WHEN** a session is both attached in this window and its Claude is working
- **THEN** the row shows the attached affordance (via `contextValue`) and a "working" badge (via description), neither suppressing the other
