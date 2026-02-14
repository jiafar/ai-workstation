import React from 'react';
import Editor from '@monaco-editor/react';
import { useEditorStore } from '../../store/editorStore';

export const EditorArea: React.FC = () => {
  const { tabs, activeTabId, setActiveTab, closeTab, updateContent } = useEditorStore();
  const activeTab = tabs.find((tab) => tab.id === activeTabId);

  const handleCloseTab = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    closeTab(tabId);
  };

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
                <div><kbd className="px-2 py-1 bg-bg-surface rounded">Cmd+P</kbd> Quick Open</div>
                <div><kbd className="px-2 py-1 bg-bg-surface rounded">Cmd+S</kbd> Save File</div>
                <div><kbd className="px-2 py-1 bg-bg-surface rounded">Cmd+W</kbd> Close Tab</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-bg-primary">
      <div className="flex items-center bg-bg-secondary border-b border-border-primary overflow-x-auto">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`flex items-center px-4 py-2 border-r border-border-primary cursor-pointer hover:bg-bg-surface ${
              tab.id === activeTabId ? 'bg-bg-surface' : ''
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="text-text-primary text-sm mr-2">{tab.name}</span>
            {tab.isDirty && <span className="text-accent-blue mr-2">●</span>}
            <button
              onClick={(e) => handleCloseTab(e, tab.id)}
              className="ml-2 text-text-muted hover:text-text-primary"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <div className="flex-1">
        {activeTab && (
          <Editor
            height="100%"
            language={activeTab.language}
            value={activeTab.content}
            theme="vs-dark"
            onChange={(value) => {
              if (value !== undefined) {
                updateContent(activeTab.id, value);
              }
            }}
            options={{
              fontSize: 14,
              minimap: { enabled: true },
              scrollBeyondLastLine: false,
              automaticLayout: true,
            }}
          />
        )}
      </div>
    </div>
  );
};
