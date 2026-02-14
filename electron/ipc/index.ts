import { registerFilesystemHandlers } from './filesystem'
import { registerTerminalHandlers } from './terminal'
import { registerGitHandlers } from './git'
import { registerAIHandlers } from './ai'
import { registerMemoryHandlers } from './memory'
import { registerDatabaseHandlers } from './database'
import { registerSkillHandlers } from './skill'
import { registerWorkflowHandlers } from './workflow'

export function registerAllHandlers() {
  registerFilesystemHandlers()
  registerTerminalHandlers()
  registerGitHandlers()
  registerAIHandlers()
  registerMemoryHandlers()
  registerDatabaseHandlers()
  registerSkillHandlers()
  registerWorkflowHandlers()
  console.log('[IPC] All handlers registered')
}

export type { FileEntry } from './filesystem'
