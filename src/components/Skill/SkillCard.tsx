import React from 'react';
import { SkillDefinition } from '../../types';

interface SkillCardProps {
  skill: SkillDefinition;
  onRun: () => void;
}

export const SkillCard: React.FC<SkillCardProps> = ({ skill, onRun }) => {
  return (
    <div className="bg-bg-surface border border-border-primary rounded p-4 hover:border-accent-blue transition-colors">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <h3 className="text-text-primary font-semibold">{skill.name}</h3>
          <p className="text-text-secondary text-sm mt-1">{skill.description}</p>
        </div>
        <button
          onClick={onRun}
          className="ml-4 px-4 py-1 bg-accent-blue text-white rounded text-sm hover:bg-opacity-90 transition-colors"
        >
          Run
        </button>
      </div>

      <div className="flex items-center space-x-4 mt-3">
        <span className="text-xs px-2 py-1 bg-bg-primary text-text-muted rounded">
          {skill.category}
        </span>
        {skill.tags && skill.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {skill.tags.map((tag) => (
              <span key={tag} className="text-xs px-2 py-1 bg-bg-primary text-text-muted rounded">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {skill.trigger?.shortcut && (
        <div className="mt-3 text-xs text-text-muted">
          Shortcut: <kbd className="px-2 py-1 bg-bg-primary rounded">{skill.trigger.shortcut}</kbd>
        </div>
      )}
    </div>
  );
};
