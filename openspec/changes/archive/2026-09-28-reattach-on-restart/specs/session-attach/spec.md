# Spec Delta

## ADDED Requirements

### Requirement: Attach terminals are not restored by VS Code
Every terminal the extension creates to attach to or create a session SHALL opt
out of VS Code's terminal persistence, so VS Code neither revives it after a full
restart nor reconnects it after a window reload. A revived terminal keeps the
tab and replays old output but launches a plain shell instead of dtach, and the
extension cannot reliably identify it, so the tab would look like the session
without being attached to it. Restoring sessions is the extension's job (see
"Reattach on startup").

#### Scenario: No plain-shell tab after restart
- **WHEN** a session is attached, and the user closes and reopens VS Code
- **THEN** VS Code does not restore a terminal tab for that session running a plain shell

#### Scenario: Other terminals are unaffected
- **WHEN** the user has ordinary terminals open alongside session terminals, and closes and reopens VS Code
- **THEN** the ordinary terminals are restored by VS Code as usual

### Requirement: Reattach on startup
The extension SHALL record, per window (in `workspaceState`), which sessions are
attached in that window. A session SHALL be added when a terminal is attached to
or created for it, re-keyed when it is renamed, and removed when the user closes
its terminal, detaches it, kills it, or restarts it into a new socket.

Closing or reloading the window SHALL NOT remove a session from the list, even
though VS Code closes its terminals as the window goes away.

On activation, when `dtachSessions.reattachOnStartup` is `true` (the default),
the extension SHALL reattach each recorded session that still exists and whose
master is alive, and that has no live terminal in the window. Reattach SHALL use
the same path as a fresh attach, including stale-client reaping. It SHALL NOT
run the startup command and SHALL NOT take keyboard focus from wherever VS Code
put it.

A recorded session that no longer exists, or whose master is gone, SHALL NOT be
reattached or restarted, and SHALL be removed from the list. Reattach must never
start a process the user did not ask for; clicking such a session still restarts
it in place.

When `reattachOnStartup` is `false`, the extension SHALL reattach nothing on
activation, and the sessions stay detached until the user attaches them.

#### Scenario: Sessions reattach after a full restart
- **WHEN** sessions `api` and `web` are attached, and the user closes and reopens VS Code
- **THEN** both sessions are reattached in new terminals, and their rows show attached

#### Scenario: Sessions reattach after a window reload
- **WHEN** a session is attached and the user reloads the window
- **THEN** the session is reattached in a new terminal, dtach's redraw repaints the current screen, and no second terminal for the session remains

#### Scenario: A detached session is not reattached
- **WHEN** the user detached `api` (or closed its terminal tab) before closing VS Code
- **THEN** `api` is not reattached on the next startup

#### Scenario: A dead session is not reattached
- **WHEN** a recorded session's master is gone at startup (e.g. the host rebooted)
- **THEN** no terminal is created for it, no master is started, and it is dropped from the attached list

#### Scenario: A renamed session is reattached under its new name
- **WHEN** the user renames an attached session `api` to `backend`, then reloads the window
- **THEN** `backend` is reattached

#### Scenario: Opt out
- **WHEN** `dtachSessions.reattachOnStartup` is `false` and the user reopens VS Code with sessions previously attached
- **THEN** no sessions are reattached

#### Scenario: Reattach does not steal focus
- **WHEN** sessions are reattached on startup
- **THEN** keyboard focus stays where VS Code restored it

## MODIFIED Requirements

### Requirement: Reuse existing terminal
Clicking a session that already has a live terminal SHALL focus that terminal rather than opening a second attach. The lookup SHALL query the live `vscode.window.terminals` list rather than trusting an in-memory map alone.

A terminal SHALL be matched to a session by, in order: (1) the socket path in the terminal's launch args (`shellArgs`); then (2) the terminal the extension associated with the session in this activation, which covers a session renamed while attached, whose terminal's launch args still name the old socket. When `reflectProcessTitle` is `false`, an additional fallback to `terminal.name === session display name` MAY be used.

A terminal whose process has exited SHALL NOT be matched by any of those rules.
VS Code keeps an exited terminal in `vscode.window.terminals` until its tab is
closed, and such a terminal is not an attachment: its dtach client is gone. This
is load-bearing for restarting a session in place, because a dtach client cannot
outlive its master — so a session whose master died mid-session is certain to
have an exited terminal still matching its socket, and matching it would focus a
dead tab instead of restarting the session.

#### Scenario: Repeat click focuses existing terminal
- **WHEN** user clicks a session that already has a live terminal
- **THEN** the existing terminal is shown and no second terminal is created

#### Scenario: Reuse after window reload
- **WHEN** the user reloads the window with a session attached, then clicks that session after it has been reattached
- **THEN** the reattached terminal is matched by its launch args and focused, and no second terminal is created

#### Scenario: Reuse after renaming an attached session
- **WHEN** the user renames an attached session and then clicks it
- **THEN** its existing terminal is focused and no second terminal is created

#### Scenario: Click after terminal closed
- **WHEN** the user closed the session's terminal and then clicks the session again
- **THEN** a new terminal is created and attached

#### Scenario: An exited terminal is not matched
- **WHEN** a session's terminal process has exited but its tab is still open, and the user clicks that session
- **THEN** the exited terminal is not matched, and the session is attached (or restarted in place, if its master is gone) in a new terminal
