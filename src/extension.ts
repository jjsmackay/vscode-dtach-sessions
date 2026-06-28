import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { exec } from 'child_process';
import {
  DtachTreeProvider,
  DtachSession,
  SessionItem,
  config,
  findTerminalForSocket,
  registerTerminal,
  unregisterTerminal,
  rekeyTerminal,
  hashOf,
} from './provider';

const SHELL = process.env.SHELL || '/bin/bash';

// Used to relabel the dtach process via `exec -a` (a bash builtin) so the tab's
// fallback name reads the session, not "dtach". Absent on some minimal hosts;
// we fall back to launching dtach directly there.
const HAS_BASH = fs.existsSync('/bin/bash');

// Persisted socket -> pid map. Survives a window reload (which strips a restored
// terminal's shellArgs but keeps its pid) and is rebuilt into the in-memory
// reattach registry on activate. Lives in workspaceState — per-window, no need
// to outlast a full editor restart, which does not restore terminals anyway.
const PID_MAP_KEY = 'dtachSessions.socketPids';
let mementoState: vscode.Memento | undefined;

function pidMap(): Record<string, number> {
  return mementoState?.get<Record<string, number>>(PID_MAP_KEY, {}) ?? {};
}

/** Read-modify-write the persisted socket->pid map: set a pid, or clear it (pid null). */
function updatePidMap(socket: string, pid: number | null): void {
  if (!mementoState) {
    return;
  }
  const map = pidMap();
  if (pid === null) {
    delete map[socket];
  } else {
    map[socket] = pid;
  }
  void mementoState.update(PID_MAP_KEY, map);
}

function persistPid(socket: string, term: vscode.Terminal): void {
  void term.processId.then((pid) => {
    if (pid) {
      updatePidMap(socket, pid);
    }
  });
}

function dropPid(socket: string): void {
  updatePidMap(socket, null);
}

/** Record a freshly created terminal for reattach: in-memory registry + persisted pid. */
function trackTerminal(socket: string, term: vscode.Terminal): void {
  registerTerminal(socket, term);
  persistPid(socket, term);
}

/**
 * Rebuild the reattach registry after a window reload. Restored terminals have
 * lost their shellArgs but kept their processId, so match live terminals' pids
 * against the persisted socket->pid map; prune entries whose terminal is gone.
 */
async function reconcileTerminals(provider: DtachTreeProvider): Promise<void> {
  if (!mementoState) {
    return;
  }
  const byPid = new Map<number, string>();
  for (const [socket, pid] of Object.entries(pidMap())) {
    byPid.set(pid, socket);
  }
  const terminals = vscode.window.terminals;
  const pids = await Promise.all(terminals.map((t) => t.processId));
  const survivors: Record<string, number> = {};
  terminals.forEach((t, i) => {
    const pid = pids[i];
    if (pid && byPid.has(pid)) {
      const socket = byPid.get(pid)!;
      registerTerminal(socket, t);
      survivors[socket] = pid;
    }
  });
  await mementoState.update(PID_MAP_KEY, survivors);
  provider.refresh();
}

function redrawArgs(redraw: string): string[] {
  return redraw && redraw !== 'none' ? ['-r', redraw] : [];
}

