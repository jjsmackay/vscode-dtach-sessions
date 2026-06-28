## 1. Scaffold

- [x] 1.1 Create `package.json` with `engines.vscode ^1.90.0`, `extensionKind: ["workspace"]`, `main: ./out/extension.js`, and `scripts.compile` = `tsc -p ./`
- [x] 1.2 Add `contributes.viewsContainers.activitybar` (id `dtachSessions`, `media/icon.svg`) and `contributes.views` (`dtachSessionsView`)
- [x] 1.3 Add `contributes.commands`: `dtachSessions.refresh`, `.create`, `.attach`, `.kill`
- [x] 1.4 Add `contributes.menus`: `view/title` (refresh + create) and `view/item/context` (kill), gated with `when: view == dtachSessionsView`
- [x] 1.5 Add `contributes.configuration`: `socketDir` (default `~`), `socketPrefix` (default `.claude-`), `redrawMethod` (default `winch`, enum `winch`/`ctrl_l`/`none`), `dtachPath` (default `dtach`)
- [x] 1.6 Create `tsconfig.json` (CommonJS, outDir `out`, strict), `.vscodeignore`, and `media/icon.svg`

## 2. Tree Provider

- [x] 2.1 Create `src/provider.ts` with `DtachTreeProvider implements vscode.TreeDataProvider<...>`
- [x] 2.2 Implement socket directory resolution (expand leading `~` to `os.homedir()`) and `fs.readdir` + prefix/`.dtach` filter
- [x] 2.3 Map sockets to tree items with display name = basename minus leading `.` and trailing `.dtach`; attach `command` = `dtachSessions.attach`
- [x] 2.4 Implement `onDidChangeTreeData` event emitter and a `refresh()` method
- [x] 2.5 Handle missing socket directory: empty tree + error message
- [x] 2.6 Wire `onDidChangeVisibility` (via the tree view) to call `refresh()` when the view becomes visible

## 3. Commands

- [x] 3.1 Create `src/extension.ts` `activate()` that registers the provider and all four commands
- [x] 3.2 Implement attach: build `<dtachPath> -a <socket> [-r <redraw>]` args, create terminal with `shellPath` = `dtachPath`, `.show()`; track created terminals by socket and reuse a live one instead of opening a second attach (clear on `onDidCloseTerminal`)
- [x] 3.3 Implement create: `showInputBox` with `validateInput` rejecting empty/whitespace/`/`-containing names, build socket path, build `<dtachPath> -A <socket> [-r <redraw>] <$SHELL||/bin/bash>` args, create terminal, refresh
- [x] 3.4 Implement kill: confirm dialog, then `child_process.exec` resolving the PID via `lsof -t <socket>` (fallback to `pgrep -f` with regex-escaped socket path), `kill` it, then `rm -f <socket>`, refresh
- [x] 3.5 Implement refresh command wired to provider `refresh()`

## 4. Build & Verify

- [x] 4.1 `npm install` and `npm run compile` produce `out/extension.js` with no errors
- [x] 4.2 `npx @vscode/vsce package` produces a `.vsix`
- [x] 4.3 Write `README.md` covering remote VSIX install, `dtach` requirement and the `dtachPath` setting, the `lsof`/`pgrep` dependency for kill, and the four acceptance scenarios (list, attach, create, kill)
- [x] 4.4 Manually verify acceptance checks on a remote host: list shows existing socket, click attaches and renders, create makes a new socket, kill removes it, native mouse select/copy works
