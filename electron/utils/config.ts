import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';

export interface AIProviderConfig {
  name: string;
  apiKey: string;
  baseURL?: string;
  model?: string;
}

export interface MemorySettings {
  maxShortTermMemories: number;
  maxWorkingMemories: number;
  maxEpisodicMemories: number;
  vectorSearchLimit: number;
}

export interface AppConfig {
  aiProviders: {
    openai?: AIProviderConfig;
    anthropic?: AIProviderConfig;
    defaultProvider?: 'openai' | 'anthropic';
  };
  memory: MemorySettings;
  terminal: {
    defaultShell: string;
    scrollback: number;
  };
  editor: {
    theme: string;
    fontSize: number;
    tabSize: number;
  };
  git: {
    defaultBranch: string;
    autoFetch: boolean;
  };
}

class ConfigManager {
  private configPath: string;
  private config: AppConfig;

  constructor() {
    this.configPath = path.join(app.getPath('userData'), 'config.json');
    this.config = this.getDefaultConfig();
    this.load();
  }

  private getDefaultConfig(): AppConfig {
    return {
      aiProviders: {
        openai: {
          name: 'OpenAI',
          apiKey: '',
          baseURL: 'https://api.openai.com/v1',
          model: 'gpt-4-turbo-preview',
        },
        anthropic: {
          name: 'Anthropic',
          apiKey: '',
          baseURL: 'https://api.anthropic.com',
          model: 'claude-3-5-sonnet-20241022',
        },
        defaultProvider: 'anthropic',
      },
      memory: {
        maxShortTermMemories: 50,
        maxWorkingMemories: 100,
        maxEpisodicMemories: 1000,
        vectorSearchLimit: 10,
      },
      terminal: {
        defaultShell: process.platform === 'win32' ? 'powershell.exe' : '/bin/zsh',
        scrollback: 1000,
      },
      editor: {
        theme: 'vs-dark',
        fontSize: 14,
        tabSize: 2,
      },
      git: {
        defaultBranch: 'main',
        autoFetch: false,
      },
    };
  }

  private load(): void {
    try {
      if (fs.existsSync(this.configPath)) {
        const configData = fs.readFileSync(this.configPath, 'utf-8');
        const loadedConfig = JSON.parse(configData);
        this.config = this.mergeWithDefaults(loadedConfig);
        logger.info('Configuration loaded successfully', { path: this.configPath });
      } else {
        logger.info('No existing config found, using defaults');
        this.save();
      }
    } catch (error) {
      logger.error('Failed to load configuration', error);
      this.config = this.getDefaultConfig();
    }
  }

  private mergeWithDefaults(loadedConfig: any): AppConfig {
    const defaultConfig = this.getDefaultConfig();
    return {
      ...defaultConfig,
      ...loadedConfig,
      aiProviders: {
        ...defaultConfig.aiProviders,
        ...loadedConfig.aiProviders,
      },
      memory: {
        ...defaultConfig.memory,
        ...loadedConfig.memory,
      },
      terminal: {
        ...defaultConfig.terminal,
        ...loadedConfig.terminal,
      },
      editor: {
        ...defaultConfig.editor,
        ...loadedConfig.editor,
      },
      git: {
        ...defaultConfig.git,
        ...loadedConfig.git,
      },
    };
  }

  private save(): void {
    try {
      const configDir = path.dirname(this.configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');
      logger.info('Configuration saved successfully', { path: this.configPath });
    } catch (error) {
      logger.error('Failed to save configuration', error);
    }
  }

  get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.config[key];
  }

  set<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
    this.config[key] = value;
    this.save();
  }

  getAll(): AppConfig {
    return { ...this.config };
  }

  reset(): void {
    this.config = this.getDefaultConfig();
    this.save();
    logger.info('Configuration reset to defaults');
  }

  updateNested(path: string[], value: any): void {
    let current: any = this.config;
    for (let i = 0; i < path.length - 1; i++) {
      if (!current[path[i]]) {
        current[path[i]] = {};
      }
      current = current[path[i]];
    }
    current[path[path.length - 1]] = value;
    this.save();
  }

  getNested(path: string[]): any {
    let current: any = this.config;
    for (const key of path) {
      if (current[key] === undefined) {
        return undefined;
      }
      current = current[key];
    }
    return current;
  }
}

// Singleton instance
export const config = new ConfigManager();

export default config;
