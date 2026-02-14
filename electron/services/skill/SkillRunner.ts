import * as path from 'path';
import * as fs from 'fs/promises';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import type { SkillDefinition } from './SkillRegistry';
import { SkillRegistry } from './SkillRegistry';
import { SkillContext } from './SkillContext';
import { logger } from '../../utils/logger';

export interface IMemoryService {
  query(query: string, layer?: number): Promise<unknown[]>;
  saveObservation(observation: Record<string, unknown>): Promise<string>;
}

export interface ILLMProvider {
  complete(params: { prompt: string; temperature?: number; maxTokens?: number }): Promise<{ content?: string; text?: string }>;
}

export interface SkillRunRecord {
  id: string;
  skillName: string;
  status: 'pending' | 'running' | 'success' | 'error';
  startTime: Date;
  endTime?: Date;
  duration?: number;
  inputs: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  error?: string;
}

export interface SkillRunContext {
  projectPath: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

const MAX_RUNS_HISTORY = 1000;

export class SkillRunner extends EventEmitter {
  private registry: SkillRegistry;
  private memoryService: IMemoryService;
  private llmProvider: ILLMProvider;
  private runs: Map<string, SkillRunRecord> = new Map();

  constructor(memoryService: IMemoryService, llmProvider: ILLMProvider) {
    super();
    this.registry = SkillRegistry.getInstance();
    this.memoryService = memoryService;
    this.llmProvider = llmProvider;
  }

  async run(
    skillName: string,
    inputs: Record<string, unknown>,
    context: SkillRunContext
  ): Promise<SkillRunRecord> {
    // Create run record
    const run: SkillRunRecord = {
      id: uuidv4(),
      skillName,
      status: 'pending',
      startTime: new Date(),
      inputs
    };

    this.runs.set(run.id, run);
    this.pruneHistory();
    this.emit('run-started', run);

    try {
      // Resolve skill
      const skill = this.registry.resolve(skillName);
      if (!skill) {
        throw new Error(`Skill not found: ${skillName}`);
      }

      // Update status
      run.status = 'running';
      this.emit('run-progress', { id: run.id, status: 'running' });

      // Validate inputs
      this.validateInputs(skill, inputs);

      // Execute skill based on type
      const outputs = await this.executeSkill(skill, inputs, context);

      // Mark as success
      run.status = 'success';
      run.outputs = outputs;
      run.endTime = new Date();
      run.duration = run.endTime.getTime() - run.startTime.getTime();

      this.emit('run-completed', run);

      return run;
    } catch (error) {
      // Mark as error
      run.status = 'error';
      run.error = error instanceof Error ? error.message : String(error);
      run.endTime = new Date();
      run.duration = run.endTime.getTime() - run.startTime.getTime();

      this.emit('run-failed', run);

      return run;
    }
  }

  private validateScriptPath(scriptPath: string, skillDir: string): void {
    const resolved = path.resolve(scriptPath);
    const resolvedDir = path.resolve(skillDir);
    if (!resolved.startsWith(resolvedDir + path.sep) && resolved !== resolvedDir) {
      throw new Error(`Script path "${resolved}" escapes skill directory "${resolvedDir}"`);
    }
    if (resolved.includes('\0')) {
      throw new Error('Script path contains null bytes');
    }
  }

  private pruneHistory(): void {
    if (this.runs.size <= MAX_RUNS_HISTORY) return;
    const entries = Array.from(this.runs.entries());
    entries.sort((a, b) => a[1].startTime.getTime() - b[1].startTime.getTime());
    const toRemove = entries.slice(0, entries.length - MAX_RUNS_HISTORY);
    for (const [key] of toRemove) {
      this.runs.delete(key);
    }
    logger.debug(`Pruned ${toRemove.length} old skill run records`);
  }

  validateInputs(skill: SkillDefinition, inputs: Record<string, unknown>): void {
    // Check required inputs
    for (const inputDef of skill.inputs) {
      if (inputDef.required && !(inputDef.name in inputs)) {
        throw new Error(`Missing required input: ${inputDef.name}`);
      }

      // Type validation
      if (inputDef.name in inputs) {
        const value = inputs[inputDef.name];
        const actualType = Array.isArray(value) ? 'array' : typeof value;

        if (inputDef.type === 'object' && actualType !== 'object') {
          throw new Error(`Input ${inputDef.name} must be an object`);
        } else if (inputDef.type === 'array' && !Array.isArray(value)) {
          throw new Error(`Input ${inputDef.name} must be an array`);
        } else if (inputDef.type !== 'array' && inputDef.type !== 'object' && actualType !== inputDef.type) {
          throw new Error(`Input ${inputDef.name} must be of type ${inputDef.type}`);
        }
      }
    }

    // Apply defaults for missing optional inputs
    for (const inputDef of skill.inputs) {
      if (!inputDef.required && !(inputDef.name in inputs) && inputDef.default !== undefined) {
        inputs[inputDef.name] = inputDef.default;
      }
    }
  }

