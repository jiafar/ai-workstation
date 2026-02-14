import React, { useState, useCallback, useEffect, useRef } from 'react'
import Editor, { OnMount } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import { useEditorStore } from '../../store/editorStore'

// Context menu component
interface ContextMenuProps {
  x: number
  y: number
  onClose: () => void
  onCloseTab: () => void
  onCloseOthers: () => void
  onCloseAll: () => void
  onSave: () => void
  canSave: boolean
}

const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  onClose,
  onCloseTab,
  onCloseOthers,
  onCloseAll,
  onSave,
  canSave,
}) => {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  return (
    <div
      ref={menuRef}
      className="fixed bg-bg-surface border border-border-primary rounded shadow-lg py-1 z-50 min-w-[160px]"
      style={{ left: x, top: y }}
    >
      <button
        onClick={() => { onSave(); onClose() }}
        disabled={!canSave}
        className="w-full px-4 py-1.5 text-left text-sm text-text-primary hover:bg-bg-hover disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Save <span className="text-text-muted ml-2">⌘S</span>
      </button>
      <div className="border-t border-border-primary my-1" />
      <button
        onClick={() => { onCloseTab(); onClose() }}
        className="w-full px-4 py-1.5 text-left text-sm text-text-primary hover:bg-bg-hover"
      >
        Close <span className="text-text-muted ml-2">⌘W</span>
      </button>
      <button
        onClick={() => { onCloseOthers(); onClose() }}
        className="w-full px-4 py-1.5 text-left text-sm text-text-primary hover:bg-bg-hover"
      >
        Close Others
      </button>
      <button
        onClick={() => { onCloseAll(); onClose() }}
        className="w-full px-4 py-1.5 text-left text-sm text-text-primary hover:bg-bg-hover"
      >
        Close All
      </button>
    </div>
  )
}

// Breadcrumb component
const Breadcrumb: React.FC<{ path: string }> = ({ path }) => {
  const parts = path.split('/').filter(Boolean)
  const fileName = parts.pop() || ''
  
  return (
    <div className="flex items-center px-3 py-1 text-xs text-text-muted bg-bg-secondary border-b border-border-primary overflow-hidden">
      {parts.map((part, index) => (
        <React.Fragment key={index}>
          <span className="truncate max-w-[100px]">{part}</span>
          <span className="mx-1">/</span>
        </React.Fragment>
      ))}
      <span className="text-text-primary font-medium truncate">{fileName}</span>
    </div>
  )
}

// Status bar component
interface StatusBarProps {
  cursorLine: number
  cursorColumn: number
  language: string
  isDirty: boolean
  isAutoSave: boolean
  onToggleAutoSave: () => void
}

