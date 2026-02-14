import { create } from 'zustand'
import type { PanelType, BottomPanelType, Project } from '../types/index'

interface AppState {
  sidebarWidth: number
  panelHeight: number
  activePanel: PanelType
  activeBottomPanel: BottomPanelType
  showSidebar: boolean
  showBottomPanel: boolean
  currentProject: Project | null
  recentProjects: Project[]
  setSidebarWidth: (width: number) => void
  setPanelHeight: (height: number) => void
  setActivePanel: (panel: PanelType) => void
  setActiveBottomPanel: (panel: BottomPanelType) => void
  toggleSidebar: () => void
  toggleBottomPanel: () => void
  setCurrentProject: (project: Project | null) => void
  addRecentProject: (project: Project) => void
}

export const useAppStore = create<AppState>((set) => ({
  sidebarWidth: 260,
  panelHeight: 250,
  activePanel: 'explorer',
  activeBottomPanel: 'terminal',
  showSidebar: true,
  showBottomPanel: true,
  currentProject: null,
  recentProjects: [],

  setSidebarWidth: (width) => set({ sidebarWidth: width }),

  setPanelHeight: (height) => set({ panelHeight: height }),

  setActivePanel: (panel) => set({ activePanel: panel }),

  setActiveBottomPanel: (panel) => set({ activeBottomPanel: panel }),

  toggleSidebar: () => set((state) => ({ showSidebar: !state.showSidebar })),

  toggleBottomPanel: () => set((state) => ({ showBottomPanel: !state.showBottomPanel })),

  setCurrentProject: (project) => set({ currentProject: project }),

  addRecentProject: (project) => set((state) => {
    const filtered = state.recentProjects.filter((p) => p.id !== project.id)
    return { recentProjects: [project, ...filtered].slice(0, 10) }
  }),
}))
