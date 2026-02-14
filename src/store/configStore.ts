import { create } from 'zustand'

export interface AppConfig {
  ai: {
    defaultProvider: 'openai' | 'anthropic'
    openaiApiKey: string
    anthropicApiKey: string
    openaiBaseUrl?: string
    openaiModel: string
    anthropicModel: string
    maxTokens: number
    temperature: number
  }
  ui: {
    theme: 'light' | 'dark' | 'system'
    fontSize: number
    sidebarCollapsed: boolean
    showLineNumbers: boolean
    wordWrap: boolean
  }
  editor: {
    tabSize: number
    useSpaces: boolean
    autoSave: boolean
    autoSaveInterval: number
    formatOnSave: boolean
  }
  terminal: {
    defaultShell: string
    fontSize: number
    cursorStyle: 'block' | 'line' | 'bar'
    scrollback: number
  }
  workspace: {
    recentProjects: string[]
    defaultProjectPath: string
    autoRestoreSession: boolean
  }
  memory: {
    enabled: boolean
    autoCompress: boolean
    maxSessionSize: number
  }
}

interface ConfigState {
  config: AppConfig | null
  isLoading: boolean
  error: string | null

  // Actions
  loadConfig: () => Promise<void>
  updateConfig: (updates: Partial<AppConfig>) => Promise<void>
  updateSection: <K extends keyof AppConfig>(section: K, updates: Partial<AppConfig[K]>) => Promise<void>
  resetConfig: () => Promise<void>
  resetSection: <K extends keyof AppConfig>(section: K) => Promise<void>
}

export const useConfigStore = create<ConfigState>((set) => ({
  config: null,
  isLoading: false,
  error: null,

  loadConfig: async () => {
    set({ isLoading: true, error: null })
    try {
      const config = await window.api.config.get() as AppConfig
      set({ config, isLoading: false })
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false })
    }
  },

  updateConfig: async (updates) => {
    try {
      await window.api.config.update(updates)
      const config = await window.api.config.get() as AppConfig
      set({ config })
    } catch (error) {
      set({ error: (error as Error).message })
    }
  },

  updateSection: async (section, updates) => {
    try {
      await window.api.config.updateSection(section, updates)
      const config = await window.api.config.get() as AppConfig
      set({ config })
    } catch (error) {
      set({ error: (error as Error).message })
    }
  },

  resetConfig: async () => {
    try {
      await window.api.config.reset()
      const config = await window.api.config.get() as AppConfig
      set({ config })
    } catch (error) {
      set({ error: (error as Error).message })
    }
  },

  resetSection: async (section) => {
    try {
      await window.api.config.resetSection(section)
      const config = await window.api.config.get() as AppConfig
      set({ config })
    } catch (error) {
      set({ error: (error as Error).message })
    }
  },
}))
