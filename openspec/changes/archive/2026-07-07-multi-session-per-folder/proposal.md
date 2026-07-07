## Why

Right-clicking a folder always reuses the one session whose name matches the
folder — there is no way to open a second session rooted at the same path. Yet
multiple sessions per folder is a normal need (two agents, a shell plus a
runner). The view-title "+" already mints numbered duplicates; the Explorer
path should offer the same, plus an explicit reuse-or-new choice.

## What Changes

- The Explorer "Open in Detach Session" command SHALL always open a QuickPick
  instead of silently reusing or creating. **BREAKING** for the folder path's
  no-prompt behaviour (a single menu entry is kept; no second command added).
- The QuickPick's input box SHALL be prefilled with the folder basename
  (sanitised) and remain editable.
- The QuickPick SHALL list one "Attach" item per existing session in the name
  family (`basename` and `basename-N`), newest-first, each showing the session's
  live Claude status in its description (the tree's status label).
- The QuickPick SHALL offer a "New session" item whose label tracks the current
  input value; accepting it creates a new session rooted in the folder, deduped
  through `uniqueName()` so a taken display name bumps a digit.
- Reuse rows SHALL stay visible while the user edits the name (default QuickPick
  filtering, which would hide non-matching items, is worked around).

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `session-create`: the "Open session for a folder" requirement changes from
  name-match-then-reuse-or-create to an always-shown QuickPick that offers
  reuse of the whole name family or a numbered new session; the existing
  "Folder default is pre-deduplicated" scenario is superseded (the input is now
  prefilled with the raw basename and dedup happens on accept).

## Impact

- `src/extension.ts`: `openInFolder` (~line 329) rewritten to build and show the
  QuickPick; reuses existing `createSession`, `attach`, `uniqueName`,
  `sanitizeName`, and `listSessions`.
- `src/provider.ts`: read the status label (`statusLabel` / `effectiveState`)
  for QuickPick item descriptions.
- No new commands or menu entries; no config; no persistence. Session cwd is
  deliberately **not** stored — matching stays by name (basename), so two
  unrelated same-basename folders share a name family (documented, accepted).
- Deferred: dropping the `-N` suffix and disambiguating same-named sessions by
  their stable hash instead. Numbering is kept this pass.
