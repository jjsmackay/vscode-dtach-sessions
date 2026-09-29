## Context

The extension and a shell companion share no process, only a filesystem:

```
 phone (Termux) ──ssh──▶ host
                          │
            ┌─────────────┴──────────────┐
            │  dts (python)   VS Code ext │   ← two front ends, no IPC
            └──────┬──────────────┬───────┘
                   ▼              ▼
        <socketDir>/<prefix><name>_<hash>.dtach    ← naming contract
        <socketDir>/status/<hash>.json             ← written by the hook
        /proc/net/unix, /proc/<pid>/{cmdline,fd}   ← liveness, clients
                   ▲
          claude  (hook walks /proc ancestors to the dtach master)
```

Facts from the current code that constrain the design:

- `find_socket` in `scripts/claude-status-hook.py` walks **every** ancestor until
  one has a `*.dtach` argument, so any process tree under the dtach master is
  correlated. It doesn't matter how the master was launched.
- `launchMaster` runs `dtach -A <socket> [-r m] $SHELL` and then types
  `startupCommand` into the terminal with `sendText`. A headless creator has no
  terminal to type into.
- `staleClientPids` classifies every `-a` client except `findTerminalForSocket`'s
  `processId` as stale. A second front end breaks that assumption.
- `HOOK_PATH` is fixed at `~/.dtach-sessions/hook` regardless of `socketDir`;
  the companion follows the same convention.
- Remote control for Claude is enabled in the user's Claude settings, so the
  startup command needs no extra flag.

## Goals / Non-Goals

**Goals:**
- From an SSH shell, create a Claude session in one command and leave it running
  detached.
- Sessions created by either front end look identical to the other.
- Attaching from one device never kills a live client on another.

**Non-Goals:**
- Rename or restart in `dts`.
- A web front end.
- Keeping `dts` in sync with VS Code settings that override per workspace. The
  config file carries user-level values.
- Non-Linux hosts.

## Decisions

### D1: Python, one file, stdlib only

`python3` is already a dependency (the hook). Python handles JSON, `/proc`
parsing and a numbered menu without extra tools; bash would need `python -c` or
`jq` for the status files anyway. `scripts/dts.py` ships in the `.vsix` and
`scripts/` is not excluded by `.vscodeignore`.

### D2: Startup command via `dtach -n` then `dtach -p`

`dts new` runs `dtach -n <socket> [-r m] $SHELL`, then pushes
`<startupCommand>\n` into the session with `dtach -p <socket>`. This matches the
extension exactly: the command is typed into an interactive shell, lands in its
history, and Ctrl+C in Claude returns to that shell. The pty buffers the input
if the shell isn't reading yet.

Alternative: `dtach -n <socket> bash -c '<startup>; exec $SHELL'`. Simpler, and
the hook would still correlate (ancestor walk). Rejected for parity: the command
isn't in history and the outer shell is a different process from what the
extension creates.

### D3: Settings reach `dts` through a config file the extension maintains

`~/.dtach-sessions/config` is a flat `key=value` file (`socketDir`,
`socketPrefix`, `dtachPath`, `redrawMethod`, `startupCommand`). Install
writes it. While `~/.dtach-sessions/bin/dts` exists, the extension rewrites it on
`onDidChangeConfiguration` for those keys, so it doesn't go stale after a
settings change. Precedence: `DTS_*` environment variable → file → built-in
default (the `package.json` defaults).

Alternatives considered: parsing VS Code's remote `settings.json` (JSONC,
several locations, workspace overrides — brittle); environment variables only
(two sources of truth the user keeps in step by hand).

### D4: Install is its own command, not part of Install Claude Hooks

The companion is useful without Claude status and the hooks are useful without
the companion. Coupling them would make Uninstall Claude Hooks remove a tool the
user still wants. Install Shell Companion is idempotent and says how to put
`~/.dtach-sessions/bin` on `PATH` (the extension doesn't edit shell rc files).

### D5: A client is stale when its terminal is gone

The rule changes from "not this window's terminal" to "its terminal no longer
exists". A client wedges because its terminal died (window closed, SSH dropped);
that is the property to test. Who owns the client doesn't matter.

**Unverified: which signal to read.** Candidates, to be settled on a real host
before anything else is built (task 1):

1. `readlink /proc/<pid>/fd/0` ends in ` (deleted)`, or the link points at a
   `/dev/pts/N` that doesn't exist.
2. Compare the client's stdin device against the current `/dev/pts/N`. This is
   only valid if pts reuse can be told apart: a new terminal can take the same
   `N` after the old one closes, so "the path exists" alone is **not** enough.
3. The pty master side is closed. This shows as a hangup on the slave: the
   client's stdin read returns EIO. It can't be observed from outside without
   touching the fd, but it may appear in `/proc/<pid>/fdinfo` or as the absence
   of any other process holding that pts.

Whichever signal is chosen must handle pts reuse. If none does, the fallback
applies to the extension only: a client is stale when it is **both** not this
window's terminal **and** fails the best available terminal check. `dts` has no
window terminal to exclude, so on the fallback it only reaps when the terminal
check is positive.

In every case, a signal that can't be read means the client is live.

### D6: `dts` reuses the extension's rules; it doesn't reinvent them

The rules are duplicated in `dts.py`, and the spec is what keeps them in sync:
- naming: `<prefix><name>_<secrets.token_hex(3)>.dtach`, regenerating on the rare
  collision
- liveness: `/proc/net/unix` rows with `St 01`, matching the absolute path or the
  basename (the `sun_path` 108-byte case)
- status: `effectiveState` semantics — `working`/`tool` decay after 120 s,
  `waiting`/`done` don't, `idle` shows nothing, dead sessions show nothing
- restart in place: `dtach -A` on the existing path, same startup replay as D2
- kill: `SIGKILL` the master and clients, remove the socket and status file

The rules are small and unlikely to change often. A shared helper that the
TypeScript calls into would be a larger restructure of the extension than this
change warrants.

## Risks / Trade-offs

- **The terminal check is wrong in one direction or the other.** If it's too
  loose, it kills a live client; if it's too strict, it leaves blank screens.
  Mitigation: settle it on a real host first (task 1) and bias every uncertain
  case towards "live".
- **Rule drift between TypeScript and Python.** Mitigation: the spec states the
  rules, and the acceptance checks exercise a session created by each front end
  and viewed from the other.
- **Shared winsize.** Attaching from the phone resizes a VS Code client on the
  same session. This is why `dts new` creates detached by default, and it's
  documented, not fixed.
- **`dtach -p` availability.** It exists in dtach 0.9. If a host's dtach lacks
  it, `dts new` reports that and falls back to D2's alternative.
