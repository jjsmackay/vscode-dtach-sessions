## ADDED Requirements

### Requirement: New session in an existing session's directory
The extension SHALL contribute a "New Session Here" command to the session row
context menu (`view/item/context`). Activating it on a session SHALL create a new
session whose shell working directory is that session's best-effort working
directory, named in the source session's name family — the family base (the
source name with any trailing `-N` numeric suffix removed) deduped via the
numeric-suffix rule (see "Unique session name on collision"). The command SHALL
NOT attach to or reuse any existing session; it always creates.

The working directory SHALL be resolved the same way as Restart: probe the
session's shell via `/proc`/`lsof`. When it cannot be resolved (no such tooling,
probe fails, or process gone), the new session SHALL be rooted at `$HOME`
silently, with no error. Because detach kills only the client while the dtach
master and its shell survive, the probe succeeds for detached sessions as well
as attached ones.

The command SHALL appear in the context menu only (no inline row icon).

#### Scenario: New session in an attached session's directory
- **WHEN** the user right-clicks an attached session `api` whose shell is at `/srv/api` and selects "New Session Here"
- **THEN** a new session named `api-2` (next free numeric suffix) is created with its shell rooted at `/srv/api`

#### Scenario: Source name is already a family sibling
- **WHEN** the user selects "New Session Here" on a session `api-2` and `api`, `api-2` already exist
- **THEN** the family base `api` is used and the new session is named `api-3` (not `api-2-2`)

#### Scenario: Working directory cannot be resolved
- **WHEN** the user selects "New Session Here" but the session's shell working directory cannot be determined
- **THEN** a new family sibling is created rooted at `$HOME` and no error is shown

#### Scenario: Detached source session
- **WHEN** the user selects "New Session Here" on a detached session whose master and shell are still alive at `/srv/api`
- **THEN** the working directory resolves to `/srv/api` and the new session is rooted there
