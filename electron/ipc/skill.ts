import { ipcMain, BrowserWindow } from 'electron'
import * as path from 'path'
import * as fs from 'fs/promises'

// Lazy-initialized services
let skillRegistry: any = null
let skillRunner: any = null
let skillsInitialized = false

// In-memory enabled state (SkillRegistry has no enable/disable concept)
const enabledState = new Map<string, boolean>()

function getMainWindow(): BrowserWindow | null {
  const windows = BrowserWindow.getAllWindows()
  return windows.length > 0 ? windows[0] : null
}

function getSkillRegistry() {
  if (!skillRegistry) {
    const { SkillRegistry } = require('../services/skill/SkillRegistry')
    skillRegistry = SkillRegistry.getInstance()
  }
  return skillRegistry
}

function getSkillRunner() {
  if (!skillRunner) {
    const { SkillRunner } = require('../services/skill/SkillRunner')
    const { MemoryManager } = require('../services/memory/MemoryManager')
    const { LLMProvider } = require('../services/ai/LLMProvider')
    skillRunner = new SkillRunner(MemoryManager.getInstance(), LLMProvider.getInstance())

    // Forward progress events to renderer
    skillRunner.on('run-progress', (data: any) => {
      const win = getMainWindow()
      if (win && !win.isDestroyed()) {
        win.webContents.send('skill:progress', data)
      }
    })
  }
  return skillRunner
}

async function ensureSkillsInitialized() {
  if (skillsInitialized) return
  const registry = getSkillRegistry()
  if (!registry.isInitialized()) {
    const skillsDir = path.join(process.cwd(), 'skills')
    try {
      await fs.access(skillsDir)
      await registry.init(skillsDir)
    } catch {
      // skills directory doesn't exist yet, that's ok
    }
  }
  skillsInitialized = true
}

export function registerSkillHandlers() {
  // List all available skills
  ipcMain.handle('skill:list', async () => {
    try {
      await ensureSkillsInitialized()
      const registry = getSkillRegistry()
      const skills = registry.list()
      return { success: true, data: skills }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // Get a specific skill by ID
  ipcMain.handle('skill:get', async (_, skillId: string) => {
    try {
      await ensureSkillsInitialized()
      const registry = getSkillRegistry()
      const skill = registry.resolve(skillId)
      if (!skill) {
        return { success: false, error: `Skill not found: ${skillId}` }
      }
      return { success: true, data: skill }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // Run a skill
  ipcMain.handle('skill:run', async (_, skillName: string, inputs: any, context?: any) => {
    try {
      await ensureSkillsInitialized()
      const runner = getSkillRunner()
      const runContext = context || { projectPath: process.cwd() }
      const result = await runner.run(skillName, inputs || {}, runContext)
      return { success: true, data: result }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // Get skill run result
  ipcMain.handle('skill:get-result', async (_, runId: string) => {
    try {
      const runner = getSkillRunner()
      const run = runner.getRun(runId)
      if (!run) {
        return { success: false, error: `Run not found: ${runId}` }
      }
      return { success: true, data: run }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // Cancel a running skill
  ipcMain.handle('skill:cancel', async (_, _runId: string) => {
    try {
      return { success: false, error: 'Skill cancellation is not supported' }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // Create a new custom skill
  ipcMain.handle('skill:create', async (_, skillData: any) => {
    try {
      await ensureSkillsInitialized()
      const registry = getSkillRegistry()
      const skillsDir = path.join(process.cwd(), 'skills')
      const skillDir = path.join(skillsDir, skillData.name)

      // Create skill directory and write skill.json
      await fs.mkdir(skillDir, { recursive: true })
      const skillDef = { ...skillData, skillDir }
      await fs.writeFile(
        path.join(skillDir, 'skill.json'),
        JSON.stringify(skillDef, null, 2),
        'utf-8'
      )

      // Register in registry
      registry.register(skillDef)
      return { success: true, data: skillDef }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // Update a skill
  ipcMain.handle('skill:update', async (_, skillId: string, updates: any) => {
    try {
      await ensureSkillsInitialized()
      const registry = getSkillRegistry()
      const existing = registry.resolve(skillId)
      if (!existing) {
        return { success: false, error: `Skill not found: ${skillId}` }
      }

      // Update skill.json on disk (hot-reload watcher will pick it up)
      const skillJsonPath = path.join(existing.skillDir, 'skill.json')
      const updated = { ...existing, ...updates }
      await fs.writeFile(skillJsonPath, JSON.stringify(updated, null, 2), 'utf-8')

      return { success: true, data: updated }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // Delete a skill
  ipcMain.handle('skill:delete', async (_, skillId: string) => {
    try {
      await ensureSkillsInitialized()
      const registry = getSkillRegistry()
      const existing = registry.resolve(skillId)
      if (existing) {
        // Remove directory
        await fs.rm(existing.skillDir, { recursive: true, force: true })
        registry.unregister(skillId)
      }
      return { success: true, data: { skillId, deleted: true } }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // Enable/disable a skill
  ipcMain.handle('skill:set-enabled', async (_, skillId: string, enabled: boolean) => {
    try {
      enabledState.set(skillId, enabled)
      return { success: true, data: { skillId, enabled } }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // Get skill run history
  ipcMain.handle('skill:get-history', async (_, skillId?: string, options?: { limit?: number }) => {
    try {
      const runner = getSkillRunner()
      const runs = skillId
        ? runner.getRunsBySkill(skillId)
        : runner.getRecentRuns(options?.limit || 50)
      return { success: true, data: { runs, total: runs.length } }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })
}
