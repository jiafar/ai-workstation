import React from 'react';
import { WorkflowStep } from '../../types';

interface StepNodeProps {
  step: WorkflowStep;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending':
      return 'border-border-primary bg-bg-surface';
    case 'running':
      return 'border-accent-blue bg-bg-surface';
    case 'completed':
      return 'border-green-500 bg-green-500 bg-opacity-10';
    case 'failed':
      return 'border-red-500 bg-red-500 bg-opacity-10';
    default:
      return 'border-border-primary bg-bg-surface';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'pending':
      return '⏸';
    case 'running':
      return '▶';
    case 'completed':
      return '✓';
    case 'failed':
      return '✗';
    default:
      return '○';
  }
};

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'skill':
      return '⚡';
    case 'api':
      return '🌐';
    case 'condition':
      return '🔀';
    case 'loop':
      return '🔄';
    default:
      return '📦';
  }
};

export const StepNode: React.FC<StepNodeProps> = ({ step, status }) => {
  return (
    <div className={`border-2 rounded-lg p-4 ${getStatusColor(status)}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <span className="text-xl">{getTypeIcon(step.type)}</span>
          <span className="text-text-primary font-medium">{step.name}</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-lg">{getStatusIcon(status)}</span>
          <span className="text-xs text-text-muted uppercase">{status}</span>
        </div>
      </div>

      {step.skillName && (
        <div className="text-text-secondary text-sm mt-2">
          Skill: <span className="text-accent-blue">{step.skillName}</span>
        </div>
      )}

      {step.config && Object.keys(step.config).length > 0 && (
        <div className="mt-2 text-xs text-text-muted">
          {Object.keys(step.config).length} configuration{Object.keys(step.config).length !== 1 ? 's' : ''}
        </div>
      )}

      {step.outputVariable && (
        <div className="text-text-muted text-xs mt-2">
          Output: <span className="text-text-secondary">{step.outputVariable}</span>
        </div>
      )}
    </div>
  );
};
