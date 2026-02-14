import Database from 'better-sqlite3';
import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { logger } from '../../utils/logger';

export interface QueryResult {
  rows: any[];
  changes?: number;
  lastInsertRowid?: number;
}

class SQLiteManager {
  private static instance: SQLiteManager;
  private db: Database.Database | null = null;
  private dbPath: string;

  private constructor() {
    this.dbPath = path.join(app.getPath('userData'), 'ai-workstation.db');
    logger.info('SQLiteManager initialized', { dbPath: this.dbPath });
  }

  static getInstance(): SQLiteManager {
    if (!SQLiteManager.instance) {
      SQLiteManager.instance = new SQLiteManager();
    }
    return SQLiteManager.instance;
  }

  /**
   * Initialize the database and create tables
   */
  init(): void {
    try {
      // Ensure database directory exists
      const dbDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      // Open database connection
      this.db = new Database(this.dbPath, {
        verbose: (message) => logger.debug('SQLite:', message),
      });

      // Enable WAL mode for better concurrency
      this.db.pragma('journal_mode = WAL');

      // Create tables
      this.createTables();

      logger.info('SQLite database initialized successfully', { path: this.dbPath });
    } catch (error) {
      logger.error('Failed to initialize SQLite database', error);
      throw error;
    }
  }

  private createTables(): void {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    // Memories table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        context TEXT,
        timestamp INTEGER NOT NULL,
        metadata TEXT,
        embedding_id TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      )
    `);

    // Conversations table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        title TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      )
    `);

    // Messages table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        metadata TEXT,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      )
    `);

    // Skills table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS skills (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        category TEXT,
        code TEXT NOT NULL,
        enabled INTEGER DEFAULT 1,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      )
    `);

    // Rituals table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS rituals (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        schedule TEXT,
        actions TEXT NOT NULL,
        enabled INTEGER DEFAULT 1,
        last_run INTEGER,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      )
    `);

    // Workflows table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS workflows (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        steps TEXT NOT NULL,
        enabled INTEGER DEFAULT 1,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      )
    `);

    // Settings table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      )
    `);

    // Create indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type);
      CREATE INDEX IF NOT EXISTS idx_memories_timestamp ON memories(timestamp);
      CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
      CREATE INDEX IF NOT EXISTS idx_skills_name ON skills(name);
      CREATE INDEX IF NOT EXISTS idx_rituals_enabled ON rituals(enabled);
    `);

    logger.info('Database tables created successfully');
  }

  /**
   * Execute a SELECT query
   */
  query(sql: string, params: any[] = []): any[] {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const stmt = this.db.prepare(sql);
      const rows = stmt.all(...params);
      logger.debug('Query executed', { sql: sql.substring(0, 100), rowCount: rows.length });
      return rows;
    } catch (error) {
      logger.error('Query failed', { sql, error });
      throw error;
    }
  }

  /**
   * Execute a single SELECT query and return one row
   */
  queryOne(sql: string, params: any[] = []): any | null {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const stmt = this.db.prepare(sql);
      const row = stmt.get(...params);
      logger.debug('Query one executed', { sql: sql.substring(0, 100) });
      return row || null;
    } catch (error) {
      logger.error('Query one failed', { sql, error });
      throw error;
    }
  }

  /**
   * Execute an INSERT, UPDATE, or DELETE statement
   */
  run(sql: string, params: any[] = []): { changes: number; lastInsertRowid: number } {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const stmt = this.db.prepare(sql);
      const result = stmt.run(...params);
      logger.debug('Statement executed', {
        sql: sql.substring(0, 100),
        changes: result.changes,
      });
      return {
        changes: result.changes,
        lastInsertRowid: Number(result.lastInsertRowid),
      };
    } catch (error) {
      logger.error('Statement execution failed', { sql, error });
      throw error;
    }
  }

  /**
   * Execute multiple statements in a transaction
   */
  transaction(callback: (db: SQLiteManager) => void): void {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const txn = this.db.transaction(callback);
    try {
      txn(this);
      logger.debug('Transaction completed successfully');
    } catch (error) {
      logger.error('Transaction failed', error);
      throw error;
    }
  }

  /**
   * Get database statistics
   */
  getStats(): Record<string, number> {
    const tables = [
      'memories',
      'conversations',
      'messages',
      'skills',
      'rituals',
      'workflows',
      'settings',
    ];

    const stats: Record<string, number> = {};

    for (const table of tables) {
      const result = this.queryOne(`SELECT COUNT(*) as count FROM ${table}`);
      stats[table] = result?.count || 0;
    }

    return stats;
  }

  /**
   * Vacuum the database to reclaim space
   */
  vacuum(): void {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      this.db.exec('VACUUM');
      logger.info('Database vacuumed successfully');
    } catch (error) {
      logger.error('Failed to vacuum database', error);
      throw error;
    }
  }

  /**
   * Backup the database
   */
  backup(backupPath: string): void {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const backupDb = new Database(backupPath);
      this.db.backup(backupDb);
      backupDb.close();
      logger.info('Database backed up successfully', { backupPath });
    } catch (error) {
      logger.error('Failed to backup database', error);
      throw error;
    }
  }

  /**
   * Get the database path
   */
  getDbPath(): string {
    return this.dbPath;
  }

  /**
   * Check if database is initialized
   */
  isInitialized(): boolean {
    return this.db !== null;
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      try {
        this.db.close();
        this.db = null;
        logger.info('Database connection closed');
      } catch (error) {
        logger.error('Failed to close database', error);
        throw error;
      }
    }
  }
}

// Singleton export
export const sqliteManager = SQLiteManager.getInstance();

export { SQLiteManager };
export default sqliteManager;
