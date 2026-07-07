## 1. Command implementation

- [ ] 1.1 Add a `familyBase(name)` helper in `src/extension.ts` (next to
  `sessionFamily`/`uniqueName`) that strips a trailing `-N` numeric suffix,
  matching `sessionFamily`'s family notion.
- [ ] 1.2 Add `newSessionHere(provider, session)` composing
  `sessionCwd(session)` → `familyBase(session.name)` → `createDeduped(provider,
  base, cwd)`; rely on `createSession`'s `$HOME` fallback when cwd is undefined.
- [ ] 1.3 Register `dtachSessions.newSessionHere` in `activate()`, resolving the
  row via the existing `toSession` helper.

## 2. Contribution wiring

- [ ] 2.1 Add the `dtachSessions.newSessionHere` command (title "New Session
  Here") to `contributes.commands` in `package.json`.
- [ ] 2.2 Add a `view/item/context` menu entry gated on `viewItem =~
  /^dtachSession-/`, in the `1_modify` group near Rename.

## 3. Verify

- [ ] 3.1 `npm run compile` clean.
- [ ] 3.2 Manual acceptance: "New Session Here" on an attached row creates a
  family sibling rooted in the source's cwd; on a detached row it still resolves
  the cwd; with cwd unresolvable it roots at `$HOME` silently. Update
  `README.md` acceptance checks if warranted.
