## ADDED Requirements

### Requirement: Inline attach and detach row actions
Each session row SHALL expose a single inline icon for its primary attach-state
action, gated on whether a terminal for the session is open in this window. A
row that is attached SHALL show a pause icon that invokes the Detach command; a
row that is not attached SHALL show a play icon that invokes the Attach command.
A row SHALL never show both at once. The pause icon SHALL be rendered in a
distinct colour (blue), using a baked-colour image asset rather than a recoloured
codicon, so its colour survives row selection — mirroring the green
terminal-open indicator. The detach inline action SHALL share the semantics of
the existing Detach command (no-op when no terminal is open).

#### Scenario: Attached row shows a blue pause action
- **WHEN** a session has a live terminal open in this window and the user hovers its row
- **THEN** a blue pause inline icon is shown and no play icon is shown

#### Scenario: Pause detaches without killing the server
- **WHEN** the user clicks the pause inline icon on an attached row
- **THEN** this window's terminal for the session is disposed, the dtach server remains alive, and the row updates to show the play icon

#### Scenario: Detached row shows a play action
- **WHEN** a session has no terminal open in this window and the user hovers its row
- **THEN** a play inline icon is shown and no pause icon is shown

#### Scenario: Play attaches the session
- **WHEN** the user clicks the play inline icon on a detached row
- **THEN** a terminal attaching to the session opens and the row updates to show the pause icon
