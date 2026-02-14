import { WorkflowRun } from '../../../src/types';
import { logger } from '../../utils/logger';
import * as fs from 'fs/promises';
import * as path from 'path';
import { app } from 'electron';

export interface WorkflowStateData extends WorkflowRun {
  inputs?: Record<string, unknown>;
  variables?: Record<string, unknown>;
  pausedFor?: string; // step ID that caused pause
}

export class WorkflowState {
  private static instance: WorkflowState | null = null;
  private runs: Map<string, WorkflowStateData> = new Map();
  private stateFilePath: string;
  private initialized = false;

  private constructor() {
    const userDataPath = app.getPath('userData');
    this.stateFilePath = path.join(userDataPath, 'state', 'workflow-state.json');
  }

  static getInstance(): WorkflowState {
    if (!WorkflowState.instance) {
      WorkflowState.instance = new WorkflowState();
    }
    return WorkflowState.instance;
  }

  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Ensure state directory exists
    const stateDir = path.dirname(this.stateFilePath);
    await fs.mkdir(stateDir, { recursive: true });

    // Load existing state
    await this.load();

    // Check for interrupted workflows (crash recovery)
    const interrupted = this.getInterrupted();
    if (interrupted.length > 0) {
      logger.warn(`Found ${interrupted.length} interrupted workflows`);
      for (const run of interrupted) {
        logger.warn(`  - ${run.workflowName} (${run.id}): ${run.currentStep || 'unknown step'}`);
      }
    }

    this.initialized = true;
    logger.info('WorkflowState initialized');
  }

  /**
   * Create a new workflow run
   */
  create(workflowName: string, inputs?: Record<string, unknown>): WorkflowStateData {
    const runId = `run-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const run: WorkflowStateData = {
      id: runId,
      workflowName,
      state: 'pending',
      stepResults: {},
      startedAt: Date.now(),
      inputs,
      variables: {},
    };

    this.runs.set(runId, run);
    this.save();

    logger.info(`Created workflow run: ${runId} for ${workflowName}`);
    return run;
  }

  /**
   * Update workflow run state
   */
  update(runId: string, updates: Partial<WorkflowStateData>): WorkflowStateData | null {
    const run = this.runs.get(runId);
    if (!run) {
      logger.warn(`Workflow run not found: ${runId}`);
      return null;
    }

    Object.assign(run, updates);

    // Auto-complete timestamp
    if (updates.state === 'completed' || updates.state === 'failed') {
      run.completedAt = Date.now();
    }

    this.save();

    logger.debug(`Updated workflow run: ${runId}`, { state: run.state });
    return run;
  }

  /**
   * Get workflow run by ID
   */
  get(runId: string): WorkflowStateData | null {
    return this.runs.get(runId) || null;
  }

  /**
   * Get all workflow runs
   */
  getAll(): WorkflowStateData[] {
    return Array.from(this.runs.values());
  }

  /**
   * Get workflows by state
   */
  getByState(state: WorkflowStateData['state']): WorkflowStateData[] {
    return Array.from(this.runs.values()).filter(run => run.state === state);
  }

  /**
   * Get interrupted workflows (for crash recovery)
   */
  getInterrupted(): WorkflowStateData[] {
    return this.getByState('running').concat(this.getByState('paused'));
  }

  /**
   * Get workflows by name
   */
  getByWorkflowName(workflowName: string): WorkflowStateData[] {
    return Array.from(this.runs.values()).filter(run => run.workflowName === workflowName);
  }

  /**
   * Remove workflow run
   */
  remove(runId: string): boolean {
    const deleted = this.runs.delete(runId);
    if (deleted) {
      this.save();
      logger.info(`Removed workflow run: ${runId}`);
    }
    return deleted;
  }

  /**
   * Clear completed/failed runs (cleanup)
   */
  cleanup(olderThanMs: number = 7 * 24 * 60 * 60 * 1000): number {
    const cutoff = Date.now() - olderThanMs;
    let removed = 0;

    for (const [runId, run] of this.runs) {
      if (
        (run.state === 'completed' || run.state === 'failed') &&
        run.completedAt &&
        run.completedAt < cutoff
      ) {
        this.runs.delete(runId);
        removed++;
      }
    }

    if (removed > 0) {
      this.save();
      logger.info(`Cleaned up ${removed} old workflow runs`);
    }

    return removed;
  }

  /**
   * Save state to disk
   */
  async save(): Promise<void> {
    try {
      const data = {
        version: '1.0',
        timestamp: Date.now(),
        runs: Array.from(this.runs.values()),
      };

      await fs.writeFile(this.stateFilePath, JSON.stringify(data, null, 2), 'utf-8');
      logger.debug('Workflow state saved');
    } catch (error) {
      logger.error('Failed to save workflow state', error);
    }
  }

  /**
   * Load state from disk
   */
  async load(): Promise<void> {
    try {
      const content = await fs.readFile(this.stateFilePath, 'utf-8');
      const data = JSON.parse(content);

      if (data.runs && Array.isArray(data.runs)) {
        this.runs.clear();
        for (const run of data.runs) {
          this.runs.set(run.id, run);
        }
        logger.info(`Loaded ${this.runs.size} workflow runs from state`);
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        logger.info('No existing workflow state found, starting fresh');
      } else {
        logger.error('Failed to load workflow state', error);
      }
    }
  }

  /**
   * Get statistics
   */
  getStats() {
    const all = this.getAll();
    return {
      total: all.length,
      pending: all.filter(r => r.state === 'pending').length,
      running: all.filter(r => r.state === 'running').length,
      paused: all.filter(r => r.state === 'paused').length,
      completed: all.filter(r => r.state === 'completed').length,
      failed: all.filter(r => r.state === 'failed').length,
    };
  }
}

export default WorkflowState;
