## MODIFIED Requirements

### Requirement: Install merges the forwarder into Claude settings idempotently

The Install command SHALL register the forwarder under each relevant Claude
lifecycle event in `~/.claude/settings.json` by merging into the existing
configuration without removing or altering the user's other hooks, and SHALL be
idempotent (re-running does not create duplicate entries). Install SHALL copy
the bundled forwarder to a stable path (`~/.dtach-sessions/hook`) and reference
that path, so an extension update does not break the wiring.

Install SHALL additionally self-test for `python3` on the extension host. The
result SHALL NOT block or alter the wiring — installation always completes — but
when `python3` cannot be found, Install SHALL append a non-blocking advisory to
its success message so that a "hooks installed but no status ever appears"
outcome is explained rather than silent. The advisory SHALL acknowledge that the
check runs on the extension host, whose `PATH` may differ from the host that
runs Claude.

#### Scenario: Install preserves existing user hooks

- **WHEN** the user already has their own hooks configured and runs Install
- **THEN** the forwarder entries are added and all pre-existing user hooks remain intact

#### Scenario: Install is idempotent

- **WHEN** Install is run a second time
- **THEN** no duplicate forwarder entries are added and the stable forwarder copy is refreshed

#### Scenario: Install notes a restart is needed

- **WHEN** Install completes
- **THEN** the user is told that already-running Claude sessions will not show status until restarted, because Claude reads hooks at session start

#### Scenario: Install warns when python3 is absent

- **WHEN** Install completes on a host where `python3` is not found by the extension-host self-test
- **THEN** the forwarder is still installed and wired, and the success message additionally advises that `python3` was not found and that status will not appear until it is available

#### Scenario: Install does not warn when python3 is present

- **WHEN** Install completes on a host where the self-test finds `python3`
- **THEN** no python3 advisory is appended to the success message
