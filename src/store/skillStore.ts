import { create } from 'zustand'
import type { SkillDefinition, SkillRun } from '../types/index'

interface SkillState {
  skills: SkillDefinition[]
  skillRuns: SkillRun[]
  setSkills: (skills: SkillDefinition[]) => void
  addSkillRun: (run: SkillRun) => void
  updateSkillRun: (id: string, updates: Partial<SkillRun>) => void
  clearRuns: () => void
}

export const useSkillStore = create<SkillState>((set) => ({
  skills: [],
  skillRuns: [],

  setSkills: (skills) => set({ skills }),

  addSkillRun: (run) => set((state) => ({
    skillRuns: [...state.skillRuns, run],
  })),

  updateSkillRun: (id, updates) => set((state) => ({
    skillRuns: state.skillRuns.map((run) =>
      run.id === id ? { ...run, ...updates } : run
    ),
  })),

  clearRuns: () => set({ skillRuns: [] }),
}))
