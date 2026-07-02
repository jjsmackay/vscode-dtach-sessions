## 1. dtach launch-failure legibility

- [x] 1.1 Track a creation timestamp for each terminal the extension creates for a socket, in the same lifecycle as the socket→terminal registration (`trackTerminal` / `showOrCreateTerminal` in `src/extension.ts`), so it is cleared when the terminal is untracked.
- [x] 1.2 Add a helper that, given a closing terminal, returns whether it was extension-created for a socket AND closed within the fast-close window (~1.5–2s) of its recorded creation. Do not gate on exit code.
- [x] 1.3 In the existing `onDidCloseTerminal` handler in `activate`, when the helper reports a fast-close, show a `showWarningMessage` stating dtach could not launch and naming `dtachSessions.dtachPath`, with an "Open Settings" action that opens that setting via `workbench.action.openSettings`.
- [x] 1.4 Ensure the warning does not fire for normal exits, Kill, detach, or reload-restored terminals (verify the ownership + fast-close guards cover these; a reconciled terminal carries no fresh creation stamp).

## 2. python3 install self-test

- [x] 2.1 In `installClaudeHooks`, after the forwarder is copied and settings written, run a cheap `python3 --version` check on the extension host that never throws and never blocks installation.
- [x] 2.2 When `python3` is not found, append a non-blocking advisory (noting the extension-host PATH caveat) to the existing success message; when found, leave the message unchanged.

## 3. Documentation

- [x] 3.1 Add a note to the README Requirements section: Kill needs `lsof` or `pgrep` to confirm what it removes; without either, it removes the socket without confirming the process is gone.

## 4. Verification

- [x] 4.1 `npm run compile` is clean (tsc, no errors).
- [x] 4.2 Live acceptance (hand to user — needs a Remote-SSH window): with a bogus `dtachSessions.dtachPath`, New Session shows the actionable warning and Open Settings jumps to `dtachSessions.dtachPath`; with a valid path, no warning fires and sessions behave as before.
