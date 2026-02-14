import React from 'react';

export const GitPanel: React.FC = () => {
  return (
    <div className="flex flex-col h-full bg-bg-secondary">
      <div className="p-4 border-b border-border-primary">
        <h2 className="text-text-primary font-semibold">Git</h2>
      </div>
      <div className="flex-1 p-4 overflow-auto">
        <div className="mb-4">
          <h3 className="text-text-secondary font-medium mb-2">Changes</h3>
          <div className="text-text-muted text-sm">
            Open a project to view git status
          </div>
        </div>
      </div>
    </div>
  );
};
