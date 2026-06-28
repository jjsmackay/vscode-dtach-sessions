## ADDED Requirements

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
