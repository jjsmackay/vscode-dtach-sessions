## Why

Sessions persist across disconnects so a running Claude stays reachable from the
Claude mobile app. Starting a *new* session still needs VS Code: the extension is
the only thing that knows the socket naming, runs `startupCommand`, and reaps
stale clients. From a phone (Termux over SSH) the only route is typing the raw
`dtach` invocation by hand, including a made-up `_<hash>`.

A small command-line companion on the host closes that gap. Everything the two
front ends need to agree on already lives on disk — the socket naming, the status
files, `/proc` liveness — so the companion needs no connection to VS Code, and
sessions it creates show up in the sidebar like any other.

Separately, the extension's stale-client rule is "every `-a` client except this
window's own terminal". That was safe when VS Code was the only way to attach.
Once a phone can attach too, an attach from VS Code would `SIGKILL` a live Termux
client. Both front ends need one rule that asks whether a client's terminal is
still there, not whose terminal it is.

## What Changes

- New `dts` command-line tool, a single Python 3 file shipped in the `.vsix`
  (`scripts/dts.py`), with these subcommands:
  - `dts` — interactive picker: attach to an existing session or create a new one
  - `dts ls` — name, live/dead, attached, Claude run-state, age
  - `dts new <name> [-a]` — create **detached** in the invoking shell's working
    directory, run the startup command; `-a` attaches afterwards
  - `dts a <name>` — attach; reap stale clients first; a dead session is
    restarted in place under the same name and `_<hash>`
  - `dts kill <name>`
- `dts` follows the extension's on-disk contract: `<prefix><name>_<6-hex>.dtach`
  in `socketDir`, status from `<socketDir>/status/<hash>.json` with the same
  `working`/`tool` decay, liveness from `/proc/net/unix` (absolute path or
  basename).
- A new **Install Shell Companion** command copies `dts` to
  `~/.dtach-sessions/bin/dts` and writes `~/.dtach-sessions/config` from the
  current settings. While the companion is installed, the extension rewrites the
  config when a relevant setting changes. `DTS_*` environment variables override
  the file; built-in defaults apply without it. A matching Uninstall removes
  both.
- **Stale-client detection changes in the extension**: a client is stale when the
  terminal it was attached from no longer exists, whoever owns it. The pid
  comparison against this window's terminal is removed. `dts` uses the same rule.
  When the signal can't be read, the client is treated as live (the same
  "never kill a live client" bias as today).

Deliberately not included: rename and restart in `dts` (little use on a phone);
a web front end (auth and exposure cost for what SSH already provides); any IPC
between `dts` and the extension.

## Capabilities

### New Capabilities
- `shell-companion`: the `dts` tool, its config file, and the Install/Uninstall
  commands that deploy it.

### Modified Capabilities
- `stale-client-reaping`: staleness is decided by whether the client's terminal
  still exists, not by whether its pid belongs to this window's terminal.

## Impact

- `scripts/dts.py` — new; stand-alone, stdlib only, no knowledge of VS Code.
- `src/extension.ts` — Install/Uninstall Shell Companion; config file writer and
  its `onDidChangeConfiguration` hook; `staleClientPids` switches to the
  terminal-exists rule (the helper that reads the signal goes in `provider.ts`
  beside the other `/proc` readers).
- `package.json` — two commands, palette entries. No new settings.
- `README.md` — companion usage, a Termux one-tap example, acceptance checks.
- `CLAUDE.md` — Gotchas: the shared on-disk contract and the stale-client rule.
- Linux `/proc` only, as reaping and liveness already are. Requires `python3` on
  the host, which the Claude hook already requires.
