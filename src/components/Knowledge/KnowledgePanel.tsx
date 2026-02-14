import React, { useState } from 'react';

interface KnowledgeEntry {
  id: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: Date;
  similarity?: number;
}

const mockEntries: KnowledgeEntry[] = [
  {
    id: '1',
    title: 'TypeScript Best Practices',
    content: 'Always use strict mode, prefer interfaces over types for objects...',
    tags: ['typescript', 'coding', 'best-practices'],
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  },
  {
    id: '2',
    title: 'React Hooks Patterns',
    content: 'Common patterns for useState, useEffect, and custom hooks...',
    tags: ['react', 'hooks', 'patterns'],
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
  },
  {
    id: '3',
    title: 'API Design Guidelines',
    content: 'RESTful API design principles, versioning strategies...',
    tags: ['api', 'architecture', 'design'],
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
  },
];

export const KnowledgePanel: React.FC = () => {
  const [entries, setEntries] = useState<KnowledgeEntry[]>(mockEntries);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddNote, setShowAddNote] = useState(false);
  const [newNote, setNewNote] = useState({ title: '', content: '', tags: '' });

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setEntries(mockEntries);
      return;
    }

    // TODO: Implement semantic search via window.api.knowledge.search()
    const filtered = mockEntries.filter(
      (entry) =>
        entry.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    );
    setEntries(filtered);
  };

  const handleAddNote = () => {
    if (newNote.title.trim() && newNote.content.trim()) {
      const entry: KnowledgeEntry = {
        id: Date.now().toString(),
        title: newNote.title.trim(),
        content: newNote.content.trim(),
        tags: newNote.tags
          .split(',')
          .map((t) => t.trim())
          .filter((t) => t),
        createdAt: new Date(),
      };
      setEntries((prev) => [entry, ...prev]);
      setNewNote({ title: '', content: '', tags: '' });
      setShowAddNote(false);
    }
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="flex flex-col h-full bg-bg-secondary">
      <div className="p-4 border-b border-border-primary">
        <h2 className="text-text-primary font-semibold mb-3">Knowledge Base</h2>
        <div className="space-y-2">
          <div className="flex space-x-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Semantic search..."
              className="flex-1 px-3 py-2 bg-bg-surface border border-border-primary rounded text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent-blue"
            />
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-accent-blue text-white rounded hover:bg-opacity-90 transition-colors"
            >
              Search
            </button>
          </div>
          <button
            onClick={() => setShowAddNote(!showAddNote)}
            className="w-full px-3 py-2 bg-bg-surface text-text-primary border border-border-primary rounded hover:bg-bg-primary transition-colors text-sm"
          >
            Add Note
          </button>
        </div>
      </div>

      {showAddNote && (
        <div className="p-4 border-b border-border-primary bg-bg-surface space-y-2">
          <input
            type="text"
            value={newNote.title}
            onChange={(e) => setNewNote((prev) => ({ ...prev, title: e.target.value }))}
            placeholder="Title..."
            className="w-full px-3 py-2 bg-bg-primary border border-border-primary rounded text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent-blue"
          />
          <textarea
            value={newNote.content}
            onChange={(e) => setNewNote((prev) => ({ ...prev, content: e.target.value }))}
            placeholder="Content..."
            className="w-full px-3 py-2 bg-bg-primary border border-border-primary rounded text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent-blue resize-none"
            rows={4}
          />
          <input
            type="text"
            value={newNote.tags}
            onChange={(e) => setNewNote((prev) => ({ ...prev, tags: e.target.value }))}
            placeholder="Tags (comma-separated)..."
            className="w-full px-3 py-2 bg-bg-primary border border-border-primary rounded text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent-blue"
          />
          <div className="flex space-x-2">
            <button
              onClick={handleAddNote}
              className="flex-1 px-3 py-1 bg-accent-blue text-white rounded text-sm hover:bg-opacity-90"
            >
              Add
            </button>
            <button
              onClick={() => {
                setShowAddNote(false);
                setNewNote({ title: '', content: '', tags: '' });
              }}
              className="flex-1 px-3 py-1 bg-bg-primary text-text-primary rounded text-sm hover:bg-bg-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto p-4 space-y-3">
        {entries.length === 0 ? (
          <div className="text-text-muted text-center py-8">
            {searchQuery ? 'No entries found' : 'No knowledge entries yet'}
          </div>
        ) : (
          entries.map((entry) => (
            <div
              key={entry.id}
              className="bg-bg-surface border border-border-primary rounded p-4 hover:border-accent-blue transition-colors cursor-pointer"
            >
              <h3 className="text-text-primary font-medium mb-2">{entry.title}</h3>
              <p className="text-text-secondary text-sm line-clamp-2 mb-3">
                {entry.content}
              </p>
              <div className="flex items-center justify-between">
                <div className="flex flex-wrap gap-1">
                  {entry.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs px-2 py-1 bg-bg-primary text-text-muted rounded"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <span className="text-xs text-text-muted">{formatDate(entry.createdAt)}</span>
              </div>
              {entry.similarity !== undefined && (
                <div className="mt-2 text-xs text-accent-blue">
                  Similarity: {(entry.similarity * 100).toFixed(0)}%
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
