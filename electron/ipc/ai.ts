import { ipcMain, BrowserWindow } from 'electron'

// Lazy-initialized LLM provider
let llmProvider: any = null

function getMainWindow(): BrowserWindow | null {
  const windows = BrowserWindow.getAllWindows()
  return windows.length > 0 ? windows[0] : null
}

function getLLMProvider() {
  if (!llmProvider) {
    // Lazy init - import dynamically to avoid circular deps
    const { LLMProvider } = require('../services/ai/LLMProvider')
    llmProvider = LLMProvider.getInstance()
  }
  return llmProvider
}

export function registerAIHandlers() {
  ipcMain.handle('ai:chat', async (_, messages: Array<{ role: string; content: string }>, options?: Record<string, unknown>) => {
    try {
      const provider = getLLMProvider()
      const response = await provider.chat(messages, options)
      return response
    } catch (error: any) {
      return `Error: ${error.message}`
    }
  })

  ipcMain.handle('ai:chat-stream', async (_, messages: Array<{ role: string; content: string }>, options?: Record<string, unknown>) => {
    try {
      const provider = getLLMProvider()
      const win = getMainWindow()

      const response = await provider.chatStream(messages, options, (chunk: string) => {
        if (win && !win.isDestroyed()) {
          win.webContents.send('ai:stream-chunk', chunk)
        }
      })

      if (win && !win.isDestroyed()) {
        win.webContents.send('ai:stream-end')
      }

      return response
    } catch (error: any) {
      const win = getMainWindow()
      if (win && !win.isDestroyed()) {
        win.webContents.send('ai:stream-end')
      }
      return `Error: ${error.message}`
    }
  })

  ipcMain.handle('ai:embed', async (_, text: string) => {
    try {
      const provider = getLLMProvider()
      return await provider.embed(text)
    } catch (error: any) {
      return []
    }
  })
}
