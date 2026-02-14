import { useEffect } from 'react'
import { useFileStore } from '../../store/fileStore'
import { useEditorStore } from '../../store/editorStore'
import type { FileEntry } from '../../types'

const HIDDEN_ENTRIES = new Set(['node_modules', '.git', 'out', 'dist', '.DS_Store'])

const detectLanguage = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase()
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescriptreact', js: 'javascript', jsx: 'javascriptreact',
    py: 'python', java: 'java', go: 'go', rs: 'rust', rb: 'ruby',
    html: 'html', css: 'css', scss: 'scss', json: 'json', xml: 'xml',
    yaml: 'yaml', yml: 'yaml', md: 'markdown', sql: 'sql', sh: 'shell',
    toml: 'toml', ini: 'ini', conf: 'ini',
  }
  return map[ext || ''] || 'plaintext'
}

interface FileNodeProps {
  file: FileEntry
  depth: number
}

function FileNode({ file, depth }: FileNodeProps) {
  const { expandedDirs, selectedPath, toggleDir, setSelectedPath, loadDirectory } = useFileStore()
  const { openFile } = useEditorStore()
  const isExpanded = expandedDirs.has(file.path)
  const isSelected = selectedPath === file.path
  const isDir = file.isDirectory

  const handleClick = async () => {
    setSelectedPath(file.path)
    if (isDir) {
      toggleDir(file.path)
      if (!isExpanded) {
        await loadDirectory(file.path)
      }
    } else {
      try {
        const content = await window.api.fs.readFile(file.path)
        openFile(file.path, file.name, content, detectLanguage(file.name))
      } catch (err) {
        console.error('Failed to read file:', err)
      }
    }
  }

  return (
    <div>
      <div
        className={`flex items-center py-[2px] cursor-pointer text-sm hover:bg-bg-surface ${isSelected ? 'bg-bg-surface' : ''}`}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
        onClick={handleClick}
      >
        {isDir ? (
          <span className="text-text-muted mr-1 text-[10px] w-3">{isExpanded ? '▾' : '▸'}</span>
        ) : (
          <span className="w-3 mr-1" />
        )}
        <span className="text-text-secondary truncate">{file.name}</span>
      </div>
      {isDir && isExpanded && file.children && (
        <div>
          {file.children
            .filter((c) => !HIDDEN_ENTRIES.has(c.name))
            .map((child) => (
              <FileNode key={child.path} file={child} depth={depth + 1} />
            ))}
        </div>
      )}
    </div>
  )
}

export function FileExplorer() {
  const { rootPath, files, setRootPath, loadDirectory } = useFileStore()

  // Auto-open last workspace or home directory on mount
  useEffect(() => {
    if (!rootPath) {
      window.api.app.getPath('home').then((homePath: string) => {
        setRootPath(homePath)
        loadDirectory(homePath)
      }).catch(() => {
        // fallback: do nothing, let user pick a folder
      })
    }
  }, [])

  const handleOpenFolder = async () => {
    try {
      const selectedPath = await window.api.fs.selectDirectory()
      if (selectedPath) {
        setRootPath(selectedPath)
        await loadDirectory(selectedPath)
      }
    } catch (err) {
      console.error('Failed to open folder:', err)
    }
  }

  const folderName = rootPath ? rootPath.split('/').pop() : ''

  return (
    <div className="flex flex-col h-full">
      {rootPath ? (
        <>
          <div className="px-4 py-2 text-xs text-text-muted uppercase tracking-wider flex items-center justify-between">
            <span className="truncate font-semibold">{folderName}</span>
            <button onClick={handleOpenFolder} className="text-text-muted hover:text-text-primary" title="Open Folder">
              +
            </button>
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {files
              .filter((f) => !HIDDEN_ENTRIES.has(f.name))
              .map((file) => (
                <FileNode key={file.path} file={file} depth={0} />
              ))}
          </div>
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <p className="text-text-muted text-sm mb-3">No folder open</p>
          <button
            onClick={handleOpenFolder}
            className="px-4 py-2 bg-accent-blue text-white rounded text-sm hover:bg-opacity-90"
          >
            Open Folder
          </button>
        </div>
      )}
    </div>
  )
}
