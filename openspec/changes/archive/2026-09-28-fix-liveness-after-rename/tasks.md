# Tasks

## 1. Hash-keyed liveness

- [x] 1.1 In `socketIsBound`, when the socket's file name carries a `_<hash>`, match any bound entry whose file name ends in `_<hash>.dtach`; otherwise keep the absolute-path/basename match. Update the doc comment. Verify `npm run compile` is clean
- [x] 1.2 Verify against the live table with a throwaway script calling the compiled `socketIsBound` on `/proc/net/unix`: a renamed live socket reads alive, a killed master reads dead, a hashless socket still matches by path
- [x] 1.3 Update the liveness gotcha in `CLAUDE.md` (the table records the bind-time path; match by hash)

## 2. Verification

- [x] 2.1 In VS Code: rename a live session, confirm the row is not treated as dead, and clicking it attaches with no "restarted" message and no startup command
