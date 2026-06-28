## 1. Pause icon asset

- [x] 1.1 Add `media/pause-blue.svg` — a 16×16 two-bar pause glyph in blue, matching `media/terminal-green.svg`'s viewBox/stroke conventions.

## 2. Tree item: attach-state contextValue and pause icon

- [x] 2.1 In `src/provider.ts`, set `SessionItem.contextValue` to `dtachSession-attached` or `dtachSession-detached` based on the existing attached check.
- [x] 2.2 ~~Wire the baked blue pause `Uri` into `DtachTreeProvider`~~ — not needed: the pause icon is set directly as the `detach` command's `icon` path in `package.json`; inline action icons take a path, not a TreeItem `Uri`.

## 3. package.json contributions

- [x] 3.1 Add a `dtachSessions.restart` command (title "Restart", icon `$(debug-restart)`, category "dtach Sessions").
- [x] 3.2 Give the `attach` command an `$(play)` icon and the `detach` command the blue pause icon (`media/pause-blue.svg`).
- [x] 3.3 Add `view/item/context` `inline` entries: play when `viewItem == dtachSession-detached`, pause when `viewItem == dtachSession-attached`, restart and kill for both (`viewItem =~ /^dtachSession-/`), ordered detach/attach @1, restart @2, kill @3.
- [x] 3.4 Add a `restart` context-menu entry under the modify/danger group, and hide `restart` from the command palette (`when: false`) like the other item-scoped commands.

## 4. Restart handler

- [x] 4.1 In `src/extension.ts`, add `restart(provider, session)`: modal confirm → `await killOne(session)` → `createSession(provider, session.name)` → `provider.refresh()`.
- [x] 4.2 Register the `dtachSessions.restart` command, resolving its argument via `toSession`.
- [x] 4.3 Capture the session shell's cwd before kill (`sessionCwd`, via `lsof`/`pgrep`) and pass it to `createSession` so the fresh shell reopens in the same directory.

## 5. Verify

- [x] 5.1 `npm run compile` cleanly.
- [x] 5.2 Manually verified in the Extension Development Host (play attaches, pause detaches, restart confirms + relaunches a fresh same-named shell in the prior cwd); shell-logic runtime-verified via /verify: attached row shows blue pause (click detaches → row flips to play); detached row shows play (click attaches → row flips to pause); restart confirms, kills, and relaunches a fresh same-named shell running `startupCommand`; cancelling restart leaves everything unchanged.
- [x] 5.3 Update `README.md` and the `## Gotchas`/architecture notes in `CLAUDE.md` if behaviour described there changed (new inline actions, contextValue split).
