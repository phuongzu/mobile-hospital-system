import React, { createContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';

type ThemeContextType = {
  isDarkMode: boolean;
  toggleDarkMode: (value?: boolean) => Promise<void>;
};

export const ThemeContext = createContext<ThemeContextType>({
  isDarkMode: false,
  toggleDarkMode: async () => { },
});

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const systemColorScheme = useColorScheme();
  const [isDarkMode, setIsDarkMode] = useState(systemColorScheme === 'dark');

  // Load saved preference on mount
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const saved = await AsyncStorage.getItem('darkMode');
        if (saved !== null) {
          // User đã từng chọn thủ công → ưu tiên preference của user
          setIsDarkMode(JSON.parse(saved));
        } else {
          // Chưa chọn → follow system
          setIsDarkMode(systemColorScheme === 'dark');
        }
      } catch (error) {
        console.error('Failed to load theme:', error);
      }
    };
    loadTheme();
  }, []);

  const toggleDarkMode = useCallback(async (value?: boolean) => {
    const newValue = value !== undefined ? value : !isDarkMode;
    setIsDarkMode(newValue);
    try {
      await AsyncStorage.setItem('darkMode', JSON.stringify(newValue));
    } catch (error) {
      console.error('Failed to save theme:', error);
    }
  }, [isDarkMode]);

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
};