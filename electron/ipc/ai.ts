import { ipcMain, type IpcMainInvokeEvent, BrowserWindow } from 'electron'
import { randomUUID } from 'crypto'
import { logger } from '../utils/logger'
import { LLMProvider } from '../services/ai/LLMProvider'

function getLLMProvider() {
  return LLMProvider.getInstance()
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
        logger.error('[AI] chat error', { error: error?.message || String(error) })
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
      logger.info('[AI] chat-stream called', { requestId, messageCount: messages?.length, options })

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
            const errorMsg = err?.message || String(err)
            logger.error('[AI] stream error', { requestId, error: errorMsg, stack: err?.stack })
            if (win && !win.isDestroyed()) {
              win.webContents.send('ai:stream-error', requestId, errorMsg)
            }
          })

        return { success: true, data: requestId }
      } catch (error: any) {
        const errorMsg = error?.message || String(error)
        logger.error('[AI] chat-stream init error', { requestId, error: errorMsg })
        if (win && !win.isDestroyed()) {
          win.webContents.send('ai:stream-error', requestId, errorMsg)
        }
        return { success: false, error: errorMsg }
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
        logger.error('[AI] embed error', { error: error?.message || String(error) })
        return { success: false, error: error.message }
      }
    }
  )
}
