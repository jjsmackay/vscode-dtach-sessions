## 1. Spike

- [x] 1.1 Confirm `mv` of a live dtach socket preserves attach and that `pgrep -f '_<hash>\.dtach'` resolves the PID post-rename (verified on dtach 0.9: attach survives; lsof/full-path pgrep fail; hash anchor resolves the PID). Rename adopts the `name_<hash>.dtach` scheme.

## 2. Prefix default, hash id & discovery

- [x] 2.1 Change `dtachSessions.socketPrefix` default to `""` in `package.json`
- [x] 2.2 Add a `sessionHash()` helper (`crypto.randomBytes(3).toString('hex')`) and a `hashOf(basename)` extractor (trailing `_[0-9a-f]{6}` before `.dtach`)
- [x] 2.3 Update `displayName()` to strip prefix (if present), `.dtach`, then a trailing `_<hash>`; legacy hashless sockets keep working
- [x] 2.4 Make `listSessions()` filter on the `.dtach` suffix plus `fs.statSync().isSocket()` (clean break — no legacy `.claude-` fallback)
- [x] 2.5 Add the prefix-default migration note to `README.md`

## 3. Recency sort & relative age

- [x] 3.1 Sort `listSessions()` by socket `mtimeMs` descending
- [x] 3.2 Add a relative-age string to `SessionItem.description` and clarify in the tooltip that it is last-modified, not activity

## 4. Terminal-open indicator

- [x] 4.1 In the tree provider, resolve each session's open-terminal state via `findTerminalForSocket` (move/share the helper as needed)
- [x] 4.2 Distinguish attached rows with a distinct icon and/or description marker, recomputed on refresh

## 5. Welcome empty-state

- [x] 5.1 Add a `viewsWelcome` contribution for `dtachSessionsView` with explanatory text and a "New Session" button bound to the create command

## 6. Create with hash & startup command

- [x] 6.1 Update `create`/`launchSession` to embed `sessionHash()` in the socket name (`<name>_<hash>.dtach`), regenerating on the rare same-name collision
- [x] 6.2 Add the `dtachSessions.startupCommand` setting (default empty) to `package.json` and `config()`
- [x] 6.3 Send the command via `terminal.sendText` only when `showOrCreateTerminal` returns a new terminal (create-only, never on reuse)

## 7. Rename session

- [x] 7.1 Add the `dtachSessions.rename` command + context-menu contribution
- [x] 7.2 Prompt with create-rule validation, refuse display-name collisions, `fs.renameSync` to `<newName>_<hash>.dtach` (hash preserved), refresh
- [x] 7.3 If a terminal is open for the session, dispose + reattach under the new name per design

## 8. Detach

- [x] 8.1 Add the `dtachSessions.detach` command + context-menu contribution that disposes the session's terminal without removing the socket (no-op if none open)

## 9. Copy commands

- [x] 9.1 Add "Copy Socket Path" command writing the absolute socket path to the clipboard
- [x] 9.2 Add "Copy Attach Command" command writing `dtach -a <socket> -r <redraw>` (configured binary/redraw) to the clipboard

## 10. Quick-switch

- [x] 10.1 Add a command-palette command that shows a `showQuickPick` of sessions (recency order) and attaches the selection via the existing attach path; handle the no-sessions case

## 11. Multi-select & kill all

- [x] 11.1 Enable `canSelectMany` on the tree view
- [x] 11.2 Refactor kill into a `killOne(session)` core; resolve the PID via `lsof -t <socket>` then `pgrep -f '_<hash>\.dtach'` (hash anchor), with the legacy escaped-full-path fallback for hashless sockets; have the kill command map over the selection behind one confirmation
- [x] 11.3 Add a "Kill All" title-bar command with a count-stating confirmation over `listSessions()`

## 12. Wire-up & docs

- [x] 12.1 Register all new commands and menu/title contributions in `package.json` and `activate()`
- [x] 12.2 Update `README.md` Features/Configuration for rename, startup command, copy, quick-switch, detach, indicator, sort, kill-all
- [x] 12.3 `npm run compile` clean; manually verify each new command against the spec scenarios
