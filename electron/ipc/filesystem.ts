import { ipcMain, dialog } from 'electron';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileEntry[];
}

export function registerFilesystemHandlers() {
  // Read file contents
  ipcMain.handle('fs:read', async (_, filePath: string) => {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return { success: true, data: content };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Write file contents
  ipcMain.handle('fs:write', async (_, filePath: string, content: string) => {
    try {
      await fs.writeFile(filePath, content, 'utf-8');
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Read directory contents
  ipcMain.handle('fs:readdir', async (_, dirPath: string, recursive: boolean = false) => {
    try {
      const entries = await readDirectory(dirPath, recursive);
      return { success: true, data: entries };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Get file/directory stats
  ipcMain.handle('fs:stat', async (_, filePath: string) => {
    try {
      const stats = await fs.stat(filePath);
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
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Check if file/directory exists
  ipcMain.handle('fs:exists', async (_, filePath: string) => {
    try {
      await fs.access(filePath);
      return { success: true, data: true };
    } catch {
      return { success: true, data: false };
    }
  });

  // Create directory
  ipcMain.handle('fs:mkdir', async (_, dirPath: string, recursive: boolean = true) => {
    try {
      await fs.mkdir(dirPath, { recursive });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Remove file/directory
  ipcMain.handle('fs:remove', async (_, filePath: string) => {
    try {
      const stats = await fs.stat(filePath);
      if (stats.isDirectory()) {
        await fs.rm(filePath, { recursive: true, force: true });
      } else {
        await fs.unlink(filePath);
      }
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Rename/move file/directory
  ipcMain.handle('fs:rename', async (_, oldPath: string, newPath: string) => {
    try {
      await fs.rename(oldPath, newPath);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Watch file/directory for changes
  ipcMain.handle('fs:watch', async (event, filePath: string, watchId: string) => {
    try {
      const watcher = fsSync.watch(filePath, { recursive: true }, (eventType, filename) => {
        event.sender.send('fs:watch:change', watchId, {
          eventType,
          filename,
          path: filename ? path.join(filePath, filename) : filePath,
        });
      });

      // Store watcher for cleanup
      event.sender.once('destroyed', () => {
        watcher.close();
      });

      return { success: true, watchId };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Select directory dialog
  ipcMain.handle('fs:select-directory', async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory', 'createDirectory'],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: true, data: null };
      }

      return { success: true, data: result.filePaths[0] };
    } catch (error: any) {
      return { success: false, error: error.message };
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
      } catch (error) {
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
