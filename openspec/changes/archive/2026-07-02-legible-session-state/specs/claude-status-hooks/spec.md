## MODIFIED Requirements

### Requirement: Forwarder writes current state to a per-hash status file

The forwarder SHALL record the current state as a single per-hash file under the
`status/` directory using an atomic write (write-then-rename), recording the
state, any tool name, and an event timestamp. It SHALL map Claude lifecycle
events to states as: SessionStart to idle; UserPromptSubmit and PostToolUse to
working; PreToolUse to tool with the tool name; Stop to done. The Notification
event SHALL be mapped by its subtype: a permission-request notification (Claude
blocked awaiting a tool-permission decision) to waiting; an idle-prompt
notification (fired when the user has simply not yet replied to a finished turn)
SHALL NOT set waiting and SHALL leave the recorded state unchanged. On SessionEnd
it SHALL remove the session's status file.

#### Scenario: Tool use recorded

- **WHEN** a PreToolUse event fires for tool `Bash` under a resolved session hash
- **THEN** the hash's status file records state "tool" with name "Bash" and a current timestamp

#### Scenario: Turn finished recorded as done

- **WHEN** a Stop event fires under a resolved session hash
- **THEN** the hash's status file records state "done" with a current timestamp

#### Scenario: Permission request recorded as waiting

- **WHEN** a Notification event of the permission-request subtype fires under a resolved session hash
- **THEN** the hash's status file records state "waiting"

#### Scenario: Idle-prompt does not raise waiting

- **WHEN** a Notification event of the idle-prompt subtype fires under a hash whose recorded state is "done"
- **THEN** the status file remains "done" and is not changed to "waiting"

#### Scenario: Session end cleans up

- **WHEN** a SessionEnd event fires under a resolved session hash
- **THEN** the hash's status file is removed

#### Scenario: Concurrent events resolve to current state

- **WHEN** two events for the same hash arrive in close succession
- **THEN** the status file reflects the later event (last-write-wins), with no partial/torn file observable by a reader
