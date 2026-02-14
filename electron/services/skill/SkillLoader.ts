import * as path from 'path';
import * as fs from 'fs/promises';
import { watch, FSWatcher } from 'chokidar';
import type { SkillDefinition } from './SkillRegistry';
import { logger } from '../../utils/logger';

export class SkillLoader {
  private static readonly SKILL_DEFINITION_FILE = 'skill.json';
  private static readonly SKILL_PROMPT_FILE = 'prompt.md';
  private static readonly SKILL_SCRIPT_FILE = 'index.ts';

  async load(skillDir: string): Promise<SkillDefinition> {
    try {
      // Check if directory exists
      const stat = await fs.stat(skillDir);
      if (!stat.isDirectory()) {
        throw new Error(`Not a directory: ${skillDir}`);
      }

      // Read skill.json
      const definitionPath = path.join(skillDir, SkillLoader.SKILL_DEFINITION_FILE);
      const definitionContent = await fs.readFile(definitionPath, 'utf-8');
      const definition = JSON.parse(definitionContent);

      // Validate required fields
      this.validateDefinition(definition);

      // Check for prompt.md
      const promptPath = path.join(skillDir, SkillLoader.SKILL_PROMPT_FILE);
      let hasPrompt = false;
      try {
        await fs.access(promptPath);
        hasPrompt = true;
        definition.promptFile = SkillLoader.SKILL_PROMPT_FILE;
      } catch {
        // Prompt file is optional
      }

      // Check for index.ts
      const scriptPath = path.join(skillDir, SkillLoader.SKILL_SCRIPT_FILE);
      let hasScript = false;
      try {
        await fs.access(scriptPath);
        hasScript = true;
        definition.scriptFile = SkillLoader.SKILL_SCRIPT_FILE;
      } catch {
        // Script file is optional
      }

      // At least one of prompt or script must exist
      if (!hasPrompt && !hasScript) {
        throw new Error(`Skill must have either ${SkillLoader.SKILL_PROMPT_FILE} or ${SkillLoader.SKILL_SCRIPT_FILE}`);
      }

      // Set skill directory
      definition.skillDir = skillDir;

      return definition as SkillDefinition;
    } catch (error) {
      throw new Error(`Failed to load skill from ${skillDir}: ${error}`);
    }
  }

  async loadAll(skillsBaseDir: string): Promise<SkillDefinition[]> {
    const skills: SkillDefinition[] = [];

    try {
      // Check if directory exists
      const stat = await fs.stat(skillsBaseDir);
      if (!stat.isDirectory()) {
        throw new Error(`Not a directory: ${skillsBaseDir}`);
      }

      // Read all entries
      const entries = await fs.readdir(skillsBaseDir, { withFileTypes: true });

      for (const entry of entries) {
        // Skip non-directories and hidden files
        if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name.startsWith('_')) {
          continue;
        }

        const skillDir = path.join(skillsBaseDir, entry.name);

        try {
          const skill = await this.load(skillDir);
          skills.push(skill);
        } catch (error) {
          logger.error(`Failed to load skill from ${skillDir}:`, error);
          // Continue loading other skills
        }
      }

      return skills;
    } catch (error) {
      logger.error(`Failed to load skills from ${skillsBaseDir}:`, error);
      return [];
    }
  }

  watch(
    skillsBaseDir: string,
    onChange: (event: 'add' | 'change' | 'remove', skillDir: string) => void
  ): FSWatcher {
    const watcher = watch(skillsBaseDir, {
      persistent: true,
      ignoreInitial: true,
      depth: 2,
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/_template/**',
        '**/.*'
      ]
    });

    // Track which skill directories have been modified
    const changedSkills = new Set<string>();
    let debounceTimer: NodeJS.Timeout | null = null;

    const handleChange = (filePath: string, event: 'add' | 'change' | 'unlink') => {
      // Extract skill directory
      const relativePath = path.relative(skillsBaseDir, filePath);
      const parts = relativePath.split(path.sep);

      if (parts.length < 2) {
        return; // Not a file inside a skill directory
      }

      const skillName = parts[0];
      const skillDir = path.join(skillsBaseDir, skillName);

      // Add to changed skills set
      changedSkills.add(skillDir);

      // Debounce: wait for multiple file changes to settle
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      debounceTimer = setTimeout(() => {
        changedSkills.forEach(dir => {
          const mappedEvent = event === 'unlink' ? 'remove' : event === 'add' ? 'add' : 'change';
          onChange(mappedEvent, dir);
        });
        changedSkills.clear();
      }, 500);
    };

    watcher
      .on('add', filePath => handleChange(filePath, 'add'))
      .on('change', filePath => handleChange(filePath, 'change'))
      .on('unlink', filePath => handleChange(filePath, 'unlink'))
      .on('unlinkDir', dirPath => {
        const relativePath = path.relative(skillsBaseDir, dirPath);
        const parts = relativePath.split(path.sep);

        if (parts.length === 1) {
          // A skill directory was deleted
          onChange('remove', dirPath);
        }
      })
      .on('error', error => {
        logger.error('Skill watcher error:', error);
      });

    logger.info(`Watching skills directory: ${skillsBaseDir}`);

    return watcher;
  }

  private validateDefinition(definition: any): void {
    const required = ['name', 'version', 'description', 'author', 'category'];

    for (const field of required) {
      if (!definition[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Validate types
    if (typeof definition.name !== 'string') {
      throw new Error('Field "name" must be a string');
    }

    if (typeof definition.version !== 'string') {
      throw new Error('Field "version" must be a string');
    }

    if (!Array.isArray(definition.inputs)) {
      definition.inputs = [];
    }

    if (!Array.isArray(definition.outputs)) {
      definition.outputs = [];
    }

    if (!Array.isArray(definition.requires)) {
      definition.requires = [];
    }

    if (!definition.trigger) {
      definition.trigger = {};
    }

    if (!Array.isArray(definition.tags)) {
      definition.tags = [];
    }
  }

  async getCapabilityFiles(skillDir: string): Promise<{
    prompt?: string;
    script?: string;
  }> {
    const result: { prompt?: string; script?: string } = {};

    // Try to read prompt.md
    try {
      const promptPath = path.join(skillDir, SkillLoader.SKILL_PROMPT_FILE);
      result.prompt = await fs.readFile(promptPath, 'utf-8');
    } catch {
      // Prompt file is optional
    }

    // Try to read index.ts
    try {
      const scriptPath = path.join(skillDir, SkillLoader.SKILL_SCRIPT_FILE);
      result.script = await fs.readFile(scriptPath, 'utf-8');
    } catch {
      // Script file is optional
    }

    return result;
  }

  resolveRequiredCapabilities(requires: string[]): string[] {
    const validCapabilities = [
      'memory',
      'ai',
      'fs',
      'terminal',
      'git',
      'log'
    ];

    return requires.map(req => {
      if (!validCapabilities.includes(req)) {
        logger.warn(`Unknown capability required: ${req}`);
      }
      return req;
    });
  }
}

export default SkillLoader;
