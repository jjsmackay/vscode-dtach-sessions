## 1. Name-family helper

- [x] 1.1 Add a helper that, given a base name and `provider.listSessions()`,
  returns the family (`name === base` or `^<base>-\d+$`) preserving newest-first
  order. Reuse `sanitizeName` for the base.

## 2. QuickPick rewrite of `openInFolder`

- [x] 2.1 Replace the name-match-then-attach-or-create body of `openInFolder`
  with `vscode.window.createQuickPick()`: set `value` to the sanitised
  basename, `title` to the folder path, and build items = one attach row per
  family member (description = provider status label, newest-first) + a trailing
  "New session" row.
- [x] 2.2 Tag each item with its kind (`attach` + the `DtachSession`, or `new`)
  so accept routes on identity, not label text (design D3). (Discriminant named
  `role`, not `kind` — `vscode.QuickPickItem.kind` already exists for
  separators and collides.)
- [x] 2.3 On `onDidChangeValue`, rebuild items so attach rows stay visible and
  only the "New session" label tracks the typed value; disable
  `matchOnDescription`/`matchOnDetail` and neutralise label filtering (design D2).
- [x] 2.4 On accept: attach → `attach(session)`; new → resolve name via
  `sanitizeName` + `uniqueName` against current names, then
  `createSession(provider, finalName, uri.fsPath)`, notifying if the name was
  bumped. Reject empty/whitespace new-name inline (picker stays open with an
  error item, rather than closing and popping a dialog). Dispose the QuickPick
  on accept/hide; do nothing on dismiss.
- [x] 2.5 Keep the no-`uri` invocation (command palette) delegating to `create`.

## 3. Verify

- [x] 3.1 `npm run compile` is clean.
- [ ] 3.2 Walk the spec scenarios manually: no-session (New only), family with
  attach rows + status, second-session numbering, custom name keeps attach rows
  visible, sanitising, dismiss opens nothing. Confirm reuse rows survive editing
  the input (design D2).
