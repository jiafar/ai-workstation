import { WorkflowDefinition, WorkflowStep } from '../../../src/types';
import { logger } from '../../utils/logger';

export interface InputDef {
  name: string;
  type: string;
  default?: unknown;
}

export interface ParsedStep extends WorkflowStep {
  depth: number;
}

export interface ExecutionPlan {
  steps: Map<string, ParsedStep>;
  executionOrder: string[][];
  inputs: InputDef[];
}

export class WorkflowParser {
  /**
   * Parse a workflow definition into an execution plan
   */
  parse(definition: WorkflowDefinition): ExecutionPlan {
    logger.info(`Parsing workflow: ${definition.name}`);

    // Validate workflow definition
    this.validateDefinition(definition);

    // Build step map
    const steps = new Map<string, ParsedStep>();
    for (const step of definition.steps) {
      steps.set(step.id, { ...step, depth: 0 });
    }

    // Validate dependencies exist
    this.validateDependencies(steps);

    // Validate DAG (no cycles)
    this.validateDAG(steps);

    // Calculate execution order (groups of parallel steps)
    const executionOrder = this.getExecutionOrder(steps);

    // Extract input definitions
    const inputs: InputDef[] = (definition.inputs || []).map(input => ({
      name: input.name,
      type: input.type,
      default: input.default,
    }));

    logger.info(`Workflow parsed successfully: ${executionOrder.length} execution groups`);

    return {
      steps,
      executionOrder,
      inputs,
    };
  }

  /**
   * Validate workflow definition structure
   */
  private validateDefinition(definition: WorkflowDefinition): void {
    if (!definition.name || typeof definition.name !== 'string') {
      throw new Error('Workflow must have a valid name');
    }

    if (!definition.steps || !Array.isArray(definition.steps)) {
      throw new Error('Workflow must have a steps array');
    }

    if (definition.steps.length === 0) {
      throw new Error('Workflow must have at least one step');
    }

    // Validate each step
    for (const step of definition.steps) {
      if (!step.id || typeof step.id !== 'string') {
        throw new Error('Each step must have a valid id');
      }

      if (!step.type || typeof step.type !== 'string') {
        throw new Error(`Step ${step.id} must have a valid type`);
      }

      const validTypes = ['skill', 'shell', 'ai', 'condition', 'parallel', 'human'];
      if (!validTypes.includes(step.type)) {
        throw new Error(`Step ${step.id} has invalid type: ${step.type}`);
      }

      // Type-specific validation
      if (step.type === 'skill' && !step.skill) {
        throw new Error(`Step ${step.id} of type 'skill' must have a skill property`);
      }

      if (step.type === 'shell' && !step.command) {
        throw new Error(`Step ${step.id} of type 'shell' must have a command property`);
      }

      if (step.type === 'ai' && !step.prompt) {
        throw new Error(`Step ${step.id} of type 'ai' must have a prompt property`);
      }

      if (step.type === 'condition' && !step.condition) {
        throw new Error(`Step ${step.id} of type 'condition' must have a condition property`);
      }

      if (step.type === 'parallel' && (!step.steps || step.steps.length === 0)) {
        throw new Error(`Step ${step.id} of type 'parallel' must have a steps array`);
      }
    }

    // Check for duplicate step IDs
    const stepIds = new Set<string>();
    for (const step of definition.steps) {
      if (stepIds.has(step.id)) {
        throw new Error(`Duplicate step ID found: ${step.id}`);
      }
      stepIds.add(step.id);
    }
  }

  /**
   * Validate that all dependencies reference existing steps
   */
  private validateDependencies(steps: Map<string, ParsedStep>): void {
    for (const [stepId, step] of steps) {
      if (step.dependsOn) {
        for (const depId of step.dependsOn) {
          if (!steps.has(depId)) {
            throw new Error(`Step ${stepId} depends on non-existent step: ${depId}`);
          }
        }
      }
    }
  }

  /**
   * Validate DAG structure (detect cycles)
   */
  validateDAG(steps: Map<string, ParsedStep>): void {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (stepId: string): boolean => {
      if (!visited.has(stepId)) {
        visited.add(stepId);
        recursionStack.add(stepId);

        const step = steps.get(stepId);
        if (step?.dependsOn) {
          for (const depId of step.dependsOn) {
            if (!visited.has(depId) && hasCycle(depId)) {
              return true;
            } else if (recursionStack.has(depId)) {
              return true;
            }
          }
        }
      }

      recursionStack.delete(stepId);
      return false;
    };

    for (const stepId of steps.keys()) {
      if (hasCycle(stepId)) {
        throw new Error(`Cycle detected in workflow DAG involving step: ${stepId}`);
      }
    }
  }

  /**
   * Calculate execution order using topological sort
   * Returns groups of steps that can run in parallel
   */
  getExecutionOrder(steps: Map<string, ParsedStep>): string[][] {
    // Calculate depth for each step (longest path from root)
    const depths = new Map<string, number>();

    const calculateDepth = (stepId: string): number => {
      if (depths.has(stepId)) {
        return depths.get(stepId)!;
      }

      const step = steps.get(stepId);
      if (!step || !step.dependsOn || step.dependsOn.length === 0) {
        depths.set(stepId, 0);
        return 0;
      }

      const maxDepth = Math.max(...step.dependsOn.map(depId => calculateDepth(depId)));
      const depth = maxDepth + 1;
      depths.set(stepId, depth);

      // Update step depth
      step.depth = depth;

      return depth;
    };

    // Calculate depths for all steps
    for (const stepId of steps.keys()) {
      calculateDepth(stepId);
    }

    // Group steps by depth
    const maxDepth = Math.max(...depths.values());
    const groups: string[][] = [];

    for (let depth = 0; depth <= maxDepth; depth++) {
      const group: string[] = [];
      for (const [stepId, stepDepth] of depths) {
        if (stepDepth === depth) {
          group.push(stepId);
        }
      }
      if (group.length > 0) {
        groups.push(group);
      }
    }

    return groups;
  }
}

export default WorkflowParser;
