import { RitualConfig } from '../../../src/types';
import { logger } from '../../utils/logger';
import { EventEmitter } from 'events';

export interface TimeSchedule {
  ritualId: string;
  time: string; // Format: "HH:MM" (24-hour)
}

export interface EventSchedule {
  ritualId: string;
  event: string; // e.g., "app:startup", "app:idle:30m", "git:commit"
}

export class RitualScheduler extends EventEmitter {
  private static instance: RitualScheduler | null = null;
  private timeSchedules: Map<string, TimeSchedule[]> = new Map();
  private eventSchedules: Map<string, EventSchedule[]> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;
  private lastCheckedMinute = -1;
  private running = false;
  private rituals: Map<string, RitualConfig> = new Map();

  private constructor() {
    super();
  }

  static getInstance(): RitualScheduler {
    if (!RitualScheduler.instance) {
      RitualScheduler.instance = new RitualScheduler();
    }
    return RitualScheduler.instance;
  }

  /**
   * Initialize scheduler with ritual configurations
   */
  init(configs: RitualConfig[]): void {
    logger.info(`Initializing RitualScheduler with ${configs.length} rituals`);

    // Clear existing schedules
    this.timeSchedules.clear();
    this.eventSchedules.clear();
    this.rituals.clear();

    // Register rituals
    for (const config of configs) {
      this.rituals.set(config.id, config);

      if (!config.enabled) {
        logger.debug(`Skipping disabled ritual: ${config.name}`);
        continue;
      }

      if (config.schedule) {
        this.scheduleTime(config.id, config.schedule);
      }

      if (config.event) {
        this.scheduleEvent(config.id, config.event);
      }
    }

    logger.info('RitualScheduler initialized');
  }

  /**
   * Schedule a ritual to run at a specific time
   */
  scheduleTime(ritualId: string, time: string): void {
    // Validate time format (HH:MM)
    if (!/^\d{2}:\d{2}$/.test(time)) {
      throw new Error(`Invalid time format: ${time}. Expected HH:MM (24-hour)`);
    }

    const [hours, minutes] = time.split(':').map(Number);

    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      throw new Error(`Invalid time: ${time}`);
    }

    // Store schedule
    const timeKey = time;
    if (!this.timeSchedules.has(timeKey)) {
      this.timeSchedules.set(timeKey, []);
    }

    this.timeSchedules.get(timeKey)!.push({ ritualId, time });

