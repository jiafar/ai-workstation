import { WorkingMemory, WorkingMemoryEntry } from './WorkingMemory'
import { ProjectMemory, ProjectContext, ProjectDecision } from './ProjectMemory'
import { PersonalMemory, PersonalIdentity, CoreMemory } from './PersonalMemory'
import { KnowledgeBase, KnowledgeEntry, SearchResult } from './KnowledgeBase'
import { CodebookCompressor } from './CodebookCompressor'
import { ObservationManager, Observation, ObservationType } from './ObservationManager'
import * as path from 'path'
import { app } from 'electron'

export interface SessionContext {
  identity?: PersonalIdentity
  soul?: CoreMemory
  memoryL0?: string
  memoryL1?: string
  todayLog?: string
  projectContext?: ProjectContext
  recentDecisions: ProjectDecision[]
  recentObservations: Observation[]
  stats: {
    workingMemoryEntries: number
    knowledgeBaseEntries: number
    observationCount: number
  }
}

export interface MemoryEntry {
  id: string
  layer: number
  type: string
  content: string
  timestamp: number
  metadata?: Record<string, any>
}

/**
 * Core Memory Orchestrator
 * Implements 4-layer memory architecture:
 * L1: Working Memory (session-level, in-memory)
 * L2: Project Memory (project-level, disk-persisted)
 * L3: Personal Memory (cross-project, disk-persisted)
 * L4: Knowledge Base (long-term knowledge, compressed)
 */
export class MemoryManager {
  private working: WorkingMemory
  private project: ProjectMemory
  private personal: PersonalMemory
  private knowledge: KnowledgeBase
  private compressor: CodebookCompressor
  private observations: ObservationManager
  private static instance: MemoryManager
  private initialized = false
  private currentProjectPath?: string

  private constructor() {
    this.working = new WorkingMemory()
    this.project = new ProjectMemory()
    this.personal = new PersonalMemory()
    this.compressor = new CodebookCompressor()
    this.knowledge = new KnowledgeBase(this.compressor)
    this.observations = new ObservationManager()
  }

