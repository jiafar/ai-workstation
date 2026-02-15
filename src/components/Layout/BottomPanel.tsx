import { useAppStore } from '../../store/appStore'
import { TerminalPanel } from '../Terminal/TerminalPanel'
import { ChatPanel } from '../Chat/ChatPanel'
import { useTheme } from '../../hooks/useTheme'
import { useRef, useState, useCallback } from 'react'

export function BottomPanel() {
  const { toggleBottomPanel } = useAppStore()
  const { theme } = useTheme()
  const [splitRatio, setSplitRatio] = useState(0.5) // 0..1, left panel fraction
  const containerRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true

    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const ratio = (e.clientX - rect.left) / rect.width
      setSplitRatio(Math.max(0.15, Math.min(0.85, ratio)))
    }

    const onMouseUp = () => {
      dragging.current = false
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [])

  return (
    <div className="h-full bg-bg-secondary flex flex-col border-t border-border">
      {/* Header bar */}
      <div className="flex items-center h-8 border-b border-border px-2 gap-1">
        <span className="px-3 py-1 text-xs font-medium text-text-primary">Terminal</span>
        <span className="text-text-muted text-xs">|</span>
        <span className="px-3 py-1 text-xs font-medium text-text-primary">AI Chat</span>
        <div className="flex-1" />
        <button
          className="text-text-muted hover:text-text-primary text-xs px-1"
          onClick={toggleBottomPanel}
          title="Close Panel"
        >
          ✕
        </button>
      </div>

      {/* Content — Terminal left, Chat right, draggable divider */}
      <div ref={containerRef} className="flex-1 flex overflow-hidden">
        {/* Terminal */}
        <div style={{ width: `${splitRatio * 100}%` }} className="flex-shrink-0 overflow-hidden">
          <TerminalPanel theme={theme} />
        </div>
        {/* Draggable divider */}
        <div
          className="resizer resizer-horizontal"
          onMouseDown={handleResizeStart}
        />
        {/* AI Chat */}
        <div className="flex-1 overflow-hidden">
          <ChatPanel />
        </div>
      </div>
    </div>
  )
}
