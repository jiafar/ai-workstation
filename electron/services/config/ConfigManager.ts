import { app } from 'electron'
import { join, dirname } from 'path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { logger } from '../../utils/logger'

export interface AppConfig {
  // AI 配置
  ai: {
    defaultProvider: 'openai' | 'anthropic' | 'kimi'
    openaiApiKey: string
    anthropicApiKey: string
    kimiApiKey: string
    openaiBaseUrl?: string
    openaiModel: string
    anthropicModel: string
    kimiModel: string
    maxTokens: number
    temperature: number
  }
  // 向量嵌入配置
  embeddings: {
    provider: 'openai' | 'jina'
    jinaApiKey: string
    jinaModel: string
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
    defaultProvider: 'openai',
    openaiApiKey: '',
    anthropicApiKey: '',
    kimiApiKey: 'sk-kimi-0lNYE0VhYaygaa4g0GABC6JuLp4UakHbfAbpqjuzkNK0fgmEaz7k3PMFvlG1raDe',
    openaiBaseUrl: '',
    openaiModel: 'gpt-4-turbo-preview',
    anthropicModel: 'claude-sonnet-4-5-20250929',
    kimiModel: 'kimi-k2.5',
    maxTokens: 4096,
    temperature: 0.7,
  },
  embeddings: {
    provider: 'jina',
    jinaApiKey: 'jina_9b98e3e410ca4cec97afeeab355936d3sVcO4flRrhFxVZkPiobMmqs_MDqR',
    jinaModel: 'jina-embeddings-v3',
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
    logger.info('[Config] Config path:', { path: this.configPath })
    this.config = this.load()
    // Save defaults on first run so config.json always exists
    if (!existsSync(this.configPath)) {
      this.save()
    }
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
      embeddings: { ...defaultConfig.embeddings, ...saved.embeddings },
      ui: { ...defaultConfig.ui, ...saved.ui },
      editor: { ...defaultConfig.editor, ...saved.editor },
      terminal: { ...defaultConfig.terminal, ...saved.terminal },
      workspace: { ...defaultConfig.workspace, ...saved.workspace },
      memory: { ...defaultConfig.memory, ...saved.memory },
    }
  }

  private save(): void {
    try {
      const dir = dirname(this.configPath)
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }
      writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8')
      logger.info('[Config] Saved config to disk', { path: this.configPath })
      this.notifyListeners()
    } catch (error) {
      logger.error('[Config] Failed to save config', error)
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
    logger.info('[Config] updateSection called', { section, updateKeys: Object.keys(updates as Record<string, unknown>) })
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
