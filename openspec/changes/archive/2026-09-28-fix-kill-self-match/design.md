# Design

## Context

See proposal. The kill is a single `sh -c` so the resolve, kill and `rm -f` run
in one exec.

## Decisions

### D1. Filter `$$` rather than restructure the pgrep
`$$` inside `sh -c` is the shell whose command line matches. The `$(…)`
subshell also matches, but it has exited by the time `kill` runs, so killing
its pid does nothing. Alternatives: the `[_]<hash>` bracket trick (the pattern
no longer matches its own text) would need changing every caller's pattern and
its escaping; `pgrep` has no self-exclusion flag that covers the parent shell.

## Risks / Trade-offs

- [pid reuse of the exited subshell pid within the same command] → Negligible;
  the window is one shell statement.
