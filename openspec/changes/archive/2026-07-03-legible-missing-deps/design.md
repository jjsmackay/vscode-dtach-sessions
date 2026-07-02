## Context

The extension deliberately does no preflight capability checks; optional features
(status, reaping) degrade to no-ops off-Linux, and the hard requirement (VS Code
version) is manifest-gated. The cost of that restraint is diagnosability: when a
dependency is missing, the extension is silent or cryptic. Two failures actually
confuse users:

- **dtach missing / mis-pathed.** `showOrCreateTerminal` hands `dtachSessions.dtachPath`
  to VS Code as (or inside) the terminal's `shellPath`. A bad path yields VS
  Code's raw "failed to launch" output with no hint that `dtachSessions.dtachPath`
  is the knob.
- **python3 missing.** The status forwarder is invoked by Claude as
  `python3 <hook>`. If `python3` is absent the hook fails *inside Claude's
  process on the host* — the extension never sees it; status rows simply never
  appear.

A prior explore session (memory notes `forwarder-legibility-outcome`,
`forwarder-as-sensor`) established the approach and verified the key mechanic.

## Goals / Non-Goals

**Goals:**
- Turn the two silent/cryptic missing-dependency failures into one actionable
  message each, without adding an activation-time or first-use preflight phase.
- Keep the happy path byte-for-byte unchanged.
- Document the one remaining edge (Kill with neither lsof nor pgrep).

**Non-Goals:**
- No extension-host probe of `dtach` (unreliable — see Decisions).
- No shell rewrite of the python forwarder (a separate decision tied to future
  forwarder capabilities).
- No change to kill logic, the forwarder, or degrade-to-no-op behaviour.

## Decisions

### D1 — Detect a dtach launch failure from the terminal's own close, not a probe

An extension-host probe (`command -v dtach`, `fs.existsSync`) answers "is dtach
on the *extension host's* PATH" — but the terminal launches with the *login
shell's* PATH (the extension host does not source `.bashrc`; this is a
documented gotcha and the reason `dtachSessions.dtachPath` exists). The probe's
failure mode is a **false negative**: nagging users whose setup works. The
terminal is the only context holding the correct PATH, so its own launch result
is the sole trustworthy signal.

**Verified:** a missing dtach fires `onDidCloseTerminal` on **both** launch
paths — the default `reflectProcessTitle`-on path (`bash -c 'exec -a "$0" "$@"' …`
exits **127** when `exec` can't find dtach) and the direct `shellPath` path (VS
Code closes the terminal rather than only printing an error). So one close-event
heuristic covers both.

**Alternative considered:** gate on `exitStatus.code === 127`. Rejected — that
signal exists only on the bash path; the direct path may report no code. Keying
on ownership + timing covers both and is simpler.

### D2 — The heuristic: extension-created + fast-close

We already register every terminal we create against its socket
(`trackTerminal` → in-memory registry + persisted pid). Add a **creation
timestamp** alongside that registration. In the existing `onDidCloseTerminal`
handler, when a closing terminal maps to a socket we created and the elapsed
time since its recorded creation is under a short threshold (~1.5–2s), show the
warning.

Two facts gate it, and together they avoid false positives:
- **Ownership** — only terminals the extension created for a socket in this
  activation are candidates. A reload-restored terminal is reconciled by pid,
  not created here, so it carries no fresh creation stamp and cannot trip the
  warning.
- **Fast-close** — a genuine session (attach, create, long-running agent) lives
  far longer than the threshold; a normal `exit`, a Kill, or a detach closes a
  terminal that is not fresh. Only an *immediate* death looks like a failed
  launch.

The warning is a `showWarningMessage` with an **Open Settings** action wired to
`workbench.action.openSettings` focused on `dtachSessions.dtachPath`.

### D3 — python3 legibility lives at install, not use

The forwarder's point-of-use failure is inside Claude on the host and invisible
to us, so there is nothing to catch at use time. The only leverage is **install
time**: after copying the forwarder, run a cheap `python3 --version` on the
extension host. Installation **always proceeds regardless** — the check only
decides whether to append an advisory line to the existing success message.

Same PATH caveat as D1 applies (ext-host PATH may differ from Claude's host), so
this can false-negative — but `python3` is usually system-wide (low risk) and we
only *warn*, never block, so the downside of a false negative is one extra
sentence, not a broken install. The advisory names the caveat.

### D4 — lsof/pgrep is documentation only

`killOne` runs `rm -f <socket>` even when no pids resolve. That is **correct** for
the common case (cleaning up a dead leftover socket) and only wrong when *both*
lsof and pgrep are missing — near-impossible on a Linux box that has dtach and
already requires `/proc`. We cannot distinguish "already dead" from "tools
missing" without the very process query that is missing, so there is no clean
code fix. A README note is the honest treatment.

## Risks / Trade-offs

- **A slow-but-legitimate launch could exceed the threshold and miss the
  warning, or a genuinely instant crash could trip it** → Threshold is a
  heuristic; err toward ~1.5–2s. A missed warning degrades to today's behaviour
  (raw error), and a false warning is non-destructive (an advisory pointing at a
  real setting). Neither harms the session.
- **Direct-path exit status is less characterised than the bash path** → We
  don't depend on the code, only on the close event firing, which was observed
  on both paths.
- **python3 self-test false-negative on a split-PATH host** → We only warn and
  the advisory states the caveat; install still works.
- **Creation-timestamp bookkeeping must be cleared with the terminal** → Store
  it in the same lifecycle as the socket→terminal tracking so a closed terminal's
  stamp does not leak or mislead a later lookup.
