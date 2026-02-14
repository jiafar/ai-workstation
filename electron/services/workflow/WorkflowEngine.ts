import { WorkflowDefinition, WorkflowRun } from '../../../src/types';
import { logger } from '../../utils/logger';
import { EventEmitter } from 'events';
import { WorkflowParser, ExecutionPlan, ParsedStep } from './WorkflowParser';
import { StepExecutor, StepResult, VariableContext } from './StepExecutor';
import { WorkflowState, WorkflowStateData } from './WorkflowState';
import * as fs from 'fs/promises';
import * as path from 'path';
import { app } from 'electron';

export interface WorkflowRunResult {
  runId: string;
  status: 'completed' | 'failed' | 'paused';
  outputs: Record<string, StepResult>;
  error?: string;
  duration: number;
}

export class WorkflowEngine extends EventEmitter {
  private static instance: WorkflowEngine | null = null;
  private parser: WorkflowParser;
  private executor: StepExecutor;
  private state: WorkflowState;
  private workflowsDir: string;
  private runningWorkflows: Map<string, AbortController> = new Map();
  private initialized = false;

  private constructor() {
    super();
    this.parser = new WorkflowParser();
    this.executor = new StepExecutor();
    this.state = WorkflowState.getInstance();

    const userDataPath = app.getPath('userData');
    this.workflowsDir = path.join(userDataPath, 'workflows');

    // Forward human input events
    this.executor.on('human-input-required', (data) => {
      this.emit('human-input-required', data);
    });
  }

  static getInstance(): WorkflowEngine {
    if (!WorkflowEngine.instance) {
      WorkflowEngine.instance = new WorkflowEngine();
    }
    return WorkflowEngine.instance;
  }

  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await this.state.init();

    // Ensure workflows directory exists
    await fs.mkdir(this.workflowsDir, { recursive: true });

