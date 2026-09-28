# Tasks

## 1. Fix

- [x] 1.1 Reproduce with the command as `killOne` builds it on a stale socket: the shell exits 137 and the socket survives
- [x] 1.2 Pipe `resolvePidsCommand`'s output through `grep -vx "$$"`; verify the same repro exits 0 and removes the socket, and a live session's master is still killed
