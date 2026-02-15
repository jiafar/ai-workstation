import { useState, useEffect, useCallback } from 'react';

interface AISettings {
  defaultProvider: 'openai' | 'anthropic' | 'kimi';
  openaiApiKey: string;
  anthropicApiKey: string;
  kimiApiKey: string;
  openaiBaseUrl?: string;
  openaiModel: string;
  anthropicModel: string;
  kimiModel: string;
  maxTokens: number;
  temperature: number;
}

interface EmbeddingsSettings {
  provider: 'openai' | 'jina';
  jinaApiKey: string;
  jinaModel: string;
}

interface EditorSettings {
  tabSize: number;
  useSpaces: boolean;
  autoSave: boolean;
  autoSaveInterval: number;
  formatOnSave: boolean;
}

interface UISettings {
  theme: 'light' | 'dark' | 'system';
  fontSize: number;
  sidebarCollapsed: boolean;
  showLineNumbers: boolean;
  wordWrap: boolean;
}

interface TerminalSettings {
  defaultShell: string;
  fontSize: number;
  cursorStyle: 'block' | 'line' | 'bar';
  scrollback: number;
}

export const SettingsPanel: React.FC = () => {
  const [aiSettings, setAISettings] = useState<AISettings | null>(null);
  const [embeddingsSettings, setEmbeddingsSettings] = useState<EmbeddingsSettings | null>(null);
  const [editorSettings, setEditorSettings] = useState<EditorSettings | null>(null);
  const [uiSettings, setUISettings] = useState<UISettings | null>(null);
  const [terminalSettings, setTerminalSettings] = useState<TerminalSettings | null>(null);
  const [saved] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load all settings from config on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const config = await window.api.config.get() as Record<string, unknown>;
        if (config) {
          setAISettings(config.ai as AISettings);
          setEmbeddingsSettings(config.embeddings as EmbeddingsSettings);
          setEditorSettings(config.editor as EditorSettings);
          setUISettings(config.ui as UISettings);
          setTerminalSettings(config.terminal as TerminalSettings);
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, []);

  const updateAI = useCallback((field: keyof AISettings, value: unknown) => {
    setAISettings((prev) => {
      if (!prev) return prev;
      // Trim API keys to prevent invisible characters from copy-paste
      const cleanValue = (field === 'openaiApiKey' || field === 'anthropicApiKey' || field === 'kimiApiKey') && typeof value === 'string'
        ? value.trim()
        : value;
      const updated = { ...prev, [field]: cleanValue };
      // Save immediately
      window.api.config.updateSection('ai', updated).catch(console.error);
      return updated;
    });
  }, []);

  const updateUI = useCallback((field: keyof UISettings, value: unknown) => {
    setUISettings((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, [field]: value };
      window.api.config.updateSection('ui', updated).catch(console.error);
      return updated;
    });
  }, []);

  const updateEmbeddings = useCallback((field: keyof EmbeddingsSettings, value: unknown) => {
    setEmbeddingsSettings((prev) => {
      if (!prev) return prev;
      const cleanValue = field === 'jinaApiKey' && typeof value === 'string' ? value.trim() : value;
      const updated = { ...prev, [field]: cleanValue };
      window.api.config.updateSection('embeddings', updated).catch(console.error);
      return updated;
    });
  }, []);

  if (loading || !aiSettings || !embeddingsSettings || !editorSettings || !uiSettings || !terminalSettings) {
    return (
      <div className="flex items-center justify-center h-full bg-bg-secondary">
        <div className="text-text-muted">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-bg-secondary">
      <div className="p-4 border-b border-border-primary">
        <h2 className="text-text-primary font-semibold">Settings</h2>
        {saved && <span className="text-green-400 text-sm ml-2">Saved</span>}
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-6">
        {/* AI Provider Section */}
        <section>
          <h3 className="text-text-primary font-medium mb-3">AI Provider</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-text-secondary text-sm mb-1">
                Default Provider
              </label>
              <select
                value={aiSettings.defaultProvider}
                onChange={(e) => updateAI('defaultProvider', e.target.value)}
                className="w-full px-3 py-2 bg-bg-surface border border-border-primary rounded text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-blue"
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="kimi">Kimi</option>
              </select>
            </div>

            <div>
              <label className="block text-text-secondary text-sm mb-1">
                OpenAI API Key
              </label>
              <input
                type="password"
                value={aiSettings.openaiApiKey}
                onChange={(e) => updateAI('openaiApiKey', e.target.value)}
                placeholder="sk-..."
                className="w-full px-3 py-2 bg-bg-surface border border-border-primary rounded text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent-blue"
              />
            </div>

            <div>
              <label className="block text-text-secondary text-sm mb-1">
                Anthropic API Key
              </label>
              <input
                type="password"
                value={aiSettings.anthropicApiKey}
                onChange={(e) => updateAI('anthropicApiKey', e.target.value)}
                placeholder="sk-ant-..."
                className="w-full px-3 py-2 bg-bg-surface border border-border-primary rounded text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent-blue"
              />
            </div>

            <div>
              <label className="block text-text-secondary text-sm mb-1">
                Kimi API Key
              </label>
              <input
                type="password"
                value={aiSettings.kimiApiKey}
                onChange={(e) => updateAI('kimiApiKey', e.target.value)}
                placeholder="sk-..."
                className="w-full px-3 py-2 bg-bg-surface border border-border-primary rounded text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent-blue"
              />
            </div>

            <div>
              <label className="block text-text-secondary text-sm mb-1">
                OpenAI Model
              </label>
              <input
                type="text"
                value={aiSettings.openaiModel}
                onChange={(e) => updateAI('openaiModel', e.target.value)}
                className="w-full px-3 py-2 bg-bg-surface border border-border-primary rounded text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-blue"
              />
            </div>

            <div>
              <label className="block text-text-secondary text-sm mb-1">
                Anthropic Model
              </label>
              <input
                type="text"
                value={aiSettings.anthropicModel}
                onChange={(e) => updateAI('anthropicModel', e.target.value)}
                className="w-full px-3 py-2 bg-bg-surface border border-border-primary rounded text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-blue"
              />
            </div>

            <div>
              <label className="block text-text-secondary text-sm mb-1">
                Kimi Model
              </label>
              <input
                type="text"
                value={aiSettings.kimiModel}
                onChange={(e) => updateAI('kimiModel', e.target.value)}
                className="w-full px-3 py-2 bg-bg-surface border border-border-primary rounded text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-blue"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-text-secondary text-sm mb-1">
                  Max Tokens
                </label>
                <input
                  type="number"
                  value={aiSettings.maxTokens}
                  onChange={(e) => updateAI('maxTokens', parseInt(e.target.value) || 4096)}
                  className="w-full px-3 py-2 bg-bg-surface border border-border-primary rounded text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-blue"
                />
              </div>
              <div>
                <label className="block text-text-secondary text-sm mb-1">
                  Temperature
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="2"
                  value={aiSettings.temperature}
                  onChange={(e) => updateAI('temperature', parseFloat(e.target.value) || 0.7)}
                  className="w-full px-3 py-2 bg-bg-surface border border-border-primary rounded text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-blue"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Embeddings Section */}
        <section>
          <h3 className="text-text-primary font-medium mb-3">向量嵌入</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-text-secondary text-sm mb-1">
                Embeddings Provider
              </label>
              <select
                value={embeddingsSettings.provider}
                onChange={(e) => updateEmbeddings('provider', e.target.value)}
                className="w-full px-3 py-2 bg-bg-surface border border-border-primary rounded text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-blue"
              >
                <option value="jina">Jina</option>
                <option value="openai">OpenAI</option>
              </select>
            </div>

            <div>
              <label className="block text-text-secondary text-sm mb-1">
                Jina API Key
              </label>
              <input
                type="password"
                value={embeddingsSettings.jinaApiKey}
                onChange={(e) => updateEmbeddings('jinaApiKey', e.target.value)}
                placeholder="jina_..."
                className="w-full px-3 py-2 bg-bg-surface border border-border-primary rounded text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent-blue"
              />
            </div>

            <div>
              <label className="block text-text-secondary text-sm mb-1">
                Jina Model
              </label>
              <input
                type="text"
                value={embeddingsSettings.jinaModel}
                onChange={(e) => updateEmbeddings('jinaModel', e.target.value)}
                className="w-full px-3 py-2 bg-bg-surface border border-border-primary rounded text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-blue"
              />
            </div>
          </div>
        </section>

        {/* Editor Section */}
        <section>
          <h3 className="text-text-primary font-medium mb-3">Editor</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-text-secondary text-sm mb-1">
                Font Size: {uiSettings.fontSize}px
              </label>
              <input
                type="range"
                min="10"
                max="24"
                value={uiSettings.fontSize}
                onChange={(e) => updateUI('fontSize', parseInt(e.target.value))}
                className="w-full"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="text-text-secondary text-sm">Word Wrap</label>
              <button
                onClick={() => updateUI('wordWrap', !uiSettings.wordWrap)}
                className={`px-4 py-1 rounded text-sm transition-colors ${
                  uiSettings.wordWrap
                    ? 'bg-accent-blue text-white'
                    : 'bg-bg-surface text-text-muted'
                }`}
              >
                {uiSettings.wordWrap ? 'On' : 'Off'}
              </button>
            </div>

            <div className="flex items-center justify-between">
              <label className="text-text-secondary text-sm">Line Numbers</label>
              <button
                onClick={() => updateUI('showLineNumbers', !uiSettings.showLineNumbers)}
                className={`px-4 py-1 rounded text-sm transition-colors ${
                  uiSettings.showLineNumbers
                    ? 'bg-accent-blue text-white'
                    : 'bg-bg-surface text-text-muted'
                }`}
              >
                {uiSettings.showLineNumbers ? 'On' : 'Off'}
              </button>
            </div>
          </div>
        </section>

        {/* Theme Section */}
        <section>
          <h3 className="text-text-primary font-medium mb-3">Theme</h3>
          <div className="flex space-x-2">
            {(['dark', 'light', 'system'] as const).map((t) => (
              <button
                key={t}
                onClick={() => updateUI('theme', t)}
                className={`flex-1 px-4 py-2 rounded transition-colors capitalize ${
                  uiSettings.theme === t
                    ? 'bg-accent-blue text-white'
                    : 'bg-bg-surface text-text-muted'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
