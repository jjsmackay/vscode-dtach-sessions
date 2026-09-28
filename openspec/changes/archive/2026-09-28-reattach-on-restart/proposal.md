# Proposal

## Why

Closing and reopening VS Code revives every attach terminal as a plain remote
bash shell: VS Code replays the old scrollback but relaunches the default shell,
not `dtach -a`. The tab looks like the session and isn't. The extension can't
recognise these husks (new pid, no `shellArgs`, no API name under
`reflectProcessTitle`), so the row reads detached while a misleading tab sits
open. The code assumes the opposite — `src/extension.ts` says a full restart
"does not restore terminals anyway".

## What Changes

- Attach and create terminals are created with `isTransient: true`, so VS Code
  never persists or revives them — on full restart **or** window reload. No more
  husks.
- **New**: on activation, the extension reattaches every session that was
  attached in this window when it last closed, provided the session still
  exists and its master is alive. Governed by a new
  `dtachSessions.reattachOnStartup` setting (default `true`).
- **BREAKING (behaviour)**: a window reload no longer keeps the attach terminal
  alive with VS Code's scrollback replay. The terminal is dropped and reattached;
  dtach's `-r` redraw repaints the current screen, but shell scrollback, tab order
  and split layout reset.
- The persisted `socket → pid` map becomes a persisted *attached-sessions* list,
  and the reload pid-reconciliation (`reconcileTerminals`, pid-keyed registry
  rebuild) is removed: reattached terminals carry their `shellArgs` again, so the
  args match is sufficient.
- Dead sessions are not reattached (reattach must not start processes
  unprompted); clicking one still restarts it in place.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `session-attach`: adds the reattach-on-startup requirement and setting; attach
  terminals become transient; the "Reuse existing terminal" requirement drops
  the persisted `processId` fallback and its reload scenario.
- `session-create`: created terminals become transient and are recorded in the
  attached-sessions list instead of a `socket → processId` association.
- `launch-diagnostics`: the "reload-restored terminal" scenario no longer
  applies — reattached terminals are fresh, and must not trip the fast-close
  warning when the reattach itself fails fast.
- `stale-client-reaping`: the "restored terminal after reload" scenario is
  replaced — there is no restored terminal; reattach goes through the fresh-attach
  reap path.

## Impact

- `src/extension.ts`: `showOrCreateTerminal` options, `trackTerminal`,
  pid-map helpers, `reconcileTerminals`, `activate`, rename's pid re-key.
- `src/provider.ts`: `findTerminalForSocket` and registry doc comments.
- `package.json`: new `dtachSessions.reattachOnStartup` setting.
- `README.md` acceptance checks (reload/restart steps), `CLAUDE.md` gotchas
  describing the reload pid registry.
- Requires VS Code honouring `TerminalOptions.isTransient` (API since 1.65).
