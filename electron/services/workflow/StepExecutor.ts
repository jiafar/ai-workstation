import { WorkflowStep } from '../../../src/types';
import { logger } from '../../utils/logger';
import { SkillRegistry } from '../skill/SkillRegistry';
import { llmProvider } from '../ai/LLMProvider';
import { exec } from 'child_process';
import { promisify } from 'util';
import { EventEmitter } from 'events';

const execAsync = promisify(exec);

export interface StepContext {
  workflowName: string;
  runId: string;
  stepId: string;
}

export interface StepResult {
  outputs: Record<string, unknown>;
  status: 'completed' | 'failed';
  duration: number;
  error?: string;
}

export interface VariableContext {
  inputs: Record<string, unknown>;
  steps: Record<string, StepResult>;
  env: Record<string, unknown>;
}

export class StepExecutor extends EventEmitter {
  private skillRegistry: SkillRegistry;
  private humanInputResolvers: Map<string, (value: any) => void> = new Map();

  constructor() {
    super();
    this.skillRegistry = SkillRegistry.getInstance();
  }

  /**
   * Execute a single workflow step
   */
  async execute(
    step: WorkflowStep,
    context: StepContext,
    variables: VariableContext
  ): Promise<StepResult> {
    const startTime = Date.now();

    logger.info(`Executing step: ${step.id} (type: ${step.type})`);

    try {
      let outputs: Record<string, unknown> = {};

      switch (step.type) {
        case 'skill':
          outputs = await this.executeSkill(step, context, variables);
          break;

        case 'shell':
          outputs = await this.executeShell(step, context, variables);
          break;

        case 'ai':
          outputs = await this.executeAI(step, context, variables);
          break;

        case 'condition':
          outputs = await this.executeCondition(step, context, variables);
          break;

        case 'parallel':
          outputs = await this.executeParallel(step, context, variables);
          break;

        case 'human':
          outputs = await this.executeHuman(step, context, variables);
          break;

        default:
          throw new Error(`Unknown step type: ${(step as any).type}`);
      }

      const duration = Date.now() - startTime;

      logger.info(`Step completed: ${step.id} (${duration}ms)`);

      return {
        outputs,
        status: 'completed',
        duration,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;

      logger.error(`Step failed: ${step.id}`, error);

      return {
        outputs: {},
        status: 'failed',
        duration,
        error: error.message || String(error),
      };
    }
  }

  /**
   * Execute a skill step
   */
  private async executeSkill(
    step: WorkflowStep,
    context: StepContext,
    variables: VariableContext
  ): Promise<Record<string, unknown>> {
    if (!step.skill) {
      throw new Error('Skill step must have a skill property');
    }

    // Resolve skill name (may contain template variables)
    const skillName = this.resolveVariables(step.skill, variables);

    // Get skill definition
    const skillDef = this.skillRegistry.resolve(skillName);
    if (!skillDef) {
      throw new Error(`Skill not found: ${skillName}`);
    }

    // Resolve input variables
    const inputs = this.resolveObject(step.inputs || {}, variables);

    logger.debug(`Calling skill: ${skillName}`, { inputs });

    // For now, we'll return mock outputs
    // TODO: Implement actual skill execution via SkillRunner
    // This would require implementing a SkillRunner service that can execute
    // both prompt-based and script-based skills

    return {
      success: true,
      result: `Skill ${skillName} executed successfully`,
      ...inputs,
    };
  }

  /**
   * Execute a shell command step
   */
  private async executeShell(
    step: WorkflowStep,
    context: StepContext,
    variables: VariableContext
  ): Promise<Record<string, unknown>> {
    if (!step.command) {
      throw new Error('Shell step must have a command property');
    }

    // Resolve command (may contain template variables)
    const command = this.resolveVariables(step.command, variables);

    logger.debug(`Executing shell command: ${command}`);

    const { stdout, stderr } = await execAsync(command, {
      maxBuffer: 10 * 1024 * 1024, // 10MB
      timeout: 5 * 60 * 1000, // 5 minutes
    });

    return {
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      exitCode: 0,
    };
  }

  /**
   * Execute an AI/LLM step
   */
  private async executeAI(
    step: WorkflowStep,
    context: StepContext,
    variables: VariableContext
  ): Promise<Record<string, unknown>> {
    if (!step.prompt) {
      throw new Error('AI step must have a prompt property');
    }

    // Resolve prompt (may contain template variables)
    const prompt = this.resolveVariables(step.prompt, variables);

    logger.debug(`Executing AI prompt: ${prompt.substring(0, 100)}...`);

    const response = await llmProvider.chat([
      {
        role: 'user',
        content: prompt,
      },
    ]);

    return {
      response,
      prompt,
    };
  }

  /**
   * Execute a condition step
   */
  private async executeCondition(
    step: WorkflowStep,
    context: StepContext,
    variables: VariableContext
  ): Promise<Record<string, unknown>> {
    if (!step.condition) {
      throw new Error('Condition step must have a condition property');
    }

    // Resolve condition (may contain template variables)
    const condition = this.resolveVariables(step.condition, variables);

    logger.debug(`Evaluating condition: ${condition}`);

    // Simple condition evaluation
    // Supports basic comparisons like "{{steps.review.outputs.score}} > 0.8"
    const result = this.evaluateCondition(condition, variables);

    return {
      condition,
      result,
      branch: result ? (step.then || 'then') : (step.else || 'else'),
    };
  }

  /**
   * Execute parallel sub-steps
   */
  private async executeParallel(
    step: WorkflowStep,
    context: StepContext,
    variables: VariableContext
  ): Promise<Record<string, unknown>> {
    if (!step.steps || step.steps.length === 0) {
      throw new Error('Parallel step must have a steps array');
    }

    logger.debug(`Executing ${step.steps.length} parallel steps`);

    // This is a simplified implementation
    // In a real implementation, we'd need to look up the actual step definitions
    // and execute them in parallel
    const results = await Promise.all(
      step.steps.map(async (stepId) => {
        return { stepId, status: 'completed' };
      })
    );

    return {
      results,
      completed: results.length,
    };
  }

  /**
   * Execute a human input step (pauses workflow)
   */
  private async executeHuman(
    step: WorkflowStep,
    context: StepContext,
    variables: VariableContext
  ): Promise<Record<string, unknown>> {
    logger.info(`Step ${step.id} requires human input, pausing workflow`);

    // Resolve prompt message if provided
    const message = step.prompt
      ? this.resolveVariables(step.prompt, variables)
      : 'This workflow requires your input to continue';

    // Emit event to request human input
    this.emit('human-input-required', {
      runId: context.runId,
      stepId: step.id,
      message,
      inputs: step.inputs,
    });

    // Wait for human input
    const input = await this.waitForHumanInput(context.runId, step.id);

    return {
      userInput: input,
      message,
    };
  }

  /**
   * Wait for human input
   */
  private waitForHumanInput(runId: string, stepId: string): Promise<any> {
    const key = `${runId}:${stepId}`;

    return new Promise((resolve) => {
      this.humanInputResolvers.set(key, resolve);
    });
  }

  /**
   * Provide human input to resume workflow
   */
  provideHumanInput(runId: string, stepId: string, input: any): void {
    const key = `${runId}:${stepId}`;
    const resolver = this.humanInputResolvers.get(key);

    if (resolver) {
      resolver(input);
      this.humanInputResolvers.delete(key);
      logger.info(`Human input provided for ${key}`);
    } else {
      logger.warn(`No pending human input request for ${key}`);
    }
  }

  /**
   * Resolve template variables in a string
   * Supports: {{inputs.name}}, {{steps.stepId.outputs.value}}, {{env.VAR}}
   */
  private resolveVariables(template: string, variables: VariableContext): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      const trimmedPath = path.trim();
      const value = this.getNestedValue(variables, trimmedPath);

      if (value === undefined) {
        logger.warn(`Variable not found: ${trimmedPath}`);
        return match; // Keep original if not found
      }

      return String(value);
    });
  }

  /**
   * Resolve template variables in an object
   */
  private resolveObject(
    obj: Record<string, unknown>,
    variables: VariableContext
  ): Record<string, unknown> {
    const resolved: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        resolved[key] = this.resolveVariables(value, variables);
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        resolved[key] = this.resolveObject(value as Record<string, unknown>, variables);
      } else {
        resolved[key] = value;
      }
    }

    return resolved;
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    const parts = path.split('.');
    let current = obj;

    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * Evaluate a condition expression
   * Simple implementation supporting basic comparisons
   */
  private evaluateCondition(condition: string, variables: VariableContext): boolean {
    try {
      // Very basic condition evaluation
      // In production, you'd want a proper expression parser

      // Support common comparison operators
      const comparisons = [
        { op: '>=', fn: (a: any, b: any) => a >= b },
        { op: '<=', fn: (a: any, b: any) => a <= b },
        { op: '>', fn: (a: any, b: any) => a > b },
        { op: '<', fn: (a: any, b: any) => a < b },
        { op: '===', fn: (a: any, b: any) => a === b },
        { op: '!==', fn: (a: any, b: any) => a !== b },
        { op: '==', fn: (a: any, b: any) => a == b },
        { op: '!=', fn: (a: any, b: any) => a != b },
      ];

      for (const { op, fn } of comparisons) {
        if (condition.includes(op)) {
          const [left, right] = condition.split(op).map(s => s.trim());

          // Parse left side (convert to number if numeric)
          let leftValue: any = left;
          if (!isNaN(Number(left))) {
            leftValue = Number(left);
          } else if (left === 'true') {
            leftValue = true;
          } else if (left === 'false') {
            leftValue = false;
          }

          // Parse right side
          let rightValue: any = right;
          if (!isNaN(Number(right))) {
            rightValue = Number(right);
          } else if (right === 'true') {
            rightValue = true;
          } else if (right === 'false') {
            rightValue = false;
          } else if (right.startsWith('"') && right.endsWith('"')) {
            rightValue = right.slice(1, -1);
          }

          return fn(leftValue, rightValue);
        }
      }

      // If no operator found, treat as boolean
      return condition === 'true' || condition === '1';
    } catch (error) {
      logger.error('Failed to evaluate condition', { condition, error });
      return false;
    }
  }
}

export default StepExecutor;
