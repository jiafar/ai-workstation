import * as path from 'path';
import * as fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface SkillContextCapabilities {
  memory: MemoryCapability;
  ai: AICapability;
  fs: FileSystemCapability;
  terminal: TerminalCapability;
  git: GitCapability;
  log: LogCapability;
}

export interface MemoryCapability {
  read(key: string): Promise<any>;
  write(key: string, value: any): Promise<void>;
  delete(key: string): Promise<void>;
  list(prefix?: string): Promise<string[]>;
}

export interface AICapability {
  chat(messages: Array<{ role: string; content: string }>, options?: any): Promise<string>;
  complete(prompt: string, options?: any): Promise<string>;
}

export interface FileSystemCapability {
  readFile(filePath: string): Promise<string>;
  writeFile(filePath: string, content: string): Promise<void>;
  exists(filePath: string): Promise<boolean>;
  readDir(dirPath: string): Promise<string[]>;
  stat(filePath: string): Promise<any>;
}

export interface TerminalCapability {
  exec(command: string, options?: any): Promise<{ stdout: string; stderr: string }>;
}

export interface GitCapability {
  status(): Promise<any>;
  log(options?: any): Promise<any[]>;
  diff(options?: any): Promise<string>;
  add(files: string[]): Promise<void>;
  commit(message: string): Promise<void>;
  branch(): Promise<string>;
  getBranches(): Promise<string[]>;
}

export interface LogCapability {
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  debug(message: string, ...args: any[]): void;
}

export class SkillContext {
  private memoryService: any;
  private llmProvider: any;
  private projectPath: string;
  private skillName: string;

  constructor(
    skillName: string,
    projectPath: string,
    memoryService: any,
    llmProvider: any
  ) {
    this.skillName = skillName;
    this.projectPath = projectPath;
    this.memoryService = memoryService;
    this.llmProvider = llmProvider;
  }

  static async create(
    skillName: string,
    projectPath: string,
    memoryService: any,
    llmProvider: any
  ): Promise<SkillContextCapabilities> {
    const context = new SkillContext(skillName, projectPath, memoryService, llmProvider);
    return context.createCapabilities();
  }

  private createCapabilities(): SkillContextCapabilities {
    return {
      memory: this.createMemoryCapability(),
      ai: this.createAICapability(),
      fs: this.createFileSystemCapability(),
      terminal: this.createTerminalCapability(),
      git: this.createGitCapability(),
      log: this.createLogCapability()
    };
  }

  private createMemoryCapability(): MemoryCapability {
    return {
      read: async (key: string) => {
        const fullKey = `skill:${this.skillName}:${key}`;
        return await this.memoryService.get(fullKey);
      },

      write: async (key: string, value: any) => {
        const fullKey = `skill:${this.skillName}:${key}`;
        await this.memoryService.set(fullKey, value);
      },

      delete: async (key: string) => {
        const fullKey = `skill:${this.skillName}:${key}`;
        await this.memoryService.delete(fullKey);
      },

      list: async (prefix?: string) => {
        const searchPrefix = prefix
          ? `skill:${this.skillName}:${prefix}`
          : `skill:${this.skillName}:`;
        const entries = await this.memoryService.list(searchPrefix);
        // Strip the skill prefix from returned keys
        const prefixLen = `skill:${this.skillName}:`.length;
        return entries.map((key: string) => key.substring(prefixLen));
      }
    };
  }

  private createAICapability(): AICapability {
    return {
      chat: async (messages: Array<{ role: string; content: string }>, options?: any) => {
        if (!this.llmProvider) {
          throw new Error('LLM provider not available');
        }

        const response = await this.llmProvider.chat({
          messages,
          ...options
        });

        return response.content || response.text || '';
      },

      complete: async (prompt: string, options?: any) => {
        if (!this.llmProvider) {
          throw new Error('LLM provider not available');
        }

        const response = await this.llmProvider.complete({
          prompt,
          ...options
        });

        return response.content || response.text || '';
      }
    };
  }

