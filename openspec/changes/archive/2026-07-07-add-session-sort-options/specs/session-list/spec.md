## RENAMED Requirements

- FROM: `### Requirement: Sort by recency with relative age`
- TO: `### Requirement: Configurable session order with relative age`

## MODIFIED Requirements

### Requirement: Configurable session order with relative age
The extension SHALL order sessions according to the `dtachSessions.sortBy` setting, which SHALL default to `created`. It SHALL support the following orders:

- `created` — by socket file modification time (`mtime`), most recent first. Because nothing is ever written to a dtach socket file, `mtime` is pinned at socket creation and does not move on attach or detach; this order is therefore stable for the life of a session (it changes only on restart, which recreates the socket).
- `lastAttached` — by socket inode change time (`ctime`), most recent first. `ctime` advances when a client attaches (and, more loosely, on reap or rename), giving a most-recently-used ordering.
- `name` — by display name, locale-aware ascending (`localeCompare`).
- `status` — by attention priority derived from the effective (post-decay) run-state: `waiting` first, then `working`/`tool`, then `done`, then sessions with no shown state; within each group by shown age, most recent first. When the status feature is off, every session falls into the no-state group and the order degrades to shown age.

Regardless of order, the extension SHALL display a relative age (e.g. "2h ago") as the tree item description. The age SHALL be activity-relative — derived from the session's live status timestamp when a status exists — and SHALL fall back to the socket `mtime` (the creation time) otherwise. The row tooltip SHALL label the socket `mtime` value as the creation time ("created …"), not as a modification time.

#### Scenario: Default order is created, most recent first
- **WHEN** `dtachSessions.sortBy` is unset (default) and the directory contains sockets with differing creation times
- **THEN** the tree lists them by socket `mtime` with the most recently created at the top

#### Scenario: Created order is stable across attach and detach
- **WHEN** the order is `created` and the user attaches to and then detaches from a session
- **THEN** the session's position does not change (socket `mtime` is unaffected by attach/detach)

#### Scenario: Last-attached order surfaces the most recently used
- **WHEN** the order is `lastAttached` and the user attaches to a session that was previously lower in the list
- **THEN** on the next refresh that session sorts to the top (its socket `ctime` advanced)

#### Scenario: Name order is alphabetic
- **WHEN** the order is `name`
- **THEN** sessions are listed by display name in locale-aware ascending order

#### Scenario: Status order puts waiting sessions first
- **WHEN** the order is `status` and one session is `waiting` (needs the user) while others are `working` or have no shown state
- **THEN** the `waiting` session sorts above the `working` sessions, which sort above the sessions with no shown state

#### Scenario: Relative age shown
- **WHEN** a session's last activity (or, absent a status, its socket creation) was two hours ago
- **THEN** the tree item description reads approximately "2h ago"

#### Scenario: Tooltip labels the creation time
- **WHEN** the user hovers a session row
- **THEN** the tooltip presents the socket `mtime` value as a creation time ("created …"), not as "last modified"

## ADDED Requirements

### Requirement: Sort order picker command
The extension SHALL contribute a view-title command that opens a QuickPick listing the available orders, marking the currently active order. Selecting an order SHALL persist it to the `dtachSessions.sortBy` setting and refresh the tree.

#### Scenario: Picker shows and changes the active order
- **WHEN** the user activates the sort command and selects an order different from the current one
- **THEN** the choice is written to `dtachSessions.sortBy`, the picker's active-order marker reflects it, and the tree re-renders in the new order

#### Scenario: Active order is marked
- **WHEN** the user opens the sort picker
- **THEN** the entry matching the current `dtachSessions.sortBy` value is visually marked as active
