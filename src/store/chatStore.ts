import { create } from 'zustand'
import type { ChatMessage } from '../types/index'

interface ChatState {
  messages: ChatMessage[]
  isStreaming: boolean
  currentModel: string
  addMessage: (message: ChatMessage) => void
  updateLastMessage: (content: string) => void
  setStreaming: (streaming: boolean) => void
  clearMessages: () => void
  setModel: (model: string) => void
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isStreaming: false,
  currentModel: 'claude-opus-4-6',

  addMessage: (message) => set((state) => ({
    messages: [...state.messages, message],
  })),

  updateLastMessage: (content) => set((state) => {
    if (state.messages.length === 0) return state

    const messages = [...state.messages]
    const lastMessage = messages[messages.length - 1]
    messages[messages.length - 1] = { ...lastMessage, content }

    return { messages }
  }),

  setStreaming: (streaming) => set({ isStreaming: streaming }),

  clearMessages: () => set({ messages: [] }),

  setModel: (model) => set({ currentModel: model }),
}))
