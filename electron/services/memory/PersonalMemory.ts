import * as fs from 'fs/promises'
import * as path from 'path'
import { app } from 'electron'

export interface PersonalIdentity {
  name?: string
  role?: string
  preferences?: Record<string, any>
  rawContent: string
}

export interface CoreMemory {
  essence: string[]
  principles: string[]
  rawContent: string
}

export interface DailyLog {
  date: string
  entries: string[]
  insights?: string[]
}

/**
 * Layer 3: Personal Memory - Personal cross-project memory
 * Manages USER.md, SOUL.md, MEMORY.md, MEMORY-L0.md, daily logs
 * Stored in app userData/memory/ directory
 */
export class PersonalMemory {
  private memoryDir: string
  private identity?: PersonalIdentity
  private soul?: CoreMemory
  private memoryL0?: string
  private memoryL1?: string

  constructor() {
    this.memoryDir = path.join(app.getPath('userData'), 'memory')
  }

  /**
   * Initialize personal memory directory
   */
  async initialize(): Promise<void> {
    await fs.mkdir(this.memoryDir, { recursive: true })
    await fs.mkdir(path.join(this.memoryDir, 'daily-logs'), { recursive: true })
  }

  /**
   * Load identity from USER.md
   */
  async loadIdentity(): Promise<PersonalIdentity | undefined> {
    const userFile = path.join(this.memoryDir, 'USER.md')

    try {
      const content = await fs.readFile(userFile, 'utf-8')
      this.identity = this.parseIdentity(content)
      return this.identity
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.error('Error loading USER.md:', error)
      }
      return undefined
    }
  }

  /**
   * Save identity to USER.md
   */
  async saveIdentity(content: string): Promise<void> {
    const userFile = path.join(this.memoryDir, 'USER.md')
    await fs.writeFile(userFile, content, 'utf-8')
    this.identity = this.parseIdentity(content)
  }

  /**
   * Load soul/essence from SOUL.md
   */
  async loadSoul(): Promise<CoreMemory | undefined> {
    const soulFile = path.join(this.memoryDir, 'SOUL.md')

    try {
      const content = await fs.readFile(soulFile, 'utf-8')
      this.soul = this.parseSoul(content)
      return this.soul
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.error('Error loading SOUL.md:', error)
      }
      return undefined
    }
  }

  /**
   * Save soul to SOUL.md
   */
  async saveSoul(content: string): Promise<void> {
    const soulFile = path.join(this.memoryDir, 'SOUL.md')
    await fs.writeFile(soulFile, content, 'utf-8')
    this.soul = this.parseSoul(content)
  }

  /**
   * Get L0 memory (core identity, ~200 tokens)
   */
  async getMemoryL0(): Promise<string | undefined> {
    const l0File = path.join(this.memoryDir, 'MEMORY-L0.md')

    try {
      this.memoryL0 = await fs.readFile(l0File, 'utf-8')
      return this.memoryL0
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.error('Error loading MEMORY-L0.md:', error)
      }
      return undefined
    }
  }

  /**
   * Save L0 memory
   */
  async saveMemoryL0(content: string): Promise<void> {
    const l0File = path.join(this.memoryDir, 'MEMORY-L0.md')
    await fs.writeFile(l0File, content, 'utf-8')
    this.memoryL0 = content
  }

  /**
   * Get L1 memory (detailed context, ~500 tokens)
   */
  async getMemoryL1(): Promise<string | undefined> {
    const l1File = path.join(this.memoryDir, 'MEMORY.md')

    try {
      this.memoryL1 = await fs.readFile(l1File, 'utf-8')
      return this.memoryL1
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.error('Error loading MEMORY.md:', error)
      }
      return undefined
    }
  }

  /**
   * Save L1 memory
   */
  async saveMemoryL1(content: string): Promise<void> {
    const l1File = path.join(this.memoryDir, 'MEMORY.md')
    await fs.writeFile(l1File, content, 'utf-8')
    this.memoryL1 = content
  }

  /**
   * Save daily log
   */
  async saveDailyLog(date: string, content: string): Promise<void> {
    const logFile = path.join(this.memoryDir, 'daily-logs', `${date}.md`)
    await fs.writeFile(logFile, content, 'utf-8')
  }

  /**
   * Get daily log for a specific date
   */
  async getDailyLog(date: string): Promise<string | undefined> {
    const logFile = path.join(this.memoryDir, 'daily-logs', `${date}.md`)

    try {
      return await fs.readFile(logFile, 'utf-8')
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.error(`Error loading daily log for ${date}:`, error)
      }
      return undefined
    }
  }

  /**
   * Get today's daily log
   */
  async getTodayLog(): Promise<string | undefined> {
    const today = new Date().toISOString().split('T')[0]
    return this.getDailyLog(today)
  }

  /**
   * Append to today's daily log
   */
  async appendToDailyLog(entry: string): Promise<void> {
    const today = new Date().toISOString().split('T')[0]
    const existing = await this.getTodayLog() || ''
    const timestamp = new Date().toISOString()
    const newContent = existing + `\n\n## ${timestamp}\n${entry}`
    await this.saveDailyLog(today, newContent)
  }

  /**
   * Get recent daily logs (last N days)
   */
  async getRecentLogs(days: number): Promise<Array<{ date: string; content: string }>> {
    const logs: Array<{ date: string; content: string }> = []
    const logsDir = path.join(this.memoryDir, 'daily-logs')

    try {
      const files = await fs.readdir(logsDir)
      const dateFiles = files
        .filter(f => f.endsWith('.md'))
        .map(f => f.replace('.md', ''))
        .sort()
        .reverse()
        .slice(0, days)

      for (const date of dateFiles) {
        const content = await this.getDailyLog(date)
        if (content) {
          logs.push({ date, content })
        }
      }
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.error('Error loading recent logs:', error)
      }
    }

    return logs
  }

  /**
   * Get cached identity
   */
  getIdentity(): PersonalIdentity | undefined {
    return this.identity
  }

  /**
   * Get cached soul
   */
  getSoul(): CoreMemory | undefined {
    return this.soul
  }

  /**
   * Get memory directory path
   */
  getMemoryDir(): string {
    return this.memoryDir
  }

  /**
   * Parse USER.md content
   */
  private parseIdentity(content: string): PersonalIdentity {
    const lines = content.split('\n')
    let name: string | undefined
    let role: string | undefined
    const preferences: Record<string, any> = {}

    for (const line of lines) {
      const lower = line.toLowerCase().trim()
      if (lower.startsWith('name:')) {
        name = line.split(':')[1]?.trim()
      } else if (lower.startsWith('role:')) {
        role = line.split(':')[1]?.trim()
      } else if (lower.startsWith('preference:') || lower.startsWith('pref:')) {
        const [key, ...valueParts] = line.split(':').slice(1).join(':').split('=')
        if (key && valueParts.length > 0) {
          preferences[key.trim()] = valueParts.join('=').trim()
        }
      }
    }

    return {
      name,
      role,
      preferences: Object.keys(preferences).length > 0 ? preferences : undefined,
      rawContent: content
    }
  }

  /**
   * Parse SOUL.md content
   */
  private parseSoul(content: string): CoreMemory {
    const essence: string[] = []
    const principles: string[] = []
    const lines = content.split('\n')

    let currentSection: 'essence' | 'principles' | null = null

    for (const line of lines) {
      const lower = line.toLowerCase().trim()

      if (lower.includes('essence') || lower.includes('core identity')) {
        currentSection = 'essence'
      } else if (lower.includes('principle') || lower.includes('values')) {
        currentSection = 'principles'
      } else if (line.trim().startsWith('-') || line.trim().startsWith('*')) {
        const item = line.trim().substring(1).trim()
        if (currentSection === 'essence') {
          essence.push(item)
        } else if (currentSection === 'principles') {
          principles.push(item)
        }
      }
    }

    return {
      essence,
      principles,
      rawContent: content
    }
  }
}