    this.initialized = true;
    logger.info('WorkflowEngine initialized');
  }

  /**
   * Run a workflow
   */
  async run(workflowName: string, inputs: Record<string, unknown> = {}): Promise<WorkflowRunResult> {
    if (!this.initialized) {
      await this.init();
    }

    logger.info(`Starting workflow: ${workflowName}`, { inputs });

    // Load workflow definition
    const definition = await this.loadWorkflow(workflowName);

    // Parse workflow into execution plan
    const plan = this.parser.parse(definition);

    // Create workflow run state
    const run = this.state.create(workflowName, inputs);

    // Create abort controller for this run
    const abortController = new AbortController();
    this.runningWorkflows.set(run.id, abortController);

    // Execute workflow
    try {
      const result = await this.executeWorkflow(run, plan, inputs, abortController.signal);

      // Update final state
      this.state.update(run.id, {
        state: result.status === 'completed' ? 'completed' : 'failed',
        error: result.error,
      });

      this.emit('workflow-done', {
        runId: run.id,
        workflowName,
        status: result.status,
        duration: result.duration,
      });

      return result;
    } catch (error: any) {
      logger.error(`Workflow failed: ${workflowName}`, error);

      this.state.update(run.id, {
        state: 'failed',
        error: error.message || String(error),
      });

      throw error;
    } finally {
      this.runningWorkflows.delete(run.id);
    }
  }

  /**
   * Execute workflow according to execution plan
   */
  private async executeWorkflow(
    run: WorkflowStateData,
    plan: ExecutionPlan,
    inputs: Record<string, unknown>,
    signal: AbortSignal
  ): Promise<WorkflowRunResult> {
    const startTime = Date.now();

    // Update state to running
    this.state.update(run.id, { state: 'running' });

    // Initialize variable context
    const variables: VariableContext = {
      inputs,
      steps: {},
      env: process.env as Record<string, unknown>,
    };

    // Store outputs from each step
    const outputs: Record<string, StepResult> = {};

    try {
      // Execute steps in order (group by group)
      for (let i = 0; i < plan.executionOrder.length; i++) {
        const group = plan.executionOrder[i];

        logger.info(`Executing step group ${i + 1}/${plan.executionOrder.length}: ${group.join(', ')}`);

        // Check if workflow was aborted
        if (signal.aborted) {
          throw new Error('Workflow was aborted');
        }

        // Execute steps in parallel within the group
        const groupResults = await Promise.all(
          group.map(async (stepId) => {
            const step = plan.steps.get(stepId);
            if (!step) {
              throw new Error(`Step not found: ${stepId}`);
            }

            // Emit step start event
            this.emit('step-start', {
              runId: run.id,
              stepId,
              stepType: step.type,
            });

            // Update current step in state
            this.state.update(run.id, { currentStep: stepId });

            // Execute step
            const result = await this.executor.execute(
              step,
              {
                workflowName: run.workflowName,
                runId: run.id,
                stepId,
              },
              variables
            );

            // Store result
            outputs[stepId] = result;
            variables.steps[stepId] = result;

            // Update step results in state
            this.state.update(run.id, {
              stepResults: {
                ...run.stepResults,
                [stepId]: result,
              },
            });

            // Emit step complete/error event
            if (result.status === 'completed') {
              this.emit('step-complete', {
                runId: run.id,
                stepId,
                outputs: result.outputs,
                duration: result.duration,
              });
            } else {
              this.emit('step-error', {
                runId: run.id,
                stepId,
                error: result.error,
                duration: result.duration,
              });
            }

            return { stepId, result };
          })
        );

        // Check for failures
        const failures = groupResults.filter(r => r.result.status === 'failed');
        if (failures.length > 0) {
          const failedSteps = failures.map(f => f.stepId).join(', ');
          throw new Error(`Steps failed: ${failedSteps}`);
        }

        // Check for human input requirement (pause)
        for (const { stepId, result } of groupResults) {
          if (result.outputs.userInput !== undefined) {
            // Workflow is paused waiting for human input
            this.state.update(run.id, {
              state: 'paused',
              pausedFor: stepId,
            });

            return {
              runId: run.id,
              status: 'paused',
              outputs,
              duration: Date.now() - startTime,
            };
          }
        }
      }

      // All steps completed successfully
      const duration = Date.now() - startTime;

      logger.info(`Workflow completed: ${run.workflowName} (${duration}ms)`);

      return {
        runId: run.id,
        status: 'completed',
        outputs,
        duration,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;

      logger.error(`Workflow execution failed: ${run.workflowName}`, error);

      return {
        runId: run.id,
        status: 'failed',
        outputs,
        error: error.message || String(error),
        duration,
      };
    }
  }

  /**
   * Stop a running workflow
   */
  async stop(runId: string): Promise<boolean> {
    const abortController = this.runningWorkflows.get(runId);

    if (abortController) {
      abortController.abort();
      this.runningWorkflows.delete(runId);

      this.state.update(runId, {
        state: 'failed',
        error: 'Workflow stopped by user',
      });

      logger.info(`Workflow stopped: ${runId}`);
      return true;
    }

    logger.warn(`Cannot stop workflow: ${runId} (not running)`);
    return false;
  }

  /**
   * Get workflow run state
   */
  getState(runId: string): WorkflowStateData | null {
    return this.state.get(runId);
  }

  /**
   * Resume a paused workflow
   */
  async resume(runId: string, userInput?: any): Promise<WorkflowRunResult> {
    const run = this.state.get(runId);

    if (!run) {
      throw new Error(`Workflow run not found: ${runId}`);
    }

    if (run.state !== 'paused') {
      throw new Error(`Workflow is not paused: ${runId} (state: ${run.state})`);
    }

    if (!run.pausedFor) {
      throw new Error(`No paused step information for workflow: ${runId}`);
    }

    logger.info(`Resuming workflow: ${runId}`);

    // Provide human input to executor
    if (userInput !== undefined) {
      this.executor.provideHumanInput(runId, run.pausedFor, userInput);
    }

    // Load workflow definition and re-execute
    const definition = await this.loadWorkflow(run.workflowName);
    const plan = this.parser.parse(definition);

    // Create new abort controller
    const abortController = new AbortController();
    this.runningWorkflows.set(runId, abortController);

    try {
      // Continue execution from where it paused
      // For simplicity, we re-execute from the beginning
      // In a production system, you'd want to resume from the paused step
      const result = await this.executeWorkflow(
        run,
        plan,
        run.inputs || {},
        abortController.signal
      );

      this.state.update(runId, {
        state: result.status === 'completed' ? 'completed' : 'failed',
        error: result.error,
      });

      return result;
    } finally {
      this.runningWorkflows.delete(runId);
    }
  }

  /**
   * Load workflow definition from file
   */
  private async loadWorkflow(workflowName: string): Promise<WorkflowDefinition> {
    // Try loading from workflows registry
    const registryPath = path.join(this.workflowsDir, 'workflows.json');

    try {
      const registryContent = await fs.readFile(registryPath, 'utf-8');
      const registry = JSON.parse(registryContent);

      const workflowEntry = registry.workflows.find((w: any) => w.name === workflowName);

      if (workflowEntry) {
        const workflowPath = path.join(this.workflowsDir, workflowEntry.file);
        const workflowContent = await fs.readFile(workflowPath, 'utf-8');
        return JSON.parse(workflowContent);
      }
    } catch (error) {
      logger.debug(`Could not load workflow from registry: ${workflowName}`);
    }

    // Try loading directly
    const directPath = path.join(this.workflowsDir, 'templates', `${workflowName}.json`);
    try {
      const content = await fs.readFile(directPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      // Try custom workflows
      const customPath = path.join(this.workflowsDir, 'custom', `${workflowName}.json`);
      const content = await fs.readFile(customPath, 'utf-8');
      return JSON.parse(content);
    }
  }

  /**
   * List all available workflows
   */
  async listWorkflows(): Promise<{ name: string; file: string; description: string }[]> {
    const registryPath = path.join(this.workflowsDir, 'workflows.json');

    try {
      const content = await fs.readFile(registryPath, 'utf-8');
      const registry = JSON.parse(content);
      return registry.workflows || [];
    } catch (error) {
      logger.warn('Could not load workflow registry');
      return [];
    }
  }

  /**
   * Get workflow run history
   */
  getHistory(limit: number = 50): WorkflowStateData[] {
    return this.state
      .getAll()
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, limit);
  }
}

export default WorkflowEngine;
