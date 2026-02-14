import { contextBridge, ipcRenderer } from 'electron'
import type { FileEntry } from './ipc/filesystem'

export interface ElectronAPI {
  // Filesystem
  fs: {
    readFile: (path: string) => Promise<string>
    writeFile: (path: string, content: string) => Promise<void>
    readDir: (path: string) => Promise<FileEntry[]>
    stat: (path: string) => Promise<{ isDirectory: boolean; size: number; mtime: number }>
    exists: (path: string) => Promise<boolean>
    mkdir: (path: string) => Promise<void>
    remove: (path: string) => Promise<void>
    rename: (oldPath: string, newPath: string) => Promise<void>
    watchDir: (path: string) => Promise<void>
    unwatchDir: (path: string) => Promise<void>
    selectDirectory: () => Promise<string | null>
  }
  // Terminal
  terminal: {
    create: (id: string, cwd?: string) => Promise<void>
    write: (id: string, data: string) => Promise<void>
    resize: (id: string, cols: number, rows: number) => Promise<void>
    kill: (id: string) => Promise<void>
    onData: (callback: (id: string, data: string) => void) => () => void
    onExit: (callback: (id: string, code: number) => void) => () => void
  }
  // AI
  ai: {
    chat: (messages: Array<{ role: string; content: string }>, options?: Record<string, unknown>) => Promise<string>
    chatStream: (messages: Array<{ role: string; content: string }>, options?: Record<string, unknown>) => Promise<string>
    onStreamChunk: (callback: (chunk: string) => void) => () => void
    onStreamEnd: (callback: () => void) => () => void
    embed: (text: string) => Promise<number[]>
  }
  // Git
  git: {
    status: (repoPath: string) => Promise<unknown>
    diff: (repoPath: string) => Promise<string>
    log: (repoPath: string, maxCount?: number) => Promise<unknown[]>
    commit: (repoPath: string, message: string) => Promise<unknown>
    add: (repoPath: string, files: string[]) => Promise<void>
    branch: (repoPath: string) => Promise<unknown>
  }
  // Memory
  memory: {
    loadSession: (projectPath?: string) => Promise<unknown>
    saveObservation: (observation: { type: string; summary: string; facts: string[]; relatedFiles?: string[] }) => Promise<string>
    query: (query: string, layer?: number) => Promise<unknown[]>
    compress: () => Promise<void>
  }
  // Database
  db: {
    query: (sql: string, params?: unknown[]) => Promise<unknown[]>
    run: (sql: string, params?: unknown[]) => Promise<{ changes: number; lastInsertRowid: number }>
  }
  // Skill
  skill: {
    list: () => Promise<unknown[]>
    run: (name: string, inputs: Record<string, unknown>) => Promise<unknown>
    create: (definition: unknown) => Promise<void>
    getResult: (runId: string) => Promise<unknown>
    onProgress: (callback: (data: { skillName: string; progress: number; message: string }) => void) => () => void
  }
  // Workflow
  workflow: {
    list: () => Promise<unknown[]>
    run: (name: string, inputs?: Record<string, unknown>) => Promise<string>
    stop: (runId: string) => Promise<void>
    getState: (runId: string) => Promise<unknown>
    create: (definition: unknown) => Promise<void>
    onStepComplete: (callback: (data: unknown) => void) => () => void
    onDone: (callback: (data: unknown) => void) => () => void
  }
  // Ritual
  ritual: {
    list: () => Promise<unknown[]>
    configure: (id: string, config: unknown) => Promise<void>
    enable: (id: string, enabled: boolean) => Promise<void>
    trigger: (id: string) => Promise<void>
  }
  // App
  app: {
    getPath: (name: string) => Promise<string>
    getPlatform: () => Promise<string>
  }
  // Events
  on: (channel: string, callback: (...args: unknown[]) => void) => () => void
}

// Helper to unwrap { success, data, error } responses from IPC
async function unwrap<T>(promise: Promise<{ success: boolean; data?: T; error?: string }>): Promise<T> {
  const result = await promise
  if (result && typeof result === 'object' && 'success' in result) {
    if (!result.success) throw new Error(result.error || 'Unknown error')
    return result.data as T
  }
  return result as T
}