    logger.info(`Scheduled ritual ${ritualId} for time: ${time}`);
  }

  /**
   * Schedule a ritual to run on an event
   */
  scheduleEvent(ritualId: string, event: string): void {
    if (!this.eventSchedules.has(event)) {
      this.eventSchedules.set(event, []);
    }

    this.eventSchedules.get(event)!.push({ ritualId, event });

    logger.info(`Scheduled ritual ${ritualId} for event: ${event}`);
  }

  /**
   * Start the scheduler
   */
  start(): void {
    if (this.running) {
      logger.warn('RitualScheduler already running');
      return;
    }

    logger.info('Starting RitualScheduler');

    this.running = true;

    // Check every minute for time-based schedules
    this.checkInterval = setInterval(() => {
      this.checkTimeSchedules();
    }, 60 * 1000); // Check every minute

    // Trigger initial check
    this.checkTimeSchedules();

    // Emit app startup event
    this.onEvent('app:startup');
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (!this.running) {
      return;
    }

    logger.info('Stopping RitualScheduler');

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    this.running = false;
  }

  /**
   * Check for time-based schedules
   */
  private checkTimeSchedules(): void {
    const now = new Date();
    const currentMinute = now.getHours() * 60 + now.getMinutes();

    // Only trigger once per minute
    if (currentMinute === this.lastCheckedMinute) {
      return;
    }

    this.lastCheckedMinute = currentMinute;

    const timeKey = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const schedules = this.timeSchedules.get(timeKey);
    if (schedules && schedules.length > 0) {
      logger.info(`Time-based trigger: ${timeKey}`);

      for (const schedule of schedules) {
        const ritual = this.rituals.get(schedule.ritualId);
        if (ritual && ritual.enabled) {
          logger.info(`Triggering ritual: ${ritual.name} (${ritual.id})`);
          this.emit('ritual-trigger', {
            ritualId: ritual.id,
            trigger: 'time',
            time: timeKey,
          });
        }
      }
    }
  }

  /**
   * Trigger event-based rituals
   */
  onEvent(event: string, data?: any): void {
    logger.debug(`Event received: ${event}`, data);

    const schedules = this.eventSchedules.get(event);
    if (schedules && schedules.length > 0) {
      logger.info(`Event-based trigger: ${event}`);

      for (const schedule of schedules) {
        const ritual = this.rituals.get(schedule.ritualId);
        if (ritual && ritual.enabled) {
          logger.info(`Triggering ritual: ${ritual.name} (${ritual.id})`);
          this.emit('ritual-trigger', {
            ritualId: ritual.id,
            trigger: 'event',
            event,
            data,
          });
        }
      }
    }
  }

  /**
   * Get all schedules
   */
  getSchedule(): {
    timeSchedules: Array<{ time: string; rituals: string[] }>;
    eventSchedules: Array<{ event: string; rituals: string[] }>;
  } {
    const timeSchedules = Array.from(this.timeSchedules.entries()).map(([time, schedules]) => ({
      time,
      rituals: schedules.map(s => s.ritualId),
    }));

    const eventSchedules = Array.from(this.eventSchedules.entries()).map(([event, schedules]) => ({
      event,
      rituals: schedules.map(s => s.ritualId),
    }));

    return {
      timeSchedules,
      eventSchedules,
    };
  }

  /**
   * Update a ritual configuration
   */
  updateRitual(config: RitualConfig): void {
    const existing = this.rituals.get(config.id);

    // Remove old schedules
    if (existing) {
      if (existing.schedule) {
        const schedules = this.timeSchedules.get(existing.schedule);
        if (schedules) {
          const filtered = schedules.filter(s => s.ritualId !== config.id);
          if (filtered.length === 0) {
            this.timeSchedules.delete(existing.schedule);
          } else {
            this.timeSchedules.set(existing.schedule, filtered);
          }
        }
      }

      if (existing.event) {
        const schedules = this.eventSchedules.get(existing.event);
        if (schedules) {
          const filtered = schedules.filter(s => s.ritualId !== config.id);
          if (filtered.length === 0) {
            this.eventSchedules.delete(existing.event);
          } else {
            this.eventSchedules.set(existing.event, filtered);
          }
        }
      }
    }

    // Add new schedules
    this.rituals.set(config.id, config);

    if (config.enabled) {
      if (config.schedule) {
        this.scheduleTime(config.id, config.schedule);
      }

      if (config.event) {
        this.scheduleEvent(config.id, config.event);
      }
    }

    logger.info(`Updated ritual: ${config.name}`);
  }

  /**
   * Remove a ritual
   */
  removeRitual(ritualId: string): void {
    const ritual = this.rituals.get(ritualId);

    if (!ritual) {
      logger.warn(`Ritual not found: ${ritualId}`);
      return;
    }

    // Remove schedules
    if (ritual.schedule) {
      const schedules = this.timeSchedules.get(ritual.schedule);
      if (schedules) {
        const filtered = schedules.filter(s => s.ritualId !== ritualId);
        if (filtered.length === 0) {
          this.timeSchedules.delete(ritual.schedule);
        } else {
          this.timeSchedules.set(ritual.schedule, filtered);
        }
      }
    }

    if (ritual.event) {
      const schedules = this.eventSchedules.get(ritual.event);
      if (schedules) {
        const filtered = schedules.filter(s => s.ritualId !== ritualId);
        if (filtered.length === 0) {
          this.eventSchedules.delete(ritual.event);
        } else {
          this.eventSchedules.set(ritual.event, filtered);
        }
      }
    }

    this.rituals.delete(ritualId);

    logger.info(`Removed ritual: ${ritual.name}`);
  }

  /**
   * Check if scheduler is running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Get ritual by ID
   */
  getRitual(ritualId: string): RitualConfig | undefined {
    return this.rituals.get(ritualId);
  }

  /**
   * Get all rituals
   */
  getAllRituals(): RitualConfig[] {
    return Array.from(this.rituals.values());
  }
}

export default RitualScheduler;
