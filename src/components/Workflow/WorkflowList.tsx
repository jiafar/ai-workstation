import React, { useState, useEffect } from 'react';
import { WorkflowDefinition } from '../../types';

export const WorkflowList: React.FC = () => {
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWorkflows();
  }, []);

  const loadWorkflows = async () => {
    try {
      const workflowList = await window.api.workflow.list();
      setWorkflows(workflowList);
    } catch (error) {
      console.error('Failed to load workflows:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRunWorkflow = async (workflowId: string) => {
    try {
      await window.api.workflow.run(workflowId);
      console.log(`Workflow ${workflowId} started`);
    } catch (error) {
      console.error(`Failed to run workflow ${workflowId}:`, error);
    }
  };

  return (
    <div className="flex flex-col h-full bg-bg-secondary">
      <div className="p-4 border-b border-border-primary">
        <h2 className="text-text-primary font-semibold">Workflows</h2>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="text-text-muted text-center py-8">Loading workflows...</div>
        ) : workflows.length === 0 ? (
          <div className="text-text-muted text-center py-8">No workflows available</div>
        ) : (
          <div className="space-y-3">
            {workflows.map((workflow) => (
              <div
                key={workflow.id}
                className="bg-bg-surface border border-border-primary rounded p-4 hover:border-accent-blue transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h3 className="text-text-primary font-semibold">{workflow.name}</h3>
                    <p className="text-text-secondary text-sm mt-1">{workflow.description}</p>
                  </div>
                  <button
                    onClick={() => handleRunWorkflow(workflow.id)}
                    className="ml-4 px-4 py-1 bg-accent-blue text-white rounded text-sm hover:bg-opacity-90 transition-colors"
                  >
                    Run
                  </button>
                </div>

                {workflow.trigger && (
                  <div className="mt-3 text-xs text-text-muted">
                    Trigger: <span className="text-text-secondary">{workflow.trigger.type}</span>
                    {workflow.trigger.schedule && (
                      <span> - {workflow.trigger.schedule}</span>
                    )}
                  </div>
                )}

                <div className="mt-2 text-xs text-text-muted">
                  Steps: {workflow.steps.length}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
