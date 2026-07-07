## Context

`openInFolder` (src/extension.ts ~L329) currently derives a name from the folder
basename, then either attaches to the newest name-matched session or creates one
rooted in the folder — no way to open a *second* session for a path. The
view-title "+" (`create`) already mints numbered duplicates via `uniqueName`.
The building blocks all exist: `createSession(provider, name, cwd)`,
`attach(session)`, `uniqueName(existing, base)`, `sanitizeName`,
`provider.listSessions()` (newest-first), and the status label helpers in
provider.ts. This change is a UI rewrite of one function plus a small helper —
no new commands, config, or persistence.

## Goals / Non-Goals

**Goals:**
- One Explorer command opens a QuickPick that offers both reuse (any session in
  the folder's name family) and a numbered new session, on a single surface.
- The input box is prefilled with the sanitised basename and stays editable, so
  a custom new-session name is one field away.
- Reuse rows stay visible while the input is edited.

**Non-Goals:**
- Persisting session cwd / matching by real working directory (matching stays by
  name/basename).
- A second menu entry, new config, or changes to the "+" flow.
- Dropping the `-N` suffix in favour of hash-based disambiguation (deferred).

## Decisions

### D1: Single QuickPick with an editable prefilled value, not InputBox-then-pick
Use `vscode.window.createQuickPick()`, set `qp.value` to the sanitised basename,
`qp.title` to the folder path, and populate `qp.items` with the attach rows plus
a trailing "New session" row. The QuickPick's own filter field doubles as the
new-name editor. Rejected: an InputBox followed by a separate reuse picker —
two dismissable modals for one decision, and it can't show the name and the
reuse options together (the user asked for both on one surface).

### D2: Defeat built-in filtering by rebuilding items on value change
QuickPick hides items whose label doesn't fuzzy-match `value`, which would erase
the attach rows the moment the user edits the name. On `onDidChangeValue`,
rebuild `qp.items`: keep every attach row (label carries the session's own name,
so its visibility must not depend on the typed value) and rewrite only the
"New session" row's label to `New session "<value>"`. To stop VS Code
re-filtering the rebuilt list, attach rows are given labels that don't collide
with typed input and matching is neutralised — set `qp.matchOnDescription` and
`qp.matchOnDetail` false and rebuild eagerly so the shown set is always the full
set. (If residual filtering proves stubborn, the fallback is to encode the
choice as buttons/detail rather than relying on label match — but rebuild-on-
change is the first approach.) Rejected: leaving default filtering on — it makes
reuse unreachable once you start typing a new name.

### D3: Distinguish the accepted item by identity, not label text
Tag each item with a discriminant (`kind: 'attach'` + the `DtachSession`, or
`kind: 'new'`) via a parallel map or a symbol property, so `onDidAccept` routes
on the item's kind, not by parsing its (possibly edited) label. New → resolve
the final name from `qp.value` through `sanitizeName` + `uniqueName` against
current session names, then `createSession(provider, finalName, uri.fsPath)`.
Attach → `attach(session)`. Empty/whitespace value with "New session" chosen is
rejected inline the same way `create` validates.

### D4: Name family = basename and its numeric-suffix siblings
Reuse candidates are `listSessions()` filtered to name `=== base` or matching
`^<base>-\d+$`, preserving `listSessions` newest-first order. This is the honest
reading of "sessions for this folder" now the folder path can mint numbered
sessions. Descriptions come from the provider's status label so the rows read
like the tree.

## Risks / Trade-offs

- **Basename collision across unrelated folders** (`src`, `app`) → sessions from
  a different repo appear in the family. Accepted and documented in the spec;
  the fix (persisting cwd) is deliberately out of scope.
- **QuickPick filtering fights the design** → mitigated by D2's rebuild-on-
  change; if VS Code still filters, fall back to non-label-matched presentation.
  Verify against the acceptance checks before archiving.
- **Behaviour change for the no-session fast path** → the previously
  zero-prompt folder-open now always shows a QuickPick. Intentional (proposal
  marks it BREAKING); accepting the prefilled value is a single Enter.
