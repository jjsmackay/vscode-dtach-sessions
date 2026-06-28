## 1. Configuration

- [x] 1.1 Add `dtachSessions.reflectProcessTitle` (boolean, default `true`) to `package.json` `contributes.configuration`, with a description covering the tab-title trade-off.
- [x] 1.2 Add `reflectProcessTitle` to the `DtachConfig` interface and `config()` in `src/provider.ts` (default `true`).

## 2. Terminal creation

- [x] 2.1 In `src/extension.ts`, factor terminal creation so attach and create pass `name: session.name` only when `reflectProcessTitle` is `false`, and omit `name` otherwise.
- [x] 2.2 Verify the dtach `shellPath`/`shellArgs` and redraw behaviour are unchanged in both branches.

## 3. Reattach via processId map

- [x] 3.1 On attach and on create, `await terminal.processId` and store a `socket → pid` association in `context.workspaceState`.
- [x] 3.2 Extend `findTerminalForSocket` in `src/provider.ts`: match by `shellArgs` socket first; then via a socket→terminal registry rebuilt from the persisted pid map; keep the `terminal.name` fallback only when `reflectProcessTitle` is `false`. (Registry + `reconcileTerminals` rebuild it on activate.)
- [x] 3.3 Register an `onDidCloseTerminal` handler that removes the closed terminal's association from the registry and `workspaceState`.
- [x] 3.4 Confirm the green attached-icon and "focus existing" paths use the updated lookup. (Both go through `findTerminalForSocket`; unchanged signature.)

## 4. Rename flow

- [x] 4.1 When `reflectProcessTitle` is `true`, skip the dispose+recreate-for-relabel step in rename; re-key the registry to the moved socket and refresh the `socket → pid` association.
- [x] 4.2 When `reflectProcessTitle` is `false`, retain the existing dispose+recreate-with-new-name behaviour.

## 5. Verification

- [x] 5.1 `npm run compile` is clean.
- [x] 5.2 Manual: with default config, attach a session running an agent CLI — tab shows the program's live title and updates. (Idle resume falls back to the session name via argv[0]; seeding a title is impossible — VS Code only honours titles from detected agent CLIs.)
- [x] 5.3 Manual: reload the window with that terminal open, then click the session — the restored terminal is focused (matched by pid), no duplicate, green icon shown.
- [x] 5.4 Manual: set `reflectProcessTitle: false`, attach — tab shows the session name; reload + click still reuses.
- [x] 5.5 Manual: close a terminal and confirm its association is removed (no stale reuse).
- [x] 5.6 Update `README.md` (features + config table) and the `CLAUDE.md` gotcha about the name-based reload fallback to reflect the pid-based mechanism.
