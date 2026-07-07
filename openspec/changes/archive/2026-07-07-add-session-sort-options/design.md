## Context

`listSessions()` in `src/provider.ts` ends with a fixed `sessions.sort((a, b) => b.mtimeMs - a.mtimeMs)`. Empirically (verified against live sockets on the host) a dtach socket's `mtime` is pinned at creation and never moves on attach/detach — the current in-code comment (`provider.ts:353`) and the old spec wording that call `mtime` an activity/modification signal are wrong. What actually moves on attach is `ctime` (and, more loosely, on reap/rename); `atime` also moves but is defeated by `relatime`/`noatime` mounts, so it is unusable across arbitrary remote hosts.

The row already displays an activity-relative age (`status.ts ?? mtime`) and joins each session to its effective run-state via `effectiveState`. The tooltip labels the `mtime` value "last modified", which is misleading given the above.

## Goals / Non-Goals

**Goals:**
- Add a `dtachSessions.sortBy` setting with orders `created` (default), `lastAttached`, `name`, `status`.
- Preserve today's behaviour exactly when the setting is unset.
- Expose a view-title QuickPick to switch order, persisted to the setting.
- Correct the tooltip label and the stale in-code/spec claims about `mtime`.

**Non-Goals:**
- Extension-tracked attach timestamps (a `workspaceState` `hash→lastAttachMs` map). Rejected for the first cut — see Decisions.
- Per-order ascending/descending toggles, grouping headers, or secondary-sort configuration.
- Any change to socket, hook, terminal, or reap behaviour.

## Decisions

### Last-attached is sourced from `ctime`, not extension-tracked state
`ctime` moves on attach and is mount-independent (unlike `atime`). It is captured for free — `listSessions()` already holds the `fs.Stats` object, so we add `ctimeMs` to `DtachSession` and sort on it.

- **Alternative — persist `hash→lastAttachMs` in `workspaceState`, stamped in the attach path.** Gives an exact "last attached via panel" but adds persisted state and a lifecycle (clear on kill), and *misses* external CLI `dtach -a` attaches — which `ctime` catches. So the "cleaner" option is both more code and less complete for real attaches. Deferred; `ctime` is the pragmatic first cut.
- **Trade-off:** `ctime` also advances on reap-stale-client and rename, so those nudge a row up under `lastAttached`. Reap fires *during* the attach path anyway, and rename is deliberate — so in practice `ctime` tracks attach closely. Documented, accepted.

### Sort key selection is a pure switch in `listSessions()`
A single `switch (sortBy)` picks the comparator; `created` remains `b.mtimeMs - a.mtimeMs` so the default is byte-for-byte the current behaviour. `status` reuses the existing `effectiveState` join (the same one feeding the row icon and the activity-bar count) so ordering can never disagree with what a row shows. This keeps all ordering logic in the one place it already lives.

### Status priority ordering
Fixed priority `waiting(0) → working/tool(1) → done(2) → none(3)`, then shown age (most recent first) within a group. This makes the panel a triage queue and mirrors the existing amber-bell / activity-bar-count attention model. A stable, non-configurable priority avoids a combinatorial settings surface.

### Exposure: config enum + view-title QuickPick
`dtachSessions.sortBy` is the source of truth; the QuickPick reads it, marks the active entry, writes the selection back (`workspace.getConfiguration().update`, global target), and the existing config-change/refresh path re-renders. VS Code has no built-in tree-sort UI, so a title command is the discoverable surface; backing it with the setting keeps it inspectable and scriptable.

## Risks / Trade-offs

- **`lastAttached` reorders on reap/rename, not only attach** → Documented in the spec and tooltip semantics; acceptable because reap coincides with attach and rename is deliberate. Upgrade path (extension-tracked timestamps) is noted as a Non-Goal, not precluded.
- **`status` order requires the status feature on** → Degrades gracefully: with status off, every session lands in the no-state group and ordering falls back to shown age (documented scenario).
- **Config value drift** (an unknown `sortBy` string) → Selection defaults to `created` on any unrecognised value; the enum in `package.json` constrains the UI path.
