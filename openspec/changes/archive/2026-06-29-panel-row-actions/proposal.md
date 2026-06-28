## Why

The session panel surfaces only one inline row action (Kill). The two most
common everyday actions — detaching a session you're done with for now, and
re-attaching one you left running — are buried in the right-click menu, and
there is no quick way to restart a session in place when its shell or agent
gets into a bad state. Promoting these to one-click row icons makes the panel
read and behave like a live session dashboard.

## What Changes

- Add a **pause** inline icon (baked blue, matching the green attached-icon
  pattern) on rows that are **attached** in this window. Clicking it detaches
  (closes this window's terminal, leaves the dtach server alive) via the
  existing `dtachSessions.detach` command.
- Add a **play** inline icon on rows that are **not attached**, which attaches
  (resumes) the session via the existing `dtachSessions.attach` command. Rows
  show pause *or* play depending on attach state, never both.
- Add a new **Restart** action (inline icon + context-menu entry): kill the
  session's dtach server, then start a fresh shell under the **same name**,
  re-running the configured `startupCommand`. Restart requires confirmation,
  since it terminates whatever is running.
- Gate the per-row inline actions on attach state via an attached/detached
  `contextValue` split on the tree item.

## Capabilities

### New Capabilities
- `session-restart`: restarting a session in place — confirm, terminate the
  dtach server, and relaunch a fresh shell under the same name with the
  configured startup command.

### Modified Capabilities
- `session-attach`: the attach and detach commands gain inline row-icon
  affordances gated on attach state (play to resume when detached, blue pause
  to detach when attached).

## Impact

- `package.json` — new `dtachSessions.restart` command; `icon` added to the
  `attach` and `detach` commands; `view/item/context` `inline` group entries
  for play/pause/restart gated by `viewItem`; matching `commandPalette`
  visibility rules.
- `src/provider.ts` — `SessionItem.contextValue` becomes
  `dtachSession-attached` / `dtachSession-detached`; blue pause icon wired
  alongside the existing green terminal icon.
- `src/extension.ts` — new `restart` handler (reuses `killOne` +
  `createSession`); `restart` command registration.
- `media/` — new baked-blue pause SVG (`pause-blue.svg`).
- No new dependencies. No breaking changes to settings or socket layout.
