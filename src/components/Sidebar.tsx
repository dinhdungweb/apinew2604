'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAppContext } from '@/context/AppContext';
import { 
  LogOut, Package, Settings, Users, BarChart2,
  User, ChevronLeft, ChevronRight, 
  FileText, Clock, RefreshCw, Database, Shield,
  Layers, Home, PieChart, Activity, X, Zap
} from 'lucide-react';

interface SidebarProps {
  isCollapsed?: boolean;
  onCollapse?: (collapsed: boolean) => void;
  isOpen?: boolean;
  onToggle?: (isOpen: boolean) => void;
}

export default function Sidebar({ 
  isCollapsed: propsIsCollapsed, 
  onCollapse, 
  isOpen = true,
  onToggle
}: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(propsIsCollapsed || false);
  const [isMobile, setIsMobile] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAppContext();

  // Sync collapse state with props
  useEffect(() => {
    if (propsIsCollapsed !== undefined && propsIsCollapsed !== isCollapsed) {
      setIsCollapsed(propsIsCollapsed);
    }
  }, [propsIsCollapsed, isCollapsed]);

  // Determine active menu item
  const isActive = (path: string) => pathname === path;

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  // Check if mobile on window resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth < 768) {
        setIsCollapsed(true);
        if (onCollapse) onCollapse(true);
      }
    };
    
    handleResize(); // Check on initial load
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [onCollapse]);

  // Handle collapse sidebar
  const handleToggleCollapse = () => {
    const newCollapsed = !isCollapsed;
    setIsCollapsed(newCollapsed);
    if (onCollapse) onCollapse(newCollapsed);
  };

  // Handle toggle sidebar on mobile
  const handleToggleSidebar = () => {
    if (onToggle) onToggle(!isOpen);
  };

  const isAdmin = user?.role === 'admin';

  // Navigation items grouped by category
  const navItems = [
    {
      title: 'Trang chính',
      items: [
        {
          name: 'Dashboard',
          path: '/dashboard',
          icon: <BarChart2 className="w-5 h-5" />,
          roles: ['admin', 'editor', 'viewer'],
        },
        {
          name: 'Sản phẩm',
          path: '/products',
          icon: <Package className="w-5 h-5" />,
          roles: ['admin', 'editor', 'viewer'],
        },
        {
          name: 'Đồng bộ ngay',
          path: '/sync',
          icon: <Zap className="w-5 h-5" />,
          roles: ['admin', 'editor'],
        },
        {
          name: 'Lên lịch tự động',
          path: '/auto-sync',
          icon: <Clock className="w-5 h-5" />,
          roles: ['admin', 'editor'],
        },
      ],
    },
    {
      title: 'Phân tích',
      items: [
        {
          name: 'Báo cáo',
          path: '/reports',
          icon: <PieChart className="w-5 h-5" />,
          roles: ['admin', 'editor'],
        },
        {
          name: 'Sync Logs',
          path: '/sync-logs',
          icon: <Clock className="w-5 h-5" />,
          roles: ['admin', 'editor'],
        },
        {
          name: 'Hoạt động',
          path: '/activities',
          icon: <Activity className="w-5 h-5" />,
          roles: ['admin'],
        },
      ],
    },
    {
      title: 'Quản lý',
      items: [
        {
          name: 'Người dùng',
          path: '/users',
          icon: <Users className="w-5 h-5" />,
          roles: ['admin'],
        },
        {
          name: 'Cài đặt',
          path: '/settings',
          icon: <Settings className="w-5 h-5" />,
          roles: ['admin'],
        },
        {
          name: 'API Keys',
          path: '/api-keys',
          icon: <Shield className="w-5 h-5" />,
          roles: ['admin'],
        },
        {
          name: 'Backup',
          path: '/backup',
          icon: <Database className="w-5 h-5" />,
          roles: ['admin'],
        },
      ],
    },
  ];

  return (
    <>
      {/* Mobile overlay */}
      {isMobile && isOpen && (
        <div 
          className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-20"
          onClick={handleToggleSidebar}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`
          fixed top-0 left-0 bottom-0 bg-white dark:bg-gray-800
          transition-all duration-300 ease-in-out z-30
          border-r border-gray-200 dark:border-gray-700
          shadow-sidebar
          ${isCollapsed ? 'w-20' : 'w-64'} 
          ${isMobile ? (isOpen ? 'translate-x-0' : '-translate-x-full') : 'translate-x-0'}
        `}
      >
        {/* Sidebar header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-700">
          {!isCollapsed && (
            <Link href="/dashboard" className="flex items-center space-x-2">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-primary-500 to-primary-600 flex items-center justify-center shadow-sm">
                <RefreshCw className="w-5 h-5 text-white" />
              </div>
              <div className="font-semibold text-gray-800 dark:text-white text-xl">
                SyncHub
              </div>
            </Link>
          )}
          
          {isCollapsed && (
            <div className="mx-auto">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-primary-500 to-primary-600 flex items-center justify-center shadow-sm">
                <RefreshCw className="w-5 h-5 text-white" />
              </div>
            </div>
          )}
          
          {!isMobile && (
            <button
              onClick={handleToggleCollapse}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
            </button>
          )}
          
          {isMobile && (
            <button
              onClick={handleToggleSidebar}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
              aria-label="Close sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        
        {/* Sidebar content */}
        <div className="flex flex-col h-[calc(100%-4rem)] overflow-hidden">
          <nav className="flex-1 py-4 overflow-y-auto px-3 space-y-6">
            {navItems.map((group, groupIndex) => {
              const visibleItems = group.items.filter(item => 
                !item.roles || item.roles.includes(user?.role || 'viewer')
              );
              
              if (visibleItems.length === 0) return null;
              
              return (
                <div key={groupIndex}>
                  {!isCollapsed && (
                    <h2 className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 px-3">
                      {group.title}
                    </h2>
                  )}
                  
                  <div className="space-y-1">
                    {visibleItems.map((item, itemIndex) => (
                      <Link
                        key={itemIndex}
                        href={item.path}
                        className={`
                          flex items-center rounded-lg px-3 py-2 text-sm font-medium
                          transition-colors duration-150 ease-in-out
                          ${isActive(item.path) 
                            ? 'bg-blue-100 text-blue-700 border-l-4 border-blue-600 pl-2 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-500'
                            : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700/50'
                          }
                          ${isCollapsed ? 'justify-center' : ''}
                        `}
                        aria-current={isActive(item.path) ? 'page' : undefined}
                      >
                        <span className={`flex-shrink-0 ${isCollapsed ? '' : 'mr-3'} ${isActive(item.path) ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                          {item.icon}
                        </span>
                        {!isCollapsed && <span>{item.name}</span>}
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </nav>
          
          {/* User profile and logout */}
          <div className="border-t border-gray-200 dark:border-gray-700 p-4">
            {!isCollapsed ? (
              <div className="flex flex-col space-y-3">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">{user?.username || 'User'}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{user?.role === 'admin' ? 'Administrator' : 'User'}</div>
                  </div>
                </div>
                
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center px-3 py-2 rounded-lg text-sm font-medium 
                    text-white bg-danger-600 hover:bg-danger-700 dark:bg-danger-700 dark:hover:bg-danger-800 
                    transition-colors duration-150 ease-in-out"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Đăng xuất
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center space-y-3">
                <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400">
                  <User className="w-5 h-5" />
                </div>
                <button
                  onClick={handleLogout}
                  className="w-10 h-10 flex items-center justify-center rounded-full 
                    text-white bg-danger-600 hover:bg-danger-700 dark:bg-danger-700 dark:hover:bg-danger-800 
                    transition-colors duration-150 ease-in-out"
                  aria-label="Logout"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
} 