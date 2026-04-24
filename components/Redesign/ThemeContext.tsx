import React, { createContext, useContext } from 'react';
import { darkColors, lightColors, ResolvedThemeMode, ThemeColors, ThemeMode } from './theme';
import { useColorScheme } from '@/components/useColorScheme';
import { useSettingsStore } from '@/lib/stores/settingsStore';

type ThemeContextValue = {
  colors: ThemeColors;
  mode: ResolvedThemeMode;
  preference: ThemeMode;
  setThemePreference: (mode: ThemeMode) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  colors: darkColors,
  mode: 'dark',
  preference: 'system',
  setThemePreference: () => {},
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const preference = useSettingsStore((state) => state.themeMode);
  const setThemeMode = useSettingsStore((state) => state.setThemeMode);
  const mode: ResolvedThemeMode =
    preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;

  const colors = mode === 'dark' ? darkColors : lightColors;

  const toggleTheme = () => {
    setThemeMode(mode === 'dark' ? 'light' : 'dark');
  };

  return (
    <ThemeContext.Provider
      value={{ colors, mode, preference, setThemePreference: setThemeMode, toggleTheme }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
