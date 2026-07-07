## 1. Config and manifest

- [ ] 1.1 Add `dtachSessions.sortBy` to `package.json` contributes.configuration as a string enum (`created`, `lastAttached`, `name`, `status`), default `created`, with per-value `enumDescriptions`.
- [ ] 1.2 Add a `dtachSessions.setSortOrder` command and a `view/title` menu entry (with an icon) for the session view.
- [ ] 1.3 Extend `config()` in `src/provider.ts` to read `sortBy`, coercing any unrecognised value to `created`.

## 2. Sort implementation

- [ ] 2.1 Add `ctimeMs: number` to the `DtachSession` interface and populate it from the existing `fs.Stats` in `listSessions()`.
- [ ] 2.2 Replace the fixed `sort` in `listSessions()` with a comparator selected by `sortBy`: `created` → `mtimeMs` desc (unchanged); `lastAttached` → `ctimeMs` desc; `name` → `localeCompare` asc; `status` → attention priority (`waiting`→`working`/`tool`→`done`→none) then shown age desc.
- [ ] 2.3 For `status` ordering, reuse the `effectiveState` join already used by the row icon and `countWaiting()` (join statuses once, sort on the effective state) so order and row rendering cannot disagree.

## 3. Picker command

- [ ] 3.1 Implement the `setSortOrder` handler in `src/extension.ts`: QuickPick of the four orders (label + description), the active one marked, writing the choice to `dtachSessions.sortBy` (global) and refreshing the tree.
- [ ] 3.2 Confirm the existing config-change / refresh path re-renders on the write (add a refresh if not already covered).

## 4. Label and comment corrections

- [ ] 4.1 Change the tooltip in `SessionItem` from "last modified" to "created" for the `mtime`-derived value.
- [ ] 4.2 Correct the stale comment at `src/provider.ts:353` (and any nearby wording) that claims socket `mtime` moves on attach/detach — it is pinned at creation.

## 5. Verify

- [ ] 5.1 `npm run compile` clean.
- [ ] 5.2 Manually verify each order against live sockets: `created` stable across attach/detach; `lastAttached` bubbles a just-attached session up; `name` alphabetic; `status` puts a `waiting` session on top. Confirm the picker marks the active order and persists the choice.
