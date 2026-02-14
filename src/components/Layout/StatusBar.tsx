import { useEditorStore } from '../../store/editorStore'
import { useAppStore } from '../../store/appStore'

export function StatusBar() {
  const activeTab = useEditorStore((s) => {
    const tab = s.tabs.find((t) => t.id === s.activeTabId)
    return tab ?? null
  })
  const currentProject = useAppStore((s) => s.currentProject)

  return (
    <div className="h-6 bg-accent-blue/10 flex items-center px-4 text-xs text-text-secondary border-t border-border gap-4">
      <span className="text-accent-blue font-medium">
        {currentProject ? currentProject.name : 'No Project'}
      </span>
      <div className="flex-1" />
      {activeTab && (
        <>
          <span>{activeTab.language}</span>
          <span>UTF-8</span>
          <span>{activeTab.isDirty ? '● Modified' : 'Saved'}</span>
        </>
      )}
      <span>AI Workstation v0.1.0</span>
    </div>
  )
}
