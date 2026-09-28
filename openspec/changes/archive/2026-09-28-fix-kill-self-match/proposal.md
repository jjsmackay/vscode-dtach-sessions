# Proposal

## Why

Killing a session whose dtach master is gone left its socket behind. `killOne`
runs one `sh -c` that resolves pids (`lsof -t … || pgrep -f '_<hash>\.dtach'`),
kills them, then runs `rm -f`. That shell's own command line contains the
pattern, so `pgrep` matches it. On a dead session it's the only match, so the
shell `SIGKILL`s itself before `rm -f` runs. The spec's "stale socket with no
process" scenario was already failing; dead sessions became common once 0.5.0
listed them.

## What Changes

- `resolvePidsCommand` drops the invoking shell's pid (`grep -vx "$$"`) from
  the resolved set.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `session-kill`: the resolved set excludes the kill's own shell, with a scenario
  for killing a dead session.

## Impact

- `src/extension.ts`: `resolvePidsCommand`. The stale-client reaper shares it but
  was unaffected (it keeps only `-a` processes).