  private async executeSkill(
    skill: SkillDefinition,
    inputs: Record<string, unknown>,
    context: SkillRunContext
  ): Promise<Record<string, unknown>> {
    const hasPrompt = !!skill.promptFile;
    const hasScript = !!skill.scriptFile;

    // Determine skill type and execution flow
    if (hasScript && hasPrompt) {
      // Script + Prompt: Run script first, then prompt with script outputs
      return await this.executeScriptWithPrompt(skill, inputs, context);
    } else if (hasScript) {
      // Script only: Run script and return outputs
      return await this.executeScript(skill, inputs, context);
    } else if (hasPrompt) {
      // Prompt only: Load and execute prompt
      return await this.executePrompt(skill, inputs, context);
    } else {
      throw new Error('Skill has neither script nor prompt');
    }
  }

  private async executeScript(
    skill: SkillDefinition,
    inputs: Record<string, unknown>,
    context: SkillRunContext
  ): Promise<Record<string, unknown>> {
    this.emit('run-progress', { skillName: skill.name, step: 'script' });

    const scriptPath = path.join(skill.skillDir, skill.scriptFile!);

    // Validate script path stays within skill directory
    this.validateScriptPath(scriptPath, skill.skillDir);

    try {
      // Create skill context
      const capabilities = await SkillContext.create(
        skill.name,
        context.projectPath,
        this.memoryService,
        this.llmProvider
      );

      // Import and execute script
      logger.warn(`Executing unsandboxed skill script: ${scriptPath}`);
      const scriptModule = await import(scriptPath);

      if (typeof scriptModule.default !== 'function') {
        throw new Error('Skill script must export a default function');
      }

      // Execute the skill function
      const result = await scriptModule.default(inputs, capabilities, context);

      return result || {};
    } catch (error) {
      throw new Error(`Script execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async executePrompt(
    skill: SkillDefinition,
    inputs: Record<string, unknown>,
    _context: SkillRunContext
  ): Promise<Record<string, unknown>> {
    this.emit('run-progress', { skillName: skill.name, step: 'prompt' });

    const promptPath = path.join(skill.skillDir, skill.promptFile!);

    try {
      // Load prompt template
      let promptTemplate = await fs.readFile(promptPath, 'utf-8');

      // Replace placeholders with input values
      promptTemplate = this.interpolateTemplate(promptTemplate, inputs);

      // Send to LLM
      if (!this.llmProvider) {
        throw new Error('LLM provider not available');
      }

      const response = await this.llmProvider.complete({
        prompt: promptTemplate,
        temperature: 0.7,
        maxTokens: 2000
      });

      const result = response.content || response.text || '';

      // Return as output
      return { result };
    } catch (error) {
      throw new Error(`Prompt execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async executeScriptWithPrompt(
    skill: SkillDefinition,
    inputs: Record<string, unknown>,
    context: SkillRunContext
  ): Promise<Record<string, unknown>> {
    // First, run the script
    const scriptOutputs = await this.executeScript(skill, inputs, context);

    // Then, merge script outputs with inputs for the prompt
    const promptInputs = { ...inputs, ...scriptOutputs };

    // Execute the prompt
    const promptOutputs = await this.executePrompt(skill, promptInputs, context);

    // Merge both outputs
    return { ...scriptOutputs, ...promptOutputs };
  }

  private interpolateTemplate(template: string, values: Record<string, unknown>): string {
    let result = template;

    // Replace {{key}} with values
    for (const [key, value] of Object.entries(values)) {
      const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      const replacement = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
      result = result.replace(regex, replacement);
    }

    return result;
  }

  getRun(id: string): SkillRunRecord | undefined {
    return this.runs.get(id);
  }

  getRecentRuns(limit: number = 10): SkillRunRecord[] {
    const runs = Array.from(this.runs.values());
    runs.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
    return runs.slice(0, limit);
  }

  getRunsBySkill(skillName: string): SkillRunRecord[] {
    const runs = Array.from(this.runs.values()).filter(r => r.skillName === skillName);
    runs.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
    return runs;
  }

  clearHistory(): void {
    this.runs.clear();
  }

  getStats() {
    const runs = Array.from(this.runs.values());
    const total = runs.length;
    const success = runs.filter(r => r.status === 'success').length;
    const failed = runs.filter(r => r.status === 'error').length;
    const running = runs.filter(r => r.status === 'running').length;

    const durations = runs.filter(r => r.duration).map(r => r.duration!);
    const avgDuration = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;

    return {
      total,
      success,
      failed,
      running,
      successRate: total > 0 ? (success / total) * 100 : 0,
      avgDuration: Math.round(avgDuration)
    };
  }
}

export default SkillRunner;
