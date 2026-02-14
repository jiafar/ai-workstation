import { create } from 'zustand'
import type { CursorPosition, EditorTab } from '../types/index'

interface EditorState {
  tabs: EditorTab[]
  activeTabId: string | null
  autoSave: boolean
  openFile: (path: string, name: string, content: string, language: string) => void
  closeTab: (id: string) => Promise<boolean>
  setActiveTab: (id: string) => void
  updateContent: (id: string, content: string) => void
  saveFile: (id: string) => Promise<boolean>
  saveActiveFile: () => Promise<boolean>
  closeAllTabs: () => Promise<boolean>
  closeOtherTabs: (id: string) => Promise<boolean>
  getActiveTab: () => EditorTab | null
  updateCursorPosition: (id: string, position: CursorPosition) => void
  updateScrollPosition: (id: string, scrollTop: number) => void
  toggleAutoSave: () => void
  hasUnsavedChanges: () => boolean
  getDirtyTabs: () => EditorTab[]
}

export const useEditorStore = create<EditorState>((set, get) => ({
  tabs: [],
  activeTabId: null,
  autoSave: false,

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
      originalContent: content,
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

  closeTab: async (id) => {
    const state = get()
    const tab = state.tabs.find((t) => t.id === id)
    
    if (tab?.isDirty) {
      const shouldSave = confirm(`"${tab.name}" has unsaved changes. Save before closing?`)
      if (shouldSave) {
        const saved = await get().saveFile(id)
        if (!saved) return false
      }
    }

    set((state) => {
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
    })
    
    return true
  },

  setActiveTab: (id) => set((state) => ({
    tabs: state.tabs.map((tab) => ({
      ...tab,
      isActive: tab.id === id,
    })),
    activeTabId: id,
  })),

  updateContent: (id, content) => {
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === id 
          ? { ...tab, content, isDirty: content !== tab.originalContent } 
          : tab
      ),
    }))

    // Auto save if enabled
    const { autoSave } = get()
    if (autoSave) {
      get().saveFile(id)
    }
  },

  saveFile: async (id) => {
    const state = get()
    const tab = state.tabs.find((t) => t.id === id)
    if (!tab || !tab.isDirty) return true

    try {
      await window.api.fs.writeFile(tab.path, tab.content)
      
      set((state) => ({
        tabs: state.tabs.map((t) =>
          t.id === id 
            ? { ...t, isDirty: false, originalContent: t.content } 
            : t
        ),
      }))
      
      return true
    } catch (error) {
      console.error('Failed to save file:', error)
      alert(`Failed to save file: ${error}`)
      return false
    }
  },

  saveActiveFile: async () => {
    const { activeTabId } = get()
    if (!activeTabId) return true
    return get().saveFile(activeTabId)
  },

  closeAllTabs: async () => {
    const state = get()
    const dirtyTabs = state.tabs.filter((t) => t.isDirty)
    
    if (dirtyTabs.length > 0) {
      const shouldSaveAll = confirm(`You have ${dirtyTabs.length} unsaved file(s). Save all before closing?`)
      if (shouldSaveAll) {
        for (const tab of dirtyTabs) {
          const saved = await get().saveFile(tab.id)
          if (!saved) return false
        }
      }
    }

    set({ tabs: [], activeTabId: null })
    return true
  },

  closeOtherTabs: async (id) => {
    const state = get()
    const otherTabs = state.tabs.filter((t) => t.id !== id && t.isDirty)
    
    if (otherTabs.length > 0) {
      const shouldSaveOthers = confirm(`You have ${otherTabs.length} other unsaved file(s). Save them before closing?`)
      if (shouldSaveOthers) {
        for (const tab of otherTabs) {
          const saved = await get().saveFile(tab.id)
          if (!saved) return false
        }
      }
    }

    const tab = state.tabs.find((t) => t.id === id)
    if (!tab) return false

    set({
      tabs: [{ ...tab, isActive: true }],
      activeTabId: id,
    })
    return true
  },

  getActiveTab: () => {
    const state = get()
    return state.tabs.find((tab) => tab.id === state.activeTabId) || null
  },

  updateCursorPosition: (id, position) => set((state) => ({
    tabs: state.tabs.map((tab) =>
      tab.id === id ? { ...tab, cursorPosition: position } : tab
    ),
  })),

  updateScrollPosition: (id, scrollTop) => set((state) => ({
    tabs: state.tabs.map((tab) =>
      tab.id === id ? { ...tab, scrollPosition: scrollTop } : tab
    ),
  })),

  toggleAutoSave: () => set((state) => ({ autoSave: !state.autoSave })),

  hasUnsavedChanges: () => {
    const state = get()
    return state.tabs.some((tab) => tab.isDirty)
  },

  getDirtyTabs: () => {
    const state = get()
    return state.tabs.filter((tab) => tab.isDirty)
  },
}))
