import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import simpleGit, { SimpleGit, StatusResult, LogResult } from 'simple-git';

const gitInstances = new Map<string, SimpleGit>();

function getGitInstance(repoPath: string): SimpleGit {
  if (!gitInstances.has(repoPath)) {
    gitInstances.set(repoPath, simpleGit(repoPath));
  }
  return gitInstances.get(repoPath)!;
}

export function registerGitHandlers() {
  // Initialize git repository
  ipcMain.handle('git:init', async (_event: IpcMainInvokeEvent, repoPath: string) => {
    try {
      const git = getGitInstance(repoPath);
      await git.init();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Get repository status
  ipcMain.handle('git:status', async (_event: IpcMainInvokeEvent, repoPath: string) => {
    try {
      const git = getGitInstance(repoPath);
      const status: StatusResult = await git.status();
      return {
        success: true,
        data: {
          current: status.current,
          tracking: status.tracking,
          ahead: status.ahead,
          behind: status.behind,
          staged: status.staged,
          modified: status.modified,
          created: status.created,
          deleted: status.deleted,
          renamed: status.renamed,
          conflicted: status.conflicted,
          files: status.files,
          isClean: status.isClean(),
        },
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Get diff
  ipcMain.handle('git:diff', async (_event: IpcMainInvokeEvent, repoPath: string, options?: { cached?: boolean; file?: string }) => {
    try {
      const git = getGitInstance(repoPath);
      let diff: string;

      if (options?.file) {
        diff = await git.diff(options.cached ? ['--cached', options.file] : [options.file]);
      } else {
        diff = await git.diff(options?.cached ? ['--cached'] : []);
      }

      return { success: true, data: diff };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Get commit log
  ipcMain.handle('git:log', async (_event: IpcMainInvokeEvent, repoPath: string, options?: { maxCount?: number; file?: string }) => {
    try {
      const git = getGitInstance(repoPath);
      const logOptions: any = {};

      if (options?.maxCount) {
        logOptions.maxCount = options.maxCount;
      }

      if (options?.file) {
        logOptions.file = options.file;
      }

      const log: LogResult = await git.log(logOptions);
      return {
        success: true,
        data: {
          all: log.all.map((commit) => ({
            hash: commit.hash,
            date: commit.date,
            message: commit.message,
            author_name: commit.author_name,
            author_email: commit.author_email,
            refs: commit.refs,
          })),
          latest: log.latest ? {
            hash: log.latest.hash,
            date: log.latest.date,
            message: log.latest.message,
            author_name: log.latest.author_name,
            author_email: log.latest.author_email,
          } : null,
          total: log.total,
        },
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Add files to staging
  ipcMain.handle('git:add', async (_event: IpcMainInvokeEvent, repoPath: string, files: string | string[]) => {
    try {
      const git = getGitInstance(repoPath);
      await git.add(files);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Commit changes
  ipcMain.handle('git:commit', async (_event: IpcMainInvokeEvent, repoPath: string, message: string) => {
    try {
      const git = getGitInstance(repoPath);
      const result = await git.commit(message);
      return {
        success: true,
        data: {
          commit: result.commit,
          summary: result.summary,
          branch: result.branch,
        },
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Get branches
  ipcMain.handle('git:branch', async (_event: IpcMainInvokeEvent, repoPath: string, options?: { all?: boolean }) => {
    try {
      const git = getGitInstance(repoPath);
      const branches = await git.branch(options?.all ? ['-a'] : []);
      return {
        success: true,
        data: {
          current: branches.current,
          all: branches.all,
          branches: branches.branches,
        },
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Checkout branch
  ipcMain.handle('git:checkout', async (_event: IpcMainInvokeEvent, repoPath: string, branch: string, create?: boolean) => {
    try {
      const git = getGitInstance(repoPath);
      if (create) {
        await git.checkoutLocalBranch(branch);
      } else {
        await git.checkout(branch);
      }
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Pull changes
  ipcMain.handle('git:pull', async (_event: IpcMainInvokeEvent, repoPath: string, remote?: string, branch?: string) => {
    try {
      const git = getGitInstance(repoPath);
      const result = await git.pull(remote, branch);
      return {
        success: true,
        data: {
          files: result.files,
          insertions: result.insertions,
          deletions: result.deletions,
          summary: result.summary,
        },
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Push changes
  ipcMain.handle('git:push', async (_event: IpcMainInvokeEvent, repoPath: string, remote?: string, branch?: string) => {
    try {
      const git = getGitInstance(repoPath);
      const result = await git.push(remote, branch);
      return { success: true, data: result };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Clone repository
  ipcMain.handle('git:clone', async (_event: IpcMainInvokeEvent, repoUrl: string, localPath: string) => {
    try {
      await simpleGit().clone(repoUrl, localPath);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Get remote information
  ipcMain.handle('git:remote', async (_event: IpcMainInvokeEvent, repoPath: string) => {
    try {
      const git = getGitInstance(repoPath);
      const remotes = await git.getRemotes(true);
      return {
        success: true,
        data: remotes.map((remote) => ({
          name: remote.name,
          refs: remote.refs,
        })),
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Stash changes
  ipcMain.handle('git:stash', async (_event: IpcMainInvokeEvent, repoPath: string, message?: string) => {
    try {
      const git = getGitInstance(repoPath);
      await git.stash(['push', '-m', message || 'WIP']);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // List stashes
  ipcMain.handle('git:stashList', async (_event: IpcMainInvokeEvent, repoPath: string) => {
    try {
      const git = getGitInstance(repoPath);
      const stashes = await git.stashList();
      return {
        success: true,
        data: stashes.all.map((stash) => ({
          hash: stash.hash,
          date: stash.date,
          message: stash.message,
        })),
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Pop stash
  ipcMain.handle('git:stashPop', async (_event: IpcMainInvokeEvent, repoPath: string, index?: number) => {
    try {
      const git = getGitInstance(repoPath);
      const args = index !== undefined ? [`stash@{${index}}`] : [];
      await git.stash(['pop', ...args]);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Apply stash (without removing)
  ipcMain.handle('git:stashApply', async (_event: IpcMainInvokeEvent, repoPath: string, index?: number) => {
    try {
      const git = getGitInstance(repoPath);
      const args = index !== undefined ? [`stash@{${index}}`] : [];
      await git.stash(['apply', ...args]);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Drop stash
  ipcMain.handle('git:stashDrop', async (_event: IpcMainInvokeEvent, repoPath: string, index?: number) => {
    try {
      const git = getGitInstance(repoPath);
      const args = index !== undefined ? [`stash@{${index}}`] : [];
      await git.stash(['drop', ...args]);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Fetch from remote
  ipcMain.handle('git:fetch', async (_event: IpcMainInvokeEvent, repoPath: string, remote?: string) => {
    try {
      const git = getGitInstance(repoPath);
      if (remote) {
        await git.fetch(remote);
      } else {
        await git.fetch();
      }
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Merge branch
  ipcMain.handle('git:merge', async (_event: IpcMainInvokeEvent, repoPath: string, branch: string) => {
    try {
      const git = getGitInstance(repoPath);
      await git.merge([branch]);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}
