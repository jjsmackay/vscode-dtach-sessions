## ADDED Requirements

### Requirement: Legible warning when a session terminal fails to launch

The extension SHALL surface a single, actionable warning when a terminal it
created for a session terminates almost immediately after creation — the
signature of a `dtach` binary that is missing or mis-pathed — naming
`dtachSessions.dtachPath` as the likely cause, rather than leaving the user with
VS Code's raw launch-failure output. The warning SHALL offer an action that
opens the `dtachSessions.dtachPath` setting.

The detection SHALL rely only on the terminal's own close event (which VS Code
fires for both the default `bash -c 'exec -a …'` launch path and the direct
`shellPath` launch path), and SHALL NOT perform any extension-host capability
probe of `dtach`, because the extension host's `PATH` differs from the
interactive terminal's login-shell `PATH` and a probe would report false
negatives on working setups.

Detection SHALL key on two facts only: the terminal was created by the extension
for a session socket, and it closed within a short window (on the order of two
seconds) of its creation. It SHALL NOT gate on a specific exit code, since the
direct launch path may report no exit code.

#### Scenario: Missing dtach on create surfaces an actionable warning

- **WHEN** a session is created and its terminal closes within the fast-close window because `dtach` (or the configured `dtachSessions.dtachPath`) could not be launched
- **THEN** the extension shows a warning that dtach could not launch and names `dtachSessions.dtachPath`, offering an action that opens that setting

#### Scenario: Missing dtach on attach surfaces an actionable warning

- **WHEN** attaching to a session creates a terminal that closes within the fast-close window because `dtach` could not be launched
- **THEN** the same actionable warning is shown

#### Scenario: Normal session exit does not warn

- **WHEN** a session terminal closes after living longer than the fast-close window (e.g. the user typed `exit`, killed the session, or detached a long-running session)
- **THEN** no launch-failure warning is shown

#### Scenario: A reload-restored terminal closing does not warn

- **WHEN** a terminal that was restored by a window reload (and therefore not freshly created by the extension in this activation) closes
- **THEN** no launch-failure warning is shown, because the fast-close window is measured from extension-tracked creation
