import { app } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'

export interface AppConfig {
  // AI 配置
  ai: {
    provider: 'openai' | 'anthropic' | 'custom'
    apiKey: string
    baseUrl?: string
    model: string
    maxTokens: number
    temperature: number
  }
  // 界面配置
  ui: {
    theme: 'light' | 'dark' | 'system'
    fontSize: number
    sidebarCollapsed: boolean
    showLineNumbers: boolean
    wordWrap: boolean
  }
  // 编辑器配置
  editor: {
    tabSize: number
    useSpaces: boolean
    autoSave: boolean
    autoSaveInterval: number
    formatOnSave: boolean
  }
  // 终端配置
  terminal: {
    defaultShell: string
    fontSize: number
    cursorStyle: 'block' | 'line' | 'bar'
    scrollback: number
  }
  // 工作区配置
  workspace: {
    recentProjects: string[]
    defaultProjectPath: string
    autoRestoreSession: boolean
  }
  // 内存配置
  memory: {
    enabled: boolean
    autoCompress: boolean
    maxSessionSize: number
  }
}

const defaultConfig: AppConfig = {
  ai: {
    provider: 'openai',
    apiKey: '',
    model: 'gpt-4',
    maxTokens: 4096,
    temperature: 0.7,
  },
  ui: {
    theme: 'dark',
    fontSize: 14,
    sidebarCollapsed: false,
    showLineNumbers: true,
    wordWrap: true,
  },
  editor: {
    tabSize: 2,
    useSpaces: true,
    autoSave: true,
    autoSaveInterval: 30000,
    formatOnSave: true,
  },
  terminal: {
    defaultShell: '',
    fontSize: 14,
    cursorStyle: 'block',
    scrollback: 10000,
  },
  workspace: {
    recentProjects: [],
    defaultProjectPath: '',
    autoRestoreSession: true,
  },
  memory: {
    enabled: true,
    autoCompress: true,
    maxSessionSize: 100,
  },
}

class ConfigManager {
  private configPath: string
  private config: AppConfig
  private listeners: Set<(config: AppConfig) => void> = new Set()

  constructor() {
    const userDataPath = app.getPath('userData')
    this.configPath = join(userDataPath, 'config.json')
    this.config = this.load()
  }

  private load(): AppConfig {
    try {
      if (existsSync(this.configPath)) {
        const data = readFileSync(this.configPath, 'utf-8')
        const saved = JSON.parse(data)
        return this.mergeWithDefault(saved)
      }
    } catch (error) {
      console.error('[Config] Failed to load config:', error)
    }
    return { ...defaultConfig }
  }

  private mergeWithDefault(saved: Partial<AppConfig>): AppConfig {
    return {
      ai: { ...defaultConfig.ai, ...saved.ai },
      ui: { ...defaultConfig.ui, ...saved.ui },
      editor: { ...defaultConfig.editor, ...saved.editor },
      terminal: { ...defaultConfig.terminal, ...saved.terminal },
      workspace: { ...defaultConfig.workspace, ...saved.workspace },
      memory: { ...defaultConfig.memory, ...saved.memory },
    }
  }

  private save(): void {
    try {
      const dir = this.configPath.substring(0, this.configPath.lastIndexOf('/'))
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }
      writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8')
      this.notifyListeners()
    } catch (error) {
      console.error('[Config] Failed to save config:', error)
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener(this.config))
  }

  get(): AppConfig {
    return { ...this.config }
  }

  getSection<K extends keyof AppConfig>(section: K): AppConfig[K] {
    return { ...this.config[section] }
  }

  update(updates: Partial<AppConfig>): void {
    this.config = this.mergeWithDefault({ ...this.config, ...updates })
    this.save()
  }

  updateSection<K extends keyof AppConfig>(section: K, updates: Partial<AppConfig[K]>): void {
    this.config[section] = { ...this.config[section], ...updates } as AppConfig[K]
    this.save()
  }

  reset(): void {
    this.config = { ...defaultConfig }
    this.save()
  }

  resetSection<K extends keyof AppConfig>(section: K): void {
    this.config[section] = { ...defaultConfig[section] }
    this.save()
  }

  onChange(listener: (config: AppConfig) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getConfigPath(): string {
    return this.configPath
  }
}

// 单例实例
let configManager: ConfigManager | null = null

export function getConfigManager(): ConfigManager {
  if (!configManager) {
    configManager = new ConfigManager()
  }
  return configManager
}

export { defaultConfig }
export type { ConfigManager }
