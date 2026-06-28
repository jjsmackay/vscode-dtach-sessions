## ADDED Requirements

### Requirement: Created terminal naming
A terminal opened by the create command (by name or for a folder) SHALL follow the same naming rule as attach: when `dtachSessions.reflectProcessTitle` is `true` (the default) it SHALL be created without an API `name` so the program's title drives the tab; when `false` it SHALL be named after the session display name. On create, the extension SHALL record a `socket → processId` association in `workspaceState` so the new terminal participates in reuse-after-reload identically to an attached one.

#### Scenario: Create with reflect enabled
- **WHEN** `reflectProcessTitle` is `true` and the user creates a session `web`
- **THEN** the terminal is created without an API name, and a `socket → processId` association for `web` is recorded

#### Scenario: Create with reflect disabled
- **WHEN** `reflectProcessTitle` is `false` and the user creates a session `web`
- **THEN** the terminal is created with `name: "web"` and the tab title is `web`
