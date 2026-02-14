import { create } from 'zustand'
import type { EditorTab } from '../types/index'

interface EditorState {
  tabs: EditorTab[]
  activeTabId: string | null
  openFile: (path: string, name: string, content: string, language: string) => void
  closeTab: (id: string) => void
  setActiveTab: (id: string) => void
  updateContent: (id: string, content: string) => void
  markSaved: (id: string) => void
  closeAllTabs: () => void
  closeOtherTabs: (id: string) => void
  getActiveTab: () => EditorTab | null
}

export const useEditorStore = create<EditorState>((set, get) => ({
  tabs: [],
  activeTabId: null,

  openFile: (path, name, content, language) => set((state) => {
    const existingTab = state.tabs.find((tab) => tab.path === path)

    if (existingTab) {
      return {
        tabs: state.tabs.map((tab) => ({
          ...tab,
          isActive: tab.id === existingTab.id,
        })),
        activeTabId: existingTab.id,
      }
    }

    const newTab: EditorTab = {
      id: `${Date.now()}-${Math.random()}`,
      path,
      name,
      content,
      language,
      isDirty: false,
      isActive: true,
    }

    return {
      tabs: [
        ...state.tabs.map((tab) => ({ ...tab, isActive: false })),
        newTab,
      ],
      activeTabId: newTab.id,
    }
  }),

  closeTab: (id) => set((state) => {
    const tabs = state.tabs.filter((tab) => tab.id !== id)
    let activeTabId = state.activeTabId

    if (state.activeTabId === id) {
      const closedIndex = state.tabs.findIndex((tab) => tab.id === id)
      if (tabs.length > 0) {
        const newActiveTab = tabs[Math.max(0, closedIndex - 1)]
        activeTabId = newActiveTab.id
        return {
          tabs: tabs.map((tab) => ({
            ...tab,
            isActive: tab.id === activeTabId,
          })),
          activeTabId,
        }
      } else {
        activeTabId = null
      }
    }

    return { tabs, activeTabId }
  }),

  setActiveTab: (id) => set((state) => ({
    tabs: state.tabs.map((tab) => ({
      ...tab,
      isActive: tab.id === id,
    })),
    activeTabId: id,
  })),

  updateContent: (id, content) => set((state) => ({
    tabs: state.tabs.map((tab) =>
      tab.id === id ? { ...tab, content, isDirty: true } : tab
    ),
  })),

  markSaved: (id) => set((state) => ({
    tabs: state.tabs.map((tab) =>
      tab.id === id ? { ...tab, isDirty: false } : tab
    ),
  })),

  closeAllTabs: () => set({ tabs: [], activeTabId: null }),

  closeOtherTabs: (id) => set((state) => {
    const tab = state.tabs.find((t) => t.id === id)
    if (!tab) return state

    return {
      tabs: [{ ...tab, isActive: true }],
      activeTabId: id,
    }
  }),

  getActiveTab: () => {
    const state = get()
    return state.tabs.find((tab) => tab.id === state.activeTabId) || null
  },
}))
