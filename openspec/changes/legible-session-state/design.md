## Context

The live-status feature reads Claude Code lifecycle hooks (via the bundled
forwarder) into per-hash `status/<hash>.json` files, which the provider joins to
sessions and renders as a row badge + icon, with staleness decay of transient
states. Three seams surfaced in use:

1. **`Notification` is overloaded.** Claude Code fires it on at least two
   subtypes — `permission_prompt` (Claude is blocked, needs a tool decision) and
   `idle_prompt` (auto-fires ~60s after `Stop` when the user hasn't replied;
   hardcoded, one-shot per wait period). The forwarder maps all of them to
   `waiting`, so nearly every finished-but-unanswered session rings the amber
   bell within a minute — the signal is diluted to noise.
2. **The resting state is invisible.** `Stop` → `idle` → `effectiveState`
   returns `undefined`, rendering identically to "no Claude here at all". There
   is no calm "finished, your move" cue.
3. **Attach-state has no always-on channel.** It only shows in the row icon
   *at rest* (green vs plain terminal); a run-state icon (spinner/bell/check)
   pre-empts it, leaving only the muted description text to distinguish attached
   from detached.

Constraints carried from the existing design: icon colour is washed to the
selection foreground on row selection (why `waiting`/attached use baked SVGs);
the badge, icon, and time all derive from one `effectiveState` pass; a window
reload strips a restored terminal's `shellArgs`, so attach detection goes
through the pid-keyed registry (`findTerminalForSocket`), not arg matching.

## Goals / Non-Goals

**Goals:**
- Make the amber bell mean "genuinely blocked" and nothing else.
- Give the finished/your-move state a real, calm presence.
- Make attach-state legible on every row regardless of run-state.

**Non-Goals:**
- No focus/interaction "acknowledgement", no liveness probing, no time-decay of
  the bell. Classifying `Notification` at the source removes the need for them;
  if a bell still lingers on a crashed permission-block, that is rare and left
  to a future change.
- No new config or command surface.
- No change to the `/proc` correlation, the atomic write, or install/uninstall.

## Decisions

### D1: Split `Notification` by subtype in the forwarder

`permission_prompt` → `waiting`; `idle_prompt` → leave the recorded state
unchanged (it fires after `Stop`, so the state is already `done`). The forwarder
becomes the single place that decides urgency, so the provider needs no new
suppression logic and the activity-bar waiting badge automatically counts only
true blocks.

*Alternative considered:* keep mapping everything to `waiting` and have the
provider decay/suppress it (focus-ack, liveness, time). Rejected — it treats the
symptom, adds cross-cutting state, and can still hide a live block. Classifying
at the source is strictly simpler.

**How the subtype is obtained is an open question (see below).** Two candidate
mechanisms: (a) read a subtype/type field from the hook's stdin JSON payload; or
(b) register the forwarder under per-matcher `Notification` entries in
`~/.claude/settings.json` (e.g. matcher `permission_prompt` vs `idle_prompt`),
passing the subtype as an argument. (b) touches the idempotent install/merge and
the surgical uninstall; (a) keeps a single registration. Prefer (a) if the
payload reliably carries the subtype.

### D2: Add a `done` state, rendered as a check glyph

`Stop` → `done` (was `idle`). `SessionStart` stays `idle` (a fresh, never-
prompted session should be quiet, not "done"). `effectiveState`: `idle` →
`undefined` (quiet, as today); `done` → shown; `working`/`tool` still decay to
`undefined` after `STALE_MS`; `waiting` and `done` do not decay (both are
legitimate resting states — `done` persists until the next prompt).

**Glyph: themed `$(check)` codicon (charts.green), not a baked SVG.** Unlike the
amber bell — where colour *is* the signal and must survive selection, forcing a
baked asset — a check's meaning is carried by its *shape*, so the codicon-colour
wash on selection is acceptable. This keeps `media/` lean.

*Alternative considered:* baked green check SVG for consistency with
`terminal-green.svg`/`state-waiting.svg`. Rejected as unnecessary — the shape
argument makes colour non-load-bearing here. Revisit only if the washed check
reads poorly on selection.

