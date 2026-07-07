## Why

The session list has a single fixed order — socket `mtime`, most-recent-first — with no way to change it. As the panel is used to herd many parallel sessions, other orderings matter: find a session by name, or triage which sessions need attention. The current spec also mislabels the sort key: it calls `mtime` a "weak activity hint", but `mtime` on a dtach socket is pinned at creation (nothing ever writes to a socket file), so today's default is really a stable *created* order, and the tooltip's "last modified" wording is wrong.

## What Changes

- Add a `dtachSessions.sortBy` setting selecting the session order, defaulting to `created` — the current behaviour, unchanged.
- Add three orderings alongside the default:
  - **Created** (`mtime`, descending) — stable, the existing default.
  - **Last attached** (`ctime`, descending) — most-recently-used-ish; `ctime` moves on attach (and, more loosely, on reap/rename), unlike the frozen `mtime`.
  - **Name** — locale-aware alphabetic.
  - **Status** — attention queue: `waiting` → `working`/`tool` → `done` → idle/none, then by shown age within each group.
- Add a view-title command that opens a QuickPick to switch order, showing a check on the active choice and persisting the selection to `dtachSessions.sortBy`.
- Relabel the tooltip timestamp from "last modified" to "created" (the value is the creation time).
- Correct the stale in-code comment and spec wording that claim socket `mtime` moves on attach/detach.

No breaking changes: the default order and every existing row treatment are preserved.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `session-list`: the fixed "Sort by recency" requirement becomes a selectable order with a configurable default; the created-time semantics of `mtime` are corrected.

## Impact

- `src/provider.ts`: `listSessions()` sort (add sort-key selection), `config()` (new `sortBy`), the tooltip label, and the `SessionItem` age comment; capture `ctimeMs` on `DtachSession` for the last-attached order; status-priority ordering reuses the existing `effectiveState` join.
- `src/extension.ts`: register the view-title sort-picker command.
- `package.json`: `dtachSessions.sortBy` configuration enum and the view-title menu/command contributions.
- No new dependencies; no change to socket/hook/terminal behaviour.
