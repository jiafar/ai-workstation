import React, { useEffect } from 'react';
import { useFileStore } from '../../store/fileStore';
import { useEditorStore } from '../../store/editorStore';
import { FileEntry } from '../../types';

interface FileNodeProps {
  file: FileEntry;
  depth: number;
}

const detectLanguage = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase();
  const languageMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    py: 'python',
    java: 'java',
    cpp: 'cpp',
    c: 'c',
    cs: 'csharp',
    go: 'go',
    rs: 'rust',
    rb: 'ruby',
    php: 'php',
    swift: 'swift',
    kt: 'kotlin',
    scala: 'scala',
    html: 'html',
    css: 'css',
    scss: 'scss',
    json: 'json',
    xml: 'xml',
    yaml: 'yaml',
    yml: 'yaml',
    md: 'markdown',
    sql: 'sql',
    sh: 'shell',
    bash: 'shell',
    zsh: 'shell',
  };
  return languageMap[ext || ''] || 'plaintext';
};

export const FileNode: React.FC<FileNodeProps> = ({ file, depth }) => {
  const { expandedDirs, selectedPath, toggleDir, setSelectedPath, loadDirectory } = useFileStore();
  const { openFile } = useEditorStore();
  const isExpanded = expandedDirs.has(file.path);
  const isSelected = selectedPath === file.path;

  const handleClick = async () => {
    setSelectedPath(file.path);

    if (file.type === 'directory') {
      toggleDir(file.path);
      if (!isExpanded && (!file.children || file.children.length === 0)) {
        await loadDirectory(file.path);
      }
    } else {
      // Open file in editor
      try {
        const content = await window.api.fs.readFile(file.path);
        const language = detectLanguage(file.name);
        openFile(file.path, file.name, content, language);
      } catch (error) {
        console.error('Failed to read file:', error);
      }
    }
  };

  return (
    <div>
      <div
        className={`flex items-center px-2 py-1 cursor-pointer hover:bg-bg-surface ${
          isSelected ? 'bg-bg-surface' : ''
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={handleClick}
      >
        {file.type === 'directory' && (
          <span className="mr-1 text-text-muted">
            {isExpanded ? '▼' : '▶'}
          </span>
        )}
        <span className="mr-2 text-text-muted">
          {file.type === 'directory' ? '📁' : '📄'}
        </span>
        <span className="text-text-primary text-sm">{file.name}</span>
      </div>
      {file.type === 'directory' && isExpanded && file.children && (
        <div>
          {file.children.map((child) => (
            <FileNode key={child.path} file={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

export const FileExplorer: React.FC = () => {
  const { rootPath, files, setRootPath, loadDirectory } = useFileStore();

  const handleOpenFolder = async () => {
    try {
      const path = await window.api.fs.selectDirectory();
      if (path) {
        setRootPath(path);
        await loadDirectory(path);
      }
    } catch (error) {
      console.error('Failed to open folder:', error);
    }
  };

  return (
    <div className="flex flex-col h-full bg-bg-secondary">
      <div className="p-3 border-b border-border-primary">
        <button
          onClick={handleOpenFolder}
          className="w-full px-3 py-2 bg-accent-blue text-white rounded hover:bg-opacity-90 transition-colors text-sm font-medium"
        >
          Open Folder
        </button>
      </div>
      <div className="flex-1 overflow-auto">
        {rootPath ? (
          <div className="py-2">
            {files.map((file) => (
              <FileNode key={file.path} file={file} depth={0} />
            ))}
          </div>
        ) : (
          <div className="p-4 text-text-muted text-sm text-center">
            No folder open
          </div>
        )}
      </div>
    </div>
  );
};
