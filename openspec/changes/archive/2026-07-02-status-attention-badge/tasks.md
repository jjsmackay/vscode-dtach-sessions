## 1. Task A — activity-bar waiting badge

- [x] 1.1 Add a `countWaiting()` method to `DtachTreeProvider` in `src/provider.ts`: return 0 when `config().showClaudeStatus` is off; otherwise read statuses (`readStatuses`), join to listed sessions by hash, and count those whose `effectiveState(status) === 'waiting'`.
- [x] 1.2 In `activate()` (`src/extension.ts`), add an `updateBadge(view, provider)` that sets `view.badge` to `{ value, tooltip }` (e.g. `"N session(s) waiting"`, Australian English) when count > 0, or `undefined` to clear.
- [x] 1.3 Call `updateBadge` once after the view is created and subscribe it to `provider.onDidChangeTreeData` (push the disposable into `context.subscriptions`) so it recomputes on every refresh.

## 2. Task B — kill removes orphan status file

- [x] 2.1 In `killOne()` (`src/extension.ts`), after the socket-removal shell command resolves, compute `hashOf(path.basename(session.socket))`; when present, `fs.rmSync(path.join(statusDir(config().socketDir), `${hash}.json`), { force: true })`. (`statusDir` is already imported.)
- [x] 2.2 Confirm via inspection that `killSelected`, `killAll`, and `restart` all flow through `killOne()` so the cleanup is inherited (no extra changes needed).

## 3. Build, version, changelog

- [x] 3.1 `npm run compile` — no TypeScript errors.
- [x] 3.2 Bump `package.json` version to `0.3.1` (rebased over the released 0.3.0) and add a CHANGELOG entry for both items.

## 4. Verification

- [x] 4.1 Task B (shell): create a session, write a fake `status/<hash>.json`, kill it via the panel → its status file is gone and a second session's status file is untouched. (Verified via a faithful mechanics harness exercising `killOne()`'s `hashOf` + targeted `rmSync` over a two-session temp dir: victim status removed, bystander untouched, idempotent on missing file, hashless socket removes nothing.)
- [x] 4.2 Task A (in-editor eyeball, GUI-only): with a Claude waiting, the activity-bar icon shows the count; resolving it clears it; multiple waiting sessions sum; toggling `showClaudeStatus` off removes the badge. (Verified in-editor from the 0.3.1 vsix — LGTM.)
