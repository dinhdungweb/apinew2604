'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAppContext } from '@/context/AppContext';
import { useTheme } from '@/context/ThemeContext';
import NotificationCenter from './ui/NotificationCenter';
import ThemeSelector from './ui/ThemeSelector';
import { 
  Menu, X, User, Search, 
  Moon, Sun, LogOut, 
  HelpCircle, ChevronDown,
  Settings
} from 'lucide-react';

interface NavbarProps {
  isMobile?: boolean;
  isSidebarOpen?: boolean;
  onSidebarToggle?: (isOpen: boolean) => void;
}

export default function Navbar({ 
  isMobile = false, 
  isSidebarOpen = true, 
  onSidebarToggle 
}: NavbarProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const pathname = usePathname();
  const { user, logout } = useAppContext();
  const { isDarkMode } = useTheme();

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Handle toggle sidebar
  const handleToggleSidebar = () => {
    if (onSidebarToggle) {
      onSidebarToggle(!isSidebarOpen);
    }
  };

  // Get page title based on current pathname
  const getPageTitle = () => {
    if (!pathname) return 'Dashboard';
    
    const path = pathname.split('/')[1];
    if (!path) return 'Dashboard';
    
    // Title case transform
    return path.charAt(0).toUpperCase() + path.slice(1).replace(/-/g, ' ');
  };

  // Search functionality (placeholder)
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSearchOpen(false);
    // Implement actual search functionality
  };

  return (
    <header 
      className={`
        sticky top-0 z-20 bg-white dark:bg-gray-800 w-full 
        transition-all duration-200 ease-in-out
        border-b border-gray-200 dark:border-gray-700
        ${isScrolled ? 'shadow-sm' : ''}
      `}
    >
      <div className="px-4 h-16 flex items-center justify-between">
        {/* Left side - Menu button and page title */}
        <div className="flex items-center">
          {isMobile && (
            <button
              onClick={handleToggleSidebar}
              className="mr-3 p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
              aria-label={isSidebarOpen ? 'Close sidebar' : 'Open sidebar'}
            >
              <Menu className="h-5 w-5" />
            </button>
          )}
          
          <h1 className="text-xl font-semibold text-gray-800 dark:text-white">
            {getPageTitle()}
          </h1>
        </div>
        
        {/* Right side - Actions */}
        <div className="flex items-center space-x-1 sm:space-x-2">
          {/* Search button */}
          <div className="relative">
            <button
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
              aria-label="Search"
            >
              <Search className="h-5 w-5" />
            </button>
            
            {isSearchOpen && (
              <div className="absolute right-0 top-12 w-80 p-3 bg-white dark:bg-gray-800 rounded-lg shadow-dropdown border border-gray-200 dark:border-gray-700 animate-fade-in">
                <form onSubmit={handleSearch} className="relative">
                  <input
                    type="text"
                    placeholder="Tìm kiếm..."
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    autoFocus
                  />
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400 dark:text-gray-500" />
                </form>
              </div>
            )}
          </div>
          
          {/* Theme Selector */}
          <div className="hidden sm:block">
            <ThemeSelector />
          </div>
          
          {/* Mobile theme toggle - simplified for small screens */}
          <button
            onClick={() => {
              const { setTheme } = useTheme();
              setTheme(isDarkMode ? 'light' : 'dark');
            }}
            className="sm:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
            aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          
          {/* Notifications */}
          <NotificationCenter />
          
          {/* User menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center px-2 py-1.5 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="User menu"
            >
              <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 mr-2">
                <User className="h-4 w-4" />
              </div>
              <span className="hidden sm:block text-sm font-medium">{user?.username || 'User'}</span>
              <ChevronDown className="h-4 w-4 ml-1 text-gray-500 dark:text-gray-400" />
            </button>
            
            {showUserMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)}></div>
                <div className="absolute right-0 top-12 w-56 py-2 bg-white dark:bg-gray-800 rounded-lg shadow-dropdown border border-gray-200 dark:border-gray-700 z-50 animate-fade-in">
                  <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{user?.username || 'User'}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{user?.role === 'admin' ? 'Administrator' : 'User'}</p>
                  </div>
                  
                  <div className="py-1">
                    <Link href="/profile" 
                      className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/50"
                      onClick={() => setShowUserMenu(false)}
                    >
                      <User className="h-4 w-4 mr-3 text-gray-500 dark:text-gray-400" />
                      Hồ sơ
                    </Link>
                    
                    <Link href="/settings" 
                      className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/50"
                      onClick={() => setShowUserMenu(false)}
                    >
                      <Settings className="h-4 w-4 mr-3 text-gray-500 dark:text-gray-400" />
                      Cài đặt
                    </Link>
                    
                    <Link href="/help" 
                      className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/50"
                      onClick={() => setShowUserMenu(false)}
                    >
                      <HelpCircle className="h-4 w-4 mr-3 text-gray-500 dark:text-gray-400" />
                      Trợ giúp
                    </Link>
                  </div>
                  
                  <div className="py-1 border-t border-gray-200 dark:border-gray-700">
                    <button
                      onClick={() => {
                        logout();
                        setShowUserMenu(false);
                      }}
                      className="flex w-full items-center px-4 py-2 text-sm text-danger-600 dark:text-danger-400 hover:bg-gray-100 dark:hover:bg-gray-700/50"
                    >
                      <LogOut className="h-4 w-4 mr-3" />
                      Đăng xuất
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      
      {/* Click outside handlers for search */}
      {isSearchOpen && (
        <div 
          className="fixed inset-0 z-10" 
          onClick={() => setIsSearchOpen(false)}
        />
      )}
    </header>
  );
} 