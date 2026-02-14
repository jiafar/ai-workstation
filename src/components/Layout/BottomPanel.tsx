import { useAppStore } from '../../store/appStore'
import { TerminalPanel } from '../Terminal/TerminalPanel'
import { ChatPanel } from '../Chat/ChatPanel'
import type { BottomPanelType } from '../../types'

const tabs: Array<{ id: BottomPanelType; label: string }> = [
  { id: 'terminal', label: 'Terminal' },
  { id: 'chat', label: 'AI Chat' },
  { id: 'problems', label: 'Problems' },
  { id: 'output', label: 'Output' },
]

export function BottomPanel() {
  const { activeBottomPanel, setActiveBottomPanel, toggleBottomPanel } = useAppStore()

  return (
    <div className="h-full bg-bg-secondary flex flex-col border-t border-border">
      {/* Tabs */}
      <div className="flex items-center h-8 border-b border-border px-2 gap-1">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            className={`px-3 py-1 text-xs font-medium rounded-t transition-colors ${
              activeBottomPanel === id
                ? 'text-text-primary bg-bg-primary'
                : 'text-text-muted hover:text-text-secondary'
            }`}
            onClick={() => setActiveBottomPanel(id)}
          >
            {label}
          </button>
        ))}
        <div className="flex-1" />
        <button
          className="text-text-muted hover:text-text-primary text-xs px-1"
          onClick={toggleBottomPanel}
          title="Close Panel"
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeBottomPanel === 'terminal' && <TerminalPanel />}
        {activeBottomPanel === 'chat' && <ChatPanel />}
        {activeBottomPanel === 'problems' && (
          <div className="p-4 text-text-muted text-sm">No problems detected.</div>
        )}
        {activeBottomPanel === 'output' && (
          <div className="p-4 text-text-muted text-sm">No output.</div>
        )}
      </div>
    </div>
  )
}
