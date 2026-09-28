# Spec Delta

## MODIFIED Requirements

### Requirement: Created terminal naming
A terminal opened by the create command (by name or for a folder) SHALL follow the same naming rule as attach: when `dtachSessions.reflectProcessTitle` is `true` (the default) it SHALL be created without an API `name` so the program's title drives the tab; when `false` it SHALL be named after the session display name. The terminal SHALL be transient, as attach terminals are, and on create the extension SHALL record the session in this window's persisted attached-sessions list so the new session is reattached on startup identically to an attached one.

#### Scenario: Create with reflect enabled
- **WHEN** `reflectProcessTitle` is `true` and the user creates a session `web`
- **THEN** the terminal is created without an API name, and `web` is recorded as attached in this window

#### Scenario: Create with reflect disabled
- **WHEN** `reflectProcessTitle` is `false` and the user creates a session `web`
- **THEN** the terminal is created with `name: "web"` and the tab title is `web`

#### Scenario: A created session is reattached after restart
- **WHEN** the user creates a session `web`, then closes and reopens VS Code with `reattachOnStartup` enabled
- **THEN** `web` is reattached without its startup command running again
