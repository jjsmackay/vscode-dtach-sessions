## Context

The extension is a thin, pure-passthrough wrapper over `dtach`: it lists socket
files, attaches them in ordinary integrated terminals, and creates/kills them. It
deliberately has no webview and no PTY proxy, so it can only observe socket
*files* and the VS Code terminal list — never what runs inside a session. Every
feature here respects that boundary; none requires introspecting session output.

Current building blocks this change reuses:
- `provider.ts`: `config()`, `displayName()`, `listSessions()`, `SessionItem`.
- `extension.ts`: `findTerminalForSocket()`, `showOrCreateTerminal()`,
  `launchSession()`, `uniqueName()`, `sanitizeName()`, `redrawArgs()`,
  `shellEscape()`, `escapeRegex()`, the kill pipeline.

## Goals / Non-Goals

**Goals:**
- Close the CRUD gap (add rename) and add low-cost, in-character QOL.
- Keep pure passthrough — no webview, no PTY proxy, no output introspection.
- Reuse existing helpers rather than introduce new architecture.
- Make the default prefix honest now that sockets live in a dedicated directory.

**Non-Goals:**
- Live activity / busy-idle indication (would require a PTY proxy).
- Renaming the published extension, view container, command ids, or settings keys.
- Any cross-window coordination of terminal state (lookups stay per-window, as today).

## Decisions

### Default prefix → empty, suffix is the discriminator
Change `dtachSessions.socketPrefix` default from `.claude-` to `""`. The leading
dot only mattered when sockets lived in `$HOME`; the dedicated directory now is
the namespace. Discovery filters on the `.dtach` suffix (which `create()` already
writes), so the prefix becomes an *optional* extra filter rather than required.
`displayName()` strips the prefix if present, strips `.dtach`, then strips a
trailing `_<hash>`.

*Alternative considered — keep `claude-` (drop only the dot):* rejected; the dir
is Claude-only by default, so any prefix is redundant. Users who park mixed
sessions in one dir can still set a prefix.

*Hardening (adopted):* layer `fs.statSync(f).isSocket()` on top of the suffix
filter to ignore a stray regular file named `*.dtach`. One stat per entry, trivial
for a handful of sockets.

*Legacy prefix (decided):* clean break — no `.claude-` discovery fallback. Existing
sockets are restored by setting `socketPrefix` back, documented in the README.

### Stable session id = a hash in the filename
Created sockets are named `<prefix><name>_<hash>.dtach`, where `<hash>` is
`crypto.randomBytes(3).toString('hex')` (6 lowercase hex). The hash is a
rename-invariant identity: it is part of the dtach process's launch argv and
stays there for the life of the session, even after the socket file is moved.

*Why it matters (verified by spike):* `mv` of a live socket preserves attach (the
listening socket is bound to the inode, so new and existing clients reach it via
the new path), **but** the dtach process's argv and bound path keep the *original*
path forever — so after a rename `lsof -t <newpath>` and `pgrep -f <newpath>` both
return nothing, and Kill would orphan the server. The hash fixes this: `pgrep -f
'_<hash>\.dtach'` matches the stale argv and resolves the PID regardless of
renames. Spike evidence: rename `web_a1b2c3` → `api_a1b2c3`, then `pgrep -f
'_a1b2c3\.dtach'` returns the live PID while both path-based lookups fail.

### Rename = move the socket file, hash preserved
`fs.renameSync(oldSocket, newSocket)` where `newSocket` keeps the same `_<hash>`
and changes only the name part. Validate the new name with the create rules,
refuse (or bump, consistent with create) if a session with that display name
already exists, then refresh. If a terminal for the old socket is open in this
window, relabel it (see risk below).

*Display-name parsing:* strip the prefix, strip `.dtach`, then strip a trailing
`_[0-9a-f]{6}`. Legacy sockets without a hash simply skip the last step. Accept the
rare edge where a real name ends in `_<6hex>` rather than persist extra state.

*Name dedup stays:* the hash guarantees *file* uniqueness, but `uniqueName()` still
bumps `web` → `web-2` so the tree never shows two identical labels. The hash is for
identity/kill-anchoring, not a licence for duplicate display names.

