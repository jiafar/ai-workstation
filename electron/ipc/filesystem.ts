import { ipcMain, dialog, type IpcMainInvokeEvent, type WebContents } from 'electron';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { pathValidator } from '../utils/pathValidator';

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileEntry[];
}

/**
 * Validate a path against the sandbox. Returns resolved path or throws.
 */
function assertPath(filePath: string): string {
  const result = pathValidator.validate(filePath);
  if (!result.valid) {
    throw new Error(`Access denied: ${result.error}`);
  }
  return result.resolved;
}

export function registerFilesystemHandlers() {
  // Read file contents
  ipcMain.handle('fs:read', async (_event: IpcMainInvokeEvent, filePath: string) => {
    try {
      const resolved = assertPath(filePath);
      const content = await fs.readFile(resolved, 'utf-8');
      return { success: true, data: content };
    } catch (error: unknown) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Write file contents
  ipcMain.handle('fs:write', async (_event: IpcMainInvokeEvent, filePath: string, content: string) => {
    try {
      const resolved = assertPath(filePath);
      await fs.writeFile(resolved, content, 'utf-8');
      return { success: true };
    } catch (error: unknown) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Read directory contents
  ipcMain.handle('fs:readdir', async (_event: IpcMainInvokeEvent, dirPath: string, recursive: boolean = false) => {
    try {
      const resolved = assertPath(dirPath);
      const entries = await readDirectory(resolved, recursive);
      return { success: true, data: entries };
    } catch (error: unknown) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Get file/directory stats
  ipcMain.handle('fs:stat', async (_event: IpcMainInvokeEvent, filePath: string) => {
    try {
      const resolved = assertPath(filePath);
      const stats = await fs.stat(resolved);
      return {
        success: true,
        data: {
          isFile: stats.isFile(),
          isDirectory: stats.isDirectory(),
          size: stats.size,
          mtime: stats.mtime,
          ctime: stats.ctime,
          atime: stats.atime,
        },
      };
    } catch (error: unknown) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Check if file/directory exists
  ipcMain.handle('fs:exists', async (_event: IpcMainInvokeEvent, filePath: string) => {
    try {
      const resolved = assertPath(filePath);
      await fs.access(resolved);
      return { success: true, data: true };
    } catch (error: unknown) {
      // Distinguish between "access denied" and "not found"
      const msg = (error as Error).message;
      if (msg.startsWith('Access denied:')) {
        return { success: false, error: msg };
      }
      return { success: true, data: false };
    }
  });

  // Create directory
  ipcMain.handle('fs:mkdir', async (_event: IpcMainInvokeEvent, dirPath: string, recursive: boolean = true) => {
    try {
      const resolved = assertPath(dirPath);
      await fs.mkdir(resolved, { recursive });
      return { success: true };
    } catch (error: unknown) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Remove file/directory
  ipcMain.handle('fs:remove', async (_event: IpcMainInvokeEvent, filePath: string) => {
    try {
      const resolved = assertPath(filePath);
      const stats = await fs.stat(resolved);
      if (stats.isDirectory()) {
        await fs.rm(resolved, { recursive: true, force: true });
      } else {
        await fs.unlink(resolved);
      }
      return { success: true };
    } catch (error: unknown) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Rename/move file/directory
  ipcMain.handle('fs:rename', async (_event: IpcMainInvokeEvent, oldPath: string, newPath: string) => {
    try {
      const resolvedOld = assertPath(oldPath);
      const resolvedNew = assertPath(newPath);
      await fs.rename(resolvedOld, resolvedNew);
      return { success: true };
    } catch (error: unknown) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Watch file/directory for changes
  ipcMain.handle('fs:watch', async (event: IpcMainInvokeEvent, filePath: string) => {
    try {
      const resolved = assertPath(filePath);
      const sender = event.sender as WebContents;
      const watchId = resolved; // Use resolved path as watchId
      const watcher = fsSync.watch(resolved, { recursive: true }, (eventType, filename) => {
        sender.send('fs:watch:change', watchId, {
          eventType,
          filename,
          path: filename ? path.join(resolved, filename) : resolved,
        });
      });

      // Cleanup watcher when window is destroyed
      sender.once('destroyed', () => {
        watcher.close();
      });

      return { success: true, data: watchId };
    } catch (error: unknown) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Unwatch (no-op for now since watchers are cleaned up on window destroy)
  ipcMain.handle('fs:unwatch', async (_event: IpcMainInvokeEvent, _filePath: string) => {
    return { success: true };
  });

  // Select directory dialog - user-initiated, always allowed
  ipcMain.handle('fs:select-directory', async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory', 'createDirectory'],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: true, data: null };
      }

      const selectedDir = result.filePaths[0];

      // Auto-add selected directory to allowed roots
      pathValidator.addRoot(selectedDir);

      return { success: true, data: selectedDir };
    } catch (error: unknown) {
      return { success: false, error: (error as Error).message };
    }
  });
}

async function readDirectory(dirPath: string, recursive: boolean): Promise<FileEntry[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const fileEntries: FileEntry[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const fileEntry: FileEntry = {
      name: entry.name,
      path: fullPath,
      isDirectory: entry.isDirectory(),
    };

    if (recursive && entry.isDirectory()) {
      try {
        fileEntry.children = await readDirectory(fullPath, true);
      } catch {
        // Skip directories we can't read
        fileEntry.children = [];
      }
    }

    fileEntries.push(fileEntry);
  }

  return fileEntries.sort((a, b) => {
    // Directories first, then alphabetically
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    return a.name.localeCompare(b.name);
  });
}
