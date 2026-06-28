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
  `socketFromTerminal`, `relativeAge`.
Shared helpers belong in `provider.ts`; command flow stays in `extension.ts`.

## Workflow
- Feature work is spec-first via **OpenSpec**: proposals/specs/tasks live in
  `openspec/changes/<change>/`. Use the `opsx:*` skills (propose/apply/archive).
- Git: branch session work, squash-merge onto the feature branch before upstream.

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
  recoloured codicon: VS Code washes codicon colour out on row selection.
