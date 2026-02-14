import { useState, useEffect, useCallback } from 'react';

type Theme = 'dark' | 'light';

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>('dark');
  const [isReady, setIsReady] = useState(false);

  // Load theme from config on mount
  useEffect(() => {
    const loadTheme = async () => {
      try {
        // Try to get theme from electron config
        if (window.api?.config?.getSection) {
          const uiConfig = await window.api.config.getSection('ui') as Record<string, unknown> | null;
          if (uiConfig?.theme) {
            setThemeState(uiConfig.theme as Theme);
          }
        }
      } catch (error) {
        console.error('Failed to load theme:', error);
        // Fallback to localStorage
        const savedTheme = localStorage.getItem('theme') as Theme;
        if (savedTheme) {
          setThemeState(savedTheme);
        }
      } finally {
        setIsReady(true);
      }
    };

    loadTheme();
  }, []);

  // Apply theme to document
  useEffect(() => {
    if (!isReady) return;

    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme, isReady]);

  const setTheme = useCallback(async (newTheme: Theme) => {
    setThemeState(newTheme);

    // Save to electron config
    try {
      if (window.api?.config?.updateSection) {
        await window.api.config.updateSection('ui', { theme: newTheme });
      }
    } catch (error) {
      console.error('Failed to save theme:', error);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  return {
    theme,
    setTheme,
    toggleTheme,
    isDark: theme === 'dark',
    isReady,
  };
}

export default useTheme;
