import { ipcMain } from 'electron';
import { sqliteManager } from '../database/SQLiteManager';
import { logger } from '../../utils/logger';

export interface Ritual {
  id: string;
  name: string;
  description?: string;
  schedule?: string; // Cron expression or interval
  actions: RitualAction[];
  enabled: boolean;
  lastRun?: number;
  createdAt: number;
  updatedAt: number;
}

export interface RitualAction {
  type: 'skill' | 'workflow' | 'command' | 'notification';
  target: string;
  params?: Record<string, any>;
}

class RitualManager {
  private static instance: RitualManager;
  private initialized = false;

  static getInstance(): RitualManager {
    if (!RitualManager.instance) {
      RitualManager.instance = new RitualManager();
    }
    return RitualManager.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    if (!sqliteManager.isInitialized()) {
      sqliteManager.init();
    }
    
    this.initialized = true;
    logger.info('RitualManager initialized');
  }

  async listRituals(): Promise<Ritual[]> {
    await this.initialize();
    
    const rows = sqliteManager.query(
      'SELECT * FROM rituals ORDER BY created_at DESC'
    );
    
    return rows.map((row: any) => this.parseRitual(row));
  }

  async getRitual(id: string): Promise<Ritual | null> {
    await this.initialize();
    
    const row = sqliteManager.queryOne(
      'SELECT * FROM rituals WHERE id = ?',
      [id]
    );
    
    return row ? this.parseRitual(row) : null;
  }

  async createRitual(ritual: Omit<Ritual, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    await this.initialize();
    
    const id = crypto.randomUUID();
    const now = Date.now();
    
    sqliteManager.run(
      `INSERT INTO rituals (id, name, description, schedule, actions, enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        ritual.name,
        ritual.description || null,
        ritual.schedule || null,
        JSON.stringify(ritual.actions),
        ritual.enabled ? 1 : 0,
        now,
        now
      ]
    );
    
    logger.info('Ritual created', { id, name: ritual.name });
    return id;
  }

  async updateRitual(id: string, updates: Partial<Omit<Ritual, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
    await this.initialize();
    
    const sets: string[] = [];
    const values: any[] = [];
    
    if (updates.name !== undefined) {
      sets.push('name = ?');
      values.push(updates.name);
    }
    if (updates.description !== undefined) {
      sets.push('description = ?');
      values.push(updates.description);
    }
    if (updates.schedule !== undefined) {
      sets.push('schedule = ?');
      values.push(updates.schedule);
    }
    if (updates.actions !== undefined) {
      sets.push('actions = ?');
      values.push(JSON.stringify(updates.actions));
    }
    if (updates.enabled !== undefined) {
      sets.push('enabled = ?');
      values.push(updates.enabled ? 1 : 0);
    }
    if (updates.lastRun !== undefined) {
      sets.push('last_run = ?');
      values.push(updates.lastRun);
    }
    
    sets.push('updated_at = ?');
    values.push(Date.now());
    values.push(id);
    
    sqliteManager.run(
      `UPDATE rituals SET ${sets.join(', ')} WHERE id = ?`,
      values
    );
    
    logger.info('Ritual updated', { id });
  }

  async deleteRitual(id: string): Promise<void> {
    await this.initialize();
    
    sqliteManager.run('DELETE FROM rituals WHERE id = ?', [id]);
    logger.info('Ritual deleted', { id });
  }

  async configureRitual(id: string, config: Partial<Ritual>): Promise<void> {
    await this.updateRitual(id, config);
  }

  async enableRitual(id: string, enabled: boolean): Promise<void> {
    await this.updateRitual(id, { enabled });
  }

  async triggerRitual(id: string): Promise<void> {
    await this.initialize();
    
    const ritual = await this.getRitual(id);
    if (!ritual) {
      throw new Error(`Ritual not found: ${id}`);
    }
    
    if (!ritual.enabled) {
      logger.warn('Attempted to trigger disabled ritual', { id });
      return;
    }
    
    logger.info('Triggering ritual', { id, name: ritual.name, actions: ritual.actions.length });
    
    // Execute actions
    for (const action of ritual.actions) {
      try {
        await this.executeAction(action);
      } catch (error) {
        logger.error('Ritual action failed', { ritualId: id, action, error });
      }
    }
    
    // Update last run time
    await this.updateRitual(id, { lastRun: Date.now() });
  }

  private async executeAction(action: RitualAction): Promise<void> {
    switch (action.type) {
      case 'skill':
        // Will be implemented when skill system is ready
        logger.info('Executing skill action', { target: action.target });
        break;
        
      case 'workflow':
        // Will be implemented when workflow system is ready
        logger.info('Executing workflow action', { target: action.target });
        break;
        
      case 'command':
        // Execute shell command
        const { exec } = require('child_process');
        exec(action.target, (error: any, stdout: string, stderr: string) => {
          if (error) {
            logger.error('Command execution failed', { command: action.target, error });
          } else {
            logger.info('Command executed', { command: action.target, stdout });
          }
        });
        break;
        
      case 'notification':
        // Show system notification
        // This would require electron Notification API
        logger.info('Notification action', { message: action.target });
        break;
        
      default:
        logger.warn('Unknown action type', { action });
    }
  }

  private parseRitual(row: any): Ritual {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      schedule: row.schedule,
      actions: JSON.parse(row.actions || '[]'),
      enabled: row.enabled === 1,
      lastRun: row.last_run,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const ritualManager = RitualManager.getInstance();

// IPC Handlers
export function registerRitualHandlers() {
  ipcMain.handle('ritual:list', async () => {
    try {
      const rituals = await ritualManager.listRituals();
      return { success: true, data: rituals };
    } catch (error: any) {
      logger.error('ritual:list failed', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('ritual:configure', async (_, id: string, config: any) => {
    try {
      await ritualManager.configureRitual(id, config);
      return { success: true };
    } catch (error: any) {
      logger.error('ritual:configure failed', { id, error });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('ritual:enable', async (_, id: string, enabled: boolean) => {
    try {
      await ritualManager.enableRitual(id, enabled);
      return { success: true };
    } catch (error: any) {
      logger.error('ritual:enable failed', { id, enabled, error });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('ritual:trigger', async (_, id: string) => {
    try {
      await ritualManager.triggerRitual(id);
      return { success: true };
    } catch (error: any) {
      logger.error('ritual:trigger failed', { id, error });
      return { success: false, error: error.message };
    }
  });

  logger.info('Ritual IPC handlers registered');
}
