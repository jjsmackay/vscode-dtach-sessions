# claude-status-hooks Specification

## Purpose

Installing, uninstalling, and managing the Claude Code status hook integration: the forwarder's /proc correlation and no-op behaviour, the per-hash status files it writes atomically, idempotent merge into ~/.claude/settings.json, the stable forwarder install path, and the detection-gated install nudge.

## Requirements

### Requirement: Forwarder correlates a hook to a session via /proc

The forwarder SHALL determine which dtach session a firing Claude hook belongs
to by walking the process-ancestor chain through `/proc` to find the dtach
master process whose command line contains a `*.dtach` socket path, then
extracting the rename-invariant 6-hex hash from that socket's basename. When no
ancestor carrying a `.dtach` path is found, the forwarder SHALL exit successfully
without writing anything. The no-status path SHALL be cheap, since the hook is
host-global and fires for every Claude session on the machine.

#### Scenario: Claude running inside a dtach session

- **WHEN** the forwarder fires and a dtach master with a `*.dtach` socket is found among its ancestors
- **THEN** it resolves the session hash from that socket and records state for that hash

#### Scenario: Claude running outside any dtach session

- **WHEN** the forwarder fires and no ancestor command line contains a `.dtach` path
- **THEN** it exits successfully without writing any status file

#### Scenario: Non-Linux host

- **WHEN** the forwarder runs where `/proc` ancestor data is unavailable
- **THEN** it exits successfully without writing any status file

### Requirement: Forwarder writes current state to a per-hash status file

The forwarder SHALL record the current state as a single per-hash file under the
`status/` directory using an atomic write (write-then-rename), recording the
state, any tool name, and an event timestamp. It SHALL map Claude lifecycle
events to states as: SessionStart and Stop to idle; UserPromptSubmit and
PostToolUse to working; PreToolUse to tool with the tool name; Notification to
waiting. On SessionEnd it SHALL remove the session's status file.

#### Scenario: Tool use recorded

- **WHEN** a PreToolUse event fires for tool `Bash` under a resolved session hash
- **THEN** the hash's status file records state "tool" with name "Bash" and a current timestamp

#### Scenario: Session end cleans up

- **WHEN** a SessionEnd event fires under a resolved session hash
- **THEN** the hash's status file is removed

#### Scenario: Concurrent events resolve to current state

- **WHEN** two events for the same hash arrive in close succession
- **THEN** the status file reflects the later event (last-write-wins), with no partial/torn file observable by a reader

### Requirement: Install merges the forwarder into Claude settings idempotently

The Install command SHALL register the forwarder under each relevant Claude
lifecycle event in `~/.claude/settings.json` by merging into the existing
configuration without removing or altering the user's other hooks, and SHALL be
idempotent (re-running does not create duplicate entries). Install SHALL copy
the bundled forwarder to a stable path (`~/.dtach-sessions/hook`) and reference
that path, so an extension update does not break the wiring.

#### Scenario: Install preserves existing user hooks

- **WHEN** the user already has their own hooks configured and runs Install
- **THEN** the forwarder entries are added and all pre-existing user hooks remain intact

#### Scenario: Install is idempotent

- **WHEN** Install is run a second time
- **THEN** no duplicate forwarder entries are added and the stable forwarder copy is refreshed

#### Scenario: Install notes a restart is needed

- **WHEN** Install completes
- **THEN** the user is told that already-running Claude sessions will not show status until restarted, because Claude reads hooks at session start

### Requirement: Uninstall removes only the forwarder's entries

The Uninstall command SHALL remove the forwarder entries from
`~/.claude/settings.json`, identified by the forwarder path, leaving all other
hooks untouched.

#### Scenario: Uninstall is surgical

- **WHEN** Uninstall is run
- **THEN** only entries referencing the forwarder path are removed and the user's other hooks remain

### Requirement: Install nudge is detection-gated and dismissible

The extension SHALL offer a one-time install prompt only when all hold: Claude
is detected on the host (the `~/.claude/` directory exists), the forwarder hooks
are not already installed, and the user has not previously dismissed the prompt.
Dismissal SHALL persist per-host in global state so "Don't ask again" survives
across windows. PATH SHALL NOT be used to detect Claude.

#### Scenario: Nudge offered once

- **WHEN** `~/.claude/` exists, hooks are not installed, and no prior dismissal is recorded
- **THEN** the extension offers Install / Not now / Don't ask again

#### Scenario: Dismissal sticks across windows

- **WHEN** the user chose "Don't ask again"
- **THEN** the nudge is not shown again in this or any other window on the host

#### Scenario: No nudge without Claude

- **WHEN** `~/.claude/` does not exist on the host
- **THEN** no install nudge is shown
