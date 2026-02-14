import { create } from 'zustand'
import type { FileEntry } from '../types/index'

interface FileState {
  rootPath: string
  files: FileEntry[]
  expandedDirs: Set<string>
  selectedPath: string | null
  setRootPath: (path: string) => void
  setFiles: (files: FileEntry[]) => void
  toggleDir: (path: string) => void
  setSelectedPath: (path: string | null) => void
  refreshFiles: () => void
  loadDirectory: (path: string) => Promise<void>
}

export const useFileStore = create<FileState>((set, get) => ({
  rootPath: '',
  files: [],
  expandedDirs: new Set<string>(),
  selectedPath: null,

  setRootPath: (path) => set({ rootPath: path }),

  setFiles: (files) => set({ files }),

  toggleDir: (path) => set((state) => {
    const newExpandedDirs = new Set(state.expandedDirs)
    if (newExpandedDirs.has(path)) {
      newExpandedDirs.delete(path)
    } else {
      newExpandedDirs.add(path)
    }
    return { expandedDirs: newExpandedDirs }
  }),

  setSelectedPath: (path) => set({ selectedPath: path }),

  refreshFiles: () => set((state) => ({ files: [...state.files] })),

  loadDirectory: async (dirPath: string) => {
    try {
      const entries = await window.api.fs.readDir(dirPath)
      const state = get()

      if (dirPath === state.rootPath || !state.rootPath) {
        // Loading root
        if (!state.rootPath) set({ rootPath: dirPath })
        set({ files: entries })
      } else {
        // Loading a subdirectory - update the tree
        const updateChildren = (files: FileEntry[]): FileEntry[] => {
          return files.map((f) => {
            if (f.path === dirPath) {
              return { ...f, children: entries }
            }
            if (f.children) {
              return { ...f, children: updateChildren(f.children) }
            }
            return f
          })
        }
        set({ files: updateChildren(state.files) })
      }
    } catch (error) {
      console.error('Failed to load directory:', error)
    }
  },
}))
