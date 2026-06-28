## Why

Managing multiple concurrent Claude sessions on a remote host means juggling dtach sockets from the terminal — there's no UI. A VS Code sidebar that lists sockets and attaches with one click removes the friction entirely, and because dtach is pure passthrough, native terminal features (mouse select, copy, scroll, search) all keep working.

## What Changes

- New VS Code extension (`dtach-sessions`) published to the remote extension host via Remote-SSH.
- Adds an activity-bar sidebar listing `~/.claude-*.dtach` sockets as clickable tree items.
- Attach command opens a normal integrated terminal running `dtach -a <socket> -r winch`.
- Create command prompts for a name and opens a terminal running `dtach -A <socket> -r winch <shell>`.
- Kill command (right-click context menu) resolves the owning process via `lsof` (falling back to escaped `pgrep`), terminates it, and removes the socket file.
- Four user-configurable settings: socket directory, socket prefix, redraw method, and dtach binary path.
- Create input is validated to reject path-breaking names; clicking a session reuses its existing terminal; the tree auto-refreshes when the view becomes visible.

## Capabilities

### New Capabilities

- `session-list`: Discover and display dtach socket files in a VS Code tree view, with refresh.
- `session-attach`: Attach to an existing dtach session in an integrated terminal using `-r winch`.
- `session-create`: Create (or idempotently attach to) a named dtach session in an integrated terminal.
- `session-kill`: Terminate a dtach server process and remove its socket file via right-click.

### Modified Capabilities

## Impact

- New repository: `detach-sessions/` containing the extension source.
- No runtime dependencies beyond VS Code API and Node stdlib.
- Requires `dtach` binary on the remote host; extension runs on the remote extension host (`extensionKind: ["workspace"]`). Binary located via the `dtachPath` setting (default PATH lookup).
- Kill relies on `lsof` where available, falling back to `pgrep`.
- Packaged as a `.vsix` and installed manually onto the remote via Command Palette.
