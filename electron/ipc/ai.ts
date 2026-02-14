import { ipcMain, type IpcMainInvokeEvent, BrowserWindow } from 'electron'
import { randomUUID } from 'crypto'

// Lazy-initialized LLM provider
let llmProvider: any = null

function getLLMProvider() {
  if (!llmProvider) {
    // Lazy init - import dynamically to avoid circular deps
    const { LLMProvider } = require('../services/ai/LLMProvider')
    llmProvider = LLMProvider.getInstance()
  }
  return llmProvider
}

export function registerAIHandlers() {
  ipcMain.handle(
    'ai:chat',
    async (
      _event: IpcMainInvokeEvent,
      messages: Array<{ role: string; content: string }>,
      options?: Record<string, unknown>
    ) => {
      try {
        const provider = getLLMProvider()
        const response = await provider.chat(messages, options)
        return { success: true, data: response }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    }
  )

  ipcMain.handle(
    'ai:chat-stream',
    async (
      event: IpcMainInvokeEvent,
      messages: Array<{ role: string; content: string }>,
      options?: Record<string, unknown>
    ) => {
      const requestId = randomUUID()
      const win = BrowserWindow.fromWebContents(event.sender)

      try {
        const provider = getLLMProvider()

        // Fire off the stream in the background so the handler can return requestId immediately
        provider
          .chatStream(messages, options, (chunk: string) => {
            if (win && !win.isDestroyed()) {
              win.webContents.send('ai:stream-chunk', requestId, chunk)
            }
          })
          .then(() => {
            if (win && !win.isDestroyed()) {
              win.webContents.send('ai:stream-end', requestId)
            }
          })
          .catch((err: any) => {
            if (win && !win.isDestroyed()) {
              win.webContents.send('ai:stream-error', requestId, err.message)
            }
          })

        return { success: true, data: requestId }
      } catch (error: any) {
        if (win && !win.isDestroyed()) {
          win.webContents.send('ai:stream-error', requestId, error.message)
        }
        return { success: false, error: error.message }
      }
    }
  )

  ipcMain.handle(
    'ai:embed',
    async (_event: IpcMainInvokeEvent, text: string) => {
      try {
        const provider = getLLMProvider()
        const embedding = await provider.embed(text)
        return { success: true, data: embedding }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    }
  )
}
