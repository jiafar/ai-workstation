import { ipcMain } from 'electron'

// Lazy-initialized MemoryManager (same pattern as ai.ts)
let memoryManager: any = null

function getMemoryManager() {
  if (!memoryManager) {
    const { MemoryManager } = require('../services/memory/MemoryManager')
    memoryManager = MemoryManager.getInstance()
  }
  return memoryManager
}

export function registerMemoryHandlers() {
  // Load a session from memory
  ipcMain.handle('memory:load-session', async (_, projectPath?: string) => {
    try {
      const mm = getMemoryManager()
      const session = await mm.loadSession(projectPath)
      return { success: true, data: session }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // Save an observation to memory
  ipcMain.handle('memory:save-observation', async (_, observation: any) => {
    try {
      const mm = getMemoryManager()
      const id = await mm.saveObservation(observation)
      return { success: true, data: id }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // Query memory
  ipcMain.handle('memory:query', async (_, query: string, layer?: number) => {
    try {
      const mm = getMemoryManager()
      const results = await mm.query(query, layer)
      return { success: true, data: results }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // Compress/summarize memory
  ipcMain.handle('memory:compress', async () => {
    try {
      const mm = getMemoryManager()
      await mm.compress()
      return { success: true, data: null }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // Get memory stats
  ipcMain.handle('memory:get-stats', async () => {
    try {
      const mm = getMemoryManager()
      const stats = await mm.getStats()
      return { success: true, data: stats }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // Get session list (MemoryManager is single-session working memory, return empty)
  ipcMain.handle('memory:get-sessions', async () => {
    try {
      return { success: true, data: { sessions: [], total: 0 } }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // Delete a session (clear working memory)
  ipcMain.handle('memory:delete-session', async () => {
    try {
      const mm = getMemoryManager()
      const wm = mm.getWorkingMemory()
      wm.clear()
      return { success: true, data: { deleted: true } }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // Clear all memory
  ipcMain.handle('memory:clear-all', async () => {
    try {
      const mm = getMemoryManager()
      const wm = mm.getWorkingMemory()
      wm.clear()
      return { success: true, data: { cleared: true, timestamp: new Date().toISOString() } }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // Create a new session
  ipcMain.handle('memory:create-session', async (_, metadata?: any) => {
    try {
      const mm = getMemoryManager()
      const session = await mm.loadSession(metadata?.projectPath)
      return { success: true, data: session }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })
}
