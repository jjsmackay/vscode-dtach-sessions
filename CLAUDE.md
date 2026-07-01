# dtach Sessions

Minimal VS Code extension: lists [dtach](https://github.com/crigler/dtach)
sockets in a sidebar and attaches to them in native integrated terminals (no
webview/PTY proxy). Runs on the **remote** extension host (Remote-SSH), where
the sockets and binary live. See `README.md` for features, config, and
acceptance checks.

## Commands
```sh
npm run compile   # tsc -p ./  ->  out/   (also runs on vscode:prepublish)
npm run watch     # tsc -watch
npx @vscode/vsce package   # -> dtach-sessions-<version>.vsix
```
No test suite; verify against the acceptance checks in `README.md`.

## Architecture
- `src/extension.ts` — command handlers + orchestration (create/attach/rename/
  kill/detach/copy), terminal creation, `activate()` command registration.
- `src/provider.ts` — `DtachTreeProvider` (tree rendering), `config()`, and the
  socket/name utilities: `displayName`, `hashOf`, `findTerminalForSocket`,
  `socketFromTerminal`, `relativeAge`. Also the Claude-status read side:
  `readStatuses` and `statusLabel` (with staleness decay).
- `scripts/claude-status-hook.py` — the bundled Claude hook forwarder (shipped in
  the `.vsix`; copied to `~/.dtach-sessions/hook` on install). Stand-alone; no
  knowledge of VS Code config.
Shared helpers belong in `provider.ts`; command flow stays in `extension.ts`.

## Workflow
- Feature work is spec-first via **OpenSpec**: proposals/specs/tasks live in
  `openspec/changes/<change>/`. Use the `opsx:*` skills (propose/apply/archive).
- Git: branch session work, squash-merge onto the feature branch before upstream.
- **One commit per change on `main`.** Each archived OpenSpec change lands as a
  single squashed commit (subject = the change's headline, `openspec: <change>`
  footer folding in its propose/impl/refactor/archive steps). `chore(release)`
  bumps stay as standalone commits so version boundaries remain legible.

## Gotchas
- The extension host does **not** source `.bashrc` — `dtach` may not be on PATH;
  that's why `dtachSessions.dtachPath` exists.
- Socket names are `<prefix><name>_<hash>.dtach`. The `_<hash>` is a
  rename-invariant id: rename moves the socket keeping the hash; kill resolves
  the process by hash so renamed sessions aren't orphaned.
- `findTerminalForSocket` queries `vscode.window.terminals` live (not an
  in-memory map) so it survives a window reload, which restarts the extension
  host but restores terminals. A reload **strips a restored terminal's
  `shellArgs`** (the socket-in-args match then fails) but keeps its `processId`,
  so reattach falls back to a socket→terminal registry rebuilt on activate by
  matching live pids against a persisted `socket→pid` map (`workspaceState`).
- `dtachSessions.reflectProcessTitle` (default on) creates attach terminals
  **without** a fixed name so the program's title drives the tab; an API name's
  title source would otherwise override it. VS Code only honours an escape-set
  title from a detected agent CLI, so we can't seed the tab — instead dtach is
  launched via `bash -c 'exec -a "$0" "$@"' <name> <dtachPath> <args…>` so its
  `argv[0]` is the session name (VS Code reads `argv[0]` for the pre-title
  fallback). The socket stays a standalone `.dtach` arg so `socketFromTerminal`
  still matches. With no API name to match on after a reload, the pid-keyed
  registry above is what keeps reattach working.
- VS Code has no terminal-rename API. With `reflectProcessTitle` on, rename only
  re-keys the registry (the live attach survives the socket move by inode); with
  it off, rename disposes and recreates the terminal under the new name.
- Attached rows use a baked-green SVG (`media/terminal-green.svg`), not a
  recoloured codicon: VS Code washes codicon colour out on row selection. The
  blue detach/pause inline icon (`media/pause-blue.svg`) is baked for the same
  reason — inline action icons aren't per-command themeable.
- `SessionItem.contextValue` encodes attach state (`dtachSession-attached` /
  `dtachSession-detached`) so the per-row inline icons can swap: play (attach)
  on detached rows, pause (detach) on attached rows. Restart and Kill show on
  both via a `viewItem =~ /^dtachSession-/` clause. Existing context-menu
  entries gate on `view ==` (not `viewItem`), so they're unaffected by the split.
- Restart = confirm → `killOne` → `createSession(name)`: it composes the kill
  and create paths (fresh hash, fresh terminal, re-runs `startupCommand`); the
  dtach server and its scrollback do not survive.
- Stale-client reaping (`reapStaleClientsOnAttach`, default on): a dtach master
  tees its pty to **every** client under one shared winsize with no retained
  buffer, so a client orphaned when its terminal died (window close, SSH drop)
  wedges on the socket and a later attach gets a cursor on a blank screen. Kills
  must be **`SIGKILL`** — a wedged client blocks `SIGTERM` (it only polls for it
  inside the `select()` loop that never wakes without a tty); this is why
  `killOne` uses `kill -9`. Detection is by pid identity: `staleClientPids`
  takes the socket's `-a` clients (via `resolvePidsCommand`, then filtered on a
  bare `-a` in `/proc/<pid>/cmdline` so the `-A` master is never touched) minus
  this window's live terminal pid (`findTerminalForSocket` → `term.processId`,
  which **is** the client pid because `exec -a` replaces bash in place). It
  returns `undefined` (skip) when a matched terminal's pid hasn't resolved, so a
  live client is never killed mid-spawn — and this pid-diff is what spares a
  reload-restored client (its pid survives and re-matches) where a blind
  "kill every client on the socket" would not. Reap fires only on the
  create-fresh branch of `showOrCreateTerminal` (making it and the attach path
  async), never on reuse; `createSession` passes `reapOnCreate` false since a new
  socket can't have clients. Reaping only kills clients — master and socket
  survive. Manual `Reap Stale Clients` (row) / `Reap All Stale Clients` (view
  title) cover the already-attached blind spot. Linux `/proc` only.
