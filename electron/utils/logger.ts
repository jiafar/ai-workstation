import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

class Logger {
  private logDir: string | null = null
  private logFile: string | null = null
  private isDev: boolean
  private initialized: boolean = false
  private consoleFailed: boolean = false

  constructor() {
    this.isDev = process.env.NODE_ENV === 'development'
  }

  private init(): void {
    if (this.initialized) return
    try {
      // 检查 app 是否已 ready
      if (!app.isReady()) {
        return // 稍后再试
      }
      this.logDir = join(app.getPath('userData'), 'logs')
      this.logFile = join(this.logDir, `app-${new Date().toISOString().split('T')[0]}.log`)
      this.ensureLogDir()
      this.initialized = true
    } catch {
      // 静默失败
      this.consoleFailed = true
    }
  }

  private ensureLogDir(): void {
    if (!this.logDir) return
    if (!existsSync(this.logDir)) {
      mkdirSync(this.logDir, { recursive: true })
    }
  }

  private formatMessage(level: LogLevel, message: string, ...args: any[]): string {
    const timestamp = new Date().toISOString()
    const argString = args.length > 0 ? ' ' + args.map(a => 
      typeof a === 'object' ? JSON.stringify(a) : String(a)
    ).join(' ') : ''
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${argString}`
  }

  private writeToFile(formattedMessage: string): void {
    if (!this.initialized) {
      this.init()
    }
    if (!this.logFile) return
    try {
      const fs = require('fs')
      fs.appendFileSync(this.logFile, formattedMessage + '\n')
    } catch {
      // 忽略文件写入错误
    }
  }

  private safeConsoleLog(method: (...args: any[]) => void, ...args: any[]): void {
    if (this.consoleFailed) return
    try {
      method(...args)
    } catch {
      this.consoleFailed = true
    }
  }

  private log(level: LogLevel, message: string, ...args: any[]): void {
    const formatted = this.formatMessage(level, message, ...args)
    
    // 写入文件（如果已初始化）
    this.writeToFile(formatted)
    
    // 开发环境输出到控制台（带错误捕获）
    if (this.isDev) {
      const consoleMethod = level === 'error' ? console.error : 
                           level === 'warn' ? console.warn : 
                           level === 'debug' ? console.debug : console.log
      this.safeConsoleLog(consoleMethod, formatted)
    }
  }

  debug(message: string, ...args: any[]): void {
    this.log('debug', message, ...args)
  }

  info(message: string, ...args: any[]): void {
    this.log('info', message, ...args)
  }

  warn(message: string, ...args: any[]): void {
    this.log('warn', message, ...args)
  }

  error(message: string, ...args: any[]): void {
    this.log('error', message, ...args)
  }
}

// 导出单例
export const logger = new Logger()
export default logger

// 全局错误处理，防止 EPIPE 崩溃
process.on('uncaughtException', (error) => {
  if ((error as any).code === 'EPIPE') {
    logger.error('EPIPE error caught:', error.message)
    // 不退出进程
    return
  }
  // 其他错误正常处理
  logger.error('Uncaught exception:', error)
  process.exit(1)
})

process.stdout?.on?.('error', (error: any) => {
  if (error.code === 'EPIPE') {
    logger.warn('stdout EPIPE error ignored')
  }
})

process.stderr?.on?.('error', (error: any) => {
  if (error.code === 'EPIPE') {
    logger.warn('stderr EPIPE error ignored')
  }
})
