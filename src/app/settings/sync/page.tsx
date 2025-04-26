'use client';

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import PageContainer from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageSection';
import SyncBatchForm from '@/components/SyncBatchForm';
import { toast } from 'react-toastify';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';

export default function SyncSettingsPage() {
  const [activeTab, setActiveTab] = useState('batch-sync');
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Lấy thông tin trạng thái đồng bộ
  useEffect(() => {
    const fetchSyncStatus = async () => {
      try {
        setLoading(true);
        
        // Lấy token xác thực
        const token = localStorage.getItem('token');
        if (!token) {
          throw new Error('Không có token xác thực');
        }
        
        // Gọi API để lấy trạng thái đồng bộ
        const response = await fetch('/api/sync/status', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          throw new Error('Không thể lấy trạng thái đồng bộ');
        }
        
        const data = await response.json();
        setSyncStatus(data);
      } catch (error: any) {
        console.error('Error fetching sync status:', error);
        toast.error(error.message || 'Lỗi khi lấy trạng thái đồng bộ');
      } finally {
        setLoading(false);
      }
    };
    
    fetchSyncStatus();
  }, []);

  // Xử lý sau khi đồng bộ thành công
  const handleSyncSuccess = () => {
    // Có thể làm mới trạng thái hoặc thực hiện hành động khác
  };

  return (
    <Layout>
      <PageContainer>
        <PageHeader 
          title="Cài đặt đồng bộ" 
          description="Quản lý các thiết lập và hoạt động đồng bộ dữ liệu"
        />
        
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="batch-sync">Đồng bộ hàng loạt</TabsTrigger>
            <TabsTrigger value="scheduler">Lịch đồng bộ tự động</TabsTrigger>
            <TabsTrigger value="logs">Lịch sử đồng bộ</TabsTrigger>
          </TabsList>
          
          <TabsContent value="batch-sync" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-medium mb-4">Đồng bộ sản phẩm</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Tính năng đồng bộ hàng loạt cho phép bạn đồng bộ nhiều sản phẩm cùng lúc với hiệu suất tối ưu thông qua worker threads.
                </p>
                <div className="bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 p-4 rounded-lg text-sm">
                  <h4 className="font-medium mb-2">Lưu ý:</h4>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Quá trình đồng bộ sẽ chạy trong nền và không bị gián đoạn ngay cả khi đóng trình duyệt</li>
                    <li>Kích thước batch tối ưu từ 10-30 sản phẩm, tùy thuộc vào cấu hình hệ thống</li>
                    <li>Đồng bộ song song giúp tăng tốc nhưng có thể đạt giới hạn API nếu cấu hình quá cao</li>
                  </ul>
                </div>
              </div>
              
              <SyncBatchForm onSuccess={handleSyncSuccess} defaultBatchSize={20} />
            </div>
            
            {/* Trạng thái đồng bộ */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md mt-8">
              <h3 className="text-lg font-medium mb-4">Trạng thái đồng bộ hiện tại</h3>
              
              {loading ? (
                <div className="animate-pulse space-y-4">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
                </div>
              ) : syncStatus ? (
                <div className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Trạng thái worker:</p>
                      <p className="font-medium">
                        {syncStatus.workerStatus === 'running' ? (
                          <span className="text-green-600 dark:text-green-400">Đang hoạt động</span>
                        ) : (
                          <span className="text-red-600 dark:text-red-400">Không hoạt động</span>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Số công việc đang chờ:</p>
                      <p className="font-medium">{syncStatus.queueStats?.waiting || 0}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Kiểm tra gần nhất:</p>
                      <p className="font-medium">
                        {syncStatus.lastCheck ? new Date(syncStatus.lastCheck).toLocaleString('vi-VN') : 'Chưa kiểm tra'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Thời gian bắt đầu:</p>
                      <p className="font-medium">
                        {syncStatus.startTime ? new Date(syncStatus.startTime).toLocaleString('vi-VN') : 'Không có dữ liệu'}
                      </p>
                    </div>
                  </div>
                  
                  {syncStatus.activeJobs && syncStatus.activeJobs.length > 0 && (
                    <div>
                      <h4 className="font-medium text-sm text-gray-500 dark:text-gray-400 mt-4 mb-2">Công việc đang xử lý:</h4>
                      <ul className="space-y-2">
                        {syncStatus.activeJobs.map((job: any, index: number) => (
                          <li key={index} className="text-sm bg-gray-50 dark:bg-gray-700 p-2 rounded">
                            ID: {job.id}, Tiến độ: {job.progress}%, Loại: {job.data?.syncType || 'Không xác định'}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400">Không có dữ liệu trạng thái đồng bộ</p>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="scheduler">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-medium mb-4">Lịch đồng bộ tự động</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Tính năng này đang được phát triển và sẽ có mặt trong phiên bản tới.
              </p>
            </div>
          </TabsContent>
          
          <TabsContent value="logs">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-medium mb-4">Lịch sử đồng bộ</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Xem lịch sử đồng bộ chi tiết trong phần Sync Logs của ứng dụng.
              </p>
              <button
                onClick={() => window.location.href = '/sync-logs'}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm text-sm font-medium"
              >
                Đi đến Sync Logs
              </button>
            </div>
          </TabsContent>
        </Tabs>
      </PageContainer>
    </Layout>
  );
} 