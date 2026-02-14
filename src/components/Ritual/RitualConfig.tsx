import React, { useState, useEffect } from 'react';

interface Ritual {
  id: string;
  name: string;
  description: string;
  schedule: string;
  enabled: boolean;
  type: 'morning' | 'evening' | 'trigger';
}

const mockRituals: Ritual[] = [
  {
    id: 'morning-sync',
    name: 'Morning Sync',
    description: 'Daily morning routine: check calendar, review tasks, sync git repos',
    schedule: '8:00 AM daily',
    enabled: true,
    type: 'morning',
  },
  {
    id: 'evening-review',
    name: 'Evening Review',
    description: 'End of day review: summarize work, update progress, prepare for tomorrow',
    schedule: '6:00 PM daily',
    enabled: true,
    type: 'evening',
  },
  {
    id: 'commit-ritual',
    name: 'Pre-Commit Check',
    description: 'Run tests and linting before each commit',
    schedule: 'On git commit',
    enabled: false,
    type: 'trigger',
  },
];

export const RitualConfig: React.FC = () => {
  const [rituals, setRituals] = useState<Ritual[]>(mockRituals);

  const toggleRitual = (ritualId: string) => {
    setRituals((prev) =>
      prev.map((ritual) =>
        ritual.id === ritualId ? { ...ritual, enabled: !ritual.enabled } : ritual
      )
    );
  };

  const getRitualIcon = (type: string) => {
    switch (type) {
      case 'morning':
        return '🌅';
      case 'evening':
        return '🌙';
      case 'trigger':
        return '⚡';
      default:
        return '📅';
    }
  };

  return (
    <div className="flex flex-col h-full bg-bg-secondary">
      <div className="p-4 border-b border-border-primary">
        <h2 className="text-text-primary font-semibold">Ritual Configuration</h2>
        <p className="text-text-muted text-sm mt-1">Automate your daily routines</p>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-3">
        {rituals.map((ritual) => (
          <div
            key={ritual.id}
            className="bg-bg-surface border border-border-primary rounded p-4"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3 flex-1">
                <span className="text-2xl">{getRitualIcon(ritual.type)}</span>
                <div className="flex-1">
                  <h3 className="text-text-primary font-medium">{ritual.name}</h3>
                  <p className="text-text-secondary text-sm mt-1">{ritual.description}</p>
                  <div className="flex items-center space-x-4 mt-2">
                    <span className="text-xs text-text-muted">
                      Schedule: {ritual.schedule}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => toggleRitual(ritual.id)}
                className={`ml-4 px-4 py-1 rounded text-sm transition-colors ${
                  ritual.enabled
                    ? 'bg-green-500 text-white hover:bg-green-600'
                    : 'bg-bg-primary text-text-muted hover:bg-bg-surface'
                }`}
              >
                {ritual.enabled ? 'Enabled' : 'Disabled'}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-border-primary">
        <button className="w-full px-4 py-2 bg-accent-blue text-white rounded hover:bg-opacity-90 transition-colors">
          Create New Ritual
        </button>
      </div>
    </div>
  );
};
