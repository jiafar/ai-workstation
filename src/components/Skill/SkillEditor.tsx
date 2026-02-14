import React, { useState } from 'react';
import { SkillDefinition } from '../../types';

interface SkillFormData extends Partial<SkillDefinition> {
  prompt?: string;
  shortcut?: string;
}

interface SkillEditorProps {
  skill?: SkillDefinition;
  onSave?: (skill: SkillDefinition) => void;
  onCancel?: () => void;
}

export const SkillEditor: React.FC<SkillEditorProps> = ({ skill, onSave, onCancel }) => {
  const [formData, setFormData] = useState<SkillFormData>(
    skill
      ? { ...skill, shortcut: skill.trigger?.shortcut }
      : {
          name: '',
          description: '',
          category: 'general',
          prompt: '',
          tags: [],
        }
  );

  const handleChange = (field: keyof SkillFormData, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    if (onSave && formData.name && formData.description && formData.prompt) {
      const { prompt, shortcut, ...rest } = formData;
      const definition: SkillDefinition = {
        ...rest,
        promptFile: prompt,
        trigger: { ...rest.trigger, shortcut },
      } as SkillDefinition;
      onSave(definition);
    }
  };

  return (
    <div className="flex flex-col h-full bg-bg-secondary p-4">
      <div className="mb-4">
        <h2 className="text-text-primary font-semibold text-lg">
          {skill ? 'Edit Skill' : 'Create New Skill'}
        </h2>
      </div>

      <div className="flex-1 overflow-auto space-y-4">
        <div>
          <label className="block text-text-secondary text-sm mb-1">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.name || ''}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="skill-name"
            className="w-full px-3 py-2 bg-bg-surface border border-border-primary rounded text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent-blue"
          />
        </div>

        <div>
          <label className="block text-text-secondary text-sm mb-1">
            Description <span className="text-red-500">*</span>
          </label>
          <textarea
            value={formData.description || ''}
            onChange={(e) => handleChange('description', e.target.value)}
            placeholder="What does this skill do?"
            className="w-full px-3 py-2 bg-bg-surface border border-border-primary rounded text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent-blue resize-none"
            rows={2}
          />
        </div>

        <div>
          <label className="block text-text-secondary text-sm mb-1">Category</label>
          <select
            value={formData.category || 'general'}
            onChange={(e) => handleChange('category', e.target.value)}
            className="w-full px-3 py-2 bg-bg-surface border border-border-primary rounded text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-blue"
          >
            <option value="general">General</option>
            <option value="code">Code</option>
            <option value="data">Data</option>
            <option value="documentation">Documentation</option>
            <option value="testing">Testing</option>
          </select>
        </div>

        <div>
          <label className="block text-text-secondary text-sm mb-1">
            Tags <span className="text-text-muted text-xs">(comma-separated)</span>
          </label>
          <input
            type="text"
            value={formData.tags?.join(', ') || ''}
            onChange={(e) => handleChange('tags', e.target.value.split(',').map((t) => t.trim()))}
            placeholder="tag1, tag2, tag3"
            className="w-full px-3 py-2 bg-bg-surface border border-border-primary rounded text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent-blue"
          />
        </div>

        <div>
          <label className="block text-text-secondary text-sm mb-1">Keyboard Shortcut</label>
          <input
            type="text"
            value={formData.shortcut || ''}
            onChange={(e) => handleChange('shortcut', e.target.value)}
            placeholder="Cmd+Shift+S"
            className="w-full px-3 py-2 bg-bg-surface border border-border-primary rounded text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent-blue"
          />
        </div>

        <div>
          <label className="block text-text-secondary text-sm mb-1">
            Prompt Template <span className="text-red-500">*</span>
          </label>
          <textarea
            value={formData.prompt || ''}
            onChange={(e) => handleChange('prompt', e.target.value)}
            placeholder="Enter the AI prompt template..."
            className="w-full px-3 py-2 bg-bg-surface border border-border-primary rounded text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent-blue resize-none font-mono text-sm"
            rows={12}
          />
        </div>
      </div>

      <div className="flex space-x-3 mt-4 pt-4 border-t border-border-primary">
        <button
          onClick={handleSave}
          disabled={!formData.name || !formData.description || !formData.prompt}
          className="flex-1 px-4 py-2 bg-accent-blue text-white rounded hover:bg-opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Save Skill
        </button>
        {onCancel && (
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 bg-bg-surface text-text-primary border border-border-primary rounded hover:bg-bg-primary transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
};
