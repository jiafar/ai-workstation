import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LoggerOptions {
  level?: LogLevel;
  enableFileLogging?: boolean;
  logDirectory?: string;
}

class Logger {
  private level: LogLevel;
  private enableFileLogging: boolean;
  private logDirectory: string;
  private logStream: fs.WriteStream | null = null;

  constructor(options: LoggerOptions = {}) {
    this.level = options.level ?? LogLevel.INFO;
    this.enableFileLogging = options.enableFileLogging ?? true;
    this.logDirectory = options.logDirectory ?? path.join(app.getPath('userData'), 'logs');

    if (this.enableFileLogging) {
      this.initializeLogFile();
    }
  }

  private initializeLogFile(): void {
    try {
      if (!fs.existsSync(this.logDirectory)) {
        fs.mkdirSync(this.logDirectory, { recursive: true });
      }

      const logFileName = `app-${new Date().toISOString().split('T')[0]}.log`;
      const logFilePath = path.join(this.logDirectory, logFileName);

      this.logStream = fs.createWriteStream(logFilePath, { flags: 'a' });
    } catch (error) {
      console.error('Failed to initialize log file:', error);
    }
  }

  private formatMessage(level: string, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const dataStr = data ? ` ${JSON.stringify(data)}` : '';
    return `[${timestamp}] [${level}] ${message}${dataStr}`;
  }

  private writeToFile(formattedMessage: string): void {
    if (this.logStream && this.enableFileLogging) {
      this.logStream.write(formattedMessage + '\n');
    }
  }

  private log(level: LogLevel, levelName: string, message: string, data?: any): void {
    if (level < this.level) {
      return;
    }

    const formattedMessage = this.formatMessage(levelName, message, data);

    // Write to console
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(formattedMessage);
        break;
      case LogLevel.INFO:
        console.info(formattedMessage);
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage);
        break;
      case LogLevel.ERROR:
        console.error(formattedMessage);
        break;
    }

    // Write to file
    this.writeToFile(formattedMessage);
  }

  debug(message: string, data?: any): void {
    this.log(LogLevel.DEBUG, 'DEBUG', message, data);
  }

  info(message: string, data?: any): void {
    this.log(LogLevel.INFO, 'INFO', message, data);
  }

  warn(message: string, data?: any): void {
    this.log(LogLevel.WARN, 'WARN', message, data);
  }

  error(message: string, data?: any): void {
    this.log(LogLevel.ERROR, 'ERROR', message, data);
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  close(): void {
    if (this.logStream) {
      this.logStream.end();
      this.logStream = null;
    }
  }
}

// Singleton instance
export const logger = new Logger({
  level: LogLevel.DEBUG,
  enableFileLogging: true,
});

export default logger;
