import React, { useState } from 'react';

interface Project {
  id: string;
  name: string;
  path: string;
  lastOpened: Date;
}

const mockProjects: Project[] = [
  {
    id: '1',
    name: 'ai-workstation',
    path: '/Users/jarvis/ai-workstation',
    lastOpened: new Date(),
  },
  {
    id: '2',
    name: 'personal-website',
    path: '/Users/jarvis/projects/personal-website',
    lastOpened: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  },
  {
    id: '3',
    name: 'ml-experiments',
    path: '/Users/jarvis/projects/ml-experiments',
    lastOpened: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  },
];

export const ProjectSelector: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>(mockProjects);

  const handleOpenFolder = async () => {
    try {
      const path = await window.api.fs.selectDirectory();
      if (path) {
        const name = path.split('/').pop() || 'Unknown';
        const newProject: Project = {
          id: Date.now().toString(),
          name,
          path,
          lastOpened: new Date(),
        };
        setProjects((prev) => [newProject, ...prev.filter((p) => p.path !== path)]);
        // TODO: Actually open the project
        console.log('Opening project:', path);
      }
    } catch (error) {
      console.error('Failed to open folder:', error);
    }
  };

  const handleOpenProject = (project: Project) => {
    // TODO: Open the project
    console.log('Opening project:', project.path);
    setProjects((prev) =>
      [project, ...prev.filter((p) => p.id !== project.id)].map((p, index) => ({
        ...p,
        lastOpened: index === 0 ? new Date() : p.lastOpened,
      }))
    );
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="flex flex-col h-full bg-bg-secondary">
      <div className="p-4 border-b border-border-primary">
        <h2 className="text-text-primary font-semibold mb-3">Projects</h2>
        <button
          onClick={handleOpenFolder}
          className="w-full px-3 py-2 bg-accent-blue text-white rounded hover:bg-opacity-90 transition-colors text-sm font-medium"
        >
          Open Folder
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <h3 className="text-text-secondary text-sm font-medium mb-3">Recent Projects</h3>
        {projects.length === 0 ? (
          <div className="text-text-muted text-center py-8">
            No recent projects
          </div>
        ) : (
          <div className="space-y-2">
            {projects.map((project) => (
              <div
                key={project.id}
                onClick={() => handleOpenProject(project)}
                className="bg-bg-surface border border-border-primary rounded p-3 hover:border-accent-blue transition-colors cursor-pointer"
              >
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">📁</span>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-text-primary font-medium truncate">
                      {project.name}
                    </h4>
                    <p className="text-text-muted text-xs truncate">{project.path}</p>
                  </div>
                  <span className="text-text-muted text-xs whitespace-nowrap">
                    {formatDate(project.lastOpened)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
