'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/context/AppContext';
import { useTheme } from '@/context/ThemeContext';
import Sidebar from './Sidebar';
import Navbar from './Navbar';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { token } = useAppContext();
  const { isDarkMode } = useTheme();
  const router = useRouter();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    // Check authentication
    if (!token) {
      router.push('/login');
    }
    
    // Check if mobile
    const handleResize = () => {
      const mobileView = window.innerWidth < 768;
      setIsMobile(mobileView);
      if (mobileView) {
        setIsCollapsed(true);
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };
    
    handleResize(); // Check on initial load
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [token, router]);

  const handleCollapse = (collapsed: boolean) => {
    setIsCollapsed(collapsed);
  };

  const handleSidebarToggle = (isOpen: boolean) => {
    setIsSidebarOpen(isOpen);
  };

  return (
    <div className="flex flex-row h-screen w-full bg-gray-50 dark:bg-gray-900 overflow-hidden text-gray-900 dark:text-gray-100">
      <Sidebar 
        isCollapsed={isCollapsed} 
        onCollapse={handleCollapse} 
        isOpen={isSidebarOpen}
        onToggle={handleSidebarToggle}
      />
      
      <div className={`flex flex-col flex-1 transition-all duration-300 ease-in-out ${
        isMobile ? '' : (isCollapsed ? 'ml-20' : 'ml-64')
      }`}>
        {/* Header for mobile or desktop */}
        <Navbar
          isMobile={isMobile}
          isSidebarOpen={isSidebarOpen}
          onSidebarToggle={handleSidebarToggle}
        />
        
        {/* Main content */}
        <main className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900">
          {token ? children : null}
        </main>
      </div>
    </div>
  );
} 