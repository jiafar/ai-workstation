import { RitualConfig } from '../../../src/types';
import { logger } from '../../utils/logger';
import { WorkflowEngine } from '../workflow/WorkflowEngine';
import { SQLiteManager } from '../database/SQLiteManager';

export interface RitualRunRecord {
  id: string;
  ritualId: string;
  ritualName: string;
  workflowName: string;
  trigger: string;
  startedAt: number;
  completedAt?: number;
  status: 'running' | 'completed' | 'failed';
  error?: string;
  duration?: number;
  workflowRunId?: string;
}

export class RitualRunner {
  private static instance: RitualRunner | null = null;
  private workflowEngine: WorkflowEngine;
  private db: SQLiteManager;
  private runningRituals: Map<string, RitualRunRecord> = new Map();

  private constructor() {
    this.workflowEngine = WorkflowEngine.getInstance();
    this.db = SQLiteManager.getInstance();
  }

  static getInstance(): RitualRunner {
    if (!RitualRunner.instance) {
      RitualRunner.instance = new RitualRunner();
    }
    return RitualRunner.instance;
  }

  /**
   * Initialize ritual runner
   */
  async init(): Promise<void> {
    // Ensure workflow engine is initialized
    await this.workflowEngine.init();

    // Create ritual runs table if not exists
    await this.createRitualRunsTable();

    logger.info('RitualRunner initialized');
  }

  /**
   * Run a ritual
   */
  async run(ritualId: string, ritual: RitualConfig, trigger: string, triggerData?: any): Promise<string> {
    logger.info(`Running ritual: ${ritual.name} (${ritualId})`, { trigger, triggerData });

    // Create run record
    const runId = `ritual-run-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const runRecord: RitualRunRecord = {
      id: runId,
      ritualId,
      ritualName: ritual.name,
      workflowName: ritual.workflowName,
      trigger,
      startedAt: Date.now(),
      status: 'running',
    };

    this.runningRituals.set(runId, runRecord);

    // Save to database
    await this.saveRunRecord(runRecord);

    try {
      // Run the workflow
      const workflowResult = await this.workflowEngine.run(ritual.workflowName, triggerData || {});

      // Update run record
      runRecord.status = workflowResult.status === 'completed' ? 'completed' : 'failed';
      runRecord.completedAt = Date.now();
      runRecord.duration = runRecord.completedAt - runRecord.startedAt;
      runRecord.workflowRunId = workflowResult.runId;

      if (workflowResult.error) {
        runRecord.error = workflowResult.error;
      }

      // Update database
      await this.updateRunRecord(runRecord);

      // Update ritual last run time
      ritual.lastRun = runRecord.startedAt;

      logger.info(`Ritual completed: ${ritual.name}`, {
        status: runRecord.status,
        duration: runRecord.duration,
      });

      return runId;
    } catch (error: any) {
      // Update run record
      runRecord.status = 'failed';
      runRecord.completedAt = Date.now();
      runRecord.duration = runRecord.completedAt - runRecord.startedAt;
      runRecord.error = error.message || String(error);

      // Update database
      await this.updateRunRecord(runRecord);

      logger.error(`Ritual failed: ${ritual.name}`, error);

      throw error;
    } finally {
      this.runningRituals.delete(runId);
    }
  }

  /**
   * Get status of a ritual run
   */
  async getStatus(runId: string): Promise<RitualRunRecord | null> {
    // Check running rituals first
    const running = this.runningRituals.get(runId);
    if (running) {
      return running;
    }

    // Query from database
    return await this.getRunRecordFromDb(runId);
  }

  /**
   * Get history of ritual executions
   */
  async getHistory(ritualId?: string, limit: number = 50): Promise<RitualRunRecord[]> {
    const query = ritualId
      ? 'SELECT * FROM ritual_runs WHERE ritualId = ? ORDER BY startedAt DESC LIMIT ?'
      : 'SELECT * FROM ritual_runs ORDER BY startedAt DESC LIMIT ?';

    const params = ritualId ? [ritualId, limit] : [limit];

    try {
      const rows = this.db.query(query, params);
      return rows.map((row: any) => this.parseRunRecord(row));
    } catch (error) {
      logger.error('Failed to get ritual history', error);
      return [];
    }
  }

  /**
   * Get ritual statistics
   */
  async getStats(ritualId: string): Promise<{
    totalRuns: number;
    successRate: number;
    averageDuration: number;
    lastRun?: number;
  }> {
    try {
      const history = await this.getHistory(ritualId, 100);

      if (history.length === 0) {
        return {
          totalRuns: 0,
          successRate: 0,
          averageDuration: 0,
        };
      }

      const totalRuns = history.length;
      const successfulRuns = history.filter(r => r.status === 'completed').length;
      const successRate = successfulRuns / totalRuns;

      const durations = history.filter(r => r.duration).map(r => r.duration!);
      const averageDuration = durations.length > 0
        ? durations.reduce((sum, d) => sum + d, 0) / durations.length
        : 0;

      const lastRun = history[0]?.startedAt;

      return {
        totalRuns,
        successRate,
        averageDuration,
        lastRun,
      };
    } catch (error) {
      logger.error('Failed to get ritual stats', error);
      return {
        totalRuns: 0,
        successRate: 0,
        averageDuration: 0,
      };
    }
  }

  /**
   * Create ritual_runs table
   */
  private async createRitualRunsTable(): Promise<void> {
    const sql = `
      CREATE TABLE IF NOT EXISTS ritual_runs (
        id TEXT PRIMARY KEY,
        ritualId TEXT NOT NULL,
        ritualName TEXT NOT NULL,
        workflowName TEXT NOT NULL,
        trigger TEXT NOT NULL,
        startedAt INTEGER NOT NULL,
        completedAt INTEGER,
        status TEXT NOT NULL,
        error TEXT,
        duration INTEGER,
        workflowRunId TEXT
      )
    `;

    await this.db.run(sql);

    // Create index on ritualId for faster queries
    await this.db.run('CREATE INDEX IF NOT EXISTS idx_ritual_runs_ritualId ON ritual_runs(ritualId)');
    await this.db.run('CREATE INDEX IF NOT EXISTS idx_ritual_runs_startedAt ON ritual_runs(startedAt)');
  }

  /**
   * Save run record to database
   */
  private async saveRunRecord(record: RitualRunRecord): Promise<void> {
    const sql = `
      INSERT INTO ritual_runs (
        id, ritualId, ritualName, workflowName, trigger,
        startedAt, completedAt, status, error, duration, workflowRunId
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      record.id,
      record.ritualId,
      record.ritualName,
      record.workflowName,
      record.trigger,
      record.startedAt,
      record.completedAt || null,
      record.status,
      record.error || null,
      record.duration || null,
      record.workflowRunId || null,
    ];

    await this.db.run(sql, params);
  }

