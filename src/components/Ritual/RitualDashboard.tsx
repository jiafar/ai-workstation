import React, { useState } from 'react';

interface RitualExecution {
  id: string;
  name: string;
  lastRun?: Date;
  nextRun?: Date;
  status: 'idle' | 'running' | 'completed' | 'failed';
  type: 'morning' | 'evening' | 'trigger';
}

const mockExecutions: RitualExecution[] = [
  {
    id: 'morning-sync',
    name: 'Morning Sync',
    lastRun: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    nextRun: new Date(Date.now() + 22 * 60 * 60 * 1000), // tomorrow morning
    status: 'completed',
    type: 'morning',
  },
  {
    id: 'evening-review',
    name: 'Evening Review',
    nextRun: new Date(Date.now() + 4 * 60 * 60 * 1000), // in 4 hours
    status: 'idle',
    type: 'evening',
  },
];

export const RitualDashboard: React.FC = () => {
  const [executions, setExecutions] = useState<RitualExecution[]>(mockExecutions);
  const [runningRitual, setRunningRitual] = useState<string | null>(null);

  const handleManualTrigger = async (ritualId: string) => {
    setRunningRitual(ritualId);
    setExecutions((prev) =>
      prev.map((exec) =>
        exec.id === ritualId ? { ...exec, status: 'running' as const } : exec
      )
    );

    // Simulate ritual execution
    setTimeout(() => {
      setExecutions((prev) =>
        prev.map((exec) =>
          exec.id === ritualId
            ? { ...exec, status: 'completed' as const, lastRun: new Date() }
            : exec
        )
      );
      setRunningRitual(null);
    }, 3000);
  };

  const formatTime = (date?: Date) => {
    if (!date) return 'Never';
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const absDiff = Math.abs(diff);
    const minutes = Math.floor(absDiff / (1000 * 60));
    const hours = Math.floor(absDiff / (1000 * 60 * 60));

    if (diff < 0) {
      if (minutes < 60) return `${minutes}m ago`;
      if (hours < 24) return `${hours}h ago`;
      return date.toLocaleDateString();
    } else {
      if (minutes < 60) return `in ${minutes}m`;
      if (hours < 24) return `in ${hours}h`;
      return date.toLocaleDateString();
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'text-accent-blue';
      case 'completed':
        return 'text-green-500';
      case 'failed':
        return 'text-red-500';
      default:
        return 'text-text-muted';
    }
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
        <h2 className="text-text-primary font-semibold">Ritual Dashboard</h2>
        <p className="text-text-muted text-sm mt-1">Monitor and trigger your rituals</p>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {runningRitual && (
          <div className="mb-4 bg-accent-blue bg-opacity-10 border border-accent-blue rounded p-4">
            <div className="flex items-center space-x-2">
              <span className="animate-spin">⚙️</span>
              <span className="text-accent-blue font-medium">
                Running: {executions.find((e) => e.id === runningRitual)?.name}
              </span>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {executions.map((execution) => (
            <div
              key={execution.id}
              className="bg-bg-surface border border-border-primary rounded p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{getRitualIcon(execution.type)}</span>
                  <div>
                    <h3 className="text-text-primary font-medium">{execution.name}</h3>
                    <span className={`text-xs uppercase ${getStatusColor(execution.status)}`}>
                      {execution.status}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleManualTrigger(execution.id)}
                  disabled={execution.status === 'running'}
                  className="px-4 py-1 bg-accent-blue text-white rounded text-sm hover:bg-opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Trigger Now
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-text-muted">Last Run</div>
                  <div className="text-text-secondary">{formatTime(execution.lastRun)}</div>
                </div>
                <div>
                  <div className="text-text-muted">Next Run</div>
                  <div className="text-text-secondary">{formatTime(execution.nextRun)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
