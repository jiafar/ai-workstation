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
}

export const useFileStore = create<FileState>((set) => ({
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
}))
