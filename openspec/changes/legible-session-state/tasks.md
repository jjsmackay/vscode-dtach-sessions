## 1. Investigation (gates the forwarder mapping)

- [ ] 1.1 Determine how the forwarder can learn the `Notification` subtype: inspect the hook's stdin JSON payload for a subtype/type field (preferred, single registration), or confirm whether per-matcher `Notification` registration in `~/.claude/settings.json` (`permission_prompt` vs `idle_prompt`) is required. Record the finding in `design.md` Open Questions.
- [ ] 1.2 Empirically confirm whether `idle_prompt` fires for a Claude CLI running inside a dtach session in a VS Code integrated terminal (`TERM_PROGRAM=vscode`): run a real session, leave it idle >60s after a Stop, and observe what lands in `status/<hash>.json`. Note the result (fires / does not fire) in `design.md`.
- [ ] 1.3 Confirm the chosen subtype mechanism does not require touching the idempotent install/surgical-uninstall requirements; if per-matcher registration is needed, note the install/uninstall impact.

## 2. Forwarder — Notification classification + done state

- [ ] 2.1 In `scripts/claude-status-hook.py`, map `Stop` to a new `done` state (was `idle`); keep `SessionStart` → `idle`.
- [ ] 2.2 Split `Notification` by subtype using the mechanism from 1.1: `permission_prompt` → `waiting`; `idle_prompt` → do not set `waiting`, leave the recorded state unchanged (no write, or re-affirm the existing state without escalating).
- [ ] 2.3 Verify (shell): drive events through the forwarder and confirm the status file records `done` on Stop, `waiting` only on a permission notification, and is left unchanged on an idle-prompt notification.

## 3. Provider — done state, check glyph, effective-state

- [ ] 3.1 Add `done` to the `SessionState` type in `src/provider.ts`.
- [ ] 3.2 Update `effectiveState`: `idle` → `undefined` (unchanged); `done` → returned (shown); `working`/`tool` still decay after `STALE_MS`; `waiting` and `done` do not decay.
- [ ] 3.3 Update `labelForState` to return a `done` badge for the `done` state.
- [ ] 3.4 Update the `SessionItem` icon switch: `done` → `$(check)` themed codicon (charts.green). Leave `waiting` (baked SVG) and `working`/`tool` (spinner) as-is; `idle`/no-status still falls back to the attached/detached terminal icon.
- [ ] 3.5 `npm run compile` — no TypeScript errors.

## 4. Provider/extension — dim detached rows

- [ ] 4.1 Give each `SessionItem` a synthetic `resourceUri` keyed on the session (e.g. `dtach-session://<hash>`, or the socket basename when hashless), used only as a decoration key — confirm it does not alter the row's label or icon derivation.
- [ ] 4.2 Add a `FileDecorationProvider` (in `src/provider.ts` or a small sibling) that returns a dim `color` (e.g. `disabledForeground`) for rows whose session is not attached (`findTerminalForSocket` returns undefined), and no decoration for attached rows.
- [ ] 4.3 Register the provider in `activate()` (`src/extension.ts`) via `window.registerFileDecorationProvider`, push the disposable to `context.subscriptions`.
- [ ] 4.4 Fire the provider's `onDidChangeFileDecorations` for affected URIs on tree refresh (attach/detach/status change), so dimming tracks attach-state without manual refresh.
- [ ] 4.5 `npm run compile` — no TypeScript errors.

## 5. Build, version, changelog

- [ ] 5.1 Bump `package.json` version (patch over the current release) and add a CHANGELOG entry covering the three parts.
- [ ] 5.2 Update `CLAUDE.md` Gotchas: the new `done` state + check glyph, the `Notification` subtype split, and the `FileDecorationProvider` row-dim (label-only, synthetic resourceUri key).

## 6. Verification

- [ ] 6.1 Task 2 (shell): status file transitions match the spec — `done` on Stop, `waiting` only on permission, unchanged on idle-prompt.
- [ ] 6.2 Task 3 (in-editor eyeball): a finished session shows a green check + "done" badge and persists (does not decay); a permission-blocked session shows the amber bell; the activity-bar waiting badge now counts only blocked sessions.
- [ ] 6.3 Task 4 (in-editor eyeball): detached rows are dimmed while attached rows are not; a detached waiting row keeps its full-strength amber bell on a dimmed label; dimming updates on attach/detach and survives a window reload. Judge whether the label-only dim reads strongly enough (per the design risk).