  private createFileSystemCapability(): FileSystemCapability {
    const resolvePath = (filePath: string): string => {
      // Resolve relative paths against project path
      if (!path.isAbsolute(filePath)) {
        return path.join(this.projectPath, filePath);
      }

      // Security: ensure absolute paths are within project
      const normalized = path.normalize(filePath);
      if (!normalized.startsWith(this.projectPath)) {
        throw new Error('Access denied: path outside project directory');
      }

      return normalized;
    };

    return {
      readFile: async (filePath: string) => {
        const fullPath = resolvePath(filePath);
        return await fs.readFile(fullPath, 'utf-8');
      },

      writeFile: async (filePath: string, content: string) => {
        const fullPath = resolvePath(filePath);
        // Ensure directory exists
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, content, 'utf-8');
      },

      exists: async (filePath: string) => {
        try {
          const fullPath = resolvePath(filePath);
          await fs.access(fullPath);
          return true;
        } catch {
          return false;
        }
      },

      readDir: async (dirPath: string) => {
        const fullPath = resolvePath(dirPath);
        const entries = await fs.readdir(fullPath);
        return entries;
      },

      stat: async (filePath: string) => {
        const fullPath = resolvePath(filePath);
        return await fs.stat(fullPath);
      }
    };
  }

  private createTerminalCapability(): TerminalCapability {
    return {
      exec: async (command: string, options?: any) => {
        try {
          const result = await execAsync(command, {
            cwd: this.projectPath,
            maxBuffer: 1024 * 1024 * 10, // 10MB
            ...options
          });

          return {
            stdout: result.stdout,
            stderr: result.stderr
          };
        } catch (error: any) {
          throw new Error(`Command failed: ${error.message}\n${error.stderr || ''}`);
        }
      }
    };
  }

  private createGitCapability(): GitCapability {
    const execGit = async (args: string): Promise<string> => {
      const { stdout } = await execAsync(`git ${args}`, {
        cwd: this.projectPath
      });
      return stdout.trim();
    };

    return {
      status: async () => {
        const output = await execGit('status --porcelain');
        const files = output.split('\n').filter(line => line.trim());

        return {
          modified: files.filter(f => f.startsWith(' M')).map(f => f.substring(3)),
          added: files.filter(f => f.startsWith('A ')).map(f => f.substring(3)),
          deleted: files.filter(f => f.startsWith(' D')).map(f => f.substring(3)),
          untracked: files.filter(f => f.startsWith('??')).map(f => f.substring(3)),
          staged: files.filter(f => !f.startsWith('??') && !f.startsWith(' ')).map(f => f.substring(3))
        };
      },

      log: async (options?: any) => {
        const limit = options?.limit || 10;
        const format = '%H|%an|%ae|%ad|%s';
        const output = await execGit(`log --pretty=format:"${format}" -n ${limit}`);

        return output.split('\n').map(line => {
          const [hash, author, email, date, message] = line.split('|');
          return { hash, author, email, date, message };
        });
      },

      diff: async (options?: any) => {
        const args = options?.staged ? '--staged' : '';
        return await execGit(`diff ${args}`);
      },

      add: async (files: string[]) => {
        const fileArgs = files.join(' ');
        await execGit(`add ${fileArgs}`);
      },

      commit: async (message: string) => {
        await execGit(`commit -m "${message.replace(/"/g, '\\"')}"`);
      },

      branch: async () => {
        return await execGit('rev-parse --abbrev-ref HEAD');
      },

      getBranches: async () => {
        const output = await execGit('branch --list');
        return output.split('\n').map(b => b.trim().replace(/^\* /, ''));
      }
    };
  }

  private createLogCapability(): LogCapability {
    const prefix = `[Skill:${this.skillName}]`;

    return {
      info: (message: string, ...args: any[]) => {
        console.log(prefix, message, ...args);
      },

      warn: (message: string, ...args: any[]) => {
        console.warn(prefix, message, ...args);
      },

      error: (message: string, ...args: any[]) => {
        console.error(prefix, message, ...args);
      },

      debug: (message: string, ...args: any[]) => {
        console.debug(prefix, message, ...args);
      }
    };
  }
}

export default SkillContext;
