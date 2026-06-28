## Context

The panel renders one `SessionItem` per socket with a fixed `contextValue` of
`dtachSession`, and contributes a single inline action (Kill). Attach is the
row's default click command; Detach lives only in the context menu. The
attached-state indicator is a baked-green SVG (`media/terminal-green.svg`) chosen
over a recoloured codicon because VS Code washes codicon colour out on row
selection.

This change promotes attach/detach to inline icons that swap by attach state,
and adds a Restart action. All the behavioural pieces already exist: `attach`,
`detach`, `killOne`, and `createSession` (which runs `startupCommand`).

## Goals / Non-Goals

**Goals:**
- One-click detach (blue pause) on attached rows; one-click attach (play) on
  detached rows; mutually exclusive.
- A Restart action (inline + context menu) that kills the server and relaunches
  a fresh same-named shell with `startupCommand`, behind a confirmation.
- Reuse existing handlers; no new dependencies; no socket-layout change.

**Non-Goals:**
- Preserving in-session state across restart (no `claude --resume`-style transcript
  recovery; the dtach server and its scrollback are gone). Restart is kill + fresh.
- Reusing the old socket hash on restart — a fresh session gets a fresh hash.
- Colouring the play/restart icons; only the pause is coloured (blue), per request.

## Decisions

### Gate inline actions with an attached/detached contextValue split
`SessionItem.contextValue` becomes `dtachSession-attached` or
`dtachSession-detached` based on the existing `findTerminalForSocket` check.
Menu `when` clauses use `viewItem == dtachSession-attached` (pause) and
`viewItem == dtachSession-detached` (play); Restart and Kill match both via
`viewItem =~ /^dtachSession-/`.
- *Why:* VS Code can only show/hide inline actions per item via `contextValue`;
  there is no per-item icon-swap API. The split is the minimal mechanism.
- *Alternative considered:* a single command whose title/icon changes — rejected,
  command contributions are static and can't vary icon per row.
- The existing context-menu entries key off `view == dtachSessionsView` (not
  `viewItem`), so they're unaffected by the contextValue rename.

### Blue pause as a baked SVG; play and restart as codicons
The pause icon is a new `media/pause-blue.svg` (two bars, `#3FB950`-style blue,
16×16, matching `terminal-green.svg`'s structure) wired as the `detach` command's
`icon`. Play (`$(play)`) and Restart (`$(debug-restart)`) stay codicons.
- *Why:* only the pause needs to read as a distinct colour next to the green
  attached indicator and survive selection; play/restart are fine in the default
  toolbar foreground. Inline-action icons aren't per-command themeable, so colour
  must be baked into the asset (same rationale as the green icon).

### Restart = confirm → killOne → createSession (same name)
`restart(provider, session)` shows a modal warning, then awaits `killOne(session)`
(terminates the server, `rm -f`s the socket, disposes the dead terminal), then
calls `createSession(provider, session.name)` and refreshes. `createSession`
already mints a fresh hash, opens the terminal, and runs `startupCommand`.
- *Why reuse:* both halves are battle-tested; restart is literally their
  composition. No name dedup needed — the old socket is removed before recreate,
  so the name is free.
- *Ordering:* `await killOne` before create so the socket is gone first; avoids a
  same-name collision and a transient duplicate row.

### Confirmation copy
A modal `showWarningMessage("Restart \"<name>\"? This terminates the running
session and starts a fresh shell.", {modal:true}, "Restart")`, matching the Kill
command's confirmation pattern.

## Risks / Trade-offs

- **Restart loses running work** (the whole point is kill + fresh) → mitigated by
  the mandatory confirmation; copy spells out that it terminates the session.
- **contextValue rename could silently break a `when` clause** → all existing
  item menus filter on `view`, not `viewItem`; verified in `package.json`. Only
  the new inline entries use `viewItem`.
- **Inline icon crowding** (play/pause, restart, kill = up to 3 icons per row) →
  acceptable; ordered detach/attach @1, restart @2, kill @3 so the destructive
  action stays rightmost.
- **`reflectProcessTitle` interaction**: restart goes through the same
  `createSession`/`showOrCreateTerminal` path as create, so title reflection and
  the pid registry behave identically — no special handling needed.

## Migration Plan

Additive. No settings, socket names, or persisted state change. Shipping the new
`package.json` contributions and code is sufficient; no rollback steps beyond
reverting the version.

## Open Questions

None.
