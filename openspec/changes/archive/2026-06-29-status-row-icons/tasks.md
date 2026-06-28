## 1. Icon assets

- [x] 1.1 Add `media/state-waiting.svg` — an amber (`#D29922`) **bell** glyph, 16×16, `fill="none"`, single stroke, round caps/joins (match `media/terminal-green.svg`). Eyeball against light and dark themes. (working/tool needs no asset — it uses the built-in `loading~spin` codicon.)

  Starting point:
  ```svg
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
    <g fill="none" stroke="#D29922" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">
      <path d="M8 2.5a3.5 3.5 0 0 0-3.5 3.5c0 3-1.5 4-1.5 4h10s-1.5-1-1.5-4A3.5 3.5 0 0 0 8 2.5z"/>
      <path d="M6.75 12.5a1.25 1.25 0 0 0 2.5 0"/>
    </g>
  </svg>
  ```

## 2. Single effective-state source

- [x] 2.1 In `src/provider.ts`, factor the decay out of `statusLabel` into `effectiveState(status): SessionState | undefined` (undefined for idle / no-status / decayed transient).
- [x] 2.2 Reimplement `statusLabel` to consume `effectiveState` so behaviour is unchanged.

## 3. Icon selection

- [x] 3.1 Wire the new waiting SVG `Uri` through `DtachTreeProvider` alongside the existing `attachedIcon`.
- [x] 3.2 In `SessionItem`, pick `iconPath` from the effective state: working/tool → `new vscode.ThemeIcon('loading~spin')`; waiting → waiting SVG; idle/none → existing attached-green / plain terminal. Pass the effective state (or chosen icon) in rather than recomputing, so it agrees with the badge.

## 4. Activity-relative time

- [x] 4.1 Pass the matched `SessionStatus` (with `ts`) into `SessionItem`, not just the badge string, so the description can compute the time from it.
- [x] 4.2 In `SessionItem`, compute the trailing relative time from `status.ts` (`relativeAge(status.ts)`) when a status exists, else from `session.mtimeMs` as today. Keep the badge composition (`<badge> · <attached> · <time>`).

## 5. Docs

- [x] 5.1 Update `README.md` (icon mapping — spinner = busy, amber bell = waiting, terminal = idle/attach — and that the row time is now activity-relative when status exists) and the `## Gotchas` note in `CLAUDE.md` (working = `loading~spin` codicon since motion not colour is the cue, so it sidesteps the selection-wash; waiting = baked amber SVG; one effective state drives icon + text + time source).

## 6. Verify

- [x] 6.1 `npm run compile` cleanly.
- [x] 6.2 Package and load the build; confirm: a working/tool session shows an **animated spinner** + text badge; a waiting session shows the amber bell; an idle/no-status session shows the green (attached) or plain terminal icon; the waiting colour survives selecting the row; a decayed `working` stops the spinner and reverts to idle/age. Note whether `loading~spin` actually animates in the tree (vs static loading glyph).
- [x] 6.3 Confirm the row time is activity-relative: a working session's time tracks time-in-state; a session with status shows time since its last event (not socket mtime); a session with no status still shows mtime age.
