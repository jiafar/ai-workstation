import { useAppStore } from '../../store/appStore'
import { FileExplorer } from '../FileExplorer/FileExplorer'
import { SkillBrowser } from '../Skill/SkillBrowser'
import { WorkflowList } from '../Workflow/WorkflowList'
import { MemoryPanel } from '../Memory/MemoryPanel'
import { TaskList } from '../TaskManager/TaskList'
import { KnowledgePanel } from '../Knowledge/KnowledgePanel'
import { SettingsPanel } from '../Settings/SettingsPanel'
import { SearchPanel } from '../Layout/SearchPanel'
import { GitPanel } from '../Layout/GitPanel'

export function Sidebar() {
  const { activePanel } = useAppStore()

  const renderPanel = () => {
    switch (activePanel) {
      case 'explorer': return <FileExplorer />
      case 'search': return <SearchPanel />
      case 'git': return <GitPanel />
      case 'skills': return <SkillBrowser />
      case 'workflows': return <WorkflowList />
      case 'memory': return <MemoryPanel />
      case 'tasks': return <TaskList />
      case 'knowledge': return <KnowledgePanel />
      case 'settings': return <SettingsPanel />
      default: return <FileExplorer />
    }
  }

  return (
    <div className="h-full bg-bg-secondary overflow-hidden flex flex-col">
      <div className="px-4 py-2 text-xs font-semibold text-text-secondary uppercase tracking-wider border-b border-border">
        {activePanel}
      </div>
      <div className="flex-1 overflow-y-auto">
        {renderPanel()}
      </div>
    </div>
  )
}
