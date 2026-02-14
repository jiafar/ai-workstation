import * as fs from 'fs/promises'
import * as path from 'path'

export interface ProjectContext {
  name: string
  description?: string
  techStack?: string[]
  architecture?: string
  conventions?: string[]
  rawContent: string
}

export interface ProjectDecision {
  id: string
  title: string
  decision: string
  rationale: string
  alternatives?: string[]
  timestamp: number
  tags?: string[]
  relatedFiles?: string[]
}

/**
 * Layer 2: Project Memory - Project-level memory
 * Loads PROJECT.md from project root if exists
 * Stores project decisions in decisions/ directory
 */
export class ProjectMemory {
  private projectPath?: string
  private projectContext?: ProjectContext
  private decisions: ProjectDecision[] = []

  /**
   * Load project memory from project directory
   */
  async load(projectPath: string): Promise<void> {
    this.projectPath = projectPath

    // Load PROJECT.md if it exists
    await this.loadProjectFile()

    // Load project decisions
    await this.loadDecisions()
  }

  /**
   * Get the loaded project context
   */
  getProjectContext(): ProjectContext | undefined {
    return this.projectContext
  }

  /**
   * Save a new project decision
   */
  async saveDecision(decision: Omit<ProjectDecision, 'id' | 'timestamp'>): Promise<string> {
    if (!this.projectPath) {
      throw new Error('Project not loaded')
    }

    const decisionEntry: ProjectDecision = {
      ...decision,
      id: `decision-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now()
    }

    this.decisions.push(decisionEntry)

    // Save to disk
    const decisionsDir = path.join(this.projectPath, 'decisions')
    await fs.mkdir(decisionsDir, { recursive: true })

    const filename = `${decisionEntry.id}.json`
    const filepath = path.join(decisionsDir, filename)
    await fs.writeFile(filepath, JSON.stringify(decisionEntry, null, 2), 'utf-8')

    return decisionEntry.id
  }

  /**
   * Get recent decisions within the last N days
   */
  getRecentDecisions(days: number): ProjectDecision[] {
    const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000)
    return this.decisions
      .filter(d => d.timestamp >= cutoffTime)
      .sort((a, b) => b.timestamp - a.timestamp)
  }

  /**
   * Get all decisions
   */
  getAllDecisions(): ProjectDecision[] {
    return [...this.decisions].sort((a, b) => b.timestamp - a.timestamp)
  }

  /**
   * Get decision by ID
   */
  getDecision(id: string): ProjectDecision | undefined {
    return this.decisions.find(d => d.id === id)
  }

  /**
   * Search decisions by query
   */
  searchDecisions(query: string): ProjectDecision[] {
    const lowerQuery = query.toLowerCase()
    return this.decisions.filter(d =>
      d.title.toLowerCase().includes(lowerQuery) ||
      d.decision.toLowerCase().includes(lowerQuery) ||
      d.rationale.toLowerCase().includes(lowerQuery) ||
      d.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
    )
  }

  /**
   * Get the project path
   */
  getProjectPath(): string | undefined {
    return this.projectPath
  }

  /**
   * Load PROJECT.md from project root
   */
  private async loadProjectFile(): Promise<void> {
    if (!this.projectPath) return

    const projectFile = path.join(this.projectPath, 'PROJECT.md')

    try {
      const content = await fs.readFile(projectFile, 'utf-8')
      this.projectContext = this.parseProjectFile(content)
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.error('Error loading PROJECT.md:', error)
      }
      // If file doesn't exist, that's okay
      this.projectContext = undefined
    }
  }

  /**
   * Load all decisions from decisions/ directory
   */
  private async loadDecisions(): Promise<void> {
    if (!this.projectPath) return

    const decisionsDir = path.join(this.projectPath, 'decisions')

    try {
      await fs.mkdir(decisionsDir, { recursive: true })
      const files = await fs.readdir(decisionsDir)

      this.decisions = []

      for (const file of files) {
        if (!file.endsWith('.json')) continue

        try {
          const filepath = path.join(decisionsDir, file)
          const content = await fs.readFile(filepath, 'utf-8')
          const decision = JSON.parse(content) as ProjectDecision
          this.decisions.push(decision)
        } catch (error) {
          console.error(`Error loading decision file ${file}:`, error)
        }
      }
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.error('Error loading decisions:', error)
      }
    }
  }

  /**
   * Parse PROJECT.md content into structured context
   */
  private parseProjectFile(content: string): ProjectContext {
    const lines = content.split('\n')
    let name = 'Unknown Project'
    let description: string | undefined
    const techStack: string[] = []
    let architecture: string | undefined
    const conventions: string[] = []

    // Simple parsing - extract name from first heading, etc.
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()

      if (line.startsWith('# ')) {
        name = line.substring(2).trim()
      } else if (line.toLowerCase().includes('description:')) {
        description = line.split(':')[1]?.trim() || lines[i + 1]?.trim()
      } else if (line.toLowerCase().includes('tech stack:') || line.toLowerCase().includes('technologies:')) {
        // Collect following bullet points
        for (let j = i + 1; j < lines.length && (lines[j].trim().startsWith('-') || lines[j].trim().startsWith('*')); j++) {
          techStack.push(lines[j].trim().substring(1).trim())
        }
      } else if (line.toLowerCase().includes('architecture:')) {
        architecture = lines[i + 1]?.trim()
      } else if (line.toLowerCase().includes('conventions:') || line.toLowerCase().includes('coding standards:')) {
        for (let j = i + 1; j < lines.length && (lines[j].trim().startsWith('-') || lines[j].trim().startsWith('*')); j++) {
          conventions.push(lines[j].trim().substring(1).trim())
        }
      }
    }

    return {
      name,
      description,
      techStack: techStack.length > 0 ? techStack : undefined,
      architecture,
      conventions: conventions.length > 0 ? conventions : undefined,
      rawContent: content
    }
  }
}
