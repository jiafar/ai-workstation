import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerAllHandlers } from './ipc'
import { pathValidator } from './utils/pathValidator'
import { logger } from './utils/logger'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    show: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 15, y: 10 },
    backgroundColor: '#1e1e2e',
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    } as Electron.WebPreferences
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details: Electron.HandlerDetails) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

/**
 * Graceful shutdown: clean up all resources
 */
async function gracefulShutdown(): Promise<void> {
  logger.info('[App] Starting graceful shutdown...')

  // Close database connection
  try {
    const { sqliteManager } = require('./services/database/SQLiteManager')
    if (sqliteManager.isInitialized()) {
      sqliteManager.close()
      logger.info('[App] Database connection closed')
    }
  } catch (error) {
    logger.error('[App] Error closing database', error)
  }

  // Note: Terminal processes are cleaned up via process.on('exit') in terminal.ts

  logger.info('[App] Graceful shutdown complete')
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.jarvis.ai-workstation')

  // Initialize path validator with app data directory
  pathValidator.init()

  app.on('browser-window-created', (_: Electron.Event, window: BrowserWindow) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerAllHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Graceful shutdown on quit
app.on('before-quit', async (event) => {
  event.preventDefault()
  await gracefulShutdown()
  // Remove the listener to avoid infinite loop, then quit
  app.removeAllListeners('before-quit')
  app.quit()
})