### D3: Dim detached rows via a `FileDecorationProvider`

VS Code has no per-row dim on `TreeItem`; a `FileDecorationProvider` returning a
`color` (e.g. `disabledForeground`) is the mechanism. It tints the **label**
only and leaves `iconPath` untouched — which is exactly the desired effect: a
dim label under a full-strength run-state icon.

- **Key by a synthetic resource URI.** Decorations key off `TreeItem.resourceUri`.
  Setting it to the real socket path would hijack label/icon derivation (VS Code
  would apply the file-icon theme and filename). Use a fake-scheme URI per row,
  e.g. `dtach-session://<hash>` (or the socket basename when hashless), purely as
  a decoration key.
- **Attach detection reuses `findTerminalForSocket`** (the live, pid-registry-
  backed path), so dimming survives a window reload the same way the icon does.
- **Refresh:** fire the provider's `onDidChangeFileDecorations` for the affected
  URIs whenever the tree refreshes (attach/detach/status change), so dimming
  tracks attach-state without manual refresh.

*Alternatives considered:* (i) grey the bell icon on detached rows — rejected in
exploration: it mutes the most urgent signal (detached + waiting is when you're
*least* present). (ii) status-bar attached/detached counts (as some sibling
extensions do) — orthogonal and out of scope; row-level legibility is the ask.

## Risks / Trade-offs

- **`idle_prompt` may not fire for our sessions.** Issue #59718 reports the
  idle notification not firing under Claude Code's *own* VS Code extension. Our
  Claude runs as a CLI inside dtach, but the attach terminal is a VS Code
  integrated terminal (`TERM_PROGRAM=vscode`), which may push Claude onto the
  extension code path and suppress `idle_prompt`. → **Mitigation:** confirm
  empirically (watch `status/<hash>.json` on a real session) before trusting the
  mapping. If `idle_prompt` never fires here, D1 still holds and is simpler —
  the noisy bell was *from* `idle_prompt`, so its absence just means the bell was
  already permission-only on our hosts; the `done`-on-`Stop` change (D2) then
  carries the resting state on its own.
- **Subtype detection mechanism unverified (D1).** If the stdin payload does not
  carry the subtype, we fall back to per-matcher registration, which enlarges
  the install/uninstall surface. → **Mitigation:** the investigation task gates
  the implementation approach; specs are written in terms of the *outcome*
  (which state results), not the mechanism.
- **Dimmed label may be too subtle.** `FileDecoration` dims the label but not the
  icon, so "dimmed row" is really "dimmed name". → **Mitigation:** eyeball on a
  real panel; if weak, consider also switching the at-rest detached icon or a
  decoration badge. Not committing to that up front.
- **Existing status files predate `done`.** A running session written by the old
  forwarder will hold `idle` where the new one writes `done`. Harmless — `idle`
  renders quiet; the next `Stop` writes `done`. No migration needed.

## Open Questions

- ~~How does the forwarder learn the `Notification` subtype?~~ **Resolved.** The
  `Notification` hook's stdin JSON carries a dedicated **`notification_type`**
  field (values include `permission_prompt`, `idle_prompt`, `auth_success`,
  `elicitation_*`). Mechanism (a) from D1 applies: the forwarder reads the field
  from stdin — **single registration, no per-matcher entries, no change to the
  idempotent install / surgical uninstall** (settles task 1.3). Only
  `permission_prompt` raises `waiting`; `idle_prompt` and all other subtypes
  leave the recorded state unchanged.
- Does `idle_prompt` fire at all for a Claude CLI inside a VS Code integrated
  terminal? **Still empirical — to confirm on real hardware** (task 1.2). Not a
  blocker: the mapping is correct either way — if `idle_prompt` never fires here,
  the bell was already permission-only and `done`-on-`Stop` carries the resting
  state on its own; if it does fire, it is now correctly suppressed.
- Does the washed `$(check)` read acceptably on a selected row, or is a baked
  SVG warranted after all? (Eyeball during verification — handed to the user.)
