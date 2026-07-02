## Why

The extension does no preflight: optional features degrade to no-ops and the one
hard requirement (VS Code) is manifest-gated. That restraint is good, but it
leaves a diagnosability gap — the extension goes **silent exactly when a
dependency is missing**. A mis-pathed `dtach` yields a cryptic raw terminal
error; a missing `python3` yields status rows that never appear, with nothing to
say why. We want legibility for the two failures that actually confuse people,
without adding a preflight phase or otherwise disturbing the happy path.

## What Changes

- **Legible dtach launch failure.** When a terminal we created for a session
  dies almost immediately (dtach missing or `dtachSessions.dtachPath` wrong), the
  extension surfaces an actionable warning with an **Open Settings** action,
  instead of leaving the user with VS Code's raw "failed to launch" text. The
  signal is the terminal's own fast close (observed for both launch paths), not
  an extension-host probe — an ext-host `PATH` probe is unreliable because the
  extension host does not source `.bashrc`, so it would false-negative on working
  setups.
- **python3 install self-test.** `Install Claude Status Hooks` runs a cheap
  `python3` check on the extension host after wiring the forwarder. Install
  **always still proceeds**; if `python3` is not found it appends a non-blocking
  note to the success message so a "hooks installed but no status ever appears"
  outcome is explained rather than silent.
- **lsof/pgrep documentation.** A README note clarifies that Kill needs `lsof`
  or `pgrep` to confirm what it removes, and that without either it removes the
  socket without confirming the process is gone. No code change.

## Capabilities

### New Capabilities
- `launch-diagnostics`: surface a legible, actionable warning when a session's
  terminal fails to launch (the fast-close-of-a-freshly-created-terminal
  heuristic), covering both the bash and direct dtach launch paths, without any
  preflight capability check.

### Modified Capabilities
- `claude-status-hooks`: the Install command additionally self-tests for
  `python3` on the extension host and, when it is absent, appends a non-blocking
  advisory to its success message; installation is never blocked by the result.

## Impact

- `src/extension.ts`: track a creation timestamp for terminals created via
  `trackTerminal` (~L67) / `showOrCreateTerminal` (~L146); extend the existing
  `onDidCloseTerminal` handler in `activate` (~L914) with the fast-close warning;
  add the python3 self-test to `installClaudeHooks` (~L714).
- `README.md`: Requirements section — lsof/pgrep clarification.
- No new dependencies. No change to kill logic, the forwarder, or activation-time
  behaviour. `dtachSessions.dtachPath` already exists and is reused by the
  Open Settings action.
