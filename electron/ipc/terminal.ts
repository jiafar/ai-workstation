import { ipcMain, BrowserWindow } from 'electron'
import * as pty from 'node-pty'
import * as os from 'os'

interface TerminalSession {
  pty: pty.IPty
  id: string
}

const terminals = new Map<string, TerminalSession>()

function getMainWindow(): BrowserWindow | null {
  const windows = BrowserWindow.getAllWindows()
  return windows.length > 0 ? windows[0] : null
}

export function registerTerminalHandlers() {
  ipcMain.handle('terminal:create', async (_, id: string, cwd?: string) => {
    if (terminals.has(id)) {
      terminals.get(id)?.pty.kill()
      terminals.delete(id)
    }

    const shell = os.platform() === 'win32' ? 'powershell.exe' : process.env.SHELL || '/bin/zsh'

    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: cwd || process.env.HOME || process.cwd(),
      env: process.env as { [key: string]: string },
    })

    ptyProcess.onData((data) => {
      const win = getMainWindow()
      if (win && !win.isDestroyed()) {
        win.webContents.send('terminal:data', id, data)
      }
    })

    ptyProcess.onExit(({ exitCode }) => {
      const win = getMainWindow()
      if (win && !win.isDestroyed()) {
        win.webContents.send('terminal:exit', id, exitCode)
      }
      terminals.delete(id)
    })

    terminals.set(id, { pty: ptyProcess, id })
  })

  ipcMain.handle('terminal:write', async (_, id: string, data: string) => {
    const terminal = terminals.get(id)
    if (terminal) terminal.pty.write(data)
  })

  ipcMain.handle('terminal:resize', async (_, id: string, cols: number, rows: number) => {
    const terminal = terminals.get(id)
    if (terminal) terminal.pty.resize(cols, rows)
  })

  ipcMain.handle('terminal:kill', async (_, id: string) => {
    const terminal = terminals.get(id)
    if (terminal) {
      terminal.pty.kill()
      terminals.delete(id)
    }
  })
}
