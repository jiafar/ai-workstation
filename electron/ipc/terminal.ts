import { ipcMain, IpcMainInvokeEvent, BrowserWindow } from 'electron'
import * as pty from 'node-pty'
import * as os from 'os'
import { logger } from '../utils/logger'

interface TerminalSession {
  pty: pty.IPty
  id: string
  windowId: number
  createdAt: number
}

const terminals = new Map<string, TerminalSession>()

function getWindowById(windowId: number): BrowserWindow | null {
  return BrowserWindow.fromId(windowId)
}

function getDefaultShell(): string {
  if (os.platform() === 'win32') {
    return 'powershell.exe'
  }
  return process.env.SHELL || '/bin/zsh'
}

export function registerTerminalHandlers() {
  // 创建终端
  ipcMain.handle('terminal:create', async (event: IpcMainInvokeEvent, id: string, cwd?: string) => {
    try {
      if (terminals.has(id)) {
        logger.warn(`[Terminal] ${id} already exists`)
        return { success: false, error: 'Terminal already exists' }
      }

      const shell = getDefaultShell()
      const senderWindow = BrowserWindow.fromWebContents(event.sender)
      
      if (!senderWindow) {
        return { success: false, error: 'No window found' }
      }

      const windowId = senderWindow.id

      const ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        cwd: cwd || process.env.HOME || process.cwd(),
        env: process.env as { [key: string]: string },
      })

      // 处理数据输出
      ptyProcess.onData((data) => {
        try {
          const win = getWindowById(windowId)
          if (win && !win.isDestroyed()) {
            win.webContents.send('terminal:data', id, data)
          }
        } catch (error) {
          // 忽略 EPIPE 错误
          if ((error as any)?.code === 'EPIPE') {
            logger.debug(`[Terminal] EPIPE error ignored for ${id}`)
            return
          }
          logger.error(`[Terminal] Error sending data for ${id}:`, error)
        }
      })

      // 处理退出
      ptyProcess.onExit(({ exitCode, signal }) => {
        logger.info(`[Terminal] ${id} exited`, { exitCode, signal })
        terminals.delete(id)
        try {
          const win = getWindowById(windowId)
          if (win && !win.isDestroyed()) {
            win.webContents.send('terminal:exit', id, exitCode)
          }
        } catch (error) {
          // 忽略 EPIPE 错误
          if ((error as any)?.code === 'EPIPE') {
            return
          }
          logger.error(`[Terminal] Error sending exit for ${id}:`, error)
        }
      })

      terminals.set(id, { 
        pty: ptyProcess, 
        id, 
        windowId,
        createdAt: Date.now()
      })
      
      logger.info(`[Terminal] ${id} created`, { pid: ptyProcess.pid, cwd, shell })
      
      return { success: true, pid: ptyProcess.pid }
    } catch (error) {
      logger.error(`[Terminal] Failed to create ${id}:`, error)
      return { success: false, error: (error as Error).message }
    }
  })

  // 写入数据
  ipcMain.handle('terminal:write', async (_: IpcMainInvokeEvent, id: string, data: string) => {
    try {
      const terminal = terminals.get(id)
      if (!terminal) {
        return { success: false, error: 'Terminal not found' }
      }
      terminal.pty.write(data)
      return { success: true }
    } catch (error) {
      // 忽略 EPIPE 错误
      if ((error as any)?.code === 'EPIPE') {
        logger.debug(`[Terminal] EPIPE on write for ${id}`)
        return { success: false, error: 'Terminal disconnected' }
      }
      logger.error(`[Terminal] Failed to write to ${id}:`, error)
      return { success: false, error: (error as Error).message }
    }
  })

  // 调整大小
  ipcMain.handle('terminal:resize', async (_: IpcMainInvokeEvent, id: string, cols: number, rows: number) => {
    try {
      const terminal = terminals.get(id)
      if (!terminal) {
        return { success: false, error: 'Terminal not found' }
      }
      terminal.pty.resize(cols, rows)
      logger.debug(`[Terminal] ${id} resized to ${cols}x${rows}`)
      return { success: true }
    } catch (error) {
      logger.error(`[Terminal] Failed to resize ${id}:`, error)
      return { success: false, error: (error as Error).message }
    }
  })

  // 关闭终端
  ipcMain.handle('terminal:kill', async (_: IpcMainInvokeEvent, id: string) => {
    try {
      const terminal = terminals.get(id)
      if (!terminal) {
        return { success: false, error: 'Terminal not found' }
      }
      terminal.pty.kill()
      terminals.delete(id)
      logger.info(`[Terminal] ${id} killed`)
      return { success: true }
    } catch (error) {
      logger.error(`[Terminal] Failed to kill ${id}:`, error)
      return { success: false, error: (error as Error).message }
    }
  })

  // 获取终端列表
  ipcMain.handle('terminal:list', async () => {
    const list = Array.from(terminals.entries()).map(([id, session]) => ({
      id,
      pid: session.pty.pid,
      createdAt: session.createdAt
    }))
    return { success: true, data: list }
  })

  // 应用退出时清理所有终端
  process.on('exit', () => {
    terminals.forEach((session, id) => {
      try {
        session.pty.kill()
        logger.info(`[Terminal] ${id} cleaned up on exit`)
      } catch (error) {
        // ignore
      }
    })
    terminals.clear()
  })

  logger.info('[IPC] Terminal handlers registered')
}
