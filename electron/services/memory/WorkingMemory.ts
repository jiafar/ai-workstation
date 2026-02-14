import { v4 as uuidv4 } from 'uuid'

export interface WorkingMemoryEntry {
  id: string
  type: 'file_buffer' | 'edit_history' | 'terminal_output' | 'conversation' | 'other'
  content: string
  timestamp: number
  metadata?: Record<string, any>
}

/**
 * Layer 1: Working Memory - Session-level memory
 * Stores active file buffers, edit history, terminal output, conversation context
 * In-memory only, not persisted to disk
 */
export class WorkingMemory {
  private entries: WorkingMemoryEntry[] = []
  private maxTerminalLines = 100
  private maxConversationMessages = 10
  private maxTotalEntries = 1000

  /**
   * Add a new entry to working memory
   */
  addEntry(type: WorkingMemoryEntry['type'], content: string, metadata?: Record<string, any>): void {
    const entry: WorkingMemoryEntry = {
      id: uuidv4(),
      type,
      content,
      timestamp: Date.now(),
      metadata
    }

    this.entries.push(entry)

    // Apply memory limits based on type
    this.enforceMemoryLimits()
  }

  /**
   * Get recent entries by count
   */
  getRecent(count: number, type?: WorkingMemoryEntry['type']): WorkingMemoryEntry[] {
    let filtered = this.entries

    if (type) {
      filtered = this.entries.filter(e => e.type === type)
    }

    return filtered.slice(-count)
  }

  /**
   * Get all entries
   */
  getAll(type?: WorkingMemoryEntry['type']): WorkingMemoryEntry[] {
    if (type) {
      return this.entries.filter(e => e.type === type)
    }
    return [...this.entries]
  }

  /**
   * Get entries by type
   */
  getByType(type: WorkingMemoryEntry['type']): WorkingMemoryEntry[] {
    return this.entries.filter(e => e.type === type)
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.entries = []
  }

  /**
   * Clear entries by type
   */
  clearByType(type: WorkingMemoryEntry['type']): void {
    this.entries = this.entries.filter(e => e.type !== type)
  }

  /**
   * Serialize working memory to JSON
   */
  serialize(): string {
    return JSON.stringify({
      entries: this.entries,
      timestamp: Date.now()
    }, null, 2)
  }

  /**
   * Get memory statistics
   */
  getStats(): {
    totalEntries: number
    byType: Record<string, number>
    oldestEntry?: number
    newestEntry?: number
  } {
    const byType: Record<string, number> = {}

    for (const entry of this.entries) {
      byType[entry.type] = (byType[entry.type] || 0) + 1
    }

    return {
      totalEntries: this.entries.length,
      byType,
      oldestEntry: this.entries[0]?.timestamp,
      newestEntry: this.entries[this.entries.length - 1]?.timestamp
    }
  }

  /**
   * Enforce memory limits to prevent unbounded growth
   */
  private enforceMemoryLimits(): void {
    // Limit terminal output entries
    const terminalEntries = this.entries.filter(e => e.type === 'terminal_output')
    if (terminalEntries.length > this.maxTerminalLines) {
      const toRemove = terminalEntries.slice(0, terminalEntries.length - this.maxTerminalLines)
      this.entries = this.entries.filter(e => !toRemove.includes(e))
    }

    // Limit conversation entries
    const conversationEntries = this.entries.filter(e => e.type === 'conversation')
    if (conversationEntries.length > this.maxConversationMessages) {
      const toRemove = conversationEntries.slice(0, conversationEntries.length - this.maxConversationMessages)
      this.entries = this.entries.filter(e => !toRemove.includes(e))
    }

    // Limit total entries (keep most recent)
    if (this.entries.length > this.maxTotalEntries) {
      this.entries = this.entries.slice(-this.maxTotalEntries)
    }
  }
}
