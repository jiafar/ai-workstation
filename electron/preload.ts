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
    create: (id: string, cwd?: string) => Promise<{ success: boolean; error?: string; pid?: number }>
    write: (id: string, data: string) => Promise<{ success: boolean; error?: string }>
    resize: (id: string, cols: number, rows: number) => Promise<{ success: boolean; error?: string }>
    kill: (id: string) => Promise<{ success: boolean; error?: string }>
    onData: (callback: (id: string, data: string) => void) => () => void
    onExit: (callback: (id: string, code: number) => void) => () => void
  }
  // AI
  ai: {
    chat: (messages: Array<{ role: string; content: string }>, options?: Record<string, unknown>) => Promise<unknown>
    chatStream: (messages: Array<{ role: string; content: string }>, options?: Record<string, unknown>) => Promise<string>
    onStreamChunk: (callback: (requestId: string, chunk: string) => void) => () => void
    onStreamEnd: (callback: (requestId: string) => void) => () => void
    onStreamError: (callback: (requestId: string, error: string) => void) => () => void
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
    checkout: (repoPath: string, branch: string, create?: boolean) => Promise<void>
    pull: (repoPath: string, remote?: string, branch?: string) => Promise<unknown>
    push: (repoPath: string, remote?: string, branch?: string) => Promise<unknown>
    clone: (repoUrl: string, localPath: string) => Promise<void>
    remote: (repoPath: string) => Promise<unknown>
    stash: (repoPath: string, message?: string) => Promise<void>
    stashList: (repoPath: string) => Promise<unknown[]>
    stashPop: (repoPath: string, index?: number) => Promise<void>
    stashApply: (repoPath: string, index?: number) => Promise<void>
    stashDrop: (repoPath: string, index?: number) => Promise<void>
    fetch: (repoPath: string, remote?: string) => Promise<void>
    merge: (repoPath: string, branch: string) => Promise<void>
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
    getStats: () => Promise<unknown>
    getSchema: () => Promise<unknown>
    backup: (backupPath: string) => Promise<unknown>
    optimize: () => Promise<unknown>
    close: () => Promise<unknown>
    getTableInfo: (tableName: string) => Promise<unknown>
    memories: {
      list: (params?: { type?: string }) => Promise<unknown[]>
      get: (id: string) => Promise<unknown>
      create: (params: { id: string; type: string; content: string; context?: string; timestamp: number; metadata?: string; embedding_id?: string }) => Promise<unknown>
      delete: (id: string) => Promise<unknown>
    }
    conversations: {
      list: (params?: { limit?: number }) => Promise<unknown[]>
      create: (params: { id: string; title: string }) => Promise<unknown>
    }
    messages: {
      list: (conversationId: string) => Promise<unknown[]>
      create: (params: { id: string; conversation_id: string; role: string; content: string; timestamp: number; metadata?: string }) => Promise<unknown>
    }
    settings: {
      get: (key: string) => Promise<unknown>
      set: (params: { key: string; value: string }) => Promise<unknown>
    }
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
  // Config
  config: {
    get: () => Promise<unknown>
    getSection: (section: string) => Promise<unknown>
    update: (updates: Record<string, unknown>) => Promise<void>
    updateSection: (section: string, updates: Record<string, unknown>) => Promise<void>
    reset: () => Promise<void>
    resetSection: (section: string) => Promise<void>
    getPath: () => Promise<string>
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
    chat: (messages, options) => unwrap(ipcRenderer.invoke('ai:chat', messages, options)),
    chatStream: (messages, options) => unwrap<string>(ipcRenderer.invoke('ai:chat-stream', messages, options)),
    onStreamChunk: (callback) => {
      const handler = (_: unknown, requestId: string, chunk: string) => callback(requestId, chunk)
      ipcRenderer.on('ai:stream-chunk', handler)
      return () => ipcRenderer.removeListener('ai:stream-chunk', handler)
    },
    onStreamEnd: (callback) => {
      const handler = (_: unknown, requestId: string) => callback(requestId)
      ipcRenderer.on('ai:stream-end', handler)
      return () => ipcRenderer.removeListener('ai:stream-end', handler)
    },
    onStreamError: (callback) => {
      const handler = (_: unknown, requestId: string, error: string) => callback(requestId, error)
      ipcRenderer.on('ai:stream-error', handler)
      return () => ipcRenderer.removeListener('ai:stream-error', handler)
    },
    embed: (text) => unwrap<number[]>(ipcRenderer.invoke('ai:embed', text)),
  },
  git: {
    status: (repoPath) => ipcRenderer.invoke('git:status', repoPath),
    diff: (repoPath) => ipcRenderer.invoke('git:diff', repoPath),
    log: (repoPath, maxCount) => ipcRenderer.invoke('git:log', repoPath, maxCount),
    commit: (repoPath, message) => unwrap(ipcRenderer.invoke('git:commit', repoPath, message)),
    add: (repoPath, files) => unwrap<void>(ipcRenderer.invoke('git:add', repoPath, files)),
    branch: (repoPath) => unwrap(ipcRenderer.invoke('git:branch', repoPath)),
    checkout: (repoPath, branch, create) => unwrap<void>(ipcRenderer.invoke('git:checkout', repoPath, branch, create)),
    pull: (repoPath, remote, branch) => unwrap(ipcRenderer.invoke('git:pull', repoPath, remote, branch)),
    push: (repoPath, remote, branch) => unwrap(ipcRenderer.invoke('git:push', repoPath, remote, branch)),
    clone: (repoUrl, localPath) => unwrap<void>(ipcRenderer.invoke('git:clone', repoUrl, localPath)),
    remote: (repoPath) => unwrap(ipcRenderer.invoke('git:remote', repoPath)),
    stash: (repoPath, message) => unwrap<void>(ipcRenderer.invoke('git:stash', repoPath, message)),
    stashList: (repoPath) => unwrap<unknown[]>(ipcRenderer.invoke('git:stashList', repoPath)),
    stashPop: (repoPath, index) => unwrap<void>(ipcRenderer.invoke('git:stashPop', repoPath, index)),
    stashApply: (repoPath, index) => unwrap<void>(ipcRenderer.invoke('git:stashApply', repoPath, index)),
    stashDrop: (repoPath, index) => unwrap<void>(ipcRenderer.invoke('git:stashDrop', repoPath, index)),
    fetch: (repoPath, remote) => unwrap<void>(ipcRenderer.invoke('git:fetch', repoPath, remote)),
    merge: (repoPath, branch) => unwrap<void>(ipcRenderer.invoke('git:merge', repoPath, branch)),
  },
  memory: {
    loadSession: (projectPath) => unwrap(ipcRenderer.invoke('memory:load-session', projectPath)),
    saveObservation: (observation) => unwrap<string>(ipcRenderer.invoke('memory:save-observation', observation)),
    query: (query, layer) => unwrap<unknown[]>(ipcRenderer.invoke('memory:query', query, layer)),
    compress: () => unwrap<void>(ipcRenderer.invoke('memory:compress')),
  },
  db: {
    getStats: () => unwrap(ipcRenderer.invoke('db:get-stats')),
    getSchema: () => unwrap(ipcRenderer.invoke('db:get-schema')),
    backup: (backupPath) => unwrap(ipcRenderer.invoke('db:backup', backupPath)),
    optimize: () => unwrap(ipcRenderer.invoke('db:optimize')),
    close: () => unwrap(ipcRenderer.invoke('db:close')),
    getTableInfo: (tableName) => unwrap(ipcRenderer.invoke('db:get-table-info', tableName)),
    memories: {
      list: (params) => unwrap<unknown[]>(ipcRenderer.invoke('db:memories:list', params)),
      get: (id) => unwrap(ipcRenderer.invoke('db:memories:get', id)),
      create: (params) => unwrap(ipcRenderer.invoke('db:memories:create', params)),
      delete: (id) => unwrap(ipcRenderer.invoke('db:memories:delete', id)),
    },
    conversations: {
      list: (params) => unwrap<unknown[]>(ipcRenderer.invoke('db:conversations:list', params)),
      create: (params) => unwrap(ipcRenderer.invoke('db:conversations:create', params)),
    },
    messages: {
      list: (conversationId) => unwrap<unknown[]>(ipcRenderer.invoke('db:messages:list', conversationId)),
      create: (params) => unwrap(ipcRenderer.invoke('db:messages:create', params)),
    },
    settings: {
      get: (key) => unwrap(ipcRenderer.invoke('db:settings:get', key)),
      set: (params) => unwrap(ipcRenderer.invoke('db:settings:set', params)),
    },
  },
  skill: {
    list: () => unwrap(ipcRenderer.invoke('skill:list')),
    run: (name, inputs) => unwrap(ipcRenderer.invoke('skill:run', name, inputs)),
    create: (definition) => unwrap<void>(ipcRenderer.invoke('skill:create', definition)),
    getResult: (runId) => unwrap(ipcRenderer.invoke('skill:get-result', runId)),
    onProgress: (callback) => {
      const handler = (_: unknown, data: { skillName: string; progress: number; message: string }) => callback(data)
      ipcRenderer.on('skill:progress', handler)
      return () => ipcRenderer.removeListener('skill:progress', handler)
    },
  },
  workflow: {
    list: () => unwrap(ipcRenderer.invoke('workflow:list')),
    run: (name, inputs) => unwrap<string>(ipcRenderer.invoke('workflow:run', name, inputs)),
    stop: (runId) => unwrap<void>(ipcRenderer.invoke('workflow:stop', runId)),
    getState: (runId) => unwrap(ipcRenderer.invoke('workflow:get-state', runId)),
    create: (definition) => unwrap<void>(ipcRenderer.invoke('workflow:create', definition)),
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
    list: () => unwrap(ipcRenderer.invoke('ritual:list')),
    configure: (id, config) => unwrap<void>(ipcRenderer.invoke('ritual:configure', id, config)),
    enable: (id, enabled) => unwrap<void>(ipcRenderer.invoke('ritual:enable', id, enabled)),
    trigger: (id) => unwrap<void>(ipcRenderer.invoke('ritual:trigger', id)),
  },
  config: {
    get: () => unwrap(ipcRenderer.invoke('config:get')),
    getSection: (section) => unwrap(ipcRenderer.invoke('config:get-section', section)),
    update: (updates) => unwrap<void>(ipcRenderer.invoke('config:update', updates)),
    updateSection: (section, updates) => unwrap<void>(ipcRenderer.invoke('config:update-section', section, updates)),
    reset: () => unwrap<void>(ipcRenderer.invoke('config:reset')),
    resetSection: (section) => unwrap<void>(ipcRenderer.invoke('config:reset-section', section)),
    getPath: () => unwrap<string>(ipcRenderer.invoke('config:get-path')),
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