const api: ElectronAPI = {
  fs: {
    readFile: (path) => unwrap<string>(ipcRenderer.invoke('fs:read', path)),
    writeFile: (path, content) => unwrap<void>(ipcRenderer.invoke('fs:write', path, content)),
    readDir: (path) => unwrap<FileEntry[]>(ipcRenderer.invoke('fs:readdir', path)),
    stat: (path) => unwrap(ipcRenderer.invoke('fs:stat', path)),
    exists: (path) => unwrap<boolean>(ipcRenderer.invoke('fs:exists', path)),
    mkdir: (path) => unwrap<void>(ipcRenderer.invoke('fs:mkdir', path)),
    remove: (path) => unwrap<void>(ipcRenderer.invoke('fs:remove', path)),
    rename: (oldPath, newPath) => unwrap<void>(ipcRenderer.invoke('fs:rename', oldPath, newPath)),
    watchDir: (path) => unwrap<void>(ipcRenderer.invoke('fs:watch', path)),
    unwatchDir: (path) => unwrap<void>(ipcRenderer.invoke('fs:unwatch', path)),
    selectDirectory: () => unwrap<string | null>(ipcRenderer.invoke('fs:select-directory')),
  },
  terminal: {
    create: (id, cwd) => ipcRenderer.invoke('terminal:create', id, cwd),
    write: (id, data) => ipcRenderer.invoke('terminal:write', id, data),
    resize: (id, cols, rows) => ipcRenderer.invoke('terminal:resize', id, cols, rows),
    kill: (id) => ipcRenderer.invoke('terminal:kill', id),
    onData: (callback) => {
      const handler = (_: unknown, id: string, data: string) => callback(id, data)
      ipcRenderer.on('terminal:data', handler)
      return () => ipcRenderer.removeListener('terminal:data', handler)
    },
    onExit: (callback) => {
      const handler = (_: unknown, id: string, code: number) => callback(id, code)
      ipcRenderer.on('terminal:exit', handler)
      return () => ipcRenderer.removeListener('terminal:exit', handler)
    },
  },
  ai: {
    chat: (messages, options) => ipcRenderer.invoke('ai:chat', messages, options),
    chatStream: (messages, options) => ipcRenderer.invoke('ai:chat-stream', messages, options),
    onStreamChunk: (callback) => {
      const handler = (_: unknown, chunk: string) => callback(chunk)
      ipcRenderer.on('ai:stream-chunk', handler)
      return () => ipcRenderer.removeListener('ai:stream-chunk', handler)
    },
    onStreamEnd: (callback) => {
      const handler = () => callback()
      ipcRenderer.on('ai:stream-end', handler)
      return () => ipcRenderer.removeListener('ai:stream-end', handler)
    },
    embed: (text) => ipcRenderer.invoke('ai:embed', text),
  },
  git: {
    status: (repoPath) => ipcRenderer.invoke('git:status', repoPath),
    diff: (repoPath) => ipcRenderer.invoke('git:diff', repoPath),
    log: (repoPath, maxCount) => ipcRenderer.invoke('git:log', repoPath, maxCount),
    commit: (repoPath, message) => ipcRenderer.invoke('git:commit', repoPath, message),
    add: (repoPath, files) => ipcRenderer.invoke('git:add', repoPath, files),
    branch: (repoPath) => ipcRenderer.invoke('git:branch', repoPath),
  },
  memory: {
    loadSession: (projectPath) => ipcRenderer.invoke('memory:load-session', projectPath),
    saveObservation: (observation) => ipcRenderer.invoke('memory:save-observation', observation),
    query: (query, layer) => ipcRenderer.invoke('memory:query', query, layer),
    compress: () => ipcRenderer.invoke('memory:compress'),
  },
  db: {
    query: (sql, params) => ipcRenderer.invoke('db:query', sql, params),
    run: (sql, params) => ipcRenderer.invoke('db:run', sql, params),
  },
  skill: {
    list: () => ipcRenderer.invoke('skill:list'),
    run: (name, inputs) => ipcRenderer.invoke('skill:run', name, inputs),
    create: (definition) => ipcRenderer.invoke('skill:create', definition),
    getResult: (runId) => ipcRenderer.invoke('skill:get-result', runId),
    onProgress: (callback) => {
      const handler = (_: unknown, data: { skillName: string; progress: number; message: string }) => callback(data)
      ipcRenderer.on('skill:progress', handler)
      return () => ipcRenderer.removeListener('skill:progress', handler)
    },
  },
  workflow: {
    list: () => ipcRenderer.invoke('workflow:list'),
    run: (name, inputs) => ipcRenderer.invoke('workflow:run', name, inputs),
    stop: (runId) => ipcRenderer.invoke('workflow:stop', runId),
    getState: (runId) => ipcRenderer.invoke('workflow:get-state', runId),
    create: (definition) => ipcRenderer.invoke('workflow:create', definition),
    onStepComplete: (callback) => {
      const handler = (_: unknown, data: unknown) => callback(data)
      ipcRenderer.on('workflow:step-complete', handler)
      return () => ipcRenderer.removeListener('workflow:step-complete', handler)
    },
    onDone: (callback) => {
      const handler = (_: unknown, data: unknown) => callback(data)
      ipcRenderer.on('workflow:done', handler)
      return () => ipcRenderer.removeListener('workflow:done', handler)
    },
  },
  ritual: {
    list: () => ipcRenderer.invoke('ritual:list'),
    configure: (id, config) => ipcRenderer.invoke('ritual:configure', id, config),
    enable: (id, enabled) => ipcRenderer.invoke('ritual:enable', id, enabled),
    trigger: (id) => ipcRenderer.invoke('ritual:trigger', id),
  },
  app: {
    getPath: (name) => ipcRenderer.invoke('app:get-path', name),
    getPlatform: () => ipcRenderer.invoke('app:get-platform'),
  },
  on: (channel, callback) => {
    const handler = (_: unknown, ...args: unknown[]) => callback(...args)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  },
}

contextBridge.exposeInMainWorld('api', api)
