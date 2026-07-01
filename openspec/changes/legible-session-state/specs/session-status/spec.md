## MODIFIED Requirements

### Requirement: Live run-state badge per session

The panel SHALL display the live run-state of a Claude Code instance running
inside each session, appended to that session's row description. The state
vocabulary SHALL be exactly: **working**, **tool:`<name>`** (a tool is running,
with its name), **waiting** (blocked awaiting a tool-permission decision),
**done** (Claude finished its turn — the user's move), and **idle** (a fresh
session not yet prompted, or otherwise quiet). The **waiting** state SHALL denote
a genuine block only; a session that is merely finished-and-unanswered SHALL be
**done**, not **waiting**. The **done** state SHALL persist until the session
next leaves it (a new prompt, a tool, or session end) and SHALL NOT decay on age.
A session with no available status SHALL render no badge and read exactly as it
does today; an **idle** session SHALL likewise render no badge.

#### Scenario: Claude working

- **WHEN** the session's Claude is processing a turn
- **THEN** the row shows a "working" badge alongside the existing age/attached description

#### Scenario: Claude running a tool

- **WHEN** the session's Claude is executing a tool named `Bash`
- **THEN** the row shows a "tool: Bash" badge

#### Scenario: Claude waiting on a permission decision

- **WHEN** the session's Claude is blocked awaiting a tool-permission decision
- **THEN** the row shows a "waiting" badge

#### Scenario: Claude finished its turn

- **WHEN** the session's Claude has finished its turn and handed control back to the user
- **THEN** the row shows a "done" badge (not "waiting"), which persists until the next prompt

#### Scenario: Finished-and-unanswered does not become waiting

- **WHEN** a finished (done) session remains unanswered by the user for a prolonged period
- **THEN** the row continues to show "done" and SHALL NOT switch to "waiting"

#### Scenario: No status available

- **WHEN** a session has no status file (e.g. no Claude inside, hooks not installed, or a non-Linux host)
- **THEN** the row shows no run-state badge and its description is unchanged from the no-status behaviour

### Requirement: Run-state row icon

The panel SHALL reflect a session's effective run-state in its row **icon**, in
addition to the description text. **working** and **tool** SHALL use an animated
spinner icon (motion signalling "busy"). **waiting** SHALL use an
attention-coloured icon that retains its colour when its row is selected (i.e. a
pre-coloured image asset, not a themed codicon, since VS Code recolours codicons
to the selection foreground on selection). **done** SHALL use a check glyph
signalling "finished — your move"; because a check's meaning is carried by its
shape, it MAY be a themed codicon and need not retain a specific colour when its
row is selected. When the effective state is **idle** or there is no status, the
icon SHALL fall back to the existing attached/detached terminal icon (green
terminal when attached in this window, plain terminal otherwise).

#### Scenario: Working session shows a spinner

- **WHEN** a session's effective state is working (or running a tool)
- **THEN** its row icon is an animated spinner, while the description still shows the exact badge (`working` or `tool: <name>`)

#### Scenario: Waiting session icon

- **WHEN** a session's effective state is waiting
- **THEN** its row icon uses the attention colour, so it stands out as needing the user

#### Scenario: Done session shows a check

- **WHEN** a session's effective state is done
- **THEN** its row icon is a check glyph and its description shows a "done" badge

#### Scenario: Idle session keeps the attach icon

- **WHEN** a session is idle or has no status
- **THEN** its row icon is the green terminal icon if attached in this window, or the plain terminal icon otherwise

#### Scenario: Waiting colour survives row selection

- **WHEN** a waiting row is selected in the tree
- **THEN** its icon keeps its attention colour (not washed to the selection foreground)

## ADDED Requirements

### Requirement: Detached rows are visually de-emphasised

The panel SHALL visually de-emphasise (dim) the row of any session that is not
attached in the current window, so attach-state is legible as an always-present
row treatment independent of the run-state icon. The dimming SHALL apply to the
row label and SHALL NOT dim or recolour the run-state icon, so a detached session
that needs the user still shows its full-strength waiting icon on a dimmed row.
Attached rows SHALL NOT be dimmed. The treatment SHALL update when a session's
attach-state changes (attach, detach, window reload) using the same live
attach detection as the row's icon and inline actions.

#### Scenario: Detached row is dimmed

- **WHEN** a session is not attached in the current window
- **THEN** its row label is dimmed while its run-state icon (if any) is shown at full strength

#### Scenario: Attached row is not dimmed

- **WHEN** a session is attached in the current window
- **THEN** its row label is shown at normal strength

#### Scenario: Detached waiting session reads as needing attention

- **WHEN** a detached session's Claude is waiting on a permission decision
- **THEN** the row label is dimmed but the amber waiting icon remains at full strength

#### Scenario: Dimming tracks attach-state changes

- **WHEN** a session is attached and then detached (or vice versa)
- **THEN** its row dimming updates to match without a manual refresh
