## Why

The live Claude run-state currently shows only as text in the row description.
The text is precise but easy to miss when scanning a list — especially the one
state that demands action, **waiting**. A coloured row icon (as
terminal-sessions does) makes state legible at a glance: you spot the session
that needs you without reading each row.

## What Changes

- The row **icon reflects the effective run-state**: an **animated spinner** for
  **working**/**tool** (motion = busy, as terminal-sessions does), and an
  **attention-coloured icon for waiting**. The existing **text badge stays** as
  the exact label (e.g. `tool: Bash`).
- When a session is **idle or has no status**, the icon falls back to the
  current behaviour: the green terminal icon if attached in this window, the
  plain terminal icon otherwise. Attach-state stays visible at rest, when run
  -state has nothing to say.
- The icon is driven by the **same effective (post-decay) state** as the text,
  so a stale `working` that decays to age also stops the spinner — they never
  disagree.
- **The row's relative time becomes activity-relative when a status exists.**
  Today the trailing `2h ago` is the socket's mtime, which tracks attach/detach
  touches, **not** what Claude is doing. When a session has a status (a recorded
  event timestamp), the time SHALL instead be measured from that last
  agent-activity event — so `working` shows how long it's been busy and a quiet
  session shows time since Claude last did anything. Sessions with no status
  keep the mtime age as before.
- **working/tool** uses an animated codicon (`loading~spin`); its colour is
  irrelevant (motion is the cue), so VS Code washing codicon colour to the
  selection foreground on select is a non-issue here. **waiting** is where
  colour *is* the signal, so it is a **baked SVG** (following the existing
  `media/terminal-green.svg` precedent) to keep its colour through selection.

Out of scope: new run-states, per-tool icon variants, animation/spinners, and
any change to how status is produced (the hook forwarder is untouched).

## Capabilities

### New Capabilities
<!-- None. -->

### Modified Capabilities
- `session-status`: the run-state is additionally reflected in the row **icon**
  (colour by effective state), not just the description text; idle/no-status
  falls back to the existing attached/detached terminal icon.

## Impact

- `src/provider.ts` — derive a single effective state (applying the existing
  staleness decay) and use it to drive both the description badge and
  `SessionItem.iconPath`. Likely factor the decay out of `statusLabel` into a
  shared `effectiveState` so text and icon agree. Pass the status `ts` through
  so the row's relative time can be computed from it (falling back to
  `mtimeMs` when there is no status).
- `media/` — one new baked SVG for **waiting** (amber/attention), matching
  `terminal-green.svg`'s conventions. **working/tool** uses the built-in
  `loading~spin` codicon — no asset.
- `README.md` / `CLAUDE.md` — document the icon colour mapping and the baked-SVG
  rationale.
- No change to `scripts/claude-status-hook.py`, the status files, or
  `package.json` settings. No new npm dependencies.
