import React, { useEffect, useState } from 'react'
import { useConfigStore, type AppConfig } from '../../store/configStore'

interface ConfigPanelProps {
  onClose?: () => void
}

type ConfigSection = 'ai' | 'ui' | 'editor' | 'terminal' | 'workspace' | 'memory'

export const ConfigPanel: React.FC<ConfigPanelProps> = ({ onClose }) => {
  const { config, loadConfig, updateSection, isLoading } = useConfigStore()
  const [activeSection, setActiveSection] = useState<ConfigSection>('ai')

  useEffect(() => {
    loadConfig()
  }, [loadConfig])

  if (isLoading || !config) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400">加载配置中...</div>
      </div>
    )
  }

  const handleUpdate = async (section: ConfigSection, updates: Record<string, unknown>) => {
    await updateSection(section, updates)
  }

  const sections: { id: ConfigSection; label: string; icon: string }[] = [
    { id: 'ai', label: 'AI 设置', icon: '🤖' },
    { id: 'ui', label: '界面', icon: '🎨' },
    { id: 'editor', label: '编辑器', icon: '📝' },
    { id: 'terminal', label: '终端', icon: '💻' },
    { id: 'workspace', label: '工作区', icon: '📁' },
    { id: 'memory', label: '记忆', icon: '🧠' },
  ]

  return (
    <div className="flex h-full bg-[#1e1e2e] text-gray-200">
      {/* Sidebar */}
      <div className="w-48 border-r border-gray-700 p-2">
        <div className="flex items-center justify-between mb-4 px-2">
          <span className="font-semibold">设置</span>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          )}
        </div>
        {sections.map((section) => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded mb-1 transition-colors ${
              activeSection === section.id
                ? 'bg-blue-600 text-white'
                : 'hover:bg-gray-700'
            }`}
          >
            <span>{section.icon}</span>
            <span>{section.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 p-6 overflow-auto">
        {activeSection === 'ai' && (
          <AIConfigSection config={config.ai} onUpdate={(updates) => handleUpdate('ai', updates)} />
        )}
        {activeSection === 'ui' && (
          <UIConfigSection config={config.ui} onUpdate={(updates) => handleUpdate('ui', updates)} />
        )}
        {activeSection === 'editor' && (
          <EditorConfigSection config={config.editor} onUpdate={(updates) => handleUpdate('editor', updates)} />
        )}
        {activeSection === 'terminal' && (
          <TerminalConfigSection config={config.terminal} onUpdate={(updates) => handleUpdate('terminal', updates)} />
        )}
        {activeSection === 'workspace' && (
          <WorkspaceConfigSection config={config.workspace} onUpdate={(updates) => handleUpdate('workspace', updates)} />
        )}
        {activeSection === 'memory' && (
          <MemoryConfigSection config={config.memory} onUpdate={(updates) => handleUpdate('memory', updates)} />
        )}
      </div>
    </div>
  )
}

// AI 配置
const AIConfigSection: React.FC<{
  config: AppConfig['ai']
  onUpdate: (updates: Partial<AppConfig['ai']>) => void
}> = ({ config, onUpdate }) => {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold mb-4">AI 设置</h2>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">提供商</label>
          <select
            value={config.provider}
            onChange={(e) => onUpdate({ provider: e.target.value as AppConfig['ai']['provider'] })}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2"
          >
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="custom">自定义</option>
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">API Key</label>
          <input
            type="password"
            value={config.apiKey}
            onChange={(e) => onUpdate({ apiKey: e.target.value })}
            placeholder="sk-..."
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2"
          />
        </div>

        {config.provider === 'custom' && (
          <div>
            <label className="block text-sm text-gray-400 mb-1">Base URL</label>
            <input
              type="text"
              value={config.baseUrl || ''}
              onChange={(e) => onUpdate({ baseUrl: e.target.value })}
              placeholder="https://api.example.com/v1"
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2"
            />
          </div>
        )}

        <div>
          <label className="block text-sm text-gray-400 mb-1">模型</label>
          <input
            type="text"
            value={config.model}
            onChange={(e) => onUpdate({ model: e.target.value })}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Max Tokens</label>
            <input
              type="number"
              value={config.maxTokens}
              onChange={(e) => onUpdate({ maxTokens: parseInt(e.target.value) })}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Temperature</label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="2"
              value={config.temperature}
              onChange={(e) => onUpdate({ temperature: parseFloat(e.target.value) })}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// UI 配置
const UIConfigSection: React.FC<{
  config: AppConfig['ui']
  onUpdate: (updates: Partial<AppConfig['ui']>) => void
}> = ({ config, onUpdate }) => {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold mb-4">界面设置</h2>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">主题</label>
          <select
            value={config.theme}
            onChange={(e) => onUpdate({ theme: e.target.value as AppConfig['ui']['theme'] })}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2"
          >
            <option value="light">浅色</option>
            <option value="dark">深色</option>
            <option value="system">跟随系统</option>
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">字体大小 ({config.fontSize}px)</label>
          <input
            type="range"
            min="10"
            max="24"
            value={config.fontSize}
            onChange={(e) => onUpdate({ fontSize: parseInt(e.target.value) })}
            className="w-full"
          />
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={config.sidebarCollapsed}
              onChange={(e) => onUpdate({ sidebarCollapsed: e.target.checked })}
              className="rounded"
            />
            <span>默认折叠侧边栏</span>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={config.showLineNumbers}
              onChange={(e) => onUpdate({ showLineNumbers: e.target.checked })}
              className="rounded"
            />
            <span>显示行号</span>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={config.wordWrap}
              onChange={(e) => onUpdate({ wordWrap: e.target.checked })}
              className="rounded"
            />
            <span>自动换行</span>
          </label>
        </div>
      </div>
    </div>
  )
}

// 编辑器配置
const EditorConfigSection: React.FC<{
  config: AppConfig['editor']
  onUpdate: (updates: Partial<AppConfig['editor']>) => void
}> = ({ config, onUpdate }) => {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold mb-4">编辑器设置</h2>
      
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Tab 大小</label>
            <input
              type="number"
              min="1"
              max="8"
              value={config.tabSize}
              onChange={(e) => onUpdate({ tabSize: parseInt(e.target.value) })}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">自动保存间隔 (ms)</label>
            <input
              type="number"
              step="1000"
              min="1000"
              value={config.autoSaveInterval}
              onChange={(e) => onUpdate({ autoSaveInterval: parseInt(e.target.value) })}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={config.useSpaces}
              onChange={(e) => onUpdate({ useSpaces: e.target.checked })}
              className="rounded"
            />
            <span>使用空格代替 Tab</span>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={config.autoSave}
              onChange={(e) => onUpdate({ autoSave: e.target.checked })}
              className="rounded"
            />
            <span>自动保存</span>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={config.formatOnSave}
              onChange={(e) => onUpdate({ formatOnSave: e.target.checked })}
              className="rounded"
            />
            <span>保存时格式化</span>
          </label>
        </div>
      </div>
    </div>
  )
}

// 终端配置
const TerminalConfigSection: React.FC<{
  config: AppConfig['terminal']
  onUpdate: (updates: Partial<AppConfig['terminal']>) => void
}> = ({ config, onUpdate }) => {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold mb-4">终端设置</h2>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">默认 Shell</label>
          <input
            type="text"
            value={config.defaultShell}
            onChange={(e) => onUpdate({ defaultShell: e.target.value })}
            placeholder="留空使用系统默认"
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">字体大小 ({config.fontSize}px)</label>
          <input
            type="range"
            min="10"
            max="24"
            value={config.fontSize}
            onChange={(e) => onUpdate({ fontSize: parseInt(e.target.value) })}
            className="w-full"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">光标样式</label>
          <select
            value={config.cursorStyle}
            onChange={(e) => onUpdate({ cursorStyle: e.target.value as AppConfig['terminal']['cursorStyle'] })}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2"
          >
            <option value="block">方块</option>
            <option value="line">竖线</option>
            <option value="bar">横线</option>
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">滚动缓冲区大小</label>
          <input
            type="number"
            step="1000"
            min="1000"
            max="50000"
            value={config.scrollback}
            onChange={(e) => onUpdate({ scrollback: parseInt(e.target.value) })}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2"
          />
        </div>
      </div>
    </div>
  )
}

// 工作区配置
const WorkspaceConfigSection: React.FC<{
  config: AppConfig['workspace']
  onUpdate: (updates: Partial<AppConfig['workspace']>) => void
}> = ({ config, onUpdate }) => {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold mb-4">工作区设置</h2>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">默认项目路径</label>
          <input
            type="text"
            value={config.defaultProjectPath}
            onChange={(e) => onUpdate({ defaultProjectPath: e.target.value })}
            placeholder="/path/to/projects"
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2"
          />
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={config.autoRestoreSession}
              onChange={(e) => onUpdate({ autoRestoreSession: e.target.checked })}
              className="rounded"
            />
            <span>启动时恢复上次会话</span>
          </label>
        </div>

        {config.recentProjects.length > 0 && (
          <div>
            <label className="block text-sm text-gray-400 mb-2">最近项目</label>
            <div className="space-y-1">
              {config.recentProjects.map((project, index) => (
                <div key={index} className="text-sm text-gray-500 bg-gray-800 px-3 py-2 rounded">
                  {project}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// 记忆配置
const MemoryConfigSection: React.FC<{
  config: AppConfig['memory']
  onUpdate: (updates: Partial<AppConfig['memory']>) => void
}> = ({ config, onUpdate }) => {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold mb-4">记忆设置</h2>
      
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => onUpdate({ enabled: e.target.checked })}
              className="rounded"
            />
            <span>启用记忆功能</span>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={config.autoCompress}
              onChange={(e) => onUpdate({ autoCompress: e.target.checked })}
              className="rounded"
            />
            <span>自动压缩记忆</span>
          </label>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">最大会话数量</label>
          <input
            type="number"
            min="10"
            max="500"
            value={config.maxSessionSize}
            onChange={(e) => onUpdate({ maxSessionSize: parseInt(e.target.value) })}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2"
          />
        </div>
      </div>
    </div>
  )
}
