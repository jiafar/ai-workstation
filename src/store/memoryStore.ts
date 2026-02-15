import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Memory {
  id: string
  content: string
  type: 'fact' | 'preference' | 'context' | 'important'
  timestamp: number
  source?: string
  metadata?: Record<string, any>
}

interface MemoryState {
  memories: Memory[]
  isLoading: boolean
  enabled: boolean
  maxMemories: number
  
  // Actions
  loadMemories: () => Promise<void>
  addMemory: (content: string, type?: Memory['type'], source?: string) => Promise<void>
  deleteMemory: (id: string) => Promise<void>
  searchMemories: (query: string) => Memory[]
  getRelevantMemories: (query: string, limit?: number) => Memory[]
  toggleEnabled: () => void
  setMaxMemories: (max: number) => void
}

export const useMemoryStore = create<MemoryState>()(
  persist(
    (set, get) => ({
      memories: [],
      isLoading: false,
      enabled: true,
      maxMemories: 5,

      loadMemories: async () => {
        try {
          set({ isLoading: true })
          // Load from database
          const result = await window.api.db.memories.list()
          const memories: Memory[] = (result as any[]).map((m) => ({
            id: m.id,
            content: m.content,
            type: m.type || 'fact',
            timestamp: m.timestamp,
            source: m.context,
            metadata: m.metadata ? JSON.parse(m.metadata) : undefined,
          }))
          set({ memories })
        } catch (error) {
          console.error('Failed to load memories:', error)
        } finally {
          set({ isLoading: false })
        }
      },

      addMemory: async (content: string, type: Memory['type'] = 'fact', source?: string) => {
        try {
          const memory: Memory = {
            id: crypto.randomUUID(),
            content,
            type,
            timestamp: Date.now(),
            source,
          }
          
          // Save to database
          await window.api.db.memories.create({
            id: memory.id,
            type: memory.type,
            content: memory.content,
            context: source || null,
            timestamp: memory.timestamp,
            metadata: JSON.stringify({}),
          })
          
          set((state) => ({
            memories: [memory, ...state.memories],
          }))
        } catch (error) {
          console.error('Failed to add memory:', error)
          throw error
        }
      },

      deleteMemory: async (id: string) => {
        try {
          await window.api.db.memories.delete(id)
          set((state) => ({
            memories: state.memories.filter((m) => m.id !== id),
          }))
        } catch (error) {
          console.error('Failed to delete memory:', error)
          throw error
        }
      },

      searchMemories: (query: string) => {
        const { memories } = get()
        if (!query.trim()) return memories
        
        const lowerQuery = query.toLowerCase()
        return memories.filter((m) =>
          m.content.toLowerCase().includes(lowerQuery)
        )
      },

      getRelevantMemories: (query: string, limit = 5) => {
        const { memories, enabled } = get()
        if (!enabled || memories.length === 0) return []
        
        // Simple relevance scoring based on keyword overlap
        const queryWords = query.toLowerCase().split(/\s+/)
        
        const scored = memories.map((memory) => {
          const memoryWords = memory.content.toLowerCase().split(/\s+/)
          const overlap = queryWords.filter((w) =>
            memoryWords.some((mw) => mw.includes(w) || w.includes(mw))
          ).length
          const score = overlap / Math.max(queryWords.length, 1)
          return { memory, score }
        })
        
        return scored
          .sort((a, b) => b.score - a.score)
          .slice(0, limit)
          .map((s) => s.memory)
      },

      toggleEnabled: () => {
        set((state) => ({ enabled: !state.enabled }))
      },

      setMaxMemories: (max: number) => {
        set({ maxMemories: max })
      },
    }),
    {
      name: 'memory-settings',
      partialize: (state) => ({ enabled: state.enabled, maxMemories: state.maxMemories }),
    }
  )
)

export default useMemoryStore
