import simpleGit, { SimpleGit, StatusResult, DiffResult, LogResult } from 'simple-git';
import { logger } from '../../utils/logger';
import { config } from '../../utils/config';

export interface GitStatus {
  current: string | null;
  tracking: string | null;
  ahead: number;
  behind: number;
  files: Array<{
    path: string;
    index: string;
    working_dir: string;
  }>;
  staged: string[];
  modified: string[];
  deleted: string[];
  untracked: string[];
  conflicted: string[];
}

export interface GitLogEntry {
  hash: string;
  date: string;
  message: string;
  author_name: string;
  author_email: string;
}

export interface GitBranch {
  current: string;
  all: string[];
  branches: Record<string, { current: boolean; label: string }>;
}

class GitService {
  private static instance: GitService;
  private gitInstances: Map<string, SimpleGit>;

  private constructor() {
    this.gitInstances = new Map();
    logger.info('GitService initialized');
  }

  static getInstance(): GitService {
    if (!GitService.instance) {
      GitService.instance = new GitService();
    }
    return GitService.instance;
  }

  private getGit(path: string): SimpleGit {
    if (!this.gitInstances.has(path)) {
      const git = simpleGit({
        baseDir: path,
        binary: 'git',
        maxConcurrentProcesses: 6,
        trimmed: false,
      });
      this.gitInstances.set(path, git);
    }
    return this.gitInstances.get(path)!;
  }

  /**
   * Get repository status
   */
  async status(path: string): Promise<GitStatus> {
    try {
      const git = this.getGit(path);
      const status: StatusResult = await git.status();

      const result: GitStatus = {
        current: status.current,
        tracking: status.tracking,
        ahead: status.ahead,
        behind: status.behind,
        files: status.files.map((file) => ({
          path: file.path,
          index: file.index,
          working_dir: file.working_dir,
        })),
        staged: status.staged,
        modified: status.modified,
        deleted: status.deleted,
        untracked: status.not_added,
        conflicted: status.conflicted,
      };

      logger.debug('Git status retrieved', { path, current: status.current });
      return result;
    } catch (error) {
      logger.error('Failed to get git status', { path, error });
      throw error;
    }
  }

  /**
   * Get diff for a file or repository
   */
  async diff(path: string, options?: { file?: string; cached?: boolean }): Promise<string> {
    try {
      const git = this.getGit(path);
      const args: string[] = [];

      if (options?.cached) {
        args.push('--cached');
      }

      if (options?.file) {
        args.push(options.file);
      }

      const diff: DiffResult = await git.diff(args);
      logger.debug('Git diff retrieved', { path, file: options?.file, cached: options?.cached });
      return diff;
    } catch (error) {
      logger.error('Failed to get git diff', { path, error });
      throw error;
    }
  }

  /**
   * Get commit log
   */
  async log(path: string, maxCount: number = 50): Promise<GitLogEntry[]> {
    try {
      const git = this.getGit(path);
      const log: LogResult = await git.log({ maxCount });

      const entries: GitLogEntry[] = log.all.map((commit) => ({
        hash: commit.hash,
        date: commit.date,
        message: commit.message,
        author_name: commit.author_name,
        author_email: commit.author_email,
      }));

      logger.debug('Git log retrieved', { path, count: entries.length });
      return entries;
    } catch (error) {
      logger.error('Failed to get git log', { path, error });
      throw error;
    }
  }

  /**
   * Commit changes
   */
  async commit(path: string, message: string): Promise<string> {
    try {
      const git = this.getGit(path);
      const result = await git.commit(message);

      logger.info('Git commit created', {
        path,
        commit: result.commit,
        summary: result.summary,
      });

      return result.commit;
    } catch (error) {
      logger.error('Failed to create git commit', { path, error });
      throw error;
    }
  }

  /**
   * Add files to staging area
   */
  async add(path: string, files: string[] | string = '.'): Promise<void> {
    try {
      const git = this.getGit(path);
      await git.add(files);

      const fileList = Array.isArray(files) ? files.join(', ') : files;
      logger.info('Files added to git staging area', { path, files: fileList });
    } catch (error) {
      logger.error('Failed to add files to git', { path, error });
      throw error;
    }
  }