- Live Claude status (`showClaudeStatus`, default on) is hook-driven, not from
  PTY/transcript scraping. The bundled `scripts/claude-status-hook.py` forwarder
  is merged into every lifecycle event in `~/.claude/settings.json` by the
  Install command (idempotent; ours is recognised by the `HOOK_PATH` substring,
  so Uninstall is surgical). It runs host-global for **every** Claude on the box;
  it correlates to a session by walking `/proc` ppids to the dtach master and
  reading the `*.dtach` socket from its cmdline (the same standalone-arg the
  `exec -a` launcher preserves — `argv[0]` relabelling doesn't hide it), then
  writes `<socketDir>/status/<hash>.json` atomically. No `.dtach` ancestor ⇒
  cheap no-op. Status is carried in the row **description**, separate from the
  `contextValue` attach-state split above — run-state and attach-state compose
  on a row without either suppressing the other. Provider decays stale
  `working`/`tool` (not `waiting`/`done`) to age so a crashed Claude doesn't
  stick. The install **nudge** is gated on `~/.claude/` existing (the "runs
  Claude" signal — PATH is unreliable on the extension host) + not-installed + a
  `globalState` dismissal flag.
- The forwarder's event→state decision lives in one pure `resolve(event,
  payload)` (testable without `/proc`): `Stop`→`done`, `SessionStart`→`idle`,
  prompts/tool as before. **`Notification` is classified by its stdin
  `notification_type`** — only `permission_prompt` raises `waiting` (the amber
  bell); `idle_prompt` (auto-fires ~60s after a finished turn) and every other
  subtype return `None`, leaving the recorded state untouched so a finished
  session stays `done`. This keeps the bell = "genuinely blocked", so the
  activity-bar waiting count is trustworthy. Reads the subtype from the stdin
  payload (single hook registration — no per-matcher entries, so install/
  uninstall are unchanged). An extension upgrade needs **Install Claude Hooks
  re-run** to copy the new forwarder to `~/.dtach-sessions/hook`.
- Status presentation derives from one `effectiveState(status)` (decay applied
  once) so the badge, icon, and time can't disagree. Icon: `loading~spin`
  codicon for working/tool (motion is the cue, so the codicon-colour wash on
  selection is moot — that's *why* a spinner works where a coloured codicon
  wouldn't); baked amber bell `media/state-waiting.svg` for waiting (colour IS
  the signal, so it must be a baked SVG like `terminal-green.svg`); `$(check)`
  themed codicon (charts.green) for `done` — here colour is *not* load-bearing
  (a check's meaning rides on its shape), so a themed codicon is fine despite the
  selection wash, keeping `media/` lean; the attached/plain terminal icon at
  rest. `waiting` and `done` don't decay (both are legitimate resting states —
  `done` persists until the next prompt). The row's relative time is
  `relativeAge(status.ts)` when a status exists (activity-relative — tracks the
  agent), falling back to socket `mtimeMs` otherwise; the tooltip keeps the
  honest mtime "last modified".
- Detached rows are dimmed via a `FileDecorationProvider`
  (`DetachedRowDecorations`), **not** a `TreeItem` treatment (VS Code has none):
  it tints the row **label** only and leaves `iconPath` untouched — so a detached
  session that needs you keeps its full-strength amber bell on a dimmed name.
  Decorations key off `TreeItem.resourceUri`, so each row gets a **synthetic**
  `dtach-session://<hash>` URI (`sessionResourceUri`) used purely as a key — a
  real socket path would hijack label/icon derivation (file-icon theme +
  filename). The provider holds a uri→session map re-keyed in `getChildren` via
  `sync()`, which fires `onDidChangeFileDecorations` for every row so dimming
  tracks attach-state on the same refresh signal as the icons; attach detection
  reuses `findTerminalForSocket` (pid-registry-backed), so it survives a reload.
