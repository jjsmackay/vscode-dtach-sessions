## MODIFIED Requirements

### Requirement: Open session for a folder
The extension SHALL contribute a single "Open in Detach Session" command to the Explorer folder context menu (`explorer/context` with `when: explorerResourceIsFolder`). Activating it SHALL always open a QuickPick (never silently reuse or create). The QuickPick's input box SHALL be prefilled with the folder's basename sanitised to a valid session name, and SHALL remain editable. The QuickPick SHALL present, below the input:

- one "Attach" item for each existing session whose name is in the folder's name family — the basename itself and any `basename-N` numeric-suffix siblings — ordered newest-first, each item's description showing that session's live status label; and
- one "New session" item whose label reflects the current input value.

Selecting an "Attach" item SHALL open that session (reusing its open terminal if present, otherwise attaching). Selecting the "New session" item SHALL create a new session with the shell's working directory set to the folder, using the input value deduped via the numeric-suffix rule (see "Unique session name on collision"). Dismissing the QuickPick SHALL open and create nothing.

Reuse ("Attach") items SHALL remain selectable while the user edits the input value; the QuickPick's default value-based item filtering SHALL NOT hide them.

Matching is by name (basename) only; session working directory is not persisted, so two unrelated folders sharing a basename share one name family.

#### Scenario: Folder has no session yet
- **WHEN** the user right-clicks a folder `detach-sessions` with no existing session and accepts the prefilled input
- **THEN** the QuickPick shows only a "New session" item, and on accept a session named `detach-sessions` is created with its shell rooted in that folder

#### Scenario: Folder already has sessions
- **WHEN** the user right-clicks a folder `detach-sessions` with existing sessions `detach-sessions` and `detach-sessions-2`
- **THEN** the QuickPick lists an "Attach" item for each (newest-first, with status), plus a "New session" item, and selecting an "Attach" item opens that session rather than creating a duplicate

#### Scenario: Create a second session for a folder
- **WHEN** the user right-clicks a folder `detach-sessions` whose session already exists and selects the "New session" item
- **THEN** a new session is created rooted in that folder, named `detach-sessions-2` (next free numeric suffix)

#### Scenario: Custom name in the input box
- **WHEN** the user right-clicks a folder `detach-sessions`, edits the input to `runner`, and selects "New session"
- **THEN** a new session named `runner` is created rooted in that folder, and the "Attach" items for the `detach-sessions` family remain visible while editing

#### Scenario: Folder name needs sanitizing
- **WHEN** the user right-clicks a folder named `My Project`
- **THEN** the input box is prefilled with `My-Project` (whitespace and slashes replaced)

#### Scenario: User dismisses the QuickPick
- **WHEN** the user right-clicks a folder and dismisses the QuickPick
- **THEN** no terminal is opened and no session is created

### Requirement: Unique session name on collision
Create SHALL always produce a new session. If the chosen name's socket already exists, the extension SHALL append the smallest free numeric suffix (`-2`, `-3`, ...) and use that name, informing the user when the name was changed. The underlying `dtach -A` remains idempotent, but it is given an unused socket so it creates rather than reattaches.

For the folder QuickPick, the input box is prefilled with the raw basename (not pre-deduplicated); deduplication is applied when the "New session" item is accepted.

#### Scenario: Name collision bumps a digit
- **WHEN** the user creates a session named `foo` and `.claude-foo.dtach` already exists
- **THEN** the session is created as `foo-2` (or the next free suffix) and the user is notified

#### Scenario: Folder input prefilled with raw basename
- **WHEN** the user right-clicks a folder `foo` whose session already exists
- **THEN** the QuickPick input is prefilled with `foo` (not `foo-2`), and accepting "New session" creates `foo-2`
