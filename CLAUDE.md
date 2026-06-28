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
  host but restores terminals.
- VS Code has no terminal-rename API — rename disposes and recreates the terminal.
- Attached rows use a baked-green SVG (`media/terminal-green.svg`), not a
  recoloured codicon: VS Code washes codicon colour out on row selection.
