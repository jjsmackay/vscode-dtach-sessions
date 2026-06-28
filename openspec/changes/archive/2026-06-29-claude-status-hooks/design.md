## Context

The extension runs on the remote extension host (Remote-SSH), where the dtach
sockets and binary live. The panel lists sockets and attaches native terminals;
it is not in the loop after a session is created — the dtach master starts the
session's process tree once and it persists across attach/detach. There is no
existing channel telling the extension what an agent inside a session is doing.

`terminal-sessions` (the reference) solves this by owning a tmux wrapper, so a
Claude hook reads `$TMUX` to know its session. We don't own a wrapper; sessions
are plain dtach sockets, some created outside the extension. The hard part is
therefore correlation: mapping a firing hook to a socket. Everything else (event
→ state, rendering a badge) is straightforward.

## Goals / Non-Goals

**Goals:**
- A live per-row badge: working / tool:`<name>` / waiting / idle.
- Work for any dtach session on the host, including ones created by hand.
- Never show a wrong state; degrade to no badge.
- Keep the extension minimal: no PTY scraping, no webview, no new npm deps.
- Compose cleanly with the in-flight `panel-row-actions` change.

**Non-Goals:**
- Cost, tokens, context-window gauge, model, turn count, last messages.
- Transcript/JSONL tailing.
- Any agent other than Claude Code.
- macOS/Windows remote hosts (no `/proc`); they degrade to no badge.

## Decisions

### Correlation: `/proc` ancestor walk (primary), hash as the key

The forwarder walks the ppid chain via `/proc/<pid>/stat` (or `status`), reading
each `/proc/<pid>/cmdline`, until it finds a process whose argv contains a
`*.dtach` path — the dtach master — and extracts the 6-hex hash from the socket
basename (the same id `provider.ts` `hashOf` uses).

- **Why over an env marker at creation:** the walk needs zero changes to session
  creation and works for hand-created sessions too. An injected `DTACH_SOCKET`
  env var would only cover extension-created sessions. The walk also survives the
  `exec -a <name>` launcher: argv[0] becomes the session name, but the `-c
  <socket>` token is still present, and we scan all tokens.
- **Why hash, not socket path:** rename moves the socket but keeps the hash;
  keying status by hash makes the join rename-invariant for free, mirroring the
  existing `rekeyTerminal` design.
- **Host-global no-op:** the hook lives in `~/.claude/settings.json` and fires
  for every Claude on the box. When the walk finds no `.dtach` ancestor it exits
  0 without writing. This is the natural filter; it must stay cheap.

### Data channel: per-hash status files, not an event log

The forwarder overwrites `~/.dtach-sessions/status/<hash>.json` with the current
state (atomic tmp-write + rename). The provider reads that directory alongside
its existing socket `readdir` and joins by hash.

- **Why over an append-only `events.jsonl` + tailer** (the reference's approach):
  for status-only, current-state-as-file is the right shape. Last-write-wins is
  *correct* semantics, there is no unbounded growth or rotation, GC is just
  deleting the file on SessionEnd, and the provider already does a `readdir` on
  the sibling socket dir — the status read folds into the same pass. No tailer,
  no startup replay.

### Install: explicit commands + a gated one-time nudge

Install/Uninstall commands are the source of truth. Install merges the forwarder
into each event array in `~/.claude/settings.json`, never clobbering the user's
hooks, identifying "ours" by the forwarder path. It copies the bundled forwarder
to a stable `~/.dtach-sessions/hook` and references that path (not the versioned
extension dir) so updates don't break the wiring.

A one-time nudge offers Install only when `~/.claude/` exists (the "runs Claude"
signal — PATH is unreliable on the extension host, which is why `dtachPath`
exists), hooks aren't installed, and the user hasn't dismissed (globalState,
per-host).

- **Why a command over silent auto-install:** mutating a global, shared config
  file should be explicit and reversible; matches the extension's minimal ethos.

### Forwarder language: python3, event via argv

Python3 for the `/proc` walk + JSON write (robust, no `jq` dependency, present
on the target host; the hook runs in the session's normal shell env, so PATH is
fine there). The event name is passed as an argv (we control the command string),
so the script reads stdin only to pull the tool name for PreToolUse.

## Risks / Trade-offs

- **Linux-only (`/proc`).** → macOS/Windows remote hosts get no badge; never a
  wrong one. Documented; a `ps`-based fallback is a possible later addition.
- **Reparenting loses the dtach ancestor** (nohup, daemonized, tmux-inside-dtach).
  → No badge for those sessions; never a wrong one. Acceptable for interactive use.
- **Crash with no Stop/SessionEnd leaves a stale "working" file.** → Provider
  decays transient states past a timestamp threshold to idle/age on read.
- **Editing `~/.claude/settings.json` could disturb user config.** → Merge-only,
  identify our entries by forwarder path, idempotent; Uninstall is surgical.
- **Hook fires for every Claude on the host.** → Cheap no-op when no `.dtach`
  ancestor; acceptable overhead.
- **Hooks apply at session start.** → Already-running sessions show no status
  until restarted; surfaced in the install confirmation.
- **Shared working tree with `panel-row-actions`.** → Built in an isolated
  worktree; the two compose by contract (status in `description`, attach-state in
  `contextValue`), so the only merge friction is small textual overlap in
  `SessionItem`, `package.json` contributions, and `activate()`.
