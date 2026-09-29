## ADDED Requirements

### Requirement: Shared on-disk contract
The `dts` tool SHALL create, list, and act on sessions using the same on-disk
contract as the extension: sockets named `<socketPrefix><name>_<hash>.dtach` in
`socketDir`, where `<hash>` is six lowercase hex characters; Claude run-state
read from `<socketDir>/status/<hash>.json`; and liveness read from
`/proc/net/unix`. A session created by either front end SHALL be listed,
attachable, and killable from the other without any conversion.

#### Scenario: Session created by dts appears in the sidebar
- **WHEN** the user runs `dts new build` and the VS Code sidebar refreshes
- **THEN** a session named `build` is listed, and clicking it attaches to the session `dts` created

#### Scenario: Session created by the extension appears in dts
- **WHEN** a session is created from the sidebar and the user runs `dts ls`
- **THEN** that session is listed under its display name

### Requirement: Create detached
`dts new <name>` SHALL create a new session in the working directory of the
invoking shell, start the configured shell under a dtach master **without**
attaching, and run the configured startup command in it. It SHALL exit once the
master is bound. With `-a` it SHALL attach after creating. A name that already
has a session SHALL still create a new session with a distinct hash, matching
the extension's create behaviour.

#### Scenario: Create and return
- **WHEN** the user runs `dts new fix-login` in `~/code/app` with startup command `claude`
- **THEN** a live session `fix-login` exists whose shell's cwd is `~/code/app` and which is running `claude`, and the command returns to the invoking shell

#### Scenario: Create and attach
- **WHEN** the user runs `dts new fix-login -a`
- **THEN** the session is created as above and the user's terminal is attached to it

#### Scenario: Startup command lands in an interactive shell
- **WHEN** a session created by `dts new` has its startup program exit
- **THEN** the session remains alive at an interactive shell prompt

### Requirement: List sessions
`dts ls` SHALL print one line per session with its display name, whether it is
live or dead, whether any client is attached, its effective Claude run-state,
and a relative age. Effective run-state SHALL follow the extension: `working`
and `tool` decay to none after 120 seconds without an update, `waiting` and
`done` do not decay, `idle` shows none, and a dead session shows none regardless
of its status file.

#### Scenario: Waiting session is flagged
- **WHEN** a live session's status file records `waiting`
- **THEN** `dts ls` shows that session as waiting

#### Scenario: Dead session shows no run-state
- **WHEN** a session's master has died and its status file still records `waiting`
- **THEN** `dts ls` shows the session as dead with no run-state

### Requirement: Attach
`dts a <name>` SHALL attach the user's terminal to the named session using the
configured redraw method. Before attaching to a live session it SHALL reap that
session's stale clients as defined by the `stale-client-reaping` capability. When
the session's master is gone it SHALL restart it in place on the same socket path,
keeping name and hash, run the startup command, and say once that the previous
output is gone. When more than one session has the name, `dts` SHALL ask which
one.

#### Scenario: Attach to a live session
- **WHEN** the user runs `dts a fix-login` for a live session
- **THEN** stale clients on it are reaped and the terminal is attached

#### Scenario: Attach to a dead session
- **WHEN** the user runs `dts a fix-login` and the session's master is gone
- **THEN** a fresh master starts on the same socket, the startup command runs, a one-line notice is printed, and the terminal is attached

#### Scenario: Live client on another device is kept
- **WHEN** the session has a live VS Code client and the user runs `dts a` from Termux
- **THEN** the VS Code client is not terminated

### Requirement: Kill
`dts kill <name>` SHALL terminate the session's master and clients with
`SIGKILL`, remove the socket, and remove its status file, matching the
extension's kill. It SHALL confirm before killing unless given `-y`.

#### Scenario: Kill removes the session everywhere
- **WHEN** the user confirms `dts kill fix-login`
- **THEN** the processes are gone, the socket and status file are removed, and the session no longer appears in `dts ls` or the sidebar

### Requirement: Interactive picker
`dts` with no arguments SHALL present a menu of sessions, marking each one's
live/dead state and run-state, plus an entry to create a new session. Choosing a
session SHALL attach as `dts a` does; choosing new SHALL prompt for a name and
create as `dts new -a` does. The picker SHALL work with no dependencies beyond
Python's standard library.

#### Scenario: Pick and attach
- **WHEN** the user runs `dts` and chooses an existing session
- **THEN** the terminal is attached to it

### Requirement: Configuration
`dts` SHALL read `socketDir`, `socketPrefix`, `dtachPath`, `redrawMethod`, and
`startupCommand` from `~/.dtach-sessions/config`. A `DTS_<KEY>` environment
variable (e.g. `DTS_SOCKET_DIR`) SHALL override the file, and the extension's
`package.json` defaults SHALL apply when neither is set. A leading `~` in
`socketDir` SHALL expand to the home directory.

#### Scenario: No config file
- **WHEN** `~/.dtach-sessions/config` does not exist and no `DTS_*` variable is set
- **THEN** `dts` uses `~/.dtach-sessions`, an empty prefix, `dtach`, `winch`, and no startup command

#### Scenario: Environment overrides file
- **WHEN** the config file sets `startupCommand=claude` and `DTS_STARTUP_COMMAND=` is set to empty
- **THEN** `dts new` runs no startup command

### Requirement: Install and uninstall
The extension SHALL provide an **Install Shell Companion** command that copies
the bundled `dts` to `~/.dtach-sessions/bin/dts`, marks it executable, writes
`~/.dtach-sessions/config` from the current settings, and tells the user how to
add `~/.dtach-sessions/bin` to `PATH`. It SHALL be idempotent. While
`~/.dtach-sessions/bin/dts` exists, the extension SHALL rewrite the config file
when any of the five settings changes. An **Uninstall Shell Companion** command
SHALL remove the tool and the config file and nothing else. Neither command SHALL
edit shell startup files.

#### Scenario: Config follows a settings change
- **WHEN** the companion is installed and the user changes `dtachSessions.startupCommand`
- **THEN** `~/.dtach-sessions/config` reflects the new value without re-running Install

#### Scenario: Uninstall is surgical
- **WHEN** the user runs Uninstall Shell Companion
- **THEN** `~/.dtach-sessions/bin/dts` and `~/.dtach-sessions/config` are removed, and sockets, status files, and the Claude hook are untouched
