import React, { useState, useEffect } from 'react';
import { Bell, X, Settings, Check, AlertCircle, Info } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  time: Date;
  read: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export default function NotificationCenter() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  
  // Fetch notifications (mock data for now)
  useEffect(() => {
    // In a real app, you would fetch from API
    const mockNotifications: Notification[] = [
      {
        id: '1',
        title: 'Đồng bộ hoàn tất',
        message: '154 sản phẩm đã được đồng bộ thành công',
        type: 'success',
        time: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
        read: false
      },
      {
        id: '2',
        title: 'Lỗi đồng bộ',
        message: 'Không thể đồng bộ 3 sản phẩm do thiếu thông tin',
        type: 'error',
        time: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
        read: false
      },
      {
        id: '3',
        title: 'Cập nhật hệ thống',
        message: 'Hệ thống sẽ bảo trì trong 2 giờ tới',
        type: 'info',
        time: new Date(Date.now() - 1000 * 60 * 60 * 5), // 5 hours ago
        read: true
      },
      {
        id: '4',
        title: 'API Key sắp hết hạn',
        message: 'API Key Shopify sẽ hết hạn trong 3 ngày',
        type: 'warning',
        time: new Date(Date.now() - 1000 * 60 * 60 * 12), // 12 hours ago
        read: true
      }
    ];
    
    setNotifications(mockNotifications);
  }, []);
  
  const markAsRead = (id: string) => {
    // In a real app, you would call API
    setNotifications(prev => 
      prev.map(notif => 
        notif.id === id ? { ...notif, read: true } : notif
      )
    );
  };
  
  const markAllAsRead = () => {
    // In a real app, you would call API
    setNotifications(prev => 
      prev.map(notif => ({ ...notif, read: true }))
    );
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <Check className="w-4 h-4 text-success-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-danger-500" />;
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-warning-500" />;
      default:
        return <Info className="w-4 h-4 text-primary-500" />;
    }
  };

  const getNotificationBg = (type: string, read: boolean) => {
    if (read) return '';
    
    switch (type) {
      case 'success':
        return 'bg-success-50 dark:bg-success-900/10';
      case 'error':
        return 'bg-danger-50 dark:bg-danger-900/10';
      case 'warning':
        return 'bg-warning-50 dark:bg-warning-900/10';
      default:
        return 'bg-primary-50 dark:bg-primary-900/10';
    }
  };
  
  const unreadCount = notifications.filter(n => !n.read).length;
  
  return (
    <div className="relative">
      <button 
        className="relative p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 w-4 h-4 bg-danger-500 text-white text-xs flex items-center justify-center rounded-full">
            {unreadCount}
          </span>
        )}
      </button>
      
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
          <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-dropdown border border-gray-200 dark:border-gray-700 z-50 animate-fade-in">
            <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">Thông báo</h3>
              {unreadCount > 0 && (
                <button 
                  className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
                  onClick={(e) => {
                    e.stopPropagation();
                    markAllAsRead();
                  }}
                >
                  Đánh dấu đã đọc
                </button>
              )}
            </div>
            
            <div className="max-h-[400px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                  Không có thông báo
                </div>
              ) : (
                notifications.map(notification => (
                  <div 
                    key={notification.id}
                    className={`p-3 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer ${
                      getNotificationBg(notification.type, notification.read)
                    }`}
                    onClick={() => markAsRead(notification.id)}
                  >
                    <div className="flex gap-3">
                      <div className={`flex-shrink-0 mt-1`}>
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{notification.title}</p>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {formatDistanceToNow(notification.time, { addSuffix: true })}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">{notification.message}</p>
                        
                        {notification.action && (
                          <button 
                            className="mt-2 text-xs font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
                            onClick={(e) => {
                              e.stopPropagation();
                              notification.action?.onClick();
                            }}
                          >
                            {notification.action.label}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            <div className="p-3 text-center border-t border-gray-200 dark:border-gray-700">
              <button className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300">
                Xem tất cả thông báo
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
} 