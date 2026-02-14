import React, { useState } from 'react';

export const SearchPanel: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="flex flex-col h-full bg-bg-secondary">
      <div className="p-4 border-b border-border-primary">
        <h2 className="text-text-primary font-semibold mb-3">Search across files</h2>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search..."
          className="w-full px-3 py-2 bg-bg-surface border border-border-primary rounded text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent-blue"
        />
      </div>
      <div className="flex-1 p-4 overflow-auto">
        <div className="text-text-muted text-sm">
          {searchQuery ? 'No results found' : 'Enter a search query to find files'}
        </div>
      </div>
    </div>
  );
};
