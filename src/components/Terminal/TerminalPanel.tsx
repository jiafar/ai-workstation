import React, { useEffect, useRef, useCallback } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'

interface TerminalInstanceProps {
  terminalId: string
  isActive: boolean
  theme: 'dark' | 'light'
  onExit?: () => void
}

const TerminalInstance: React.FC<TerminalInstanceProps> = ({
  terminalId,
  isActive,
  theme,
  onExit
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const onExitRef = useRef(onExit)
  onExitRef.current = onExit

  // Track whether backend terminal is alive across StrictMode re-mounts
  const backendAliveRef = useRef(false)
  // Deferred kill timer — allows StrictMode re-mount to cancel the kill
  const killTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 主题配置
  const getTheme = useCallback(() => {
    if (theme === 'light') {
      return {
        background: '#ffffff',
        foreground: '#1a1a2e',
        cursor: '#1a1a2e',
        selectionBackground: '#c1c1c1',
        black: '#000000',
        red: '#dc2626',
        green: '#16a34a',
        yellow: '#ca8a04',
        blue: '#2563eb',
        magenta: '#9333ea',
        cyan: '#0d9488',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#ef4444',
        brightGreen: '#22c55e',
        brightYellow: '#eab308',
        brightBlue: '#3b82f6',
        brightMagenta: '#a855f7',
        brightCyan: '#14b8a6',
        brightWhite: '#ffffff',
      }
    }
    // Dark theme (default)
    return {
      background: '#1e1e2e',
      foreground: '#cdd6f4',
      cursor: '#cdd6f4',
      selectionBackground: '#45475a',
      black: '#181825',
      red: '#f38ba8',
      green: '#a6e3a1',
      yellow: '#f9e2af',
      blue: '#89b4fa',
      magenta: '#cba6f7',
      cyan: '#94e2d5',
      white: '#cdd6f4',
      brightBlack: '#313244',
      brightRed: '#f38ba8',
      brightGreen: '#a6e3a1',
      brightYellow: '#f9e2af',
      brightBlue: '#89b4fa',
      brightMagenta: '#cba6f7',
      brightCyan: '#94e2d5',
      brightWhite: '#ffffff',
    }
  }, [theme])

  useEffect(() => {
    if (!containerRef.current) return

    let cancelled = false

    // Cancel any pending kill from a previous StrictMode unmount
    if (killTimeoutRef.current) {
      clearTimeout(killTimeoutRef.current)
      killTimeoutRef.current = null
    }

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: getTheme(),
      scrollback: 10000,
      allowProposedApi: true,
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(containerRef.current)
    fitAddon.fit()

    terminalRef.current = term
    fitAddonRef.current = fitAddon

    // 注册输入处理器
    const inputDisposer = term.onData((data) => {
      if (!cancelled) {
        window.api.terminal.write(terminalId, data).catch(() => {})
      }
    })

    // Subscribe to IPC events synchronously (not inside async init)
    // so cleanup can always unsubscribe them reliably
    const unsubscribeData = window.api.terminal.onData((id: string, data: string) => {
      if (id === terminalId && !cancelled && terminalRef.current) {
        try {
          terminalRef.current.write(data)
        } catch (error) {
          console.error('[Terminal] Error writing data:', error)
        }
      }
    })

    const unsubscribeExit = window.api.terminal.onExit((id: string) => {
      if (id === terminalId && !cancelled) {
        backendAliveRef.current = false
        onExitRef.current?.()
      }
    })

    // 初始化后端
    const initBackend = async () => {
      try {
        if (backendAliveRef.current) {
          // Backend terminal survived StrictMode re-mount — just resize
          await window.api.terminal.resize(terminalId, term.cols, term.rows).catch(() => {})
          if (!cancelled && isActive) term.focus()
          return
        }

        const result = await window.api.terminal.create(terminalId)
        if (cancelled) return

        if (result?.success === false) {
          term.writeln(`\r\n\x1b[31mError: ${result?.error || 'Unknown error'}\x1b[0m`)
          return
        }

        backendAliveRef.current = true
        await window.api.terminal.resize(terminalId, term.cols, term.rows)
        if (cancelled) return
        if (isActive) term.focus()
      } catch (error: any) {
        if (!cancelled) {
          term.writeln(`\r\n\x1b[31mFailed to create terminal: ${error?.message || error}\x1b[0m`)
        }
      }
    }

    initBackend()

    // 调整大小 - 使用防抖
    let resizeTimeout: NodeJS.Timeout | null = null
    const onResize = () => {
      if (resizeTimeout) clearTimeout(resizeTimeout)
      resizeTimeout = setTimeout(() => {
        if (!cancelled && terminalRef.current && fitAddonRef.current) {
          fitAddonRef.current.fit()
          const { cols, rows } = terminalRef.current
          window.api.terminal.resize(terminalId, cols, rows).catch(() => {})
        }
      }, 100)
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelled = true
      if (resizeTimeout) clearTimeout(resizeTimeout)
      window.removeEventListener('resize', onResize)
      inputDisposer.dispose()
      unsubscribeData()
      unsubscribeExit()
      term.dispose()
      // Defer the backend kill — StrictMode re-mount will cancel this
      killTimeoutRef.current = setTimeout(() => {
        backendAliveRef.current = false
        window.api.terminal.kill(terminalId).catch(() => {})
      }, 100)
    }
  }, [terminalId, getTheme])

  // 切换时聚焦
  useEffect(() => {
    if (isActive && terminalRef.current) {
      terminalRef.current.focus()
      setTimeout(() => {
        if (fitAddonRef.current) {
          fitAddonRef.current.fit()
        }
      }, 50)
    }
  }, [isActive])

  // 主题变化时更新
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.options.theme = getTheme()
    }
  }, [theme, getTheme])

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 p-2"
      style={{
        visibility: isActive ? 'visible' : 'hidden',
        zIndex: isActive ? 10 : 0
      }}
    />
  )
}

