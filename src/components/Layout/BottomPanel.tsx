import { useAppStore } from '../../store/appStore'
import { TerminalPanel } from '../Terminal/TerminalPanel'
import { ChatPanel } from '../Chat/ChatPanel'
import type { BottomPanelType } from '../../types'
import { useTheme } from '../../hooks/useTheme'

const tabs: Array<{ id: BottomPanelType; label: string }> = [
  { id: 'terminal', label: 'Terminal' },
  { id: 'chat', label: 'AI Chat' },
  { id: 'problems', label: 'Problems' },
  { id: 'output', label: 'Output' },
]

export function BottomPanel() {
  const { activePanel, activeBottomPanel, setActiveBottomPanel, setActivePanel, toggleBottomPanel } = useAppStore()
  const { theme } = useTheme()

  // When chat tab is clicked in bottom panel while chat is already in main area,
  // just switch to the main chat view instead of creating a duplicate
  const handleTabClick = (id: BottomPanelType) => {
    if (id === 'chat') {
      setActivePanel('chat')
    } else {
      setActiveBottomPanel(id)
    }
  }

  // If chat is showing in main area, don't also show it in bottom panel
  const showChatHere = activeBottomPanel === 'chat' && activePanel !== 'chat'

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
            onClick={() => handleTabClick(id)}
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
        {activeBottomPanel === 'terminal' && <TerminalPanel theme={theme} />}
        {showChatHere && <ChatPanel />}
        {activeBottomPanel === 'chat' && !showChatHere && (
          <div className="flex items-center justify-center h-full text-text-muted text-sm">
            AI Chat is open in the main area. Click 💬 in the activity bar to view it.
          </div>
        )}
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
