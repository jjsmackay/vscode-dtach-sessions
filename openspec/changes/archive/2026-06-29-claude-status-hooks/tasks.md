## 1. Forwarder script

- [x] 1.1 Add a bundled python3 forwarder (e.g. `scripts/claude-status-hook.py`) that takes the event name as `argv[1]`.
- [x] 1.2 Implement the `/proc` ancestor walk: follow the ppid chain, read each `/proc/<pid>/cmdline`, find the first ancestor whose argv contains a `*.dtach` token, and extract the 6-hex hash from the socket basename. Exit 0 (no write) if none found or `/proc` is unavailable.
- [x] 1.3 Map events to state (SessionStart/Stop→idle, UserPromptSubmit/PostToolUse→working, PreToolUse→tool+name from stdin JSON, Notification→waiting); write `~/.dtach-sessions/status/<hash>.json` atomically (tmp + rename) with state, tool name, timestamp.
- [x] 1.4 On SessionEnd, remove `status/<hash>.json`.
- [x] 1.5 Verify by hand: run Claude inside an extension-created dtach session and confirm a status file appears/updates/clears; run Claude outside dtach and confirm no file is written.

## 2. Install / uninstall

- [x] 2.1 In `src/extension.ts`, add an Install handler: copy the bundled forwarder to the stable path `~/.dtach-sessions/hook` (overwrite), then merge forwarder entries (referencing that path) under each lifecycle event in `~/.claude/settings.json` without disturbing existing hooks; idempotent (no duplicates).
- [x] 2.2 Add an Uninstall handler that removes only entries referencing the forwarder path.
- [x] 2.3 Show an install-complete message noting already-running Claude sessions need a restart to report status.
- [x] 2.4 Register `dtachSessions.installClaudeHooks` and `dtachSessions.uninstallClaudeHooks` in `package.json` (+ command registration in `activate`).

## 3. Install nudge

- [x] 3.1 On activate, offer Install / Not now / Don't ask again only when `~/.claude/` exists, hooks are not installed, and no prior dismissal is stored.
- [x] 3.2 Persist "Don't ask again" in `globalState` (per-host) so it survives across windows; wire the buttons to install / no-op / record dismissal.

## 4. Provider: status read, join, badge

- [x] 4.1 In `src/provider.ts`, read the sibling `status/` directory and build a `Map<hash, state>` (tolerate missing dir, like the socket dir ENOENT handling).
- [x] 4.2 Join status to sessions by hash in `listSessions`/`SessionItem`; legacy no-hash sockets get no status.
- [x] 4.3 Apply staleness decay: transient states (working, tool) older than the threshold fall back to idle/age.
- [x] 4.4 Append the badge to `SessionItem.description` (working / tool:`<name>` / waiting / idle); do **not** touch `contextValue`. Optionally adjust the icon. No badge when no status.

## 5. Watcher

- [x] 5.1 Add a `FileSystemWatcher` (or `fs.watch`) on the `status/` dir that calls `provider.refresh()` on create/change/delete; register and dispose with the extension.

## 6. Config & docs

- [x] 6.1 Add an optional config setting to enable/disable the status feature (default on) in `package.json` and `config()`.
- [x] 6.2 Update `README.md` (feature, install command, Linux-only caveat) and the `## Gotchas` notes in `CLAUDE.md` (correlation via `/proc`, per-hash status files, status-in-description vs contextValue composition).

## 7. Verify

- [x] 7.1 `npm run compile` cleanly.
- [ ] 7.2 Manual acceptance: install hooks; start Claude in a session and confirm working/tool/waiting/idle badges track its state; kill Claude mid-turn and confirm the badge decays; SessionEnd clears it; uninstall leaves other Claude hooks intact.