  /**
   * Get singleton instance
   */
  static getInstance(): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager()
    }
    return MemoryManager.instance
  }

  /**
   * Initialize the memory system
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    await this.personal.initialize()
    await this.knowledge.initialize()
    await this.observations.initialize()

    this.initialized = true
  }

  /**
   * Load session context
   * Protocol:
   * 1. Load L0 core identity (~200 tokens): USER.md + SOUL.md + MEMORY-L0.md
   * 2. Detect active project → load PROJECT.md + recent 7-day decisions
   * 3. Load L1 detailed context (~500 tokens): MEMORY.md + recent 3 observations + today's log
   * 4. Initialize empty working memory buffer
   */
  async loadSession(projectPath?: string): Promise<SessionContext> {
    await this.initialize()

    // Clear working memory for new session
    this.working.clear()

    // L0: Load core identity
    const identity = await this.personal.loadIdentity()
    const soul = await this.personal.loadSoul()
    const memoryL0 = await this.personal.getMemoryL0()

    // L2: Load project context if project path provided
    let projectContext: ProjectContext | undefined
    let recentDecisions: ProjectDecision[] = []

    if (projectPath) {
      this.currentProjectPath = projectPath
      await this.project.load(projectPath)
      projectContext = this.project.getProjectContext()
      recentDecisions = this.project.getRecentDecisions(7) // Last 7 days
    }

    // L1: Load detailed context
    const memoryL1 = await this.personal.getMemoryL1()
    const todayLog = await this.personal.getTodayLog()
    const recentObservations = await this.observations.getRecent(3) // Last 3 observations

    // Get stats
    const stats = {
      workingMemoryEntries: this.working.getStats().totalEntries,
      knowledgeBaseEntries: await this.knowledge.getCount(),
      observationCount: await this.observations.getCount()
    }

    return {
      identity,
      soul,
      memoryL0,
      memoryL1,
      todayLog,
      projectContext,
      recentDecisions,
      recentObservations,
      stats
    }
  }

  /**
   * Save observation with UUID
   */
  async saveObservation(obs: {
    type: ObservationType
    summary: string
    facts: string[]
    relatedFiles?: string[]
    tags?: string[]
    metadata?: Record<string, any>
  }): Promise<string> {
    await this.initialize()

    const uuid = await this.observations.create({
      ...obs,
      projectPath: this.currentProjectPath
    })

    // Also add to today's log
    const logEntry = `### Observation: ${obs.summary}\nType: ${obs.type}\nUUID: ${uuid}\nFacts:\n${obs.facts.map(f => `- ${f}`).join('\n')}`
    await this.personal.appendToDailyLog(logEntry)

    return uuid
  }

  /**
   * Query across memory layers
   */
  async query(query: string, layer?: number): Promise<MemoryEntry[]> {
    await this.initialize()

    const results: MemoryEntry[] = []

    // L1: Working Memory
    if (layer === undefined || layer === 1) {
      const workingEntries = this.working.getAll()
      for (const entry of workingEntries) {
        if (entry.content.toLowerCase().includes(query.toLowerCase())) {
          results.push({
            id: entry.id,
            layer: 1,
            type: entry.type,
            content: entry.content,
            timestamp: entry.timestamp,
            metadata: entry.metadata
          })
        }
      }
    }

    // L2: Project Memory
    if (layer === undefined || layer === 2) {
      const decisions = this.project.searchDecisions(query)
      for (const decision of decisions) {
        results.push({
          id: decision.id,
          layer: 2,
          type: 'decision',
          content: `${decision.title}\n${decision.decision}\n${decision.rationale}`,
          timestamp: decision.timestamp,
          metadata: { tags: decision.tags, relatedFiles: decision.relatedFiles }
        })
      }
    }

    // L3: Personal Memory (observations)
    if (layer === undefined || layer === 3) {
      const observations = await this.observations.search(query)
      for (const obs of observations) {
        results.push({
          id: obs.uuid,
          layer: 3,
          type: obs.type,
          content: `${obs.summary}\n${obs.facts.join('\n')}`,
          timestamp: obs.timestamp,
          metadata: { tags: obs.tags, relatedFiles: obs.relatedFiles }
        })
      }
    }

    // L4: Knowledge Base
    if (layer === undefined || layer === 4) {
      const searchResults = await this.knowledge.search(query, 10)
      for (const result of searchResults) {
        const entry = result.entry
        results.push({
          id: entry.id,
          layer: 4,
          type: entry.type,
          content: this.knowledge.getDecompressedContent(entry),
          timestamp: entry.timestamp,
          metadata: { tags: entry.tags, score: result.score }
        })
      }
    }

    // Sort by timestamp (most recent first)
    return results.sort((a, b) => b.timestamp - a.timestamp)
  }

  /**
   * Compress working memory using codebook
   * Moves working memory entries to knowledge base
   */
  async compress(): Promise<void> {
    await this.initialize()

    const workingEntries = this.working.getAll()

    // Group entries by type for compression
    const contentByType: Record<string, string[]> = {}

    for (const entry of workingEntries) {
      if (!contentByType[entry.type]) {
        contentByType[entry.type] = []
      }
      contentByType[entry.type].push(entry.content)
    }

    // Add significant entries to knowledge base
    for (const entry of workingEntries) {
      // Only compress substantial content (> 100 chars)
      if (entry.content.length > 100) {
        await this.knowledge.addEntry(
          `Working memory: ${entry.type}`,
          entry.content,
          'other',
          [entry.type, 'compressed-from-working-memory'],
          entry.metadata
        )
      }
    }

    // Clear working memory after compression
    this.working.clear()

    // Rebuild codebook periodically
    const kbCount = await this.knowledge.getCount()
    if (kbCount > 0 && kbCount % 100 === 0) {
      await this.knowledge.rebuildCodebook()
    }
  }

  /**
   * Get context for AI (used by ContextBuilder)
   */
  async getContextForAI(query: string): Promise<{
    systemPrompt: string
    relevantMemories: MemoryEntry[]
  }> {
    await this.initialize()

    // Build system prompt from L0 and L1 memory
    const identity = this.personal.getIdentity()
    const soul = this.personal.getSoul()
    const memoryL0 = await this.personal.getMemoryL0()
    const memoryL1 = await this.personal.getMemoryL1()

    let systemPrompt = '# Core Identity\n\n'

    if (identity) {
      systemPrompt += `Name: ${identity.name || 'User'}\n`
      systemPrompt += `Role: ${identity.role || 'Developer'}\n\n`
    }

    if (soul) {
      systemPrompt += '## Essence\n'
      systemPrompt += soul.essence.map(e => `- ${e}`).join('\n') + '\n\n'
      systemPrompt += '## Principles\n'
      systemPrompt += soul.principles.map(p => `- ${p}`).join('\n') + '\n\n'
    }

    if (memoryL0) {
      systemPrompt += '## Core Memory (L0)\n'
      systemPrompt += memoryL0 + '\n\n'
    }

    if (memoryL1) {
      systemPrompt += '## Detailed Context (L1)\n'
      systemPrompt += memoryL1 + '\n\n'
    }

    // Add project context if available
    const projectContext = this.project.getProjectContext()
    if (projectContext) {
      systemPrompt += '## Current Project\n'
      systemPrompt += `Name: ${projectContext.name}\n`
      if (projectContext.description) {
        systemPrompt += `Description: ${projectContext.description}\n`
      }
      if (projectContext.techStack) {
        systemPrompt += `Tech Stack: ${projectContext.techStack.join(', ')}\n`
      }
      systemPrompt += '\n'
    }

    // Query relevant memories
    const relevantMemories = await this.query(query)

    return {
      systemPrompt,
      relevantMemories: relevantMemories.slice(0, 20) // Limit to top 20 most relevant
    }
  }

  /**
   * Get working memory instance
   */
  getWorkingMemory(): WorkingMemory {
    return this.working
  }

  /**
   * Get project memory instance
   */
  getProjectMemory(): ProjectMemory {
    return this.project
  }

  /**
   * Get personal memory instance
   */
  getPersonalMemory(): PersonalMemory {
    return this.personal
  }

  /**
   * Get knowledge base instance
   */
  getKnowledgeBase(): KnowledgeBase {
    return this.knowledge
  }

  /**
   * Get observation manager instance
   */
  getObservationManager(): ObservationManager {
    return this.observations
  }

  /**
   * Get compressor instance
   */
  getCompressor(): CodebookCompressor {
    return this.compressor
  }

  /**
   * Save project decision
   */
  async saveProjectDecision(decision: {
    title: string
    decision: string
    rationale: string
    alternatives?: string[]
    tags?: string[]
    relatedFiles?: string[]
  }): Promise<string> {
    await this.initialize()

    if (!this.currentProjectPath) {
      throw new Error('No project loaded')
    }

    return this.project.saveDecision(decision)
  }

  /**
   * Add entry to working memory
   */
  addToWorkingMemory(type: WorkingMemoryEntry['type'], content: string, metadata?: Record<string, any>): void {
    this.working.addEntry(type, content, metadata)
  }

  /**
   * Add entry to knowledge base
   */
  async addToKnowledgeBase(
    title: string,
    content: string,
    type: KnowledgeEntry['type'],
    tags: string[] = []
  ): Promise<string> {
    await this.initialize()
    return this.knowledge.addEntry(title, content, type, tags)
  }

  /**
   * Get memory statistics
   */
  async getStats(): Promise<{
    working: ReturnType<WorkingMemory['getStats']>
    project: { decisions: number; hasContext: boolean }
    personal: { hasIdentity: boolean; hasSoul: boolean; hasL0: boolean; hasL1: boolean }
    knowledge: Awaited<ReturnType<KnowledgeBase['getCompressionStats']>>
    observations: { total: number }
  }> {
    await this.initialize()

    return {
      working: this.working.getStats(),
      project: {
        decisions: this.project.getAllDecisions().length,
        hasContext: this.project.getProjectContext() !== undefined
      },
      personal: {
        hasIdentity: this.personal.getIdentity() !== undefined,
        hasSoul: this.personal.getSoul() !== undefined,
        hasL0: (await this.personal.getMemoryL0()) !== undefined,
        hasL1: (await this.personal.getMemoryL1()) !== undefined
      },
      knowledge: this.knowledge.getCompressionStats(),
      observations: {
        total: await this.observations.getCount()
      }
    }
  }
}
