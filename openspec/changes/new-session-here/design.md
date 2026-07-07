## Context

The Explorer feature "multiple sessions per folder" lets you attach-or-create
family siblings rooted at a folder, via a QuickPick. The session pane has no
counterpart: its `+` roots at `$HOME`, and Restart is the only place that
recovers a session's live working directory (`sessionCwd`, walking `/proc` to
the master's shell child and reading its cwd via `lsof`). All the machinery
needed for a pane-side "create a sibling here" already exists; this change wires
it into a per-row command.

## Goals / Non-Goals

**Goals:**
- One-action, from-the-pane creation of a new session rooted in an existing
  session's directory, without visiting the Explorer.
- Reuse existing helpers (`sessionCwd`, `uniqueName`/`createDeduped`,
  `createSession`) rather than adding new mechanism.
- Behave consistently with Restart on cwd-resolution failure.

**Non-Goals:**
- Duplicating running state. A dtach master tees one pty with no retained
  buffer; there is no fork/snapshot. "New Session Here" is a fresh shell in the
  same directory — not a copy of the program or scrollback. (This is why the
  command is named for the *location*, not "Clone"/"Duplicate".)
- Re-offering attach-to-family. The pane already shows the whole family, so a
  picker would be redundant — the command is a pure create.
- An inline row icon. The inline group (attach/detach · restart · kill) is full.

## Decisions

- **Family base derivation.** Strip a trailing `-N` from the source name using
  the same numeric-suffix notion as `sessionFamily`, so cloning `api-2` yields
  `api-3`, not `api-2-2`. Pass the base to `createDeduped`, which picks the next
  free suffix against current sessions.
- **Reuse `sessionCwd` verbatim.** It is already the tested cwd probe; no need
  for a variant. It returns `undefined` on failure, which `createSession` treats
  as "root at `$HOME`" — giving the silent fallback for free.
- **Command shape.** `newSessionHere(provider, session)`:
  `cwd = await sessionCwd(session)` → `base = familyBase(session.name)` →
  `createDeduped(provider, base, cwd)`. `createDeduped` already notifies when the
  name was bumped, so no extra UX.
- **Menu placement.** `view/item/context`, in the `1_modify` group near Rename.
  Title: "New Session Here". Gate on `viewItem =~ /^dtachSession-/` so it shows
  on both attached and detached rows.

## Risks / Trade-offs

- **Basename ambiguity.** A session legitimately named `2024-01` has its `-01`
  stripped to base `2024`. This is the same ambiguity `sessionFamily` already
  lives with; accepting it keeps the two features consistent rather than
  inventing a second family rule.
- **cwd staleness.** `sessionCwd` reads the shell's cwd at probe time; if the
  user has `cd`'d elsewhere, the new session follows the current cwd, not where
  the session started. This is the intuitive behaviour ("here" = where it is
  now) and matches Restart.
- **`familyBase` is new surface.** A tiny pure helper (regex strip). Kept in
  `extension.ts` next to `sessionFamily`/`uniqueName` since it is create-flow
  logic, not a shared tree utility.
