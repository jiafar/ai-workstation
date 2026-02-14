import { create } from 'zustand'
import type { TerminalTab } from '../types/index'

interface TerminalState {
  terminals: TerminalTab[]
  activeTerminalId: string | null
  addTerminal: () => void
  removeTerminal: (id: string) => void
  setActiveTerminal: (id: string) => void
  renameTerminal: (id: string, title: string) => void
}

export const useTerminalStore = create<TerminalState>((set) => ({
  terminals: [],
  activeTerminalId: null,

  addTerminal: () => set((state) => {
    const id = `terminal-${Date.now()}`
    const newTerminal: TerminalTab = {
      id,
      title: `Terminal ${state.terminals.length + 1}`,
      isActive: true,
    }

    return {
      terminals: [
        ...state.terminals.map((term) => ({ ...term, isActive: false })),
        newTerminal,
      ],
      activeTerminalId: id,
    }
  }),

  removeTerminal: (id) => set((state) => {
    const terminals = state.terminals.filter((term) => term.id !== id)
    let activeTerminalId = state.activeTerminalId

    if (state.activeTerminalId === id) {
      const removedIndex = state.terminals.findIndex((term) => term.id === id)
      if (terminals.length > 0) {
        const newActiveTerm = terminals[Math.max(0, removedIndex - 1)]
        activeTerminalId = newActiveTerm.id
        return {
          terminals: terminals.map((term) => ({
            ...term,
            isActive: term.id === activeTerminalId,
          })),
          activeTerminalId,
        }
      } else {
        activeTerminalId = null
      }
    }

    return { terminals, activeTerminalId }
  }),

  setActiveTerminal: (id) => set((state) => ({
    terminals: state.terminals.map((term) => ({
      ...term,
      isActive: term.id === id,
    })),
    activeTerminalId: id,
  })),

  renameTerminal: (id, title) => set((state) => ({
    terminals: state.terminals.map((term) =>
      term.id === id ? { ...term, title } : term
    ),
  })),
}))
