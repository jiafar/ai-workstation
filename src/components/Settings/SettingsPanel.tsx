import React, { useState } from 'react';

interface Settings {
  aiProvider: {
    openaiApiKey: string;
    anthropicApiKey: string;
    defaultProvider: 'openai' | 'anthropic';
  };
  editor: {
    fontSize: number;
    tabSize: number;
    wordWrap: boolean;
    minimap: boolean;
  };
  theme: 'dark' | 'light';
}

const defaultSettings: Settings = {
  aiProvider: {
    openaiApiKey: '',
    anthropicApiKey: '',
    defaultProvider: 'openai',
  },
  editor: {
    fontSize: 14,
    tabSize: 2,
    wordWrap: true,
    minimap: true,
  },
  theme: 'dark',
};

export const SettingsPanel: React.FC = () => {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    // TODO: Persist settings via window.api.settings.save()
    console.log('Saving settings:', settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const updateAIProvider = (field: keyof Settings['aiProvider'], value: any) => {
    setSettings((prev) => ({
      ...prev,
      aiProvider: { ...prev.aiProvider, [field]: value },
    }));
  };

  const updateEditor = (field: keyof Settings['editor'], value: any) => {
    setSettings((prev) => ({
      ...prev,
      editor: { ...prev.editor, [field]: value },
    }));
  };

  return (
    <div className="flex flex-col h-full bg-bg-secondary">
      <div className="p-4 border-b border-border-primary">
        <h2 className="text-text-primary font-semibold">Settings</h2>
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
                value={settings.aiProvider.defaultProvider}
                onChange={(e) =>
                  updateAIProvider('defaultProvider', e.target.value as 'openai' | 'anthropic')
                }
                className="w-full px-3 py-2 bg-bg-surface border border-border-primary rounded text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-blue"
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
              </select>
            </div>

            <div>
              <label className="block text-text-secondary text-sm mb-1">
                OpenAI API Key
              </label>
              <input
                type="password"
                value={settings.aiProvider.openaiApiKey}
                onChange={(e) => updateAIProvider('openaiApiKey', e.target.value)}
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
                value={settings.aiProvider.anthropicApiKey}
                onChange={(e) => updateAIProvider('anthropicApiKey', e.target.value)}
                placeholder="sk-ant-..."
                className="w-full px-3 py-2 bg-bg-surface border border-border-primary rounded text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent-blue"
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
                Font Size: {settings.editor.fontSize}px
              </label>
              <input
                type="range"
                min="10"
                max="24"
                value={settings.editor.fontSize}
                onChange={(e) => updateEditor('fontSize', parseInt(e.target.value))}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-text-secondary text-sm mb-1">
                Tab Size: {settings.editor.tabSize} spaces
              </label>
              <input
                type="range"
                min="2"
                max="8"
                step="2"
                value={settings.editor.tabSize}
                onChange={(e) => updateEditor('tabSize', parseInt(e.target.value))}
                className="w-full"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="text-text-secondary text-sm">Word Wrap</label>
              <button
                onClick={() => updateEditor('wordWrap', !settings.editor.wordWrap)}
                className={`px-4 py-1 rounded text-sm transition-colors ${
                  settings.editor.wordWrap
                    ? 'bg-accent-blue text-white'
                    : 'bg-bg-surface text-text-muted'
                }`}
              >
                {settings.editor.wordWrap ? 'On' : 'Off'}
              </button>
            </div>

            <div className="flex items-center justify-between">
              <label className="text-text-secondary text-sm">Minimap</label>
              <button
                onClick={() => updateEditor('minimap', !settings.editor.minimap)}
                className={`px-4 py-1 rounded text-sm transition-colors ${
                  settings.editor.minimap
                    ? 'bg-accent-blue text-white'
                    : 'bg-bg-surface text-text-muted'
                }`}
              >
                {settings.editor.minimap ? 'On' : 'Off'}
              </button>
            </div>
          </div>
        </section>

        {/* Theme Section */}
        <section>
          <h3 className="text-text-primary font-medium mb-3">Theme</h3>
          <div className="flex space-x-2">
            <button
              onClick={() => setSettings((prev) => ({ ...prev, theme: 'dark' }))}
              className={`flex-1 px-4 py-2 rounded transition-colors ${
                settings.theme === 'dark'
                  ? 'bg-accent-blue text-white'
                  : 'bg-bg-surface text-text-muted'
              }`}
            >
              Dark
            </button>
            <button
              onClick={() => setSettings((prev) => ({ ...prev, theme: 'light' }))}
              className={`flex-1 px-4 py-2 rounded transition-colors ${
                settings.theme === 'light'
                  ? 'bg-accent-blue text-white'
                  : 'bg-bg-surface text-text-muted'
              }`}
            >
              Light
            </button>
          </div>
        </section>
      </div>

      <div className="p-4 border-t border-border-primary">
        <button
          onClick={handleSave}
          className={`w-full px-4 py-2 rounded transition-colors ${
            saved
              ? 'bg-green-500 text-white'
              : 'bg-accent-blue text-white hover:bg-opacity-90'
          }`}
        >
          {saved ? 'Saved!' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
};
