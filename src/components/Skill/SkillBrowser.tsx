import React, { useState, useEffect } from 'react';
import { SkillDefinition } from '../../types';
import { SkillCard } from './SkillCard';

export const SkillBrowser: React.FC = () => {
  const [skills, setSkills] = useState<SkillDefinition[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSkills();
  }, []);

  const loadSkills = async () => {
    try {
      const skillList = await window.api.skill.list();
      setSkills(skillList);
    } catch (error) {
      console.error('Failed to load skills:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredSkills = skills.filter((skill) => {
    const query = searchQuery.toLowerCase();
    return (
      skill.name.toLowerCase().includes(query) ||
      skill.description.toLowerCase().includes(query) ||
      skill.category.toLowerCase().includes(query) ||
      skill.tags?.some((tag) => tag.toLowerCase().includes(query))
    );
  });

  const handleRunSkill = async (skill: SkillDefinition) => {
    try {
      await window.api.skill.run(skill.name, '');
      console.log(`Skill ${skill.name} executed`);
    } catch (error) {
      console.error(`Failed to run skill ${skill.name}:`, error);
    }
  };

  const handleCreateSkill = () => {
    console.log('Create new skill');
    // TODO: Open skill editor modal or panel
  };

  return (
    <div className="flex flex-col h-full bg-bg-secondary">
      <div className="p-4 border-b border-border-primary">
        <h2 className="text-text-primary font-semibold mb-3">Skill Browser</h2>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search skills..."
          className="w-full px-3 py-2 bg-bg-surface border border-border-primary rounded text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent-blue mb-3"
        />
        <button
          onClick={handleCreateSkill}
          className="w-full px-3 py-2 bg-accent-blue text-white rounded hover:bg-opacity-90 transition-colors text-sm font-medium"
        >
          Create Skill
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="text-text-muted text-center py-8">Loading skills...</div>
        ) : filteredSkills.length === 0 ? (
          <div className="text-text-muted text-center py-8">
            {searchQuery ? 'No skills found matching your search' : 'No skills available'}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredSkills.map((skill) => (
              <SkillCard key={skill.name} skill={skill} onRun={() => handleRunSkill(skill)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
