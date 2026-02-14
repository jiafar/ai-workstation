import { create } from 'zustand'
import type { WorkflowDefinition, WorkflowRun } from '../types/index'

interface WorkflowState {
  workflows: WorkflowDefinition[]
  workflowRuns: WorkflowRun[]
  setWorkflows: (workflows: WorkflowDefinition[]) => void
  addWorkflowRun: (run: WorkflowRun) => void
  updateWorkflowRun: (id: string, updates: Partial<WorkflowRun>) => void
  clearRuns: () => void
}

export const useWorkflowStore = create<WorkflowState>((set) => ({
  workflows: [],
  workflowRuns: [],

  setWorkflows: (workflows) => set({ workflows }),

  addWorkflowRun: (run) => set((state) => ({
    workflowRuns: [...state.workflowRuns, run],
  })),

  updateWorkflowRun: (id, updates) => set((state) => ({
    workflowRuns: state.workflowRuns.map((run) =>
      run.id === id ? { ...run, ...updates } : run
    ),
  })),

  clearRuns: () => set({ workflowRuns: [] }),
}))
