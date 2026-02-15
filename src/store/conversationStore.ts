import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Conversation {
  id: string
  title: string
  created_at: number
  updated_at: number
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  isStreaming?: boolean
}

interface ConversationState {
  conversations: Conversation[]
  currentConversationId: string | null
  messages: ChatMessage[]
  isLoading: boolean
  
  // Actions
  loadConversations: () => Promise<void>
  createConversation: (title: string) => Promise<void>
  switchConversation: (id: string) => Promise<void>
  deleteConversation: (id: string) => Promise<void>
  
  // Message actions
  loadMessages: (conversationId: string) => Promise<void>
  saveMessage: (message: ChatMessage) => Promise<void>
  updateMessage: (messageId: string, content: string) => Promise<void>
  clearMessages: () => void
  
  // Local state
  addLocalMessage: (message: ChatMessage) => void
  updateLocalLastMessage: (content: string) => void
  setLocalMessageStreaming: (messageId: string, isStreaming: boolean) => void
  removeLocalMessage: (messageId: string) => void
}

export const useConversationStore = create<ConversationState>()(
  persist(
    (set, get) => ({
      conversations: [],
      currentConversationId: null,
      messages: [],
      isLoading: false,

      loadConversations: async () => {
        try {
          const conversations = await window.api.db.conversations.list({ limit: 100 })
          set({ conversations: conversations as Conversation[] })
        } catch (error) {
          console.error('Failed to load conversations:', error)
        }
      },

      createConversation: async (title: string) => {
        try {
          const id = crypto.randomUUID()
          await window.api.db.conversations.create({ id, title })
          
          const newConversation: Conversation = {
            id,
            title,
            created_at: Date.now(),
            updated_at: Date.now(),
          }
          
          set((state) => ({
            conversations: [newConversation, ...state.conversations],
            currentConversationId: id,
            messages: [],
          }))
        } catch (error) {
          console.error('Failed to create conversation:', error)
          throw error
        }
      },

      switchConversation: async (id: string) => {
        const { currentConversationId, loadMessages } = get()
        if (currentConversationId === id) return
        
        set({ currentConversationId: id, messages: [] })
        await loadMessages(id)
      },

      deleteConversation: async (id: string) => {
        try {
          // Call backend API to delete conversation
          await window.api.db.conversations.delete(id)
          
          set((state) => {
            const newConversations = state.conversations.filter((c) => c.id !== id)
            const newCurrentId = state.currentConversationId === id 
              ? (newConversations[0]?.id || null)
              : state.currentConversationId
            
            return {
              conversations: newConversations,
              currentConversationId: newCurrentId,
              messages: newCurrentId !== state.currentConversationId ? [] : state.messages,
            }
          })
        } catch (error) {
          console.error('Failed to delete conversation:', error)
          throw error
        }
      },

      loadMessages: async (conversationId: string) => {
        try {
          const messages = await window.api.db.messages.list(conversationId)
          // Convert database messages to ChatMessage format
          const chatMessages: ChatMessage[] = (messages as any[]).map((msg) => ({
            id: msg.id,
            role: msg.role,
            content: msg.content,
            timestamp: msg.timestamp,
          }))
          set({ messages: chatMessages })
        } catch (error) {
          console.error('Failed to load messages:', error)
        }
      },

      saveMessage: async (message: ChatMessage) => {
        const { currentConversationId } = get()
        if (!currentConversationId) return

        try {
          await window.api.db.messages.create({
            id: message.id,
            conversation_id: currentConversationId,
            role: message.role,
            content: message.content,
            timestamp: message.timestamp,
            metadata: JSON.stringify({}),
          })
          
          // Update conversation timestamp
          set((state) => ({
            conversations: state.conversations.map((c) =>
              c.id === currentConversationId
                ? { ...c, updated_at: Date.now() }
                : c
            ),
          }))
        } catch (error) {
          console.error('Failed to save message:', error)
        }
      },

      updateMessage: async (messageId: string, content: string) => {
        // For now, just update local state
        // In a full implementation, you'd update the database too
        set((state) => ({
          messages: state.messages.map((m) =>
            m.id === messageId ? { ...m, content } : m
          ),
        }))
      },

      clearMessages: () => {
        set({ messages: [] })
      },

      // Local state actions (for UI updates)
      addLocalMessage: (message: ChatMessage) => {
        set((state) => ({
          messages: [...state.messages, message],
        }))
      },

      updateLocalLastMessage: (content: string) => {
        set((state) => {
          if (state.messages.length === 0) return state
          const messages = [...state.messages]
          const lastMessage = messages[messages.length - 1]
          messages[messages.length - 1] = { ...lastMessage, content }
          return { messages }
        })
      },

      setLocalMessageStreaming: (messageId: string, isStreaming: boolean) => {
        set((state) => ({
          messages: state.messages.map((m) =>
            m.id === messageId ? { ...m, isStreaming } : m
          ),
        }))
      },

      removeLocalMessage: (messageId: string) => {
        set((state) => ({
          messages: state.messages.filter((m) => m.id !== messageId),
        }))
      },
    }),
    {
      name: 'conversation-storage',
      partialize: (state) => ({ currentConversationId: state.currentConversationId }),
    }
  )
)

export default useConversationStore
