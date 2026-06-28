## Why

The panel covers the minimum lifecycle — list, attach, create, kill — but stops
short of feeling complete. There is no way to rename a session, no empty-state
guidance, no way to auto-start a command on create, and the list is an
undifferentiated set of names that does not show which sessions are already open.
The default socket prefix (`.claude-`) also carries a leading dot that only made
sense when sockets lived in `$HOME`; now that they live in a dedicated directory,
the dot — and arguably the whole prefix — is vestigial.

## What Changes

- **Stable session id** — created sockets are named `<name>_<hash>.dtach` (6 hex
  chars). The hash is a rename-invariant identity: it stays in the dtach process's
  launch argv for the life of the session, so the process is always resolvable by
  the hash even after the socket file is moved.
- **Rename a session** — new context-menu command that moves the socket file
  (preserving the hash) and renames any open terminal, closing the
  create/kill/rename CRUD gap. Kill resolves the process via the hash anchor, so
  rename never orphans the dtach server.
- **Drop the default prefix** — default `socketPrefix` changes from `.claude-` to
  `""`; the dedicated directory plus the `.dtach` suffix become the discriminator.
  Session discovery filters on the `.dtach` suffix confirmed with a socket-type
  check (`isSocket()`) rather than a name prefix. **BREAKING**: existing
  `.claude-*.dtach` sockets stop appearing under the new default until renamed or
  the old prefix is restored in settings (clean break — no legacy fallback).
- **Welcome view** — an empty-state with a "New Session" call-to-action when no
  sessions exist, instead of a blank panel.
- **Startup command** — optional config run inside a session on create (e.g.
  `claude`), removing the manual step.
- **Copy socket path / attach command** — context-menu entries to the clipboard
  for scripting and SSH.
- **Quick-switch** — a command-palette picker to fuzzy-find and attach a session.
- **Terminal-open indicator** — sessions with a live terminal in the current
  window are visually distinguished (icon and/or description).
- **Detach** — explicit "close this window's terminal, keep the session alive".
- **Sort by recency** — order sessions by socket mtime and surface a relative age
  ("modified 2h ago") as a weak activity hint.
- **Kill all / multi-select kill** — tear down several sessions at once.

## Capabilities

### New Capabilities
- `session-rename`: rename an existing session — move its socket file and rename
  any open terminal attached to it.

### Modified Capabilities
- `session-list`: empty default prefix and suffix-based discovery; welcome
  empty-state; recency sort with relative-age display; terminal-open indicator.
- `session-create`: socket names gain a rename-invariant `_<hash>` id; optional
  startup command run inside a newly created session.
- `session-attach`: command-palette quick-switch picker; copy socket path / attach
  command to clipboard; explicit detach command.
- `session-kill`: process resolution via the hash anchor (rename-safe);
  multi-select and kill-all teardown.

## Impact

- `src/extension.ts`: new `rename`, `detach`, `quickSwitch`, `copy*`, `killAll`
  command handlers; `create`/`launchSession` gain startup-command injection.
- `src/provider.ts`: `displayName` simplification; suffix/socket-type filter;
  mtime-based sort; `SessionItem` icon/description for terminal-open state;
  `config()` default prefix change.
- `package.json`: default `socketPrefix` → `""`; new `startupCommand` setting; new
  commands and menu contributions; `viewsWelcome` contribution.
- `README.md`: document new commands/settings and the prefix-default migration note.
- No new runtime dependencies.
