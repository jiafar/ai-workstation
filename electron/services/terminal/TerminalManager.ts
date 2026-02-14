import * as pty from 'node-pty';
import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';
import { config } from '../../utils/config';

export interface TerminalOptions {
  cwd?: string;
  shell?: string;
  env?: Record<string, string>;
  cols?: number;
  rows?: number;
}

export interface TerminalInfo {
  id: string;
  pid: number;
  cwd: string;
  shell: string;
  cols: number;
  rows: number;
  createdAt: number;
}

class TerminalManager extends EventEmitter {
  private static instance: TerminalManager;
  private terminals: Map<string, pty.IPty>;
  private terminalInfo: Map<string, TerminalInfo>;

  private constructor() {
    super();
    this.terminals = new Map();
    this.terminalInfo = new Map();
    logger.info('TerminalManager initialized');
  }

  static getInstance(): TerminalManager {
    if (!TerminalManager.instance) {
      TerminalManager.instance = new TerminalManager();
    }
    return TerminalManager.instance;
  }

  /**
   * Create a new terminal session
   */
  create(id: string, options: TerminalOptions = {}): TerminalInfo {
    if (this.terminals.has(id)) {
      logger.warn(`Terminal with id ${id} already exists`);
      throw new Error(`Terminal with id ${id} already exists`);
    }

    try {
      const terminalConfig = config.get('terminal');
      const shell = options.shell || terminalConfig.defaultShell;
      const cwd = options.cwd || process.env.HOME || process.cwd();
      const cols = options.cols || 80;
      const rows = options.rows || 24;

      // Merge environment variables
      const env = {
        ...process.env,
        ...options.env,
      };

      // Create the pty process
      const terminal = pty.spawn(shell, [], {
        name: 'xterm-color',
        cols,
        rows,
        cwd,
        env: env as { [key: string]: string },
      });

      // Store terminal
      this.terminals.set(id, terminal);

      // Store terminal info
      const info: TerminalInfo = {
        id,
        pid: terminal.pid,
        cwd,
        shell,
        cols,
        rows,
        createdAt: Date.now(),
      };
      this.terminalInfo.set(id, info);

      // Set up data handler
      terminal.onData((data) => {
        this.emit('data', id, data);
      });

      // Set up exit handler
      terminal.onExit(({ exitCode, signal }) => {
        logger.info(`Terminal ${id} exited`, { exitCode, signal });
        this.emit('exit', id, exitCode, signal);
        this.terminals.delete(id);
        this.terminalInfo.delete(id);
      });

      logger.info(`Terminal created`, {
        id,
        pid: terminal.pid,
        shell,
        cwd,
      });

      return info;
    } catch (error) {
      logger.error(`Failed to create terminal ${id}`, error);
      throw error;
    }
  }

  /**
   * Write data to a terminal
   */
  write(id: string, data: string): void {
    const terminal = this.terminals.get(id);
    if (!terminal) {
      logger.warn(`Terminal ${id} not found`);
      throw new Error(`Terminal ${id} not found`);
    }

    try {
      terminal.write(data);
      logger.debug(`Wrote data to terminal ${id}`, { length: data.length });
    } catch (error) {
      logger.error(`Failed to write to terminal ${id}`, error);
      throw error;
    }
  }

  /**
   * Resize a terminal
   */
  resize(id: string, cols: number, rows: number): void {
    const terminal = this.terminals.get(id);
    if (!terminal) {
      logger.warn(`Terminal ${id} not found`);
      throw new Error(`Terminal ${id} not found`);
    }

    try {
      terminal.resize(cols, rows);

      // Update terminal info
      const info = this.terminalInfo.get(id);
      if (info) {
        info.cols = cols;
        info.rows = rows;
        this.terminalInfo.set(id, info);
      }

      logger.debug(`Resized terminal ${id}`, { cols, rows });
    } catch (error) {
      logger.error(`Failed to resize terminal ${id}`, error);
      throw error;
    }
  }

  /**
   * Kill a terminal session
   */
  kill(id: string): void {
    const terminal = this.terminals.get(id);
    if (!terminal) {
      logger.warn(`Terminal ${id} not found`);
      return;
    }

    try {
      terminal.kill();
      this.terminals.delete(id);
      this.terminalInfo.delete(id);
      logger.info(`Terminal ${id} killed`);
    } catch (error) {
      logger.error(`Failed to kill terminal ${id}`, error);
      throw error;
    }
  }

  /**
   * Get terminal info
   */
  getInfo(id: string): TerminalInfo | undefined {
    return this.terminalInfo.get(id);
  }

  /**
   * Get all terminal IDs
   */
  getAllIds(): string[] {
    return Array.from(this.terminals.keys());
  }

  /**
   * Get all terminal info
   */
  getAllInfo(): TerminalInfo[] {
    return Array.from(this.terminalInfo.values());
  }

  /**
   * Check if a terminal exists
   */
  exists(id: string): boolean {
    return this.terminals.has(id);
  }

  /**
   * Get terminal count
   */
  getCount(): number {
    return this.terminals.size;
  }

  /**
   * Kill all terminals
   */
  killAll(): void {
    const ids = this.getAllIds();
    for (const id of ids) {
      try {
        this.kill(id);
      } catch (error) {
        logger.error(`Failed to kill terminal ${id} during killAll`, error);
      }
    }
    logger.info('All terminals killed');
  }

  /**
   * Clear terminal (send clear command)
   */
  clear(id: string): void {
    const terminal = this.terminals.get(id);
    if (!terminal) {
      logger.warn(`Terminal ${id} not found`);
      throw new Error(`Terminal ${id} not found`);
    }

    try {
      // Send clear command based on platform
      if (process.platform === 'win32') {
        terminal.write('cls\r');
      } else {
        terminal.write('clear\r');
      }
      logger.debug(`Cleared terminal ${id}`);
    } catch (error) {
      logger.error(`Failed to clear terminal ${id}`, error);
      throw error;
    }
  }
}

// Singleton export
export const terminalManager = TerminalManager.getInstance();

export { TerminalManager };
export default terminalManager;