// Terminal 标签页类型
interface TerminalTab {
  id: string
  title: string
  isActive: boolean
}

// Monotonic ID counter to avoid duplicates from StrictMode same-tick calls
let terminalIdCounter = 0

// 使用简单的状态管理
const useTerminalManager = () => {
  const [terminals, setTerminals] = React.useState<TerminalTab[]>([])
  const [activeId, setActiveId] = React.useState<string | null>(null)
  const initedRef = React.useRef(false)

  const addTerminal = React.useCallback(() => {
    const id = `term-${Date.now()}-${++terminalIdCounter}`
    setTerminals(prev => {
      const newTerminal: TerminalTab = {
        id,
        title: `Terminal ${prev.length + 1}`,
        isActive: true,
      }
      return [...prev.map(t => ({ ...t, isActive: false })), newTerminal]
    })
    setActiveId(id)
    return id
  }, [])

  const removeTerminal = React.useCallback((id: string) => {
    setTerminals(prev => {
      const index = prev.findIndex(t => t.id === id)
      const newTerminals = prev.filter(t => t.id !== id)

      if (newTerminals.length === 0) {
        setActiveId(null)
        return newTerminals
      }

      const wasActive = prev[index]?.isActive
      if (wasActive) {
        const newActiveIndex = Math.max(0, index - 1)
        const newActiveId = newTerminals[newActiveIndex].id
        setActiveId(newActiveId)
        return newTerminals.map(t => ({
          ...t,
          isActive: t.id === newActiveId
        }))
      }

      return newTerminals
    })
  }, [])

  const setActive = React.useCallback((id: string) => {
    setActiveId(id)
    setTerminals(prev => prev.map(t => ({
      ...t,
      isActive: t.id === id
    })))
  }, [])

  // 初始化时创建一个终端 — 只运行一次（ref 防止 StrictMode 重复创建）
  React.useEffect(() => {
    if (!initedRef.current) {
      initedRef.current = true
      addTerminal()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    terminals,
    activeId,
    addTerminal,
    removeTerminal,
    setActive
  }
}

interface TerminalPanelProps {
  theme?: 'dark' | 'light'
}

export const TerminalPanel: React.FC<TerminalPanelProps> = ({ theme = 'dark' }) => {
  const { terminals, activeId, addTerminal, removeTerminal, setActive } = useTerminalManager()

  return (
    <div className="flex flex-col h-full bg-bg-primary">
      {/* 标签栏 */}
      <div className="flex items-center bg-bg-secondary border-b border-border overflow-x-auto">
        {terminals.map((terminal) => (
          <div
            key={terminal.id}
            className={`flex items-center px-4 py-2 border-r border-border cursor-pointer whitespace-nowrap transition-colors ${
              terminal.id === activeId 
                ? 'bg-bg-surface text-text-primary' 
                : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
            }`}
            onClick={() => setActive(terminal.id)}
          >
            <span className="text-sm mr-2">{terminal.title}</span>
            <button
              onClick={(e) => { 
                e.stopPropagation()
                removeTerminal(terminal.id)
              }}
              className="ml-2 text-text-muted hover:text-accent-red transition-colors"
            >
              ×
            </button>
          </div>
        ))}
        <button 
          onClick={addTerminal} 
          className="px-3 py-2 text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
        >
          +
        </button>
      </div>

      {/* 终端区域 */}
      <div className="flex-1 relative overflow-hidden">
        {terminals.map((terminal) => (
          <TerminalInstance
            key={terminal.id}
            terminalId={terminal.id}
            isActive={terminal.id === activeId}
            theme={theme}
            onExit={() => removeTerminal(terminal.id)}
          />
        ))}
      </div>
    </div>
  )
}

export default TerminalPanel
