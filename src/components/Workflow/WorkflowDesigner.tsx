import React from 'react';
import { WorkflowDefinition } from '../../types';
import { StepNode } from './StepNode';

interface WorkflowDesignerProps {
  workflow: WorkflowDefinition;
}

export const WorkflowDesigner: React.FC<WorkflowDesignerProps> = ({ workflow }) => {
  return (
    <div className="flex flex-col h-full bg-bg-secondary p-4">
      <div className="mb-4">
        <h2 className="text-text-primary font-semibold text-lg">{workflow.name}</h2>
        <p className="text-text-secondary text-sm mt-1">{workflow.description}</p>
      </div>

      <div className="flex-1 overflow-auto bg-bg-primary rounded border border-border-primary p-6">
        <div className="space-y-4">
          {workflow.steps.map((step, index) => (
            <div key={step.id} className="relative">
              <StepNode step={step} status="pending" />
              {index < workflow.steps.length - 1 && (
                <div className="flex justify-center my-2">
                  <div className="w-0.5 h-8 bg-border-primary"></div>
                </div>
              )}
            </div>
          ))}
        </div>

        {workflow.steps.length === 0 && (
          <div className="text-text-muted text-center py-12">
            No steps defined. Add steps to create your workflow.
          </div>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-border-primary">
        <button className="w-full px-4 py-2 bg-accent-blue text-white rounded hover:bg-opacity-90 transition-colors">
          Save Workflow
        </button>
      </div>
    </div>
  );
};
