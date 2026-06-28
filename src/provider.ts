import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export interface DtachSession {
  name: string;
  socket: string;
  mtimeMs: number;
}

/** Expand a leading ~ to the home directory. */
export function expandHome(p: string): string {
  if (p === '~') {
    return os.homedir();
  }
  if (p.startsWith('~/')) {
    return path.join(os.homedir(), p.slice(2));
  }
  return p;
}

export interface DtachConfig {
  socketDir: string;
  socketPrefix: string;
  redrawMethod: string;
  dtachPath: string;
  startupCommand: string;
}

export function config(): DtachConfig {
  const c = vscode.workspace.getConfiguration('dtachSessions');
  return {
    socketDir: expandHome(c.get<string>('socketDir', '~/.dtach-sessions')),
    socketPrefix: c.get<string>('socketPrefix', ''),
    redrawMethod: c.get<string>('redrawMethod', 'winch'),
    dtachPath: c.get<string>('dtachPath', 'dtach'),
    startupCommand: c.get<string>('startupCommand', ''),
  };
}

/**
 * Strip the configured prefix, the trailing '.dtach', and a trailing '_<hash>'
 * (6 hex chars assigned at create) from a socket basename. Legacy sockets with
 * no hash simply skip the last step.
 */
export function displayName(socketBasename: string, socketPrefix: string): string {
  let s = socketBasename.startsWith(socketPrefix)
    ? socketBasename.slice(socketPrefix.length)
    : socketBasename.replace(/^\./, '');
  s = s.replace(/\.dtach$/, '');
  return s.replace(/_[0-9a-f]{6}$/, '');
}

/** Extract the rename-invariant hash from a socket basename, if present. */
export function hashOf(socketBasename: string): string | undefined {
  const m = socketBasename.replace(/\.dtach$/, '').match(/_([0-9a-f]{6})$/);
  return m ? m[1] : undefined;
}

/** Extract the dtach socket path from a terminal's launch args, if present. */
export function socketFromTerminal(t: vscode.Terminal): string | undefined {
  const args = (t.creationOptions as vscode.TerminalOptions).shellArgs;
  if (Array.isArray(args)) {
    return args.find((a): a is string => typeof a === 'string' && a.endsWith('.dtach'));
  }
  return undefined;
}

/**
 * Find an open terminal attached to the given session. Queried live from
 * vscode.window.terminals (not an in-memory map) so it survives a window reload,
 * which restores terminals but restarts the extension host.
 */
export function findTerminalForSocket(session: { name: string; socket: string }): vscode.Terminal | undefined {
  for (const t of vscode.window.terminals) {
    const sock = socketFromTerminal(t);
    if (sock === session.socket) {
      return t;
    }
    // A restored terminal may not expose shellArgs after reload; fall back to
    // the name we assigned it (the session display name).
    if (sock === undefined && t.name === session.name) {
      return t;
    }
  }
  return undefined;
}

/** A compact relative age such as "2h ago" derived from a mtime. */
function relativeAge(mtimeMs: number): string {
  const secs = Math.max(0, Math.floor((Date.now() - mtimeMs) / 1000));
  if (secs < 60) {
    return `${secs}s ago`;
  }
  const mins = Math.floor(secs / 60);
  if (mins < 60) {
    return `${mins}m ago`;
  }
  const hours = Math.floor(mins / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  return `${Math.floor(hours / 24)}d ago`;
}

export class SessionItem extends vscode.TreeItem {
  constructor(public readonly session: DtachSession, attachedIcon?: vscode.Uri) {
    super(session.name, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'dtachSession';
    const attached = findTerminalForSocket(session) !== undefined;
    const age = relativeAge(session.mtimeMs);
    this.description = attached ? `attached · ${age}` : age;
    this.tooltip = `${session.socket}\nlast modified ${age}${attached ? '\nattached in this window' : ''}`;
    // Mark sessions attached in this window with a green terminal icon so the list
    // reads as a live dashboard. Use a baked-green SVG rather than a codicon +
    // ThemeColor: VS Code recolours codicons to the selection foreground when the
    // row is selected, which would wash the green out; an image icon keeps its
    // colour in selected and inactive-selected states.
    this.iconPath = attached
      ? attachedIcon ?? new vscode.ThemeIcon('terminal', new vscode.ThemeColor('charts.green'))
      : new vscode.ThemeIcon('terminal');
    this.command = {
      command: 'dtachSessions.attach',
      title: 'Attach',
      arguments: [session],
    };
  }
}

export class DtachTreeProvider implements vscode.TreeDataProvider<SessionItem> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private readonly attachedIcon?: vscode.Uri;

  constructor(extensionUri?: vscode.Uri) {
    this.attachedIcon = extensionUri
      ? vscode.Uri.joinPath(extensionUri, 'media', 'terminal-green.svg')
      : undefined;
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: SessionItem): vscode.TreeItem {
    return element;
  }

  getChildren(): SessionItem[] {
    return this.listSessions().map((s) => new SessionItem(s, this.attachedIcon));
  }

  /**
   * List sockets in the configured directory: entries matching the prefix that
   * end in `.dtach` and are actually sockets, newest (by mtime) first.
   */
  listSessions(): DtachSession[] {
    const { socketDir, socketPrefix } = config();
    let entries: string[];
    try {
      entries = fs.readdirSync(socketDir);
    } catch (err) {
      // A not-yet-created socket directory is normal (e.g. first run before any
      // session exists) — show nothing rather than an error. Surface real
      // failures such as permission errors.
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      vscode.window.showErrorMessage(
        `dtach Sessions: cannot read socket directory ${socketDir}: ${(err as Error).message}`
      );
      return [];
    }
    const sessions: DtachSession[] = [];
    for (const f of entries) {
      if (!f.startsWith(socketPrefix) || !f.endsWith('.dtach')) {
        continue;
      }
      const socket = path.join(socketDir, f);
      let st: fs.Stats;
      try {
        st = fs.statSync(socket);
      } catch {
        continue;
      }
      if (!st.isSocket()) {
        continue;
      }
      sessions.push({ name: displayName(f, socketPrefix), socket, mtimeMs: st.mtimeMs });
    }
    return sessions.sort((a, b) => b.mtimeMs - a.mtimeMs);
  }
}