  /**
   * Get branch information
   */
  async branch(path: string): Promise<GitBranch> {
    try {
      const git = this.getGit(path);
      const branchSummary = await git.branch();

      const result: GitBranch = {
        current: branchSummary.current,
        all: branchSummary.all,
        branches: branchSummary.branches,
      };

      logger.debug('Git branch info retrieved', { path, current: result.current });
      return result;
    } catch (error) {
      logger.error('Failed to get git branch info', { path, error });
      throw error;
    }
  }

  /**
   * Create a new branch
   */
  async createBranch(path: string, branchName: string, checkout: boolean = false): Promise<void> {
    try {
      const git = this.getGit(path);

      if (checkout) {
        await git.checkoutLocalBranch(branchName);
      } else {
        await git.branch([branchName]);
      }

      logger.info('Git branch created', { path, branchName, checkout });
    } catch (error) {
      logger.error('Failed to create git branch', { path, branchName, error });
      throw error;
    }
  }

  /**
   * Checkout a branch
   */
  async checkout(path: string, branchName: string): Promise<void> {
    try {
      const git = this.getGit(path);
      await git.checkout(branchName);

      logger.info('Git branch checked out', { path, branchName });
    } catch (error) {
      logger.error('Failed to checkout git branch', { path, branchName, error });
      throw error;
    }
  }

  /**
   * Pull from remote
   */
  async pull(path: string, remote?: string, branch?: string): Promise<void> {
    try {
      const git = this.getGit(path);
      await git.pull(remote, branch);

      logger.info('Git pull completed', { path, remote, branch });
    } catch (error) {
      logger.error('Failed to pull from git', { path, error });
      throw error;
    }
  }

  /**
   * Push to remote
   */
  async push(path: string, remote?: string, branch?: string): Promise<void> {
    try {
      const git = this.getGit(path);
      await git.push(remote, branch);

      logger.info('Git push completed', { path, remote, branch });
    } catch (error) {
      logger.error('Failed to push to git', { path, error });
      throw error;
    }
  }

  /**
   * Check if directory is a git repository
   */
  async isRepo(path: string): Promise<boolean> {
    try {
      const git = this.getGit(path);
      const result = await git.checkIsRepo();
      return result;
    } catch (error) {
      logger.debug('Directory is not a git repository', { path });
      return false;
    }
  }

  /**
   * Initialize a new git repository
   */
  async init(path: string): Promise<void> {
    try {
      const git = this.getGit(path);
      await git.init();

      logger.info('Git repository initialized', { path });
    } catch (error) {
      logger.error('Failed to initialize git repository', { path, error });
      throw error;
    }
  }

  /**
   * Clone a repository
   */
  async clone(repoUrl: string, targetPath: string): Promise<void> {
    try {
      await simpleGit().clone(repoUrl, targetPath);

      logger.info('Git repository cloned', { repoUrl, targetPath });
    } catch (error) {
      logger.error('Failed to clone git repository', { repoUrl, targetPath, error });
      throw error;
    }
  }

  /**
   * Reset changes
   */
  async reset(path: string, mode: 'soft' | 'mixed' | 'hard' = 'mixed'): Promise<void> {
    try {
      const git = this.getGit(path);
      await git.reset([`--${mode}`]);

      logger.info('Git reset completed', { path, mode });
    } catch (error) {
      logger.error('Failed to reset git', { path, mode, error });
      throw error;
    }
  }

  /**
   * Stash changes
   */
  async stash(path: string, message?: string): Promise<void> {
    try {
      const git = this.getGit(path);
      const args = message ? ['push', '-m', message] : ['push'];
      await git.stash(args);

      logger.info('Git stash created', { path, message });
    } catch (error) {
      logger.error('Failed to stash git changes', { path, error });
      throw error;
    }
  }

  /**
   * Apply stash
   */
  async stashPop(path: string): Promise<void> {
    try {
      const git = this.getGit(path);
      await git.stash(['pop']);

      logger.info('Git stash applied', { path });
    } catch (error) {
      logger.error('Failed to apply git stash', { path, error });
      throw error;
    }
  }
}

// Singleton export
export const gitService = GitService.getInstance();

export { GitService };
export default gitService;
