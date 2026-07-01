## Why

The live-status feature tells you what a session's Claude is doing, but two
things make it lie or go quiet at the wrong moments:

- The forwarder maps **every** `Notification` hook to `waiting` (the amber
  bell). But Claude Code fires `Notification` on two very different subtypes:
  `permission_prompt` (Claude is genuinely blocked, needs a tool decision) and
  `idle_prompt` (auto-fires ~60s after `Stop` when you simply haven't replied
  yet). The result is that almost every finished-but-unanswered session starts
  ringing the bell within a minute, so the bell stops meaning "needs you".
- The resting state is invisible. `Stop` maps to `idle`, which the provider
  renders identically to "no status at all" — so a session Claude has finished
  and handed back to you looks the same as one that never ran Claude. There is
  no calm "done, your move" signal.
- Attach-state has no always-on channel. It only shows in the row **icon** when
  the session is at rest (green vs plain terminal); the moment a run-state
  (spinner/bell) takes the icon, you can only tell attached from detached by
  reading the muted description text. A detached session that needs you looks
  the same as an attached one.

## What Changes

- **Classify `Notification` subtypes in the forwarder.** `permission_prompt`
  keeps mapping to `waiting` (the amber bell); `idle_prompt` no longer rings —
  it leaves the session in its finished state. The amber bell becomes
  permission-blocks-only: rare, and therefore trustworthy. The activity-bar
  waiting badge then counts only sessions that are genuinely blocked.
- **Add a `done` run-state** (written on `Stop`) shown with a calm green check
  glyph and a "done" badge — "Claude finished, your move" — so the resting
  state has a real presence instead of rendering as nothing. `SessionStart`
  stays `idle`/quiet (a fresh session that was never prompted shows the plain
  terminal, no glyph).
- **Dim detached session rows.** A detached row's label is dimmed while its
  run-state icon stays at full strength, so attach-state reads as row brightness
  independently of the icon — a dim row with a bright amber bell reads as
  "dormant session that needs you". Attached rows are unchanged.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `claude-status-hooks`: the event→state mapping changes — `Notification` is
  split by subtype (`permission_prompt` → waiting, `idle_prompt` → not the
  bell), and `Stop` maps to a new `done` state (`SessionStart` remains `idle`).
- `session-status`: the state vocabulary gains `done` (shown as a check glyph
  and badge); `waiting` is narrowed to genuine blocks; and detached rows are
  dimmed so attach-state stays legible even when a run-state owns the icon.

## Impact

- `scripts/claude-status-hook.py`: read the `Notification` subtype and adjust
  the event→state mapping; add the `done` state on `Stop`.
- `src/provider.ts`: extend the state vocabulary and `effectiveState`/icon logic
  for `done` (check glyph); add a `FileDecorationProvider` that dims detached
  rows, keyed by a per-row synthetic resource URI, reusing the existing
  attach-detection path.
- `src/extension.ts`: register the decoration provider and refresh it alongside
  the tree.
- `media/`: a check glyph asset if a baked SVG is chosen over a themed codicon
  (design decision).
- Builds on the in-flight `status-attention-badge` change: this narrows what its
  waiting badge counts. No config or command surface changes.
- Two things need empirical confirmation before the mapping can be trusted (see
  design): exactly how the forwarder learns the `Notification` subtype, and
  whether `idle_prompt` fires at all for a Claude CLI running inside a VS Code
  integrated terminal.
