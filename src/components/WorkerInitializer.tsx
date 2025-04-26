'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAppContext } from '@/context/AppContext';

/**
 * Component để khởi tạo worker đồng bộ khi ứng dụng được tải
 */
const WorkerInitializer = () => {
  const { token } = useAppContext();
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initializeWorker = useCallback(async () => {
    // Chỉ khởi tạo nếu có token (đã đăng nhập)
    if (!token) return;

    try {
      // Kiểm tra trạng thái worker
      const checkResponse = await fetch('/api/sync/worker', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (checkResponse.ok) {
        const data = await checkResponse.json();
        
        // Nếu worker đã được khởi tạo, không cần khởi tạo lại
        if (data.success && data.worker && data.worker.isInitialized) {
          console.log('[Worker] Đã được khởi tạo từ trước');
          setInitialized(true);
          return;
        }
      }

      // Khởi tạo worker
      const response = await fetch('/api/sync/worker', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          console.log('[Worker] Khởi tạo thành công');
          setInitialized(true);
        } else {
          setError(data.message || 'Không thể khởi tạo worker');
          console.error('[Worker Error]', data.message);
        }
      } else {
        setError('Không thể kết nối đến máy chủ');
        console.error('[Worker Error] HTTP error:', response.status);
      }
    } catch (error: any) {
      setError(error.message || 'Lỗi không xác định');
      console.error('[Worker Error]', error);
    }
  }, [token]);

  useEffect(() => {
    if (token && !initialized && !error) {
      // Thử khởi tạo sau 2 giây để đảm bảo app đã load đầy đủ
      const timer = setTimeout(() => {
        initializeWorker();
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [token, initialized, error, initializeWorker]);

  // Component này không render gì cả
  return null;
};

export default WorkerInitializer; 