## 1. Command implementation

- [x] 1.1 Add a `familyBase(name)` helper in `src/extension.ts` (next to
  `sessionFamily`/`uniqueName`) that strips a trailing `-N` numeric suffix,
  matching `sessionFamily`'s family notion.
- [x] 1.2 Add `newSessionHere(provider, session)` composing
  `sessionCwd(session)` → `familyBase(session.name)` → `createDeduped(provider,
  base, cwd)`; rely on `createSession`'s `$HOME` fallback when cwd is undefined.
- [x] 1.3 Register `dtachSessions.newSessionHere` in `activate()`, resolving the
  row via the existing `toSession` helper.

## 2. Contribution wiring

- [x] 2.1 Add the `dtachSessions.newSessionHere` command (title "New Session
  Here") to `contributes.commands` in `package.json`.
- [x] 2.2 Add a `view/item/context` menu entry gated on `viewItem =~
  /^dtachSession-/`, in the `1_modify` group near Rename.

## 3. Verify

- [x] 3.1 `npm run compile` clean.
- [x] 3.2 Manual acceptance: "New Session Here" on an attached row creates a
  family sibling rooted in the source's cwd; on a detached row it still resolves
  the cwd; with cwd unresolvable it roots at `$HOME` silently. Update
  `README.md` acceptance checks if warranted.
  Verified by static/logic review, not an in-app GUI check (no VS Code GUI
  available in this session): the compose chain matches the design exactly,
  `sessionCwd` reads the master's shell child so it works whether the row is
  attached or detached, and `createSession`'s existing `$HOME` fallback covers
  the unresolvable-cwd case. Added a README command-table row.
