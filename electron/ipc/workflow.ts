import { ipcMain, BrowserWindow } from 'electron'
import * as path from 'path'
import * as fs from 'fs/promises'
import { app } from 'electron'

// Lazy-initialized WorkflowEngine
let workflowEngine: any = null
let engineInitialized = false

// In-memory enabled state
const enabledState = new Map<string, boolean>()

function getMainWindow(): BrowserWindow | null {
  const windows = BrowserWindow.getAllWindows()
  return windows.length > 0 ? windows[0] : null
}

function getWorkflowEngine() {
  if (!workflowEngine) {
    const { WorkflowEngine } = require('../services/workflow/WorkflowEngine')
    workflowEngine = WorkflowEngine.getInstance()

    // Forward events to renderer
    workflowEngine.on('step-complete', (data: any) => {
      const win = getMainWindow()
      if (win && !win.isDestroyed()) {
        win.webContents.send('workflow:step-complete', data)
      }
    })

    workflowEngine.on('workflow-done', (data: any) => {
      const win = getMainWindow()
      if (win && !win.isDestroyed()) {
        win.webContents.send('workflow:done', data)
      }
    })
  }
  return workflowEngine
}

async function ensureEngineInitialized() {
  if (engineInitialized) return
  const engine = getWorkflowEngine()
  await engine.init()
  engineInitialized = true
}

function getWorkflowsDir(): string {
  return path.join(app.getPath('userData'), 'workflows')
}

export function registerWorkflowHandlers() {
  // List all available workflows
  ipcMain.handle('workflow:list', async () => {
    try {
      await ensureEngineInitialized()
      const engine = getWorkflowEngine()
      const workflows = await engine.listWorkflows()
      return { success: true, data: workflows }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // Get a specific workflow by ID
  ipcMain.handle('workflow:get', async (_, workflowId: string) => {
    try {
      await ensureEngineInitialized()
      const workflowsDir = getWorkflowsDir()

      // Try templates first, then custom
      for (const subdir of ['templates', 'custom']) {
        const filePath = path.join(workflowsDir, subdir, `${workflowId}.json`)
        try {
          const content = await fs.readFile(filePath, 'utf-8')
          return { success: true, data: JSON.parse(content) }
        } catch {
          // Continue to next directory
        }
      }

      return { success: false, error: `Workflow not found: ${workflowId}` }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // Run a workflow
  ipcMain.handle('workflow:run', async (_, workflowName: string, inputs?: any) => {
    try {
      await ensureEngineInitialized()
      const engine = getWorkflowEngine()
      const result = await engine.run(workflowName, inputs || {})
      return { success: true, data: result }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // Stop a running workflow
  ipcMain.handle('workflow:stop', async (_, runId: string) => {
    try {
      const engine = getWorkflowEngine()
      const stopped = await engine.stop(runId)
      return { success: true, data: { runId, stopped } }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // Get workflow run state
  ipcMain.handle('workflow:get-state', async (_, runId: string) => {
    try {
      const engine = getWorkflowEngine()
      const state = engine.getState(runId)
      if (!state) {
        return { success: false, error: `Workflow run not found: ${runId}` }
      }
      return { success: true, data: state }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // Create a new workflow
  ipcMain.handle('workflow:create', async (_, workflowData: any) => {
    try {
      await ensureEngineInitialized()
      const workflowsDir = getWorkflowsDir()
      const customDir = path.join(workflowsDir, 'custom')
      await fs.mkdir(customDir, { recursive: true })

      const fileName = `${workflowData.name || `workflow-${Date.now()}`}.json`
      const filePath = path.join(customDir, fileName)
      await fs.writeFile(filePath, JSON.stringify(workflowData, null, 2), 'utf-8')

      return { success: true, data: { ...workflowData, file: `custom/${fileName}` } }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // Update a workflow
  ipcMain.handle('workflow:update', async (_, workflowId: string, updates: any) => {
    try {
      await ensureEngineInitialized()
      const workflowsDir = getWorkflowsDir()

      // Find existing file
      for (const subdir of ['custom', 'templates']) {
        const filePath = path.join(workflowsDir, subdir, `${workflowId}.json`)
        try {
          const content = await fs.readFile(filePath, 'utf-8')
          const existing = JSON.parse(content)
          const updated = { ...existing, ...updates }
          await fs.writeFile(filePath, JSON.stringify(updated, null, 2), 'utf-8')
          return { success: true, data: updated }
        } catch {
          // Continue to next directory
        }
      }

      return { success: false, error: `Workflow not found: ${workflowId}` }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // Delete a workflow
  ipcMain.handle('workflow:delete', async (_, workflowId: string) => {
    try {
      await ensureEngineInitialized()
      const workflowsDir = getWorkflowsDir()

      for (const subdir of ['custom', 'templates']) {
        const filePath = path.join(workflowsDir, subdir, `${workflowId}.json`)
        try {
          await fs.access(filePath)
          await fs.unlink(filePath)
          return { success: true, data: { workflowId, deleted: true } }
        } catch {
          // Continue to next directory
        }
      }

      return { success: false, error: `Workflow not found: ${workflowId}` }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // Enable/disable a workflow
  ipcMain.handle('workflow:set-enabled', async (_, workflowId: string, enabled: boolean) => {
    try {
      enabledState.set(workflowId, enabled)
      return { success: true, data: { workflowId, enabled } }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // Get workflow run history
  ipcMain.handle('workflow:get-history', async (_, _workflowId?: string, options?: { limit?: number }) => {
    try {
      await ensureEngineInitialized()
      const engine = getWorkflowEngine()
      const history = engine.getHistory(options?.limit || 50)
      return { success: true, data: { runs: history, total: history.length } }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // Validate workflow definition
  ipcMain.handle('workflow:validate', async (_, workflowData: any) => {
    try {
      const { WorkflowParser } = require('../services/workflow/WorkflowParser')
      const parser = new WorkflowParser()
      parser.parse(workflowData)
      return { success: true, data: { valid: true, errors: [], warnings: [] } }
    } catch (error: any) {
      return {
        success: true,
        data: { valid: false, errors: [error.message], warnings: [] },
      }
    }
  })

  // Get workflow templates
  ipcMain.handle('workflow:get-templates', async () => {
    try {
      await ensureEngineInitialized()
      const workflowsDir = getWorkflowsDir()
      const templatesDir = path.join(workflowsDir, 'templates')

      try {
        const files = await fs.readdir(templatesDir)
        const templates = []

        for (const file of files) {
          if (!file.endsWith('.json')) continue
          try {
            const content = await fs.readFile(path.join(templatesDir, file), 'utf-8')
            const tmpl = JSON.parse(content)
            templates.push({
              id: file.replace('.json', ''),
              name: tmpl.name || file.replace('.json', ''),
              description: tmpl.description || '',
              category: tmpl.category || 'general',
            })
          } catch {
            // Skip invalid template files
          }
        }

        return { success: true, data: templates }
      } catch {
        return { success: true, data: [] }
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })
}
