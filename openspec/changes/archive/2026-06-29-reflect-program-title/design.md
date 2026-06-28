## Context

The extension attaches to dtach sessions in ordinary integrated terminals (pure passthrough — no webview or PTY proxy). It currently pins each terminal's tab title by passing `name: <session display name>` to `vscode.window.createTerminal`.

Agent CLIs such as Claude Code continuously set the terminal title via an OSC window-title escape sequence (`ESC ] 2 ; <title> BEL`), leading with a status glyph. A spike confirmed the full chain:

1. **dtach relays the sequence intact.** Emitting `ESC]2;✶ …BEL` inside a detached session and attaching with `dtach -a … -r winch` reproduced the exact bytes — emoji and BEL included — on the client side. dtach is not an obstacle.
2. **A pinned API `name` suppresses it.** With the extension's `name` set, the tab showed the session name regardless of `terminal.integrated.tabs.title: "${sequence}"` or `terminal.integrated.tabs.allowAgentCliTitle: true`. VS Code's "Api" title source outranks the program/sequence title; no template or setting overrode it.
3. **Omitting `name` works.** A terminal created without an API name showed the program's live title through a dtach attach.
4. **Reload behaviour.** A window reload restarts the extension host and restores terminals, but a restored terminal loses `creationOptions.shellArgs` and `shellPath`, keeping only `name` and `processId`. `processId` was stable across reload for every dtach terminal tested (identical pids before and after).

Today's reuse lookup (`findTerminalForSocket`) matches a terminal to a session by its `shellArgs` socket, falling back to `terminal.name`. That name fallback exists precisely because `shellArgs` does not survive reload. Dropping the name to surface the program title therefore removes the only post-reload match key — unless we replace it.

## Goals / Non-Goals

**Goals:**
- Let the attached program's title drive the tab when desired, with no hook, sidecar, statusline, or PTY proxy.
- Keep reuse / focus-existing / attached-state working across a window reload regardless of whether a `name` is set.
- Make the behaviour configurable, defaulting to reflecting the program title.

**Non-Goals:**
- Parsing or interpreting the program's title (no OSC parsing in the extension — VS Code renders it).
- Showing agent state in the sidebar row (the separate "sidecar" idea; out of scope here).
- Changing the dtach invocation or the passthrough model.
- Persisting associations across full editor restarts (only window reload, which is what restores terminals).

## Decisions

**D1 — Reflect the program title by omitting the API `name` (toggle, default on).**
Add `dtachSessions.reflectProcessTitle` (boolean, default `true`). When `true`, attach/create pass no `name`; when `false`, they pass the session display name as today. Chosen over: (a) `terminal.integrated.tabs.title: "${sequence}"` — rejected, the spike showed the Api source still wins; (b) a custom title sequence — we don't control the program. Omitting the name is the only mechanism that works, and it is one conditional at the createTerminal call sites.

**D2 — Reattach via a persisted `socket → processId` map in `workspaceState`.**
At attach/create, `await terminal.processId` and store it keyed by socket. `findTerminalForSocket` matches by `shellArgs` first (valid pre-reload), then by comparing each live terminal's `processId` against the stored map (valid post-reload). The pid is the only identifier that both survives reload and is independent of the name. Chosen over keeping the name-as-key: that key disappears precisely in the reflect-on case we want. `workspaceState` (not `globalState`) because terminals are per-window and only need to survive reload, not editor restart.

**D3 — Keep the name fallback only when `reflectProcessTitle` is `false`.**
When the name is pinned, `terminal.name === display name` remains a valid extra fallback and is cheap to keep. When reflecting, that branch can never match and is skipped.

**D4 — Clean up the map on terminal close.**
`onDidCloseTerminal` removes the association for the closed terminal so stale pids cannot mis-match a future terminal (pid reuse by the OS).

**D5 — Rename flow simplifies.**
Rename currently disposes and recreates the terminal solely to relabel the tab (VS Code has no rename API). With `reflectProcessTitle` on there is no tab label to maintain, so the recreate-for-relabel step is unnecessary; rename only needs to re-point the attach at the moved socket (the hash is preserved). When the toggle is off, the existing dispose+recreate-with-new-name behaviour is retained.

## Risks / Trade-offs

- **Plain-shell sessions lose the session name on the tab when reflecting.** → The sidebar row remains the stable identity surface; users who prefer the name on the tab set `reflectProcessTitle: false`.
- **OS pid reuse could mis-match a session to an unrelated terminal.** → Match `shellArgs` first (authoritative when present); only fall back to the pid map for terminals with no `shellArgs` (i.e. restored ones); remove entries on close so the map stays small and current.
- **`processId` is a `Thenable` resolved asynchronously.** → Record it with `await` at attach/create; lookups already tolerate an unmatched terminal (treated as not-attached) so a not-yet-resolved pid degrades gracefully to "create new", never to a wrong match.
- **Association does not survive a full editor restart** (only reload). → Acceptable: a full restart does not restore terminals either, so there is nothing to reuse.

## Open Questions

- None blocking. Default is `reflectProcessTitle: true`; revisit if plain-shell users find losing the tab name disruptive.
