import { ipcMain } from 'electron'
import { getConfigManager } from '../services/config'
import { logger } from '../utils/logger'

export function registerConfigHandlers(): void {
  const configManager = getConfigManager()

  // 获取完整配置
  ipcMain.handle('config:get', () => {
    try {
      return { success: true, data: configManager.get() }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  // 获取指定 section
  ipcMain.handle('config:get-section', (_event, section: string) => {
    try {
      const data = configManager.getSection(section as never)
      return { success: true, data }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  // 更新完整配置
  ipcMain.handle('config:update', (_event, updates: Record<string, unknown>) => {
    try {
      configManager.update(updates)
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  // 更新指定 section
  ipcMain.handle('config:update-section', (_event, section: string, updates: Record<string, unknown>) => {
    try {
      configManager.updateSection(section as any, updates as any)
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  // 重置配置
  ipcMain.handle('config:reset', () => {
    try {
      configManager.reset()
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  // 重置指定 section
  ipcMain.handle('config:reset-section', (_event, section: string) => {
    try {
      configManager.resetSection(section as never)
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  // 获取配置文件路径
  ipcMain.handle('config:get-path', () => {
    try {
      return { success: true, data: configManager.getConfigPath() }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  logger.info('[IPC] Config handlers registered')
}
