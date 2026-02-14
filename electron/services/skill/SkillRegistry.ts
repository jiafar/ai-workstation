import * as path from 'path';
import * as fs from 'fs/promises';
import { EventEmitter } from 'events';
import { SkillLoader } from './SkillLoader';
import { logger } from '../../utils/logger';

export interface SkillInput {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required: boolean;
  default?: any;
}

export interface SkillOutput {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
}

export interface SkillTrigger {
  command?: string;
  chatKeyword?: string;
}

export interface SkillDefinition {
  name: string;
  version: string;
  description: string;
  author: string;
  category: string;
  tags: string[];
  inputs: SkillInput[];
  outputs: SkillOutput[];
  trigger: SkillTrigger;
  requires: string[];
  promptFile?: string;
  scriptFile?: string;
  skillDir: string;
}

export class SkillRegistry extends EventEmitter {
  private static instance: SkillRegistry | null = null;
  private skills: Map<string, SkillDefinition> = new Map();
  private loader: SkillLoader;
  private watcher: any = null;
  private initialized: boolean = false;

  private constructor() {
    super();
    this.loader = new SkillLoader();
  }

  static getInstance(): SkillRegistry {
    if (!SkillRegistry.instance) {
      SkillRegistry.instance = new SkillRegistry();
    }
    return SkillRegistry.instance;
  }

  async init(skillsDir: string): Promise<void> {
    if (this.initialized) {
      logger.warn('SkillRegistry already initialized');
      return;
    }

    logger.info(`Initializing SkillRegistry with skills directory: ${skillsDir}`);

    try {
      // Check if skills directory exists
      await fs.access(skillsDir);
    } catch (error) {
      logger.error(`Skills directory does not exist: ${skillsDir}`);
      throw new Error(`Skills directory not found: ${skillsDir}`);
    }

    // Load all skills
    const skills = await this.loader.loadAll(skillsDir);

    for (const skill of skills) {
      this.register(skill);
    }

    // Setup hot-reload watcher
    this.setupWatcher(skillsDir);

    this.initialized = true;
    this.emit('initialized', { count: this.skills.size });
    logger.info(`SkillRegistry initialized with ${this.skills.size} skills`);
  }

  private setupWatcher(skillsDir: string): void {
    this.watcher = this.loader.watch(skillsDir, async (event, skillDir) => {
      logger.info(`Skill ${event} detected: ${skillDir}`);

      if (event === 'change' || event === 'add') {
        try {
          const skill = await this.loader.load(skillDir);
          this.register(skill);
          this.emit('skill-updated', skill);
          logger.info(`Skill ${skill.name} hot-reloaded`);
        } catch (error) {
          logger.error(`Failed to reload skill from ${skillDir}:`, error);
          this.emit('skill-error', { skillDir, error });
        }
      } else if (event === 'remove') {
        // Extract skill name from directory
        const skillName = path.basename(skillDir);
        this.unregister(skillName);
        this.emit('skill-removed', { name: skillName });
        logger.info(`Skill ${skillName} removed`);
      }
    });
  }

  register(skill: SkillDefinition): void {
    // Validate skill definition
    if (!skill.name || !skill.version) {
      throw new Error('Invalid skill definition: name and version are required');
    }

    // Check for conflicts
    const existing = this.skills.get(skill.name);
    if (existing) {
      logger.warn(`Overwriting existing skill: ${skill.name}`);
    }

    this.skills.set(skill.name, skill);
    logger.info(`Registered skill: ${skill.name} v${skill.version}`);
  }

  unregister(name: string): boolean {
    const deleted = this.skills.delete(name);
    if (deleted) {
      logger.info(`Unregistered skill: ${name}`);
    }
    return deleted;
  }

  resolve(name: string): SkillDefinition | undefined {
    return this.skills.get(name);
  }

  list(): SkillDefinition[] {
    return Array.from(this.skills.values());
  }

  getByCategory(category: string): SkillDefinition[] {
    return this.list().filter(skill => skill.category === category);
  }

  search(query: string): SkillDefinition[] {
    const lowerQuery = query.toLowerCase();
    return this.list().filter(skill => {
      // Search in name, description, tags, and category
      return (
        skill.name.toLowerCase().includes(lowerQuery) ||
        skill.description.toLowerCase().includes(lowerQuery) ||
        skill.category.toLowerCase().includes(lowerQuery) ||
        skill.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
      );
    });
  }

  getCategoryList(): string[] {
    const categories = new Set<string>();
    this.list().forEach(skill => categories.add(skill.category));
    return Array.from(categories).sort();
  }

  getByTrigger(trigger: string): SkillDefinition | undefined {
    return this.list().find(skill => {
      return (
        skill.trigger.command === trigger ||
        skill.trigger.chatKeyword === trigger
      );
    });
  }

  async destroy(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
    this.skills.clear();
    this.initialized = false;
    this.removeAllListeners();
    logger.info('SkillRegistry destroyed');
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getStats() {
    return {
      total: this.skills.size,
      categories: this.getCategoryList().length,
      byCategory: this.getCategoryList().reduce((acc, cat) => {
        acc[cat] = this.getByCategory(cat).length;
        return acc;
      }, {} as Record<string, number>)
    };
  }
}

export default SkillRegistry;
