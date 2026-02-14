import { registerFilesystemHandlers } from './filesystem'
import { registerTerminalHandlers } from './terminal'
import { registerGitHandlers } from './git'
import { registerAIHandlers } from './ai'
import { registerMemoryHandlers } from './memory'
import { registerDatabaseHandlers } from './database'
import { registerSkillHandlers } from './skill'
import { registerWorkflowHandlers } from './workflow'
import { registerRitualHandlers } from '../services/ritual/RitualManager'
import { registerConfigHandlers } from './config'
import { logger } from '../utils/logger'

export function registerAllHandlers() {
  registerFilesystemHandlers()
  registerTerminalHandlers()
  registerGitHandlers()
  registerAIHandlers()
  registerMemoryHandlers()
  registerDatabaseHandlers()
  registerSkillHandlers()
  registerWorkflowHandlers()
  registerRitualHandlers()
  registerConfigHandlers()
  logger.info('[IPC] All handlers registered')
}

export type { FileEntry } from './filesystem'
