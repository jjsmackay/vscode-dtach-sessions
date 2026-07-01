## ADDED Requirements

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
