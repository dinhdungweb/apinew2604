'use client';

import { useState, useEffect } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { ClockIcon, CheckCircleIcon, XCircleIcon, MinusCircleIcon } from '@heroicons/react/24/outline';

interface SyncActivity {
  id: string;
  productId: string;
  productName: string;
  status: 'success' | 'error' | 'skipped';
  timestamp: string;
  errorMessage?: string;
  source: 'shopify' | 'nhanh';
  target: 'shopify' | 'nhanh';
}

interface RecentActivitiesProps {
  limit?: number;
  activities?: SyncActivity[];
  loading?: boolean;
}

const StatusIcon = ({ status }: { status: string }) => {
  switch (status) {
    case 'success':
      return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
    case 'error':
      return <XCircleIcon className="h-5 w-5 text-red-500" />;
    case 'skipped':
      return <MinusCircleIcon className="h-5 w-5 text-amber-500" />;
    default:
      return <ClockIcon className="h-5 w-5 text-gray-400" />;
  }
};

const RecentActivities: React.FC<RecentActivitiesProps> = ({ 
  limit = 5, 
  activities: initialActivities, 
  loading: initialLoading 
}) => {
  const [activities, setActivities] = useState<SyncActivity[]>(initialActivities || []);
  const [loading, setLoading] = useState<boolean>(initialLoading !== undefined ? initialLoading : true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Nếu đã có activities từ props, không cần fetch
    if (initialActivities) {
      setActivities(initialActivities);
      return;
    }
    
    const fetchRecentActivities = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/sync/logs?limit=${limit}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch recent activities');
        }
        
        const data = await response.json();
        setActivities(data.logs || []);
      } catch (err) {
        console.error('Error fetching recent activities:', err);
        setError('Không thể tải dữ liệu hoạt động gần đây');
      } finally {
        setLoading(false);
      }
    };

    fetchRecentActivities();
  }, [limit, initialActivities]);

  // Cập nhật state khi props thay đổi
  useEffect(() => {
    if (initialActivities) {
      setActivities(initialActivities);
    }
  }, [initialActivities]);
  
  useEffect(() => {
    if (initialLoading !== undefined) {
      setLoading(initialLoading);
    }
  }, [initialLoading]);

  // Hiển thị skeleton loader khi đang loading
  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(limit)].map((_, index) => (
          <div key={index} className="flex items-start space-x-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg animate-pulse">
            <div className="h-5 w-5 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Hiển thị thông báo lỗi nếu có
  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-lg">
        {error}
      </div>
    );
  }

  // Hiển thị thông báo nếu không có hoạt động
  if (activities.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        Chưa có hoạt động đồng bộ nào
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {activities.map((activity) => (
        <div key={activity.id} className="flex items-start space-x-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-750 transition">
          <StatusIcon status={activity.status} />
          
          <div className="flex-1">
            <h4 className="font-medium text-gray-900 dark:text-gray-100">
              {activity.productName || `Sản phẩm #${activity.productId}`}
            </h4>
            
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {activity.status === 'success' && `Đồng bộ thành công từ ${activity.source} sang ${activity.target}`}
              {activity.status === 'error' && `Lỗi đồng bộ: ${activity.errorMessage || 'Không xác định'}`}
              {activity.status === 'skipped' && 'Bỏ qua đồng bộ - không có thay đổi'}
            </p>
            
            <div className="flex items-center mt-2 text-xs text-gray-400">
              <ClockIcon className="h-3 w-3 mr-1" />
              <time dateTime={activity.timestamp} title={format(new Date(activity.timestamp), 'PPpp', { locale: vi })}>
                {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true, locale: vi })}
              </time>
            </div>
          </div>
        </div>
      ))}
      
      <div className="text-center">
        <a href="/activities" className="inline-block text-sm text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
          Xem tất cả hoạt động
        </a>
      </div>
    </div>
  );
};

export default RecentActivities; 