import { useAppStore } from '../../store/appStore'
import type { PanelType } from '../../types'

const panels: Array<{ id: PanelType; icon: string; label: string }> = [
  { id: 'explorer', icon: '📁', label: 'Explorer' },
  { id: 'search', icon: '🔍', label: 'Search' },
  { id: 'git', icon: '⑂', label: 'Git' },
  { id: 'skills', icon: '⚡', label: 'Skills' },
  { id: 'workflows', icon: '🔄', label: 'Workflows' },
  { id: 'memory', icon: '🧠', label: 'Memory' },
  { id: 'tasks', icon: '☑', label: 'Tasks' },
  { id: 'knowledge', icon: '📚', label: 'Knowledge' },
  { id: 'chat', icon: '💬', label: 'AI Chat' },
  { id: 'settings', icon: '⚙', label: 'Settings' },
]

export function ActivityBar() {
  const { activePanel, setActivePanel, showSidebar, toggleSidebar } = useAppStore()

  const handleClick = (id: PanelType) => {
    if (id === 'chat') {
      // Chat uses the main area, not the sidebar — just toggle activePanel
      setActivePanel(activePanel === 'chat' ? 'explorer' : 'chat')
    } else if (activePanel === id && showSidebar) {
      toggleSidebar()
    } else {
      setActivePanel(id)
      if (!showSidebar) toggleSidebar()
    }
  }

  return (
    <div className="w-12 bg-bg-tertiary flex flex-col items-center py-2 border-r border-border">
      {panels.map(({ id, icon, label }) => (
        <button
          key={id}
          className={`activity-icon text-lg ${activePanel === id && (id === 'chat' || showSidebar) ? 'active' : ''}`}
          onClick={() => handleClick(id)}
          title={label}
        >
          {icon}
        </button>
      ))}
    </div>
  )
}