/** Single-quote a string for safe use inside a shell command. */
function shellEscape(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

/** Escape regex metacharacters so a path matches literally in pgrep -f. */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** A fresh 6-hex-char rename-invariant session id. */
function sessionHash(): string {
  return crypto.randomBytes(3).toString('hex');
}

/**
 * dtach creates the socket file asynchronously after its process starts, so an
 * immediate refresh misses it. Poll briefly until the socket appears, then
 * refresh; give up (and refresh anyway) after ~3s.
 */
function refreshWhenReady(provider: DtachTreeProvider, socket: string): void {
  let tries = 0;
  const tick = (): void => {
    if (fs.existsSync(socket) || ++tries >= 15) {
      provider.refresh();
      return;
    }
    setTimeout(tick, 200);
  };
  tick();
}

/**
 * Show the terminal already attached to this session if one is open; otherwise
 * launch a fresh dtach terminal with the given args. Returns the new terminal,
 * or undefined when an existing one was reused.
 */
function showOrCreateTerminal(
  session: { name: string; socket: string },
  args: string[],
  dtachPath: string,
  cwd?: string
): vscode.Terminal | undefined {
  const existing = findTerminalForSocket(session);
  if (existing) {
    existing.show();
    return undefined;
  }
  // With reflectProcessTitle off, pin the session name as the tab title.
  //
  // With it on, omit the API name so the attached program's title drives the tab
  // (VS Code honours an escape-set title only from a process it detects as an
  // agent CLI, so we cannot seed one ourselves — the shell/dtach would be
  // ignored). Until the program emits its title, VS Code falls back to the
  // process name, which is "dtach". So launch dtach with argv[0] set to the
  // session name via bash `exec -a` (VS Code reads argv[0] for that fallback):
  // the tab reads the session name instead of "dtach", and the program's own
  // title takes over once it sets one. The socket stays a standalone, dtach
  // arg so socketFromTerminal still matches it. Where bash is unavailable we
  // launch dtach directly and accept the "dtach" fallback.
  const reflect = config().reflectProcessTitle;
  let options: vscode.TerminalOptions;
  if (!reflect) {
    options = { name: session.name, shellPath: dtachPath, shellArgs: args, cwd };
  } else if (HAS_BASH) {
    options = {
      shellPath: '/bin/bash',
      shellArgs: ['-c', 'exec -a "$0" "$@"', session.name, dtachPath, ...args],
      cwd,
    };
  } else {
    options = { shellPath: dtachPath, shellArgs: args, cwd };
  }
  const term = vscode.window.createTerminal(options);
  trackTerminal(session.socket, term);
  term.show();
  return term;
}

function attach(session: { name: string; socket: string }): void {
  const { redrawMethod, dtachPath } = config();
  const args = ['-a', session.socket, ...redrawArgs(redrawMethod)];
  showOrCreateTerminal(session, args, dtachPath);
}

/** Turn an arbitrary string (e.g. a folder name) into a valid session name. */
function sanitizeName(raw: string): string {
  return raw.trim().replace(/[/\s]+/g, '-');
}

/** Return `base`, or `base-2`, `base-3`, ... — the first display name that is free. */
function uniqueName(existing: Set<string>, base: string): string {
  if (!existing.has(base)) {
    return base;
  }
  let n = 2;
  while (existing.has(`${base}-${n}`)) {
    n++;
  }
  return `${base}-${n}`;
}

/** Shared input validation for create and rename. */
function validateName(value: string, taken?: Set<string>): string | undefined {
  if (value.trim().length === 0) {
    return 'Name cannot be empty';
  }
  if (/[/\s]/.test(value)) {
    return 'Name cannot contain slashes or whitespace';
  }
  if (taken?.has(value)) {
    return `A session named "${value}" already exists`;
  }
  return undefined;
}

/**
 * Create a new session named `name` with a fresh hash id and launch it with
 * `dtach -A`. `cwd` sets the shell's working directory. Runs the configured
 * startup command in the new terminal. Returns false if the socket dir can't be made.
 */
function createSession(provider: DtachTreeProvider, name: string, cwd?: string): boolean {
  const { socketDir, socketPrefix, redrawMethod, dtachPath, startupCommand } = config();
  try {
    fs.mkdirSync(socketDir, { recursive: true });
  } catch (err) {
    vscode.window.showErrorMessage(
      `dtach Sessions: cannot create socket directory ${socketDir}: ${(err as Error).message}`
    );
    return false;
  }
  // Embed a rename-invariant hash; regenerate on the rare same-name collision.
  let socket: string;
  do {
    socket = path.join(socketDir, `${socketPrefix}${name}_${sessionHash()}.dtach`);
  } while (fs.existsSync(socket));
  const args = ['-A', socket, ...redrawArgs(redrawMethod), SHELL];
  const term = showOrCreateTerminal({ name, socket }, args, dtachPath, cwd);
  if (term) {
    if (startupCommand) {
      term.sendText(startupCommand, true);
    }
    refreshWhenReady(provider, socket);
  }
  return true;
}

/** The "+" command: prompt for a name and create a new session (display-name deduped). */
async function create(provider: DtachTreeProvider): Promise<void> {
  const taken = new Set(provider.listSessions().map((s) => s.name));
  const name = await vscode.window.showInputBox({
    prompt: 'New dtach session name',
    validateInput: (value) => validateName(value),
  });
  if (!name) {
    return;
  }
  // Create always makes a NEW session: if the display name is taken, bump a digit
  // so the tree never shows two identical labels.
  const finalName = uniqueName(taken, name);
  if (createSession(provider, finalName) && finalName !== name) {
    vscode.window.showInformationMessage(
      `dtach Sessions: "${name}" already exists; created "${finalName}".`
    );
  }
}

/**
 * Explorer right-click "Open in Detach Session": open the session for this
 * folder (named after it), attaching to an existing one if present, otherwise
 * creating it with the shell rooted in that folder.
 */
async function openInFolder(provider: DtachTreeProvider, uri?: vscode.Uri): Promise<void> {
  if (!uri) {
    await create(provider);
    return;
  }
  const name = sanitizeName(path.basename(uri.fsPath));
  const existing = provider.listSessions().filter((s) => s.name === name);
  if (existing.length) {
    attach(existing[0]); // listSessions is newest-first; reuse the most recent
  } else {
    createSession(provider, name, uri.fsPath);
  }
}

/** Rename a session: move the socket (hash preserved) and relabel any open terminal. */
async function rename(provider: DtachTreeProvider, session: DtachSession): Promise<void> {
  const hash = hashOf(path.basename(session.socket));
  if (!hash) {
    vscode.window.showInformationMessage(
      'dtach Sessions: this session has no id in its socket name and cannot be safely renamed. Kill and recreate it instead.'
    );
    return;
  }
  const { socketDir, socketPrefix, redrawMethod, dtachPath, reflectProcessTitle } = config();
  const others = new Set(
    provider.listSessions().filter((s) => s.socket !== session.socket).map((s) => s.name)
  );
  const newName = await vscode.window.showInputBox({
    prompt: 'Rename dtach session',
    value: session.name,
    validateInput: (value) => validateName(value, others),
  });
  if (!newName || newName === session.name) {
    return;
  }
  const newSocket = path.join(socketDir, `${socketPrefix}${newName}_${hash}.dtach`);
  if (fs.existsSync(newSocket)) {
    vscode.window.showErrorMessage(`dtach Sessions: ${newSocket} already exists.`);
    return;
  }
  const term = findTerminalForSocket(session);
  try {
    fs.renameSync(session.socket, newSocket);
  } catch (err) {
    vscode.window.showErrorMessage(
      `dtach Sessions: rename failed: ${(err as Error).message}`
    );
    return;
  }
  if (term) {
    if (reflectProcessTitle) {
      // The live attach survives the socket move — the unix-socket connection is
      // held by inode, not path — and there is no pinned tab name to rebuild, so
      // just re-point our tracking at the new socket. No dispose/reattach flash.
      rekeyTerminal(session.socket, newSocket);
      dropPid(session.socket);
      persistPid(newSocket, term);
    } else {
      // VS Code has no terminal-rename API; dispose and reattach under the new
      // name (the close handler untracks the old terminal).
      term.dispose();
      showOrCreateTerminal(
        { name: newName, socket: newSocket },
        ['-a', newSocket, ...redrawArgs(redrawMethod)],
        dtachPath
      );
    }
  }
  provider.refresh();
}

/** Close this window's terminal for a session without killing the dtach server. */
function detach(session: DtachSession): void {
  findTerminalForSocket(session)?.dispose();
}

/** Command-palette quick-switch: pick a session and attach it. */
async function quickSwitch(provider: DtachTreeProvider): Promise<void> {
  const sessions = provider.listSessions();
  if (!sessions.length) {
    vscode.window.showInformationMessage('dtach Sessions: no sessions.');
    return;
  }
  const pick = await vscode.window.showQuickPick(
    sessions.map((s) => ({ label: s.name, session: s })),
    { placeHolder: 'Attach dtach session' }
  );
  if (pick) {
    attach(pick.session);
  }
}

function copySocketPath(session: DtachSession): void {
  vscode.env.clipboard.writeText(session.socket);
  vscode.window.showInformationMessage(`dtach Sessions: copied socket path for "${session.name}".`);
}

function copyAttachCommand(session: DtachSession): void {
  const { redrawMethod, dtachPath } = config();
  const cmd = [dtachPath, '-a', session.socket, ...redrawArgs(redrawMethod)].join(' ');
  vscode.env.clipboard.writeText(cmd);
  vscode.window.showInformationMessage(`dtach Sessions: copied attach command for "${session.name}".`);
}

/**
 * Shell snippet that prints the pids holding a session's socket — the dtach
 * master plus any attached clients. Resolved by lsof on the current path,
 * falling back to a pgrep on the hash anchor (rename-safe), or the escaped full
 * path for legacy hashless sockets. Shared by killOne (which kills them) and
 * sessionCwd (which walks the master to its shell).
 */
function resolvePidsCommand(session: DtachSession): string {
  const sock = shellEscape(session.socket);
  const hash = hashOf(path.basename(session.socket));
  const fallback = hash
    ? `pgrep -f ${shellEscape(`_${hash}\\.dtach`)}`
    : `pgrep -f ${shellEscape(escapeRegex(session.socket))}`;
  return `lsof -t ${sock} 2>/dev/null || ${fallback} 2>/dev/null`;
}

/**
 * Terminate one session's dtach server and remove its socket. The owning process
 * is resolved by resolvePidsCommand (lsof, falling back to a rename-safe pgrep).
 */
async function killOne(session: DtachSession): Promise<void> {
  const sock = shellEscape(session.socket);
  const cmd =
    `pids=$(${resolvePidsCommand(session)}); ` +
    `[ -n "$pids" ] && kill $pids 2>/dev/null; ` +
    `rm -f ${sock}`;

  await new Promise<void>((resolve) => {
    exec(cmd, (err) => {
      if (err) {
        vscode.window.showErrorMessage(
          `dtach Sessions: kill failed for ${session.name}: ${err.message}`
        );
      }
      resolve();
    });
  });

  // Close the now-dead terminal so a stale tab does not linger.
  findTerminalForSocket(session)?.dispose();
}

/** Kill one or more selected sessions behind a single confirmation. */
async function killSelected(provider: DtachTreeProvider, sessions: DtachSession[]): Promise<void> {
  if (!sessions.length) {
    return;
  }
  const msg =
    sessions.length === 1
      ? `Kill dtach session "${sessions[0].name}"? This terminates the session and removes its socket.`
      : `Kill ${sessions.length} dtach sessions? This terminates them and removes their sockets.`;
  const choice = await vscode.window.showWarningMessage(msg, { modal: true }, 'Kill');
  if (choice !== 'Kill') {
    return;
  }
  for (const s of sessions) {
    await killOne(s);
  }
  provider.refresh();
}

/** Kill every listed session. */
async function killAll(provider: DtachTreeProvider): Promise<void> {
  const sessions = provider.listSessions();
  if (!sessions.length) {
    vscode.window.showInformationMessage('dtach Sessions: no sessions to kill.');
    return;
  }
  const choice = await vscode.window.showWarningMessage(
    `Kill all ${sessions.length} dtach sessions? This terminates them and removes their sockets.`,
    { modal: true },
    'Kill All'
  );
  if (choice !== 'Kill All') {
    return;
  }
  for (const s of sessions) {
    await killOne(s);
  }
  provider.refresh();
}

/**
 * Best-effort working directory of a session's shell, so a restart can reopen
 * there rather than at $HOME. The processes holding the socket are the dtach
 * master plus any attached clients (same set killOne resolves); only the master
 * has a child (the shell), so find that child and read its cwd via lsof. Returns
 * undefined when it can't be determined (no proc found, lsof missing, etc.).
 */
function sessionCwd(session: DtachSession): Promise<string | undefined> {
  const cmd =
    `pids=$(${resolvePidsCommand(session)}); ` +
    `for p in $pids; do ` +
    `c=$(pgrep -P "$p" 2>/dev/null | head -1); ` +
    `if [ -n "$c" ]; then ` +
    `lsof -a -p "$c" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -1; break; ` +
    `fi; done`;
  return new Promise((resolve) => {
    exec(cmd, (_err, stdout) => {
      const dir = stdout.trim();
      resolve(dir.length ? dir : undefined);
    });
  });
}

/**
 * Restart a session in place: terminate the dtach server (and dispose its dead
 * terminal), then create a fresh session under the same name, reopening in the
 * old shell's working directory when it can be resolved. Goes through
 * createSession, so it mints a new hash, opens a new terminal, and runs the
 * configured startupCommand — exactly as a create would. Confirmed first, since
 * it destroys whatever the session was running.
 */
async function restart(provider: DtachTreeProvider, session: DtachSession): Promise<void> {
  const choice = await vscode.window.showWarningMessage(
    `Restart dtach session "${session.name}"? This terminates the running session and starts a fresh shell.`,
    { modal: true },
    'Restart'
  );
  if (choice !== 'Restart') {
    return;
  }
  const cwd = await sessionCwd(session); // capture before kill; the proc is gone after
  await killOne(session); // remove the old socket first so the name is free to reuse
  createSession(provider, session.name, cwd);
  provider.refresh();
}

/** Resolve a command argument (a tree node or session) to a DtachSession. */
function toSession(item: SessionItem | DtachSession): DtachSession {
  return item instanceof SessionItem ? item.session : item;
}

export function activate(context: vscode.ExtensionContext): void {
  mementoState = context.workspaceState;
  const provider = new DtachTreeProvider(context.extensionUri);
  const view = vscode.window.createTreeView('dtachSessionsView', {
    treeDataProvider: provider,
    canSelectMany: true,
  });

  // Rebuild the reattach registry from the persisted pid map for terminals that
  // a window reload restored before this activation.
  void reconcileTerminals(provider);

  context.subscriptions.push(
    view,
    view.onDidChangeVisibility((e) => {
      if (e.visible) {
        provider.refresh();
      }
    }),
    // Keep the attached-state icon honest: re-render when a terminal opens
    // (attach), closes, or is disposed (detach, kill, rename).
    vscode.window.onDidOpenTerminal(() => provider.refresh()),
    vscode.window.onDidCloseTerminal((t) => {
      const socket = unregisterTerminal(t);
      if (socket) {
        dropPid(socket);
      }
      provider.refresh();
    }),
    vscode.commands.registerCommand('dtachSessions.refresh', () => provider.refresh()),
    vscode.commands.registerCommand('dtachSessions.create', () => create(provider)),
    vscode.commands.registerCommand('dtachSessions.openInFolder', (uri?: vscode.Uri) =>
      openInFolder(provider, uri)
    ),
    vscode.commands.registerCommand('dtachSessions.attach', (item: SessionItem | DtachSession) =>
      attach(toSession(item))
    ),
    vscode.commands.registerCommand('dtachSessions.rename', (item: SessionItem | DtachSession) =>
      rename(provider, toSession(item))
    ),
    vscode.commands.registerCommand('dtachSessions.detach', (item: SessionItem | DtachSession) =>
      detach(toSession(item))
    ),
    vscode.commands.registerCommand('dtachSessions.restart', (item: SessionItem | DtachSession) =>
      restart(provider, toSession(item))
    ),
    vscode.commands.registerCommand('dtachSessions.quickSwitch', () => quickSwitch(provider)),
    vscode.commands.registerCommand('dtachSessions.copySocketPath', (item: SessionItem | DtachSession) =>
      copySocketPath(toSession(item))
    ),
    vscode.commands.registerCommand('dtachSessions.copyAttachCommand', (item: SessionItem | DtachSession) =>
      copyAttachCommand(toSession(item))
    ),
    vscode.commands.registerCommand(
      'dtachSessions.kill',
      (item: SessionItem | DtachSession, items?: SessionItem[]) => {
        const selection = items && items.length ? items : [item];
        return killSelected(provider, selection.map(toSession));
      }
    ),
    vscode.commands.registerCommand('dtachSessions.killAll', () => killAll(provider))
  );
}

export function deactivate(): void {
  // no-op
}
