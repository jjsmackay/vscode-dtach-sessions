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
  hashOf,
} from './provider';

const SHELL = process.env.SHELL || '/bin/bash';

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
  const term = vscode.window.createTerminal({
    name: session.name,
    shellPath: dtachPath,
    shellArgs: args,
    cwd,
  });
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
  const { socketDir, socketPrefix, redrawMethod, dtachPath } = config();
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
  // VS Code has no terminal-rename API; dispose and reattach under the new name.
  if (term) {
    term.dispose();
    showOrCreateTerminal(
      { name: newName, socket: newSocket },
      ['-a', newSocket, ...redrawArgs(redrawMethod)],
      dtachPath
    );
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
 * Terminate one session's dtach server and remove its socket. The owning process
 * is resolved by lsof on the current path, falling back to a pgrep on the hash
 * anchor (rename-safe), or the escaped full path for legacy hashless sockets.
 */
async function killOne(session: DtachSession): Promise<void> {
  const sock = shellEscape(session.socket);
  const hash = hashOf(path.basename(session.socket));
  const fallback = hash
    ? `pgrep -f ${shellEscape(`_${hash}\\.dtach`)}`
    : `pgrep -f ${shellEscape(escapeRegex(session.socket))}`;
  const cmd =
    `pids=$(lsof -t ${sock} 2>/dev/null || ${fallback} 2>/dev/null); ` +
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

/** Resolve a command argument (a tree node or session) to a DtachSession. */
function toSession(item: SessionItem | DtachSession): DtachSession {
  return item instanceof SessionItem ? item.session : item;
}

export function activate(context: vscode.ExtensionContext): void {
  const provider = new DtachTreeProvider(context.extensionUri);
  const view = vscode.window.createTreeView('dtachSessionsView', {
    treeDataProvider: provider,
    canSelectMany: true,
  });

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
    vscode.window.onDidCloseTerminal(() => provider.refresh()),
    vscode.commands.registerCommand('dtachSessions.refresh', () => provider.refresh()),
    vscode.commands.registerCommand('dtachSessions.create', () => create(provider)),
    vscode.commands.registerCommand('dtachSessions.openInFolder', (uri?: vscode.Uri) =>
      openInFolder(provider, uri)
    ),
    vscode.commands.registerCommand('dtachSessions.attach', (s: DtachSession) => attach(s)),
    vscode.commands.registerCommand('dtachSessions.rename', (item: SessionItem | DtachSession) =>
      rename(provider, toSession(item))
    ),
    vscode.commands.registerCommand('dtachSessions.detach', (item: SessionItem | DtachSession) =>
      detach(toSession(item))
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
