import * as fs from 'fs/promises'
import * as path from 'path'
import { app } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import { logger } from '../../utils/logger'

export type ObservationType = 'insight' | 'pattern' | 'decision' | 'fact' | 'preference'

export interface Observation {
  uuid: string
  type: ObservationType
  summary: string
  facts: string[]
  relatedFiles?: string[]
  tags?: string[]
  timestamp: number
  projectPath?: string
  metadata?: Record<string, any>
}

export interface ObservationFilter {
  type?: ObservationType
  tags?: string[]
  projectPath?: string
  startDate?: number
  endDate?: number
}

/**
 * Manages observations with UUID identifiers
 * Stores observations as individual JSON files
 */
export class ObservationManager {
  private observationsDir: string
  private cache: Map<string, Observation> = new Map()
  private cacheLoaded = false

  constructor() {
    this.observationsDir = path.join(app.getPath('userData'), 'memory', 'observations')
  }

  /**
   * Initialize observations directory
   */
  async initialize(): Promise<void> {
    await fs.mkdir(this.observationsDir, { recursive: true })
  }

  /**
   * Create a new observation
   */
  async create(obs: Omit<Observation, 'uuid' | 'timestamp'>): Promise<string> {
    const observation: Observation = {
      ...obs,
      uuid: uuidv4(),
      timestamp: Date.now()
    }

    // Save to disk
    const filename = `${observation.uuid}.json`
    const filepath = path.join(this.observationsDir, filename)
    await fs.writeFile(filepath, JSON.stringify(observation, null, 2), 'utf-8')

    // Add to cache
    this.cache.set(observation.uuid, observation)

    return observation.uuid
  }

  /**
   * Get observation by UUID
   */
  async get(uuid: string): Promise<Observation | undefined> {
    // Check cache first
    if (this.cache.has(uuid)) {
      return this.cache.get(uuid)
    }

    // Load from disk
    const filepath = path.join(this.observationsDir, `${uuid}.json`)

    try {
      const content = await fs.readFile(filepath, 'utf-8')
      const observation = JSON.parse(content) as Observation
      this.cache.set(uuid, observation)
      return observation
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        logger.error(`Error loading observation ${uuid}:`, error)
      }
      return undefined
    }
  }

  /**
   * List observations with optional filtering
   */
  async list(filter?: ObservationFilter): Promise<Observation[]> {
    await this.ensureCacheLoaded()

    let observations = Array.from(this.cache.values())

    // Apply filters
    if (filter) {
      if (filter.type) {
        observations = observations.filter(o => o.type === filter.type)
      }

      if (filter.tags && filter.tags.length > 0) {
        observations = observations.filter(o =>
          o.tags?.some(tag => filter.tags!.includes(tag))
        )
      }

      if (filter.projectPath) {
        observations = observations.filter(o => o.projectPath === filter.projectPath)
      }

      if (filter.startDate) {
        observations = observations.filter(o => o.timestamp >= filter.startDate!)
      }

      if (filter.endDate) {
        observations = observations.filter(o => o.timestamp <= filter.endDate!)
      }
    }

    return observations.sort((a, b) => b.timestamp - a.timestamp)
  }

  /**
   * Get recent observations
   */
  async getRecent(count: number, type?: ObservationType): Promise<Observation[]> {
    await this.ensureCacheLoaded()

    let observations = Array.from(this.cache.values())

    if (type) {
      observations = observations.filter(o => o.type === type)
    }

    return observations
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, count)
  }

  /**
   * Search observations by query
   */
  async search(query: string): Promise<Observation[]> {
    await this.ensureCacheLoaded()

    const lowerQuery = query.toLowerCase()

    return Array.from(this.cache.values())
      .filter(o =>
        o.summary.toLowerCase().includes(lowerQuery) ||
        o.facts.some(f => f.toLowerCase().includes(lowerQuery)) ||
        o.tags?.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
        o.relatedFiles?.some(file => file.toLowerCase().includes(lowerQuery))
      )
      .sort((a, b) => b.timestamp - a.timestamp)
  }

  /**
   * Update an existing observation
   */
  async update(uuid: string, updates: Partial<Omit<Observation, 'uuid' | 'timestamp'>>): Promise<boolean> {
    const existing = await this.get(uuid)
    if (!existing) {
      return false
    }

    const updated: Observation = {
      ...existing,
      ...updates
    }

    // Save to disk
    const filepath = path.join(this.observationsDir, `${uuid}.json`)
    await fs.writeFile(filepath, JSON.stringify(updated, null, 2), 'utf-8')

    // Update cache
    this.cache.set(uuid, updated)

    return true
  }

  /**
   * Delete an observation
   */
  async delete(uuid: string): Promise<boolean> {
    const filepath = path.join(this.observationsDir, `${uuid}.json`)

    try {
      await fs.unlink(filepath)
      this.cache.delete(uuid)
      return true
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        logger.error(`Error deleting observation ${uuid}:`, error)
      }
      return false
    }
  }

  /**
   * Get observations by date range
   */
  async getByDateRange(startDate: Date, endDate: Date): Promise<Observation[]> {
    return this.list({
      startDate: startDate.getTime(),
      endDate: endDate.getTime()
    })
  }

  /**
   * Get observations by project
   */
  async getByProject(projectPath: string): Promise<Observation[]> {
    return this.list({ projectPath })
  }

  /**
   * Get observations by type
   */
  async getByType(type: ObservationType): Promise<Observation[]> {
    return this.list({ type })
  }

  /**
   * Get all observations count
   */
  async getCount(): Promise<number> {
    await this.ensureCacheLoaded()
    return this.cache.size
  }

  /**
   * Clear the cache and reload from disk
   */
  async reload(): Promise<void> {
    this.cache.clear()
    this.cacheLoaded = false
    await this.ensureCacheLoaded()
  }

  /**
   * Ensure cache is loaded from disk
   */
  private async ensureCacheLoaded(): Promise<void> {
    if (this.cacheLoaded) return

    try {
      const files = await fs.readdir(this.observationsDir)

      for (const file of files) {
        if (!file.endsWith('.json')) continue

        try {
          const filepath = path.join(this.observationsDir, file)
          const content = await fs.readFile(filepath, 'utf-8')
          const observation = JSON.parse(content) as Observation
          this.cache.set(observation.uuid, observation)
        } catch (error) {
          logger.error(`Error loading observation file ${file}:`, error)
        }
      }

      this.cacheLoaded = true
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        logger.error('Error loading observations:', error)
      }
      this.cacheLoaded = true
    }
  }
}
