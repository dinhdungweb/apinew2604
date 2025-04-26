import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { Sun, Moon, Monitor, ChevronDown } from 'lucide-react';

export default function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    // Áp dụng dark class ngay để UI phản hồi nhanh hơn
    if (newTheme === 'dark' || (newTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    
    setTheme(newTheme);
    setIsOpen(false);
  };

  // Get display data for current theme
  const themeData = {
    light: { icon: <Sun className="w-4 h-4" />, label: 'Sáng' },
    dark: { icon: <Moon className="w-4 h-4" />, label: 'Tối' },
    system: { icon: <Monitor className="w-4 h-4" />, label: 'Hệ thống' },
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full px-3 py-2 text-sm font-medium rounded-md bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center">
          {themeData[theme].icon}
          <span className="ml-2">{themeData[theme].label}</span>
        </div>
        <ChevronDown className="w-4 h-4 ml-2" />
      </button>

      {isOpen && (
        <div className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
          <div className="py-1">
            <button
              onClick={() => handleThemeChange('light')}
              className={`flex items-center w-full px-4 py-2 text-left text-sm ${
                theme === 'light' 
                  ? 'bg-gray-100 dark:bg-gray-700 text-primary-600 dark:text-primary-400' 
                  : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <Sun className="w-4 h-4 mr-2" />
              Sáng
            </button>
            <button
              onClick={() => handleThemeChange('dark')}
              className={`flex items-center w-full px-4 py-2 text-left text-sm ${
                theme === 'dark' 
                  ? 'bg-gray-100 dark:bg-gray-700 text-primary-600 dark:text-primary-400' 
                  : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <Moon className="w-4 h-4 mr-2" />
              Tối
            </button>
            <button
              onClick={() => handleThemeChange('system')}
              className={`flex items-center w-full px-4 py-2 text-left text-sm ${
                theme === 'system' 
                  ? 'bg-gray-100 dark:bg-gray-700 text-primary-600 dark:text-primary-400' 
                  : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <Monitor className="w-4 h-4 mr-2" />
              Hệ thống
            </button>
          </div>
        </div>
      )}
    </div>
  );
} 