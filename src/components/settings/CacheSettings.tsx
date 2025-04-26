import React, { useState, useEffect } from 'react';
import Card from '@/components/Card';
import { RefreshCw, Trash2, Clock } from 'lucide-react';
import { toast } from 'react-toastify';

export default function CacheSettings() {
  const [loading, setLoading] = useState(true);
  const [cacheInfo, setCacheInfo] = useState<{
    timestamp: number;
    isExpired: boolean;
    expiresIn: string;
    itemCount: number;
  }>({
    timestamp: 0,
    isExpired: true,
    expiresIn: '0',
    itemCount: 0
  });

  const formatTime = (timestamp: number) => {
    if (!timestamp) return '—';
    return new Date(timestamp).toLocaleString('vi-VN');
  };

  const calculateExpiresIn = (timestamp: number) => {
    if (!timestamp) return '—';
    const expiryTime = timestamp + 5 * 60 * 1000; // 5 phút (từ shopifyCache.ts)
    const now = Date.now();
    
    if (now > expiryTime) return 'Đã hết hạn';
    
    const diff = expiryTime - now;
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    
    return `${minutes} phút ${seconds} giây`;
  };

  const fetchCacheInfo = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/products/cache-info', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Không thể lấy thông tin cache');
      }
      
      const data = await response.json();
      setCacheInfo({
        timestamp: data.timestamp || 0,
        isExpired: data.isExpired || true,
        expiresIn: calculateExpiresIn(data.timestamp),
        itemCount: data.itemCount || 0
      });
    } catch (error) {
      console.error('Error fetching cache info:', error);
      toast.error('Không thể lấy thông tin cache');
    } finally {
      setLoading(false);
    }
  };

  const handleClearCache = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/products/refresh-cache', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Không thể xóa cache');
      }
      
      await fetchCacheInfo();
      toast.success('Đã xóa cache thành công');
    } catch (error) {
      console.error('Error clearing cache:', error);
      toast.error('Không thể xóa cache');
    }
  };

  useEffect(() => {
    fetchCacheInfo();
    
    // Cập nhật thông tin cache mỗi 30 giây
    const interval = setInterval(() => {
      fetchCacheInfo();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      <Card title="Quản lý cache" loading={loading}>
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Trạng thái cache
                </h3>
                <div className={`w-3 h-3 rounded-full ${cacheInfo.isExpired ? 'bg-red-500' : 'bg-green-500'}`}></div>
              </div>
              <p className="text-lg font-semibold">
                {cacheInfo.isExpired ? 'Hết hạn' : 'Hoạt động'}
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="flex items-center mb-2">
                <Clock className="w-4 h-4 text-gray-500 mr-2" />
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Cập nhật lần cuối
                </h3>
              </div>
              <p className="text-lg font-semibold">
                {formatTime(cacheInfo.timestamp)}
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="flex items-center mb-2">
                <Clock className="w-4 h-4 text-gray-500 mr-2" />
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Thời gian còn lại
                </h3>
              </div>
              <p className={`text-lg font-semibold ${cacheInfo.isExpired ? 'text-red-500' : 'text-green-500'}`}>
                {cacheInfo.expiresIn}
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="flex items-center mb-2">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Số lượng sản phẩm
                </h3>
              </div>
              <p className="text-lg font-semibold">
                {cacheInfo.itemCount}
              </p>
            </div>
          </div>

          <div className="flex gap-4 mt-6">
            <button
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg shadow-sm flex items-center gap-2 transition-colors"
              onClick={fetchCacheInfo}
            >
              <RefreshCw className="w-4 h-4" />
              <span>Làm mới</span>
            </button>
            
            <button
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-sm flex items-center gap-2 transition-colors"
              onClick={handleClearCache}
            >
              <Trash2 className="w-4 h-4" />
              <span>Xóa cache</span>
            </button>
          </div>
        </div>
      </Card>

      <Card title="Cài đặt cache">
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="cache-ttl" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Thời gian cache (phút)
              </label>
              <input
                id="cache-ttl"
                type="number"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800"
                defaultValue={5}
                min={1}
                max={60}
              />
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Thời gian giữ cache trước khi làm mới (1-60 phút)
              </p>
            </div>

            <div>
              <label htmlFor="auto-refresh" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Tự động làm mới
              </label>
              <select
                id="auto-refresh"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800"
                defaultValue="always"
              >
                <option value="always">Luôn luôn</option>
                <option value="on_expired">Khi hết hạn</option>
                <option value="never">Không bao giờ</option>
              </select>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Khi nào hệ thống nên tự động làm mới cache
              </p>
            </div>
          </div>

          <div className="mt-4">
            <button
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg shadow-sm flex items-center gap-2 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Lưu cài đặt</span>
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
} 