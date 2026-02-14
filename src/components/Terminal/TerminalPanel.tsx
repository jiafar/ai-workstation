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
  const cleanupRef = useRef<(() => void) | null>(null)
  const isDestroyedRef = useRef(false)

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
      if (!isDestroyedRef.current) {
        window.api.terminal.write(terminalId, data).catch(() => {})
      }
    })

    // 初始化后端
    const initTerminal = async () => {
      try {
        const { cols, rows } = term
        const result = await window.api.terminal.create(terminalId)
        
        if (result?.success === false || isDestroyedRef.current) {
          if (!isDestroyedRef.current) {
            term.writeln(`\r\n\x1b[31mError: ${result?.error || 'Unknown error'}\x1b[0m`)
          }
          return
        }

        // 立即 resize 到正确尺寸
        await window.api.terminal.resize(terminalId, cols, rows)

        // 接收后端数据
        const unsubscribeData = window.api.terminal.onData((id: string, data: string) => {
          if (id === terminalId && !isDestroyedRef.current && terminalRef.current) {
            try {
              terminalRef.current.write(data)
            } catch (error) {
              console.error('[Terminal] Error writing data:', error)
            }
          }
        })

        // 接收退出事件
        const unsubscribeExit = window.api.terminal.onExit((id: string) => {
          if (id === terminalId && !isDestroyedRef.current) {
            onExit?.()
          }
        })

        // 保存清理函数
        cleanupRef.current = () => {
          unsubscribeData()
          unsubscribeExit()
        }

        if (isActive) term.focus()
      } catch (error: any) {
        if (!isDestroyedRef.current) {
          term.writeln(`\r\n\x1b[31mFailed to create terminal: ${error?.message || error}\x1b[0m`)
        }
      }
    }

    initTerminal()

    // 调整大小 - 使用防抖
    let resizeTimeout: NodeJS.Timeout | null = null
    const onResize = () => {
      if (resizeTimeout) clearTimeout(resizeTimeout)
      resizeTimeout = setTimeout(() => {
        if (!isDestroyedRef.current && terminalRef.current && fitAddonRef.current) {
          fitAddonRef.current.fit()
          const { cols, rows } = terminalRef.current
          window.api.terminal.resize(terminalId, cols, rows).catch(() => {})
        }
      }, 100)
    }
    window.addEventListener('resize', onResize)

    return () => {
      isDestroyedRef.current = true
      if (resizeTimeout) clearTimeout(resizeTimeout)
      window.removeEventListener('resize', onResize)
      inputDisposer.dispose()
      if (cleanupRef.current) cleanupRef.current()
      term.dispose()
      window.api.terminal.kill(terminalId).catch(() => {})
    }
  }, [terminalId, onExit, getTheme, isActive])

  // 切换时聚焦
  useEffect(() => {
    if (isActive && terminalRef.current && !isDestroyedRef.current) {
      terminalRef.current.focus()
      setTimeout(() => {
        if (!isDestroyedRef.current && fitAddonRef.current) {
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

// 使用简单的状态管理
const useTerminalManager = () => {
  const [terminals, setTerminals] = React.useState<TerminalTab[]>([])
  const [activeId, setActiveId] = React.useState<string | null>(null)

  const addTerminal = React.useCallback(() => {
    const id = `term-${Date.now()}`
    const newTerminal: TerminalTab = {
      id,
      title: `Terminal ${terminals.length + 1}`,
      isActive: true,
    }
    setTerminals(prev => [
      ...prev.map(t => ({ ...t, isActive: false })),
      newTerminal
    ])
    setActiveId(id)
    return id
  }, [terminals.length])

  const removeTerminal = React.useCallback((id: string) => {
    setTerminals(prev => {
      const index = prev.findIndex(t => t.id === id)
      const newTerminals = prev.filter(t => t.id !== id)
      
      if (activeId === id && newTerminals.length > 0) {
        const newActiveIndex = Math.max(0, index - 1)
        const newActiveId = newTerminals[newActiveIndex].id
        setActiveId(newActiveId)
        return newTerminals.map(t => ({
          ...t,
          isActive: t.id === newActiveId
        }))
      }
      
      if (newTerminals.length === 0) {
        setActiveId(null)
      }
      
      return newTerminals
    })
  }, [activeId])

  const setActive = React.useCallback((id: string) => {
    setActiveId(id)
    setTerminals(prev => prev.map(t => ({
      ...t,
      isActive: t.id === id
    })))
  }, [])

  // 初始化时创建一个终端
  React.useEffect(() => {
    if (terminals.length === 0) {
      addTerminal()
    }
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
