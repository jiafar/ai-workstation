export interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
  children?: FileEntry[]
}

export interface CursorPosition {
  lineNumber: number
  column: number
}

export interface EditorTab {
  id: string
  path: string
  name: string
  content: string
  originalContent: string
  language: string
  isDirty: boolean
  isActive: boolean
  cursorPosition?: CursorPosition
  scrollPosition?: number
}

export interface TerminalTab {
  id: string
  title: string
  isActive: boolean
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  metadata?: {
    model?: string
    tokens?: number
    skillUsed?: string
  }
}

export interface Project {
  id: string
  name: string
  path: string
  lastOpened: number
  metadata?: Record<string, unknown>
}

export interface Task {
  id: string
  projectId: string
  title: string
  description?: string
  status: 'todo' | 'in_progress' | 'done'
  priority: 'low' | 'medium' | 'high'
  tags: string[]
  linkedFiles: string[]
  createdAt: number
  updatedAt: number
}

export interface Observation {
  id: string
  type: 'insight' | 'pattern' | 'decision' | 'fact' | 'preference'
  summary: string
  facts: string[]
  relatedFiles: string[]
  importance: number
  createdAt: number
}

export interface SkillDefinition {
  name: string
  version: string
  description: string
  author: string
  category: string
  tags: string[]
  inputs: SkillInput[]
  outputs: SkillOutput[]
  trigger?: {
    command?: string
    shortcut?: string
    chatKeyword?: string
  }
  requires: string[]
  promptFile?: string
  scriptFile?: string
}

export interface SkillInput {
  name: string
  type: 'string' | 'number' | 'boolean' | 'enum' | 'file'
  description: string
  required?: boolean
  default?: unknown
  values?: string[]
}

export interface SkillOutput {
  name: string
  type: string
  description: string
}

export interface SkillRun {
  id: string
  skillName: string
  inputs: Record<string, unknown>
  outputs?: Record<string, unknown>
  status: 'pending' | 'running' | 'completed' | 'failed'
  error?: string
  startedAt: number
  completedAt?: number
  duration?: number
}

export interface WorkflowDefinition {
  name: string
  description: string
  trigger?: {
    manual?: boolean
    event?: string
    schedule?: string | null
  }
  inputs?: Array<{ name: string; type: string; default?: unknown }>
  steps: WorkflowStep[]
}

export interface WorkflowStep {
  id: string
  type: 'skill' | 'shell' | 'ai' | 'condition' | 'parallel' | 'human'
  skill?: string
  command?: string
  prompt?: string
  condition?: string
  then?: string
  else?: string
  steps?: string[]
  inputs?: Record<string, unknown>
  dependsOn?: string[]
}

export interface WorkflowRun {
  id: string
  workflowName: string
  state: 'pending' | 'running' | 'paused' | 'completed' | 'failed'
  currentStep?: string
  stepResults: Record<string, unknown>
  startedAt: number
  completedAt?: number
  error?: string
}

export interface RitualConfig {
  id: string
  name: string
  schedule?: string
  event?: string
  workflowName: string
  description: string
  enabled: boolean
  lastRun?: number
}

export type PanelType = 'explorer' | 'search' | 'git' | 'skills' | 'workflows' | 'rituals' | 'memory' | 'tasks' | 'knowledge' | 'settings'
export type BottomPanelType = 'terminal' | 'chat' | 'problems' | 'output'