const StatusBar: React.FC<StatusBarProps> = ({
  cursorLine,
  cursorColumn,
  language,
  isDirty,
  isAutoSave,
  onToggleAutoSave,
}) => {
  return (
    <div className="flex items-center justify-between px-3 py-1 text-xs bg-accent-blue text-white">
      <div className="flex items-center gap-4">
        <span>Ln {cursorLine}, Col {cursorColumn}</span>
        <span className="uppercase">{language}</span>
        {isDirty && (
          <span className="text-yellow-300">● Modified</span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleAutoSave}
          className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
            isAutoSave ? 'bg-white/20' : 'hover:bg-white/10'
          }`}
        >
          Auto Save: {isAutoSave ? 'On' : 'Off'}
        </button>
      </div>
    </div>
  )
}

export const EditorArea: React.FC = () => {
  const {
    tabs,
    activeTabId,
    autoSave,
    setActiveTab,
    closeTab,
    updateContent,
    saveActiveFile,
    saveFile,
    closeAllTabs,
    closeOtherTabs,
    toggleAutoSave,
    updateCursorPosition,
  } = useEditorStore()

  const activeTab = tabs.find((tab) => tab.id === activeTabId)
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 })
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; tabId: string } | null>(null)

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmd = e.metaKey || e.ctrlKey

      if (isCmd && e.key === 's') {
        e.preventDefault()
        saveActiveFile()
      } else if (isCmd && e.key === 'w') {
        e.preventDefault()
        if (activeTabId) {
          closeTab(activeTabId)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeTabId, saveActiveFile, closeTab])

  // Handle editor mount
  const handleEditorMount: OnMount = useCallback((editor) => {
    editorRef.current = editor

    editor.onDidChangeCursorPosition((e) => {
      setCursorPosition({
        line: e.position.lineNumber,
        column: e.position.column,
      })
      if (activeTabId) {
        updateCursorPosition(activeTabId, {
          lineNumber: e.position.lineNumber,
          column: e.position.column,
        })
      }
    })

    // Restore cursor position if exists
    if (activeTab?.cursorPosition) {
      editor.setPosition({
        lineNumber: activeTab.cursorPosition.lineNumber,
        column: activeTab.cursorPosition.column,
      })
    }
  }, [activeTabId, activeTab?.cursorPosition, updateCursorPosition])

  // Handle tab context menu
  const handleContextMenu = (e: React.MouseEvent, tabId: string) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, tabId })
  }

  const handleCloseTab = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation()
    closeTab(tabId)
  }

  // Empty state
  if (tabs.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-bg-primary">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-text-primary mb-4">AI Workstation</h1>
          <div className="text-text-muted space-y-2">
            <p>Start by opening a folder or creating a new file</p>
            <div className="mt-6 text-sm">
              <div className="font-semibold mb-2">Keyboard Shortcuts:</div>
              <div className="space-y-1">
                <div><kbd className="px-2 py-1 bg-bg-surface rounded">⌘P</kbd> Quick Open</div>
                <div><kbd className="px-2 py-1 bg-bg-surface rounded">⌘S</kbd> Save File</div>
                <div><kbd className="px-2 py-1 bg-bg-surface rounded">⌘W</kbd> Close Tab</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-bg-primary">
      {/* Tab bar */}
      <div className="flex items-center bg-bg-secondary border-b border-border-primary overflow-x-auto">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`flex items-center px-3 py-2 border-r border-border-primary cursor-pointer hover:bg-bg-surface group min-w-[120px] max-w-[200px] ${
              tab.id === activeTabId ? 'bg-bg-surface' : ''
            }`}
            onClick={() => setActiveTab(tab.id)}
            onContextMenu={(e) => handleContextMenu(e, tab.id)}
          >
            <span className="flex-1 text-text-primary text-sm truncate mr-2">{tab.name}</span>
            {tab.isDirty && (
              <span className="text-accent-blue mr-1">●</span>
            )}
            <button
              onClick={(e) => handleCloseTab(e, tab.id)}
              className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-text-primary transition-opacity"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* Breadcrumb */}
      {activeTab && <Breadcrumb path={activeTab.path} />}

      {/* Editor */}
      <div className="flex-1 relative">
        {activeTab && (
          <Editor
            height="100%"
            language={activeTab.language}
            value={activeTab.content}
            theme="vs-dark"
            onMount={handleEditorMount}
            onChange={(value) => {
              if (value !== undefined) {
                updateContent(activeTab.id, value)
              }
            }}
            options={{
              fontSize: 14,
              fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
              minimap: { enabled: true, scale: 1 },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              wordWrap: 'on',
              lineNumbers: 'on',
              renderLineHighlight: 'all',
              smoothScrolling: true,
              cursorSmoothCaretAnimation: 'on',
              formatOnPaste: true,
              formatOnType: true,
            }}
          />
        )}
      </div>

      {/* Status bar */}
      {activeTab && (
        <StatusBar
          cursorLine={cursorPosition.line}
          cursorColumn={cursorPosition.column}
          language={activeTab.language}
          isDirty={activeTab.isDirty}
          isAutoSave={autoSave}
          onToggleAutoSave={toggleAutoSave}
        />
      )}

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onCloseTab={() => closeTab(contextMenu.tabId)}
          onCloseOthers={() => closeOtherTabs(contextMenu.tabId)}
          onCloseAll={closeAllTabs}
          onSave={() => {
            const tab = tabs.find((t) => t.id === contextMenu.tabId)
            if (tab?.isDirty) {
              saveFile(contextMenu.tabId)
            }
          }}
          canSave={tabs.find((t) => t.id === contextMenu.tabId)?.isDirty || false}
        />
      )}
    </div>
  )
}
