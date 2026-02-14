import * as fs from 'fs/promises'
import * as path from 'path'
import { app } from 'electron'
import { CodebookCompressor } from './CodebookCompressor'

export interface KnowledgeEntry {
  id: string
  title: string
  content: string
  type: 'technical' | 'concept' | 'pattern' | 'documentation' | 'reference' | 'other'
  tags: string[]
  timestamp: number
  compressed?: boolean
  compressedContent?: string
  metadata?: Record<string, any>
}

export interface SearchResult {
  entry: KnowledgeEntry
  score: number
}

/**
 * Layer 4: Knowledge Base - Long-term knowledge storage
 * Wraps vector storage and codebook compression
 * Note: Full LanceDB integration would require additional dependencies
 * This implementation uses a simple file-based approach with compression
 */
export class KnowledgeBase {
  private knowledgeDir: string
  private compressor: CodebookCompressor
  private entriesCache: Map<string, KnowledgeEntry> = new Map()
  private cacheLoaded = false
  private codebookFile: string

  constructor(compressor: CodebookCompressor) {
    this.knowledgeDir = path.join(app.getPath('userData'), 'memory', 'knowledge')
    this.codebookFile = path.join(this.knowledgeDir, '.codebook.json')
    this.compressor = compressor
  }

  /**
   * Initialize knowledge base
   */
  async initialize(): Promise<void> {
    await fs.mkdir(this.knowledgeDir, { recursive: true })

    // Load codebook if exists
    try {
      const codebookData = await fs.readFile(this.codebookFile, 'utf-8')
      this.compressor.loadCodebook(codebookData)
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.error('Error loading codebook:', error)
      }
      // If no codebook exists yet, that's okay
    }
  }

  /**
   * Add a new knowledge entry
   */
  async addEntry(
    title: string,
    content: string,
    type: KnowledgeEntry['type'],
    tags: string[] = [],
    metadata?: Record<string, any>
  ): Promise<string> {
    const id = `kb-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // Compress content if codebook is available
    let compressed = false
    let compressedContent: string | undefined

    if (this.compressor.getStats().entries > 0) {
      compressedContent = this.compressor.compress(content)
      compressed = true
    }

    const entry: KnowledgeEntry = {
      id,
      title,
      content,
      type,
      tags,
      timestamp: Date.now(),
      compressed,
      compressedContent,
      metadata
    }

    // Save to disk
    const filepath = path.join(this.knowledgeDir, `${id}.json`)
    await fs.writeFile(filepath, JSON.stringify(entry, null, 2), 'utf-8')

    // Add to cache
    this.entriesCache.set(id, entry)

    return id
  }

  /**
   * Get entry by ID
   */
  async get(id: string): Promise<KnowledgeEntry | undefined> {
    // Check cache first
    if (this.entriesCache.has(id)) {
      return this.entriesCache.get(id)
    }

    // Load from disk
    const filepath = path.join(this.knowledgeDir, `${id}.json`)

    try {
      const content = await fs.readFile(filepath, 'utf-8')
      const entry = JSON.parse(content) as KnowledgeEntry
      this.entriesCache.set(id, entry)
      return entry
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.error(`Error loading knowledge entry ${id}:`, error)
      }
      return undefined
    }
  }

  /**
   * Search entries by text query
   */
  async search(query: string, limit = 10): Promise<SearchResult[]> {
    await this.ensureCacheLoaded()

    const lowerQuery = query.toLowerCase()
    const results: SearchResult[] = []

    for (const entry of this.entriesCache.values()) {
      let score = 0

      // Title match (highest weight)
      if (entry.title.toLowerCase().includes(lowerQuery)) {
        score += 10
      }

      // Content match
      if (entry.content.toLowerCase().includes(lowerQuery)) {
        score += 5
      }

      // Tag match
      if (entry.tags.some(tag => tag.toLowerCase().includes(lowerQuery))) {
        score += 7
      }

      // Type match
      if (entry.type.toLowerCase().includes(lowerQuery)) {
        score += 3
      }

      if (score > 0) {
        results.push({ entry, score })
      }
    }

    // Sort by score and limit
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
  }

  /**
   * Get entries by type
   */
  async getByType(type: KnowledgeEntry['type']): Promise<KnowledgeEntry[]> {
    await this.ensureCacheLoaded()

    return Array.from(this.entriesCache.values())
      .filter(e => e.type === type)
      .sort((a, b) => b.timestamp - a.timestamp)
  }

  /**
   * Get entries by tags
   */
  async getByTags(tags: string[]): Promise<KnowledgeEntry[]> {
    await this.ensureCacheLoaded()

    return Array.from(this.entriesCache.values())
      .filter(e => e.tags.some(tag => tags.includes(tag)))
      .sort((a, b) => b.timestamp - a.timestamp)
  }

  /**
   * Update an entry
   */
  async update(id: string, updates: Partial<Omit<KnowledgeEntry, 'id' | 'timestamp'>>): Promise<boolean> {
    const existing = await this.get(id)
    if (!existing) {
      return false
    }

    const updated: KnowledgeEntry = {
      ...existing,
      ...updates
    }

    // Recompress if content changed and codebook available
    if (updates.content && this.compressor.getStats().entries > 0) {
      updated.compressedContent = this.compressor.compress(updates.content)
      updated.compressed = true
    }

    // Save to disk
    const filepath = path.join(this.knowledgeDir, `${id}.json`)
    await fs.writeFile(filepath, JSON.stringify(updated, null, 2), 'utf-8')

    // Update cache
    this.entriesCache.set(id, updated)

    return true
  }

  /**
   * Delete an entry
   */
  async delete(id: string): Promise<boolean> {
    const filepath = path.join(this.knowledgeDir, `${id}.json`)

    try {
      await fs.unlink(filepath)
      this.entriesCache.delete(id)
      return true
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.error(`Error deleting knowledge entry ${id}:`, error)
      }
      return false
    }
  }

  /**
   * Get all entries
   */
  async getAll(): Promise<KnowledgeEntry[]> {
    await this.ensureCacheLoaded()
    return Array.from(this.entriesCache.values())
      .sort((a, b) => b.timestamp - a.timestamp)
  }

  /**
   * Get entry count
   */
  async getCount(): Promise<number> {
    await this.ensureCacheLoaded()
    return this.entriesCache.size
  }

  /**
   * Rebuild codebook from all entries and recompress
   */
  async rebuildCodebook(): Promise<void> {
    await this.ensureCacheLoaded()

    const allContent = Array.from(this.entriesCache.values()).map(e => e.content)

    // Learn new codebook
    await this.compressor.learn(allContent)

    // Save codebook
    const codebookData = this.compressor.saveCodebook()
    await fs.writeFile(this.codebookFile, codebookData, 'utf-8')

    // Recompress all entries
    for (const entry of this.entriesCache.values()) {
      entry.compressedContent = this.compressor.compress(entry.content)
      entry.compressed = true

      // Save updated entry
      const filepath = path.join(this.knowledgeDir, `${entry.id}.json`)
      await fs.writeFile(filepath, JSON.stringify(entry, null, 2), 'utf-8')
    }
  }

  /**
   * Get decompressed content for an entry
   */
  getDecompressedContent(entry: KnowledgeEntry): string {
    if (entry.compressed && entry.compressedContent) {
      try {
        return this.compressor.decompress(entry.compressedContent)
      } catch (error) {
        console.error('Error decompressing content:', error)
        return entry.content
      }
    }
    return entry.content
  }

  /**
   * Get compression statistics
   */
  getCompressionStats(): {
    totalEntries: number
    compressedEntries: number
    codebookSize: number
    avgCompressionRatio: number
  } {
    const total = this.entriesCache.size
    let compressed = 0
    let totalRatio = 0

    for (const entry of this.entriesCache.values()) {
      if (entry.compressed && entry.compressedContent) {
        compressed++
        totalRatio += entry.compressedContent.length / entry.content.length
      }
    }

    return {
      totalEntries: total,
      compressedEntries: compressed,
      codebookSize: this.compressor.getStats().entries,
      avgCompressionRatio: compressed > 0 ? totalRatio / compressed : 1.0
    }
  }

  /**
   * Semantic search placeholder
   * In a full implementation, this would use vector embeddings
   */
  async semanticSearch(embedding: number[], limit = 10): Promise<SearchResult[]> {
    // Placeholder: In production, this would use LanceDB or similar
    // For now, fall back to text search
    console.warn('semanticSearch not fully implemented, using text search fallback')
    return []
  }

  /**
   * Ensure cache is loaded from disk
   */
  private async ensureCacheLoaded(): Promise<void> {
    if (this.cacheLoaded) return

    try {
      const files = await fs.readdir(this.knowledgeDir)

      for (const file of files) {
        if (!file.endsWith('.json') || file.startsWith('.')) continue

        try {
          const filepath = path.join(this.knowledgeDir, file)
          const content = await fs.readFile(filepath, 'utf-8')
          const entry = JSON.parse(content) as KnowledgeEntry
          this.entriesCache.set(entry.id, entry)
        } catch (error) {
          console.error(`Error loading knowledge entry file ${file}:`, error)
        }
      }

      this.cacheLoaded = true
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.error('Error loading knowledge base:', error)
      }
      this.cacheLoaded = true
    }
  }
}
