## MODIFIED Requirements

### Requirement: Attach on click
The extension SHALL open an integrated terminal attached to a dtach session when the user clicks a tree item. The terminal SHALL be created using `vscode.window.createTerminal` with `shellPath: 'dtach'` and `shellArgs` derived from the socket path and configured redraw method.

Before creating a terminal, the extension SHALL determine whether the session's
socket still has a dtach master. When it does not — the socket outlived its
master, typically because the host restarted — the extension SHALL start a fresh
master on the **same** socket path rather than attaching to a socket that cannot
serve the connection.

The restart SHALL preserve the session's display name, its `_<hash>`
rename-invariant id, and its working directory, and SHALL run the configured
startup command as session creation does. It SHALL NOT mint a new socket path or
hash.

The restart SHALL report itself once as information — naming the cause and
stating that the previous session's output is gone — and SHALL NOT ask for
confirmation, since the previous output is unrecoverable either way.

#### Scenario: Attach with winch redraw
- **WHEN** user clicks a session row and `redrawMethod` is `winch`
- **THEN** a terminal opens running `dtach -a <socket> -r winch` and is immediately focused

#### Scenario: Attach with ctrl_l redraw
- **WHEN** user clicks a session row and `redrawMethod` is `ctrl_l`
- **THEN** a terminal opens running `dtach -a <socket> -r ctrl_l`

#### Scenario: Attach with no redraw
- **WHEN** user clicks a session row and `redrawMethod` is `none`
- **THEN** a terminal opens running `dtach -a <socket>` with no `-r` flag

#### Scenario: Clicking a session whose master is gone restarts it in place
- **WHEN** the user clicks a session whose socket has no dtach master
- **THEN** a fresh master is started on the same socket path, a terminal opens attached to it, and the row keeps its name and hash

#### Scenario: The restart is reported once
- **WHEN** a session is restarted in place because its socket had no master
- **THEN** an information message states that the session was restarted and that the previous output is gone, with no confirmation prompt

#### Scenario: A restarted session runs the startup command
- **WHEN** a session is restarted in place and a startup command is configured
- **THEN** the startup command runs in the restarted session

#### Scenario: No doomed terminal is created
- **WHEN** the user clicks a session whose socket has no dtach master
- **THEN** no terminal is created that attaches to the dead socket, and no warning naming `dtachSessions.dtachPath` is shown
