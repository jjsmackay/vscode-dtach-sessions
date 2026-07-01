# session-status Specification

## Purpose

Showing each session's live Claude run-state in the panel: the state vocabulary (working / tool / waiting / idle), sourcing from per-hash status files joined to sessions by hash, staleness decay of transient states, and refresh on status change. Composes with attach-state without either suppressing the other.

## Requirements

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

### Requirement: Run-state row icon

The panel SHALL reflect a session's effective run-state in its row **icon**, in
addition to the description text. **working** and **tool** SHALL use an animated
spinner icon (motion signalling "busy"). **waiting** SHALL use an
attention-coloured icon that retains its colour when its row is selected (i.e. a
pre-coloured image asset, not a themed codicon, since VS Code recolours codicons
to the selection foreground on selection). When the effective state is **idle**
or there is no status, the icon SHALL fall back to the existing
attached/detached terminal icon (green terminal when attached in this window,
plain terminal otherwise).

#### Scenario: Working session shows a spinner

- **WHEN** a session's effective state is working (or running a tool)
- **THEN** its row icon is an animated spinner, while the description still shows the exact badge (`working` or `tool: <name>`)

#### Scenario: Waiting session icon

- **WHEN** a session's effective state is waiting
- **THEN** its row icon uses the attention colour, so it stands out as needing the user

#### Scenario: Idle session keeps the attach icon

- **WHEN** a session is idle or has no status
- **THEN** its row icon is the green terminal icon if attached in this window, or the plain terminal icon otherwise

#### Scenario: Waiting colour survives row selection

- **WHEN** a waiting row is selected in the tree
- **THEN** its icon keeps its attention colour (not washed to the selection foreground)

### Requirement: Activity-relative session time

The row's relative time SHALL be measured from a session's last status event
(its recorded timestamp) when a status exists, rather than from the socket
file's mtime; a session with no status SHALL continue to show its socket-mtime
age. This makes the row's time track what Claude is doing — busy duration, or
how long since it last acted — instead of socket attach/detach touches.

#### Scenario: Active state shows time in state

- **WHEN** a session is working and its last event was 12 seconds ago
- **THEN** the row's relative time is ~12s, measured from that event (not the socket mtime)

#### Scenario: Quiet session shows time since last activity

- **WHEN** a session's last event (e.g. a Stop) was 5 minutes ago
- **THEN** the row's relative time is ~5m, measured from that event

#### Scenario: No status falls back to mtime age

- **WHEN** a session has no status file
- **THEN** the row shows its socket-mtime age, exactly as before this change

### Requirement: Icon and text reflect one effective state

The row icon and the description badge SHALL derive from the same effective
(post-decay) run-state, so they never disagree. When a transient state decays
(see staleness decay), both the badge and the icon SHALL revert together.

#### Scenario: Stale working reverts icon and text together

- **WHEN** a session's last recorded state is "working" and its timestamp is older than the staleness threshold
- **THEN** the row shows neither the "working" badge nor the busy icon, falling back to age and the attached/detached terminal icon

### Requirement: Activity-bar waiting badge

The panel SHALL display, on its activity-bar view container, a numeric badge
counting the sessions whose effective (post-decay) run-state is **waiting**, so
a session blocked on the user is visible even when the view is collapsed or not
on screen. The count SHALL include only sessions whose effective state is
`waiting`; `working`, `tool`, and idle/no-status sessions SHALL NOT contribute.
A count of zero SHALL clear the badge entirely. The badge SHALL recompute on
every panel refresh and SHALL be derived from the same effective-state source as
the per-row badge and icon, so they can never disagree. The badge SHALL be
present only when the live-status feature is enabled; when it is disabled, no
badge SHALL be shown.

#### Scenario: One session waiting

- **WHEN** exactly one session's effective state is waiting
- **THEN** the activity-bar icon shows a badge of `1` with a tooltip naming the waiting count

#### Scenario: Multiple waiting sessions sum

- **WHEN** three sessions are simultaneously in the waiting state
- **THEN** the activity-bar badge reads `3`

#### Scenario: Working sessions do not count

- **WHEN** sessions are working or running a tool but none is waiting
- **THEN** no activity-bar badge is shown

#### Scenario: Badge clears when resolved

- **WHEN** the last waiting session leaves the waiting state (the user responds, or it goes idle/stale)
- **THEN** the activity-bar badge is cleared

#### Scenario: Feature disabled hides the badge

- **WHEN** the live-status feature is turned off
- **THEN** no activity-bar badge is shown regardless of session states