  /**
   * Update run record in database
   */
  private async updateRunRecord(record: RitualRunRecord): Promise<void> {
    const sql = `
      UPDATE ritual_runs
      SET completedAt = ?, status = ?, error = ?, duration = ?, workflowRunId = ?
      WHERE id = ?
    `;

    const params = [
      record.completedAt || null,
      record.status,
      record.error || null,
      record.duration || null,
      record.workflowRunId || null,
      record.id,
    ];

    await this.db.run(sql, params);
  }

  /**
   * Get run record from database
   */
  private async getRunRecordFromDb(runId: string): Promise<RitualRunRecord | null> {
    const sql = 'SELECT * FROM ritual_runs WHERE id = ?';

    try {
      const row = this.db.queryOne(sql, [runId]);
      return row ? this.parseRunRecord(row) : null;
    } catch (error) {
      logger.error('Failed to get run record', error);
      return null;
    }
  }

  /**
   * Parse database row to RitualRunRecord
   */
  private parseRunRecord(row: any): RitualRunRecord {
    return {
      id: row.id,
      ritualId: row.ritualId,
      ritualName: row.ritualName,
      workflowName: row.workflowName,
      trigger: row.trigger,
      startedAt: row.startedAt,
      completedAt: row.completedAt || undefined,
      status: row.status,
      error: row.error || undefined,
      duration: row.duration || undefined,
      workflowRunId: row.workflowRunId || undefined,
    };
  }
}

export default RitualRunner;
