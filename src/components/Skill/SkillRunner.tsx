import React, { useState } from 'react';
import { SkillDefinition } from '../../types';

interface SkillRunnerProps {
  skill: SkillDefinition;
}

export const SkillRunner: React.FC<SkillRunnerProps> = ({ skill }) => {
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [output, setOutput] = useState<string>('');
  const [running, setRunning] = useState(false);

  const handleInputChange = (key: string, value: string) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
  };

  const handleRun = async () => {
    setRunning(true);
    setOutput('');
    try {
      const args = Object.entries(inputs)
        .map(([key, value]) => `--${key}="${value}"`)
        .join(' ');
      const result = await window.api.skill.run(skill.name, args);
      setOutput(result);
    } catch (error) {
      setOutput(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-bg-secondary p-4">
      <div className="mb-4">
        <h2 className="text-text-primary font-semibold text-lg">{skill.name}</h2>
        <p className="text-text-secondary text-sm mt-1">{skill.description}</p>
      </div>

      {skill.inputs && Object.entries(skill.inputs).length > 0 && (
        <div className="mb-4 space-y-3">
          <h3 className="text-text-primary font-medium">Inputs</h3>
          {Object.entries(skill.inputs).map(([key, config]) => (
            <div key={key}>
              <label className="block text-text-secondary text-sm mb-1">
                {config.label || key}
                {config.required && <span className="text-red-500 ml-1">*</span>}
              </label>
              {config.type === 'textarea' ? (
                <textarea
                  value={inputs[key] || ''}
                  onChange={(e) => handleInputChange(key, e.target.value)}
                  placeholder={config.placeholder}
                  className="w-full px-3 py-2 bg-bg-surface border border-border-primary rounded text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent-blue resize-none"
                  rows={4}
                />
              ) : (
                <input
                  type={config.type || 'text'}
                  value={inputs[key] || ''}
                  onChange={(e) => handleInputChange(key, e.target.value)}
                  placeholder={config.placeholder}
                  className="w-full px-3 py-2 bg-bg-surface border border-border-primary rounded text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent-blue"
                />
              )}
            </div>
          ))}
        </div>
      )}

      <button
        onClick={handleRun}
        disabled={running}
        className="w-full px-4 py-2 bg-accent-blue text-white rounded hover:bg-opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-4"
      >
        {running ? 'Running...' : 'Run Skill'}
      </button>

      {output && (
        <div className="flex-1 overflow-auto">
          <h3 className="text-text-primary font-medium mb-2">Output</h3>
          <div className="bg-bg-surface border border-border-primary rounded p-4">
            <pre className="text-text-secondary text-sm whitespace-pre-wrap break-words">
              {output}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
