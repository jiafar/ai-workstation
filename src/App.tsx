import { TitleBar } from './components/Layout/TitleBar'
import { ActivityBar } from './components/Layout/ActivityBar'
import { Sidebar } from './components/Layout/Sidebar'
import { EditorArea } from './components/Editor/EditorArea'
import { BottomPanel } from './components/Layout/BottomPanel'
import { StatusBar } from './components/Layout/StatusBar'
import { useAppStore } from './store/appStore'
import { useRef, useCallback } from 'react'

export default function App() {
  const {
    sidebarWidth,
    panelHeight,
    showSidebar,
    showBottomPanel,
    setSidebarWidth,
    setPanelHeight
  } = useAppStore()

  const sidebarResizing = useRef(false)
  const panelResizing = useRef(false)

  const handleSidebarResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    sidebarResizing.current = true
    const startX = e.clientX
    const startWidth = sidebarWidth

    const onMouseMove = (e: MouseEvent) => {
      if (!sidebarResizing.current) return
      const delta = e.clientX - startX
      const newWidth = Math.max(180, Math.min(500, startWidth + delta))
      setSidebarWidth(newWidth)
    }

    const onMouseUp = () => {
      sidebarResizing.current = false
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [sidebarWidth, setSidebarWidth])

  const handlePanelResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    panelResizing.current = true
    const startY = e.clientY
    const startHeight = panelHeight

    const onMouseMove = (e: MouseEvent) => {
      if (!panelResizing.current) return
      const delta = startY - e.clientY
      const newHeight = Math.max(100, Math.min(600, startHeight + delta))
      setPanelHeight(newHeight)
    }

    const onMouseUp = () => {
      panelResizing.current = false
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [panelHeight, setPanelHeight])

  return (
    <div className="flex flex-col h-screen w-screen bg-bg-primary text-text-primary">
      {/* Title Bar */}
      <TitleBar />

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Activity Bar */}
        <ActivityBar />

        {/* Sidebar */}
        {showSidebar && (
          <>
            <div style={{ width: sidebarWidth }} className="flex-shrink-0">
              <Sidebar />
            </div>
            {/* Sidebar Resizer */}
            <div
              className="resizer resizer-horizontal"
              onMouseDown={handleSidebarResizeStart}
            />
          </>
        )}

        {/* Editor + Bottom Panel */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Editor Area */}
          <div className="flex-1 overflow-hidden">
            <EditorArea />
          </div>

          {/* Bottom Panel Resizer */}
          {showBottomPanel && (
            <div
              className="resizer resizer-vertical"
              onMouseDown={handlePanelResizeStart}
            />
          )}

          {/* Bottom Panel */}
          {showBottomPanel && (
            <div style={{ height: panelHeight }} className="flex-shrink-0">
              <BottomPanel />
            </div>
          )}
        </div>
      </div>

      {/* Status Bar */}
      <StatusBar />
    </div>
  )
}