*Risk:* VS Code's `Terminal` has no public rename API. Mitigation below.

### Startup command via `terminal.sendText`, create-only
After `showOrCreateTerminal()` returns a *new* terminal (it returns `undefined`
on reuse), and only then, send `startupCommand` with `sendText(cmd, true)`. Gating
on the "new terminal" return value naturally restricts it to create — reattach
and folder-open-of-existing never re-run it. No shell-injection concern: it is the
user's own configured command sent to their own shell.

### Terminal-open indicator reuses `findTerminalForSocket`
`getChildren()` already could call `findTerminalForSocket(session)` per row;
surface the result as a distinct `ThemeIcon` and/or a description marker. No new
state — it is recomputed on each refresh, which is what keeps it correct across
window reload.

### Recency sort + relative age
Replace the alphabetical `.sort()` in `listSessions()` with a sort on
`fs.statSync(socket).mtimeMs` descending. Render a compact relative age in
`SessionItem.description`. mtime is an honest *weak* signal (socket file touch),
explicitly not a claim about in-session activity — call this out in the tooltip.

### Quick-switch via `vscode.window.showQuickPick`
Build the pick list from `listSessions()` (already recency-ordered); on selection
route through the same attach path as a tree click, so reuse-or-create is
identical. A command-palette entry, no tree dependency.

### Kill resolves the PID via the hash anchor
Replace the kill resolution with: `lsof -t <currentsocket>` (precise; works while
the socket sits at its launch path) then fall back to `pgrep -f '_<hash>\.dtach'`
using the hash extracted from the current filename. This is rename-safe — the hash
is in the stale argv. Legacy sockets with no hash fall back to the previous
escaped-full-path `pgrep`. Socket removal via `rm -f` is unchanged.

### Multi-select kill / kill all
The tree is created with `canSelectMany: true`; the kill command accepts the
selection array (VS Code passes `(clicked, allSelected)` to the handler). Refactor
the current single-session kill into a `killOne(session)` core (using the hash
resolution above) and have the command map over the selection behind one
confirmation. "Kill All" runs the same core over `listSessions()`.

### Copy / detach
Thin commands: copy uses `vscode.env.clipboard.writeText`; detach is
`findTerminalForSocket(session)?.dispose()` with no socket removal.

## Risks / Trade-offs

- **No terminal rename API** → On rename, if a terminal is open, dispose it and
  reattach under the new name (reusing the existing attach path). Document that an
  open session's terminal will flicker/reopen on rename; acceptable and keeps the
  tab title correct. (Alternative: leave the old terminal as-is with a stale title
  — rejected as confusing.)
- **Prefix default change is BREAKING** → existing `.claude-*.dtach` sockets
  vanish under the new default (clean break, decided). Mitigation: README migration
  note; users restore by setting `socketPrefix` back to `.claude-`, or rename their
  sockets.
- **mtime as activity** → could mislead if read as "busy". Mitigation: label it as
  last-modified in the tooltip; never imply liveness.
- **Rename of a live socket** → verified on dtach 0.9: `mv` preserves attach, and
  `pgrep -f '_<hash>\.dtach'` resolves the PID post-rename. Residual risk: a
  process unrelated to dtach whose argv happens to contain `_<hash>.dtach` — the
  6-hex space plus the `.dtach` suffix makes this negligible in practice.
- **Hash collision** → two sessions could draw the same 6-hex hash. Mitigation:
  `uniqueName()` already keeps display names distinct; a hash clash only matters if
  two sockets share both name and hash, which `create()` checks against existing
  sockets. Regenerate on the rare clash.

## Migration Plan

1. Ship the prefix default change with a README note and the (optional) legacy
   fallback during discovery.
2. No data migration needed — sockets are ephemeral; users recreate or rename.
3. Rollback: restore the `.claude-` default in `package.json`; other features are
   additive and independently revertible.

## Open Questions

All resolved during apply:
- Legacy `.claude-` discovery fallback → **clean break**, no fallback.
- `isSocket()` hardening → **included**.
- `mv` of a live socket on the target dtach build → **verified (dtach 0.9)**; rename
  adopts the `name_<hash>.dtach` scheme with a hash-anchored kill.
