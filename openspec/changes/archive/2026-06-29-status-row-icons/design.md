## Context

The status feature already reads per-hash status files and renders a text badge
in the row description, with staleness decay in `statusLabel`. The row icon
today encodes only attach-state: a baked green SVG (`media/terminal-green.svg`)
when attached, a plain `ThemeIcon('terminal')` otherwise. This change adds a
run-state-coloured icon on top, keeping the text.

The governing constraint is a known VS Code gotcha: it recolours codicons to the
selection foreground when a row is selected, washing out any `ThemeColor`. The
attached icon is a baked SVG for exactly this reason. So state colours must also
be baked SVGs.

## Goals / Non-Goals

**Goals:**
- Run-state legible at a glance via icon colour; `waiting` stands out.
- Icon and text always agree (one effective state drives both).
- Stay minimal: reuse the baked-SVG pattern, no new deps, no forwarder changes.

**Non-Goals:**
- New states, per-tool icons, spinners/animation.
- Changing how status is produced or stored.
- Encoding attach-state into the active-state icons (attach stays in the text
  and in the idle fallback icon).

## Decisions

### One effective-state source drives icon and text

Factor the decay currently inside `statusLabel` into a shared
`effectiveState(status): SessionState | undefined` (returns undefined for
idle / no-status / decayed-transient). `statusLabel` and the new icon selection
both consume it. This guarantees they never disagree and removes duplicated
decay logic.

- **Why:** the failure mode to avoid is a "working" icon next to an age-only
  description (or vice-versa) after decay. A single source makes that
  impossible by construction.

### Icon mapping — motion for "busy", colour for "needs you"

| Effective state | Icon |
|---|---|
| working, tool | **animated spinner** — `ThemeIcon('loading~spin')` (codicon, no asset) |
| waiting | **baked amber SVG** (one asset) |
| idle / none | existing: `terminal-green.svg` if attached, else `ThemeIcon('terminal')` |

- **Spinner for working/tool (not a coloured SVG).** This is the key call, and
  it neatly sidesteps the selection-wash gotcha. The gotcha is that VS Code
  recolours codicons to the selection foreground on row select — fatal if you
  rely on a codicon's *colour*, which is why the attach icon is a baked SVG. But
  for "busy" the cue is **motion**, not colour: a spinning codicon keeps
  spinning regardless of selection, and we don't care what colour it spins in.
  So `loading~spin` is exactly right here, and it matches terminal-sessions.
  (You cannot animate a static SVG image in a tree row — animation *requires* a
  codicon, which is the other reason this state can't be a baked SVG.)
- **Baked SVG for waiting.** Here colour *is* the signal ("needs you"), and it
  must survive selection — so it's a baked amber/attention SVG, same technique
  as `terminal-green.svg`. Exact tone chosen against the VS Code `charts.*`
  palette at implementation, validated in light and dark themes.
- **working and tool share the spinner:** both are "busy"; the text already
  distinguishes `tool: <name>`.
- **Attach-state when active:** deliberately not encoded in the active icons —
  attach stays in the description (`· attached`) and in the idle fallback icon.
  Doubling states with attached/detached variants was rejected as asset sprawl
  for marginal value (attach matters most at rest, which the idle fallback
  already covers).

### Asset naming

One new SVG, `media/state-waiting.svg` — a **bell** glyph in amber (`#D29922`,
the attention tone; a bell reads as "this session is pinging you for input",
unlike a warning triangle which would imply error). 16×16, `fill="none"`,
single coloured stroke, round caps/joins — matching `terminal-green.svg`'s
construction. Wired through `DtachTreeProvider` as a `Uri` (as the green icon
already is). working/tool needs no asset — it is the built-in `loading~spin`
codicon.

### Activity-relative time

The row's trailing relative time switches source based on whether a status
exists: `relativeAge(status.ts)` when there is one, else the current
`relativeAge(mtimeMs)`. `SessionItem` already has the status (it computes the
badge); it just needs the `ts` to compute the time, so `getChildren` passes the
status through rather than only the badge string.

- **Why:** the socket mtime is misleading once status is in play — it moves on
  attach/detach, not on agent activity, so a busy session can read "2h ago".
  Measuring from the last hook event makes the number mean what a user assumes:
  time in the current state, or time since Claude last acted. terminal-sessions
  shows the same activity-relative time ("working 12s").
- **Decay interaction (a bonus):** a crashed `working` decays to no badge, and
  its time — now from `ts` — reads "Nm ago" since the last event, correctly
  signalling it has gone quiet, rather than a stale socket mtime.
- **Idle wording unchanged:** idle still shows no badge (per the shipped
  behaviour); only the *number's source* changes, so the row stays
  `<time>` for idle, just measured from activity.

## Risks / Trade-offs

- **`loading~spin` must actually animate in a TreeItem.** → The `~spin` modifier
  is supported on tree-item codicons and is what terminal-sessions uses;
  confirmed at implementation via the verify step. If a given VS Code build
  didn't animate it, it would simply show a static loading glyph — still a
  distinct "busy" icon, just without motion (graceful).
- **The spinner won't carry a custom colour.** → Accepted by design: motion is
  the cue for "busy", so it spinning in the theme/selection foreground is fine.
- **Waiting colour legibility across themes.** → Pick a tone validated against
  VS Code's `charts.*` palette in light and dark; the baked green icon is the
  working precedent.
- **Selection wash.** → Only `waiting` relies on colour, and it is a baked SVG
  so its colour survives selection; the spinner doesn't care about its colour.
- **Icon/text divergence after decay.** → Removed by construction via the single
  `effectiveState` source.
- **Colour/motion-only signalling is an accessibility weak point.** → The text
  badge remains the precise label, so icon treatment is an enhancement, not the
  sole channel.
