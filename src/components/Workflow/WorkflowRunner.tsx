import React, { useState, useEffect } from 'react';
import { WorkflowDefinition } from '../../types';
import { StepNode } from './StepNode';

interface WorkflowRunnerProps {
  workflow: WorkflowDefinition;
}

interface StepStatus {
  stepId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  output?: string;
  error?: string;
}

export const WorkflowRunner: React.FC<WorkflowRunnerProps> = ({ workflow }) => {
  const [stepStatuses, setStepStatuses] = useState<Map<string, StepStatus>>(new Map());
  const [logs] = useState<string[]>([]);

  useEffect(() => {
    // Initialize step statuses
    const initialStatuses = new Map<string, StepStatus>();
    workflow.steps.forEach((step) => {
      initialStatuses.set(step.id, { stepId: step.id, status: 'pending' });
    });
    setStepStatuses(initialStatuses);

    // TODO: Subscribe to workflow execution updates
    // This would listen to real-time updates from the backend
  }, [workflow]);

  return (
    <div className="flex flex-col h-full bg-bg-secondary">
      <div className="p-4 border-b border-border-primary">
        <h2 className="text-text-primary font-semibold">{workflow.name}</h2>
        <p className="text-text-secondary text-sm mt-1">Execution in progress...</p>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="p-4">
          <h3 className="text-text-primary font-medium mb-3">Steps</h3>
          <div className="space-y-4">
            {workflow.steps.map((step, index) => {
              const status = stepStatuses.get(step.id)?.status || 'pending';
              return (
                <div key={step.id} className="relative">
                  <StepNode step={step} status={status} />
                  {index < workflow.steps.length - 1 && (
                    <div className="flex justify-center my-2">
                      <div className="w-0.5 h-8 bg-border-primary"></div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-4 border-t border-border-primary">
          <h3 className="text-text-primary font-medium mb-3">Execution Log</h3>
          <div className="bg-bg-primary rounded border border-border-primary p-4 h-48 overflow-auto">
            {logs.length === 0 ? (
              <div className="text-text-muted text-sm">No logs yet...</div>
            ) : (
              <div className="space-y-1">
                {logs.map((log, index) => (
                  <div key={index} className="text-text-secondary text-sm font-mono">
                    {log}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
