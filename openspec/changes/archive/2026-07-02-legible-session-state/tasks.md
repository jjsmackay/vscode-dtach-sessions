## 1. Investigation (gates the forwarder mapping)

- [x] 1.1 Determine how the forwarder can learn the `Notification` subtype: inspect the hook's stdin JSON payload for a subtype/type field (preferred, single registration), or confirm whether per-matcher `Notification` registration in `~/.claude/settings.json` (`permission_prompt` vs `idle_prompt`) is required. Record the finding in `design.md` Open Questions. — **Resolved:** stdin carries `notification_type`; mechanism (a), single registration.
- [ ] 1.2 Empirically confirm whether `idle_prompt` fires for a Claude CLI running inside a dtach session in a VS Code integrated terminal (`TERM_PROGRAM=vscode`): run a real session, leave it idle >60s after a Stop, and observe what lands in `status/<hash>.json`. Note the result (fires / does not fire) in `design.md`. — **HANDED TO USER: needs a live session; mapping is correct either way (see design risk).**
- [x] 1.3 Confirm the chosen subtype mechanism does not require touching the idempotent install/surgical-uninstall requirements; if per-matcher registration is needed, note the install/uninstall impact. — **Confirmed:** single registration, no install/uninstall change.

## 2. Forwarder — Notification classification + done state

- [x] 2.1 In `scripts/claude-status-hook.py`, map `Stop` to a new `done` state (was `idle`); keep `SessionStart` → `idle`.
- [x] 2.2 Split `Notification` by subtype using the mechanism from 1.1: `permission_prompt` → `waiting`; `idle_prompt` → do not set `waiting`, leave the recorded state unchanged (no write, or re-affirm the existing state without escalating).
- [x] 2.3 Verify (shell): drive events through the forwarder and confirm the status file records `done` on Stop, `waiting` only on a permission notification, and is left unchanged on an idle-prompt notification. — **Pure `resolve()` extracted; 11-case unit test all-pass.**

## 3. Provider — done state, check glyph, effective-state

- [x] 3.1 Add `done` to the `SessionState` type in `src/provider.ts`.
- [x] 3.2 Update `effectiveState`: `idle` → `undefined` (unchanged); `done` → returned (shown); `working`/`tool` still decay after `STALE_MS`; `waiting` and `done` do not decay. — Existing logic already yields this once `done` is in the type; comments updated to make it explicit.
- [x] 3.3 Update `labelForState` to return a `done` badge for the `done` state.
- [x] 3.4 Update the `SessionItem` icon switch: `done` → `$(check)` themed codicon (charts.green). Leave `waiting` (baked SVG) and `working`/`tool` (spinner) as-is; `idle`/no-status still falls back to the attached/detached terminal icon.
- [x] 3.5 `npm run compile` — no TypeScript errors.

## 4. Provider/extension — dim detached rows

- [x] 4.1 Give each `SessionItem` a synthetic `resourceUri` keyed on the session (`dtach-session://<hash>`, or the socket basename when hashless), used only as a decoration key — confirmed it does not alter the row's label or icon derivation.
- [x] 4.2 Add a `FileDecorationProvider` (`DetachedRowDecorations` in `src/provider.ts`) that returns a dim `color` (`disabledForeground`) for rows whose session is not attached (`findTerminalForSocket` returns undefined), and no decoration for attached rows.
- [x] 4.3 Register the provider in `activate()` (`src/extension.ts`) via `window.registerFileDecorationProvider`, push the disposable to `context.subscriptions`.
- [x] 4.4 Fire the provider's `onDidChangeFileDecorations` for affected URIs on tree refresh (attach/detach/status change), so dimming tracks attach-state without manual refresh. — Fired from `sync()` in `getChildren`.
- [x] 4.5 `npm run compile` — no TypeScript errors.

## 5. Build, version, changelog

- [x] 5.1 Bump `package.json` version (patch over the current release: 0.3.1 → 0.3.2) and add a CHANGELOG entry covering the three parts.
- [x] 5.2 Update `CLAUDE.md` Gotchas: the new `done` state + check glyph, the `Notification` subtype split, and the `FileDecorationProvider` row-dim (label-only, synthetic resourceUri key).

## 6. Verification

- [x] 6.1 Task 2 (shell): status file transitions match the spec — `done` on Stop, `waiting` only on permission, unchanged on idle-prompt. — 11-case `resolve()` unit test all-pass.
- [ ] 6.2 Task 3 (in-editor eyeball): a finished session shows a green check + "done" badge and persists (does not decay); a permission-blocked session shows the amber bell; the activity-bar waiting badge now counts only blocked sessions. — **HANDED TO USER: needs a running VS Code + real sessions.**
- [ ] 6.3 Task 4 (in-editor eyeball): detached rows are dimmed while attached rows are not; a detached waiting row keeps its full-strength amber bell on a dimmed label; dimming updates on attach/detach and survives a window reload. Judge whether the label-only dim reads strongly enough (per the design risk). — **HANDED TO USER: needs a running VS Code + real sessions.**
