import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import { sqliteManager } from '../services/database/SQLiteManager';
import { logger } from '../utils/logger';

const ALLOWED_TABLES = [
  'memories', 'conversations', 'messages', 'skills', 'rituals', 'workflows', 'settings',
] as const;

type AllowedTable = (typeof ALLOWED_TABLES)[number];

function ensureDb(): void {
  if (!sqliteManager.isInitialized()) {
    sqliteManager.init();
  }
}

export function registerDatabaseHandlers() {
  // Initialize database on startup
  try {
    sqliteManager.init();
    logger.info('Database initialized in IPC handlers');
  } catch (error) {
    logger.error('Failed to initialize database in IPC handlers', error);
  }

  // ---------------------------------------------------------------------------
  // Safe admin operations
  // ---------------------------------------------------------------------------

  ipcMain.handle('db:get-stats', async () => {
    try {
      ensureDb();
      const stats = sqliteManager.getStats();
      const dbPath = sqliteManager.getDbPath();
      let size = 0;
      try {
        const fs = require('fs');
        size = fs.statSync(dbPath).size;
      } catch { /* ignore */ }
      const pageInfo = sqliteManager.queryOne('PRAGMA page_count');
      const pageSize = sqliteManager.queryOne('PRAGMA page_size');
      return {
        success: true,
        data: {
          size,
          tableCount: Object.keys(stats).length,
          recordCount: Object.values(stats).reduce((a: number, b: number) => a + b, 0),
          pageSize: (pageSize as any)?.page_size || 4096,
          pageCount: (pageInfo as any)?.page_count || 0,
          tables: stats,
        },
      };
    } catch (error: any) {
      logger.error('db:get-stats failed', { error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('db:get-schema', async () => {
    try {
      ensureDb();
      const tables = sqliteManager.query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
      const views = sqliteManager.query("SELECT name FROM sqlite_master WHERE type='view'");
      const indexes = sqliteManager.query("SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'");
      return {
        success: true,
        data: {
          tables: tables.map((t: any) => t.name),
          views: views.map((v: any) => v.name),
          indexes: indexes.map((i: any) => i.name),
        },
      };
    } catch (error: any) {
      logger.error('db:get-schema failed', { error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('db:backup', async (_event: IpcMainInvokeEvent, backupPath: string) => {
    try {
      ensureDb();
      sqliteManager.backup(backupPath);
      const fs = require('fs');
      const stats = fs.statSync(backupPath);
      return { success: true, data: { backupPath, timestamp: new Date().toISOString(), size: stats.size } };
    } catch (error: any) {
      logger.error('db:backup failed', { backupPath, error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('db:optimize', async () => {
    try {
      ensureDb();
      sqliteManager.vacuum();
      return { success: true, data: { optimized: true, timestamp: new Date().toISOString() } };
    } catch (error: any) {
      logger.error('db:optimize failed', { error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('db:close', async () => {
    try {
      sqliteManager.close();
      return { success: true, data: { closed: true } };
    } catch (error: any) {
      logger.error('db:close failed', { error: error.message });
      return { success: false, error: error.message };
    }
  });

  // ---------------------------------------------------------------------------
  // Table info -- validated against whitelist
  // ---------------------------------------------------------------------------

  ipcMain.handle('db:get-table-info', async (_event: IpcMainInvokeEvent, tableName: string) => {
    try {
      ensureDb();
      if (!ALLOWED_TABLES.includes(tableName as AllowedTable)) {
        return { success: false, error: `Table "${tableName}" is not allowed. Valid: ${ALLOWED_TABLES.join(', ')}` };
      }
      const columns = sqliteManager.query(`PRAGMA table_info(${tableName})`);
      const indexes = sqliteManager.query(`PRAGMA index_list(${tableName})`);
      const count = sqliteManager.queryOne<{ count: number }>(`SELECT COUNT(*) as count FROM ${tableName}`);
      return { success: true, data: { name: tableName, columns, indexes, rowCount: count?.count || 0 } };
    } catch (error: any) {
      logger.error('db:get-table-info failed', { tableName, error: error.message });
      return { success: false, error: error.message };
    }
  });

  // ---------------------------------------------------------------------------
  // Memories -- safe parameterized CRUD
  // ---------------------------------------------------------------------------

  ipcMain.handle('db:memories:list', async (_event: IpcMainInvokeEvent, params?: { type?: string }) => {
    try {
      ensureDb();
      const rows = params?.type
        ? sqliteManager.query('SELECT * FROM memories WHERE type = ? ORDER BY timestamp DESC', [params.type])
        : sqliteManager.query('SELECT * FROM memories ORDER BY timestamp DESC');
      return { success: true, data: rows };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('db:memories:get', async (_event: IpcMainInvokeEvent, id: string) => {
    try {
      ensureDb();
      const row = sqliteManager.queryOne('SELECT * FROM memories WHERE id = ?', [id]);
      return { success: true, data: row };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('db:memories:create', async (_event: IpcMainInvokeEvent, params: {
    id: string; type: string; content: string; context?: string; timestamp: number; metadata?: string; embedding_id?: string;
  }) => {
    try {
      ensureDb();
      const result = sqliteManager.run(
        'INSERT INTO memories (id, type, content, context, timestamp, metadata, embedding_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [params.id, params.type, params.content, params.context ?? null, params.timestamp, params.metadata ?? null, params.embedding_id ?? null]
      );
      return { success: true, data: { changes: result.changes, lastInsertRowid: result.lastInsertRowid } };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('db:memories:delete', async (_event: IpcMainInvokeEvent, id: string) => {
    try {
      ensureDb();
      const result = sqliteManager.run('DELETE FROM memories WHERE id = ?', [id]);
      return { success: true, data: { changes: result.changes } };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // ---------------------------------------------------------------------------
  // Conversations
  // ---------------------------------------------------------------------------

  ipcMain.handle('db:conversations:list', async (_event: IpcMainInvokeEvent, params?: { limit?: number }) => {
    try {
      ensureDb();
      const rows = (params?.limit && params.limit > 0)
        ? sqliteManager.query('SELECT * FROM conversations ORDER BY updated_at DESC LIMIT ?', [params.limit])
        : sqliteManager.query('SELECT * FROM conversations ORDER BY updated_at DESC');
      return { success: true, data: rows };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('db:conversations:create', async (_event: IpcMainInvokeEvent, params: { id: string; title: string }) => {
    try {
      ensureDb();
      const result = sqliteManager.run('INSERT INTO conversations (id, title) VALUES (?, ?)', [params.id, params.title]);
      return { success: true, data: { changes: result.changes, lastInsertRowid: result.lastInsertRowid } };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('db:conversations:delete', async (_event: IpcMainInvokeEvent, id: string) => {
    try {
      ensureDb();
      // Delete conversation (messages will be auto-deleted via ON DELETE CASCADE)
      const result = sqliteManager.run('DELETE FROM conversations WHERE id = ?', [id]);
      return { success: true, data: { changes: result.changes } };
    } catch (error: any) {
      logger.error('db:conversations:delete failed', { id, error: error.message });
      return { success: false, error: error.message };
    }
  });

  // ---------------------------------------------------------------------------
  // Messages
  // ---------------------------------------------------------------------------

  ipcMain.handle('db:messages:list', async (_event: IpcMainInvokeEvent, conversationId: string) => {
    try {
      ensureDb();
      const rows = sqliteManager.query('SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC', [conversationId]);
      return { success: true, data: rows };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('db:messages:create', async (_event: IpcMainInvokeEvent, params: {
    id: string; conversation_id: string; role: string; content: string; timestamp: number; metadata?: string;
  }) => {
    try {
      ensureDb();
      const result = sqliteManager.run(
        'INSERT INTO messages (id, conversation_id, role, content, timestamp, metadata) VALUES (?, ?, ?, ?, ?, ?)',
        [params.id, params.conversation_id, params.role, params.content, params.timestamp, params.metadata ?? null]
      );
      return { success: true, data: { changes: result.changes, lastInsertRowid: result.lastInsertRowid } };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // ---------------------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------------------

  ipcMain.handle('db:settings:get', async (_event: IpcMainInvokeEvent, key: string) => {
    try {
      ensureDb();
      const row = sqliteManager.queryOne('SELECT key, value FROM settings WHERE key = ?', [key]);
      return { success: true, data: row };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('db:settings:set', async (_event: IpcMainInvokeEvent, params: { key: string; value: string }) => {
    try {
      ensureDb();
      const result = sqliteManager.run(
        "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, strftime('%s', 'now') * 1000)",
        [params.key, params.value]
      );
      return { success: true, data: { changes: result.changes } };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  logger.info('Database IPC handlers registered');
}
