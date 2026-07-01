## Context

Two small follow-ups to the v0.2.0 live-status feature, both building on existing
machinery: `readStatuses(socketDir)` + `effectiveState(status)` in
`provider.ts`, and `statusDir(socketDir)` (already exported). The provider
already fires `onDidChangeTreeData` on status changes, terminal open/close, and
view visibility — the badge can ride that same signal. The status feature is
Linux-only (`/proc`-based forwarder) and the badge render is GUI-only (no
headless `TreeView.badge` handle in this repo).

## Goals / Non-Goals

**Goals:**
- Surface the waiting count on the activity-bar icon, visible with the view
  collapsed, recomputed on every refresh, gated on `showClaudeStatus`.
- Make extension-driven kills clean up the per-hash status file so orphans do
  not accumulate.

**Non-Goals:**
- No change to the forwarder (`scripts/claude-status-hook.py`) or the status
  file format/location.
- No new config keys or commands.
- Not counting `working`/`tool` in the badge — only `waiting` is actionable
  attention.

## Decisions

- **`countWaiting()` lives on the provider, set as `view.badge` in `extension.ts`.**
  The provider owns status reading (`readStatuses`/`effectiveState`); a
  `countWaiting()` helper there keeps that logic in one place and returns 0 when
  `showClaudeStatus` is off. `extension.ts` owns the `TreeView` handle, so it
  subscribes to `onDidChangeTreeData` and writes `view.badge` — `{ value, tooltip }`
  when the count is positive, `undefined` to clear. Alternative — computing the
  count inline in `extension.ts` — would duplicate the status-read/decay logic
  the provider already centralises, risking badge/row disagreement; rejected.
- **Set the badge from `onDidChangeTreeData`, not from each command.** Every
  state transition that matters already triggers a refresh (status-file watch,
  terminal open/close, visibility). Hooking the one event keeps the badge correct
  without threading badge updates through every command path.
- **Kill removes `statusDir(config().socketDir)/<hash>.json` in `killOne()`.**
  `killOne()` is the single chokepoint composed by single-kill, multi-select,
  Kill All, and Restart, so cleanup added there covers them all. Keyed on
  `hashOf(basename(socket))`: no hash (legacy socket) ⇒ skip. Use
  `fs.rmSync(..., { force: true })` so an absent file (the common case) is not an
  error.

## Risks / Trade-offs

- [Badge unverifiable headlessly] → Acceptance for Task A is an explicit
  in-editor eyeball (documented in tasks); Task B is shell-verifiable.
- [`view.badge` is a no-op on VS Code builds without view-badge support] →
  Degrades silently to no badge; the row-level state remains the primary signal.
- [Removing the status file races a still-running Claude that writes again
  post-kill] → The session is being killed, so its forwarder has no `.dtach`
  ancestor to correlate to; any late write is itself an orphan the next kill or
  manual cleanup handles. Acceptable for cruft cleanup, not correctness-critical.
