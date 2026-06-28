# session-restart Specification

## Purpose

Restarting a dtach session in place: terminating its server and socket, then
recreating a fresh session under the same display name and attaching a new
terminal to it, best-effort preserving the working directory and re-running the
configured startup command.

## Requirements

### Requirement: Restart command
The extension SHALL provide a "Restart" command available both as an inline row
icon and in the tree item right-click context menu. Activating it SHALL
terminate the session's dtach server and remove its socket (reusing the kill
behaviour), then create a fresh session under the **same display name** and open
a new terminal attached to it. Restart SHALL be available regardless of whether
the session is currently attached in this window.

#### Scenario: Restart an attached session
- **WHEN** the user invokes Restart on an attached session and confirms
- **THEN** the existing dtach server is terminated and its terminal disposed, a new session with the same name is created, a fresh terminal opens attached to it, and the tree refreshes

#### Scenario: Restart a detached session
- **WHEN** the user invokes Restart on a session with no open terminal and confirms
- **THEN** the existing dtach server is terminated, a new session with the same name is created with a fresh terminal, and the tree refreshes

### Requirement: Confirmation before restart
The restart command SHALL require explicit user confirmation before terminating
the session, since restarting destroys whatever the session is running.

#### Scenario: User confirms
- **WHEN** the confirmation dialog is shown and the user confirms
- **THEN** the restart proceeds

#### Scenario: User cancels
- **WHEN** the confirmation dialog is shown and the user dismisses or declines it
- **THEN** no process is killed, no socket is removed or created, and the tree is unchanged

### Requirement: Fresh shell runs the startup command
The shell created by a restart SHALL be a fresh shell, and the configured
`startupCommand` SHALL run in it exactly as it does for a newly created session
(on create only, not on plain reattach). When no `startupCommand` is configured,
the restart SHALL open a bare shell.

#### Scenario: Restart relaunches the startup command
- **WHEN** `startupCommand` is set to `claude` and the user restarts a session
- **THEN** the fresh shell runs `claude` after it opens

#### Scenario: Restart with no startup command
- **WHEN** `startupCommand` is empty and the user restarts a session
- **THEN** a fresh bare shell opens with no startup command sent

### Requirement: Restart preserves the working directory
The restart SHALL make a best-effort attempt to open the fresh shell in the
working directory of the session's shell at the time of restart, resolved from
the live process before it is terminated. When the directory cannot be resolved,
the restart SHALL fall back to the default new-terminal directory.

#### Scenario: Restart reopens in the same directory
- **WHEN** a session's shell is in `/home/me/project` and the user restarts it
- **THEN** the fresh shell opens with its working directory set to `/home/me/project`

#### Scenario: Working directory cannot be resolved
- **WHEN** the session's working directory cannot be determined (e.g. no owning process is found)
- **THEN** the fresh shell opens in the default new-terminal directory without error
