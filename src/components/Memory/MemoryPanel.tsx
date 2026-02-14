import React, { useState } from 'react';

interface MemorySection {
  id: string;
  title: string;
  description: string;
  content: string;
}

const memorySections: MemorySection[] = [
  {
    id: 'working',
    title: 'Working Memory',
    description: 'Current session context and recent interactions',
    content: 'No active session data',
  },
  {
    id: 'project',
    title: 'Project Memory',
    description: 'Project-specific patterns, decisions, and conventions',
    content: 'Open a project to view project memory',
  },
  {
    id: 'personal',
    title: 'Personal Memory',
    description: 'Your preferences, habits, and personalized settings',
    content: 'No personal preferences configured',
  },
  {
    id: 'knowledge',
    title: 'Knowledge Base',
    description: 'Accumulated knowledge and documentation',
    content: 'Knowledge base is empty',
  },
];

export const MemoryPanel: React.FC = () => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['working']));

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const handleLoadSession = async () => {
    try {
      await window.api.memory.loadSession();
      console.log('Session loaded');
    } catch (error) {
      console.error('Failed to load session:', error);
    }
  };

  const handleCompress = async () => {
    try {
      await window.api.memory.compress();
      console.log('Memory compressed');
    } catch (error) {
      console.error('Failed to compress memory:', error);
    }
  };

  return (
    <div className="flex flex-col h-full bg-bg-secondary">
      <div className="p-4 border-b border-border-primary">
        <h2 className="text-text-primary font-semibold mb-3">Memory System</h2>
        <div className="flex space-x-2">
          <button
            onClick={handleLoadSession}
            className="flex-1 px-3 py-2 bg-accent-blue text-white rounded hover:bg-opacity-90 transition-colors text-sm"
          >
            Load Session
          </button>
          <button
            onClick={handleCompress}
            className="flex-1 px-3 py-2 bg-bg-surface text-text-primary border border-border-primary rounded hover:bg-bg-primary transition-colors text-sm"
          >
            Compress
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-3">
        {memorySections.map((section) => {
          const isExpanded = expandedSections.has(section.id);
          return (
            <div key={section.id} className="bg-bg-surface rounded border border-border-primary">
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-bg-primary transition-colors"
              >
                <div className="text-left">
                  <div className="text-text-primary font-medium">{section.title}</div>
                  <div className="text-text-muted text-xs">{section.description}</div>
                </div>
                <span className="text-text-muted">{isExpanded ? '▼' : '▶'}</span>
              </button>
              {isExpanded && (
                <div className="px-4 py-3 border-t border-border-primary">
                  <div className="text-text-secondary text-sm">{section.content}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
