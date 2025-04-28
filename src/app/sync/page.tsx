'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/context/AppContext';
import Layout from '@/components/Layout';
import PageContainer, { PageHeader } from '@/components/ui/PageContainer';
import {
  RefreshCw, PlayCircle, StopCircle, 
  Clock, CheckCircle, XCircle, Settings,
  FileBarChart, Zap, Package, HelpCircle
} from 'lucide-react';
import { toast } from 'react-toastify';
import Card from '@/components/Card';
import Button from '@/components/Button';
import { cn } from '@/lib/utils';

interface SyncStats {
  total: number;
  success: number;
  error: number;
  skipped: number;
  startTime: string | null;
  endTime: string | null;
  currentProduct: string;
  progress: number;
}

interface SyncStatus {
  inProgress: boolean;
  lastSyncTime: string | null;
  stats: SyncStats;
}

// Đơn giản hóa component SyncProgress
const SyncProgress = ({ progress = 0 }) => (
  <div className="w-full bg-gray-200 rounded-full h-2.5">
    <div 
      className="bg-blue-600 h-2.5 rounded-full" 
      style={{ width: `${progress}%` }}
    ></div>
  </div>
);

export default function SyncPage() {
  const { token } = useAppContext();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<SyncStatus>({
    inProgress: false,
    lastSyncTime: null,
    stats: {
      total: 0,
      success: 0,
      error: 0,
      skipped: 0,
      startTime: null,
      endTime: null,
      currentProduct: '',
      progress: 0
    }
  });
  const [syncType, setSyncType] = useState<string>('inventory');
  const [syncAll, setSyncAll] = useState<boolean>(false);
  const [isStarting, setIsStarting] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [warehouseId, setWarehouseId] = useState<string>('175080');
  const [warehouses, setWarehouses] = useState<{id: string, name: string}[]>([
    {id: '175080', name: 'Kho mặc định (175080)'},
    {id: 'all', name: 'Tất cả các kho'},
  ]);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  // Hàm kiểm tra trạng thái đồng bộ
  const checkSyncStatus = async () => {
    try {
      if (!token) return;

      const response = await fetch('/api/sync/auto', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (error) {
      console.error('Lỗi khi kiểm tra trạng thái đồng bộ:', error);
    } finally {
      setLoading(false);
    }
  };

  // Khởi tạo
  useEffect(() => {
    if (!token) {
      router.push('/login');
      return;
    }
    
    // Kiểm tra trạng thái ban đầu
    checkSyncStatus();
    
    // Thiết lập refresh interval
    const interval = setInterval(checkSyncStatus, 3000);
    setRefreshInterval(interval);

    // Cleanup
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [token, router]);

  const startSync = async () => {
    if (!token) {
      toast.error('Vui lòng đăng nhập lại');
      return;
    }
    
    setIsStarting(true);
    
    try {
      const response = await fetch('/api/sync/manual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          syncType,
          syncAll,
          warehouseId
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          toast.success('Đồng bộ đã được bắt đầu');
          await checkSyncStatus();
        } else {
          toast.error(`Lỗi khi bắt đầu đồng bộ: ${data.message}`);
        }
      } else {
        toast.error('Lỗi kết nối đến máy chủ');
      }
    } catch (error) {
      console.error('Error starting sync:', error);
      toast.error('Lỗi khi bắt đầu đồng bộ');
    } finally {
      setIsStarting(false);
    }
  };

  // Format thời gian
  const formatTime = (timeString: string | null) => {
    if (!timeString) return '—';
    
    try {
      const date = new Date(timeString);
      return date.toLocaleString('vi-VN', {
        year: 'numeric',
        month: '2-digit', 
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch (error) {
      return timeString;
    }
  };

  // Tính thời gian đã trôi qua
  const getElapsedTime = () => {
    if (!status?.stats?.startTime) return '0 giây';

    const start = new Date(status?.stats?.startTime).getTime();
    const end = status?.stats?.endTime ? new Date(status?.stats?.endTime).getTime() : Date.now();
    const diffMs = end - start;
    
    const seconds = Math.floor(diffMs / 1000);
    if (seconds < 60) return `${seconds} giây`;
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes < 60) {
      return `${minutes} phút ${remainingSeconds} giây`;
    }
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    return `${hours} giờ ${remainingMinutes} phút ${remainingSeconds} giây`;
  };

  return (
    <Layout>
      <PageContainer>
        <PageHeader 
          title="Đồng bộ tự động" 
          description="Đồng bộ hàng loạt sản phẩm giữa Shopify và Nhanh.vn"
          actions={
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                onClick={checkSyncStatus}
                className={cn("flex items-center gap-1", isRefreshing && "animate-spin")}
                disabled={isRefreshing}
              >
                <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
                <span>Làm mới</span>
              </Button>
              <button
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg shadow-sm text-sm font-medium flex items-center transition-colors"
                onClick={startSync}
                disabled={status.inProgress || isStarting}
              >
                {status.inProgress ? (
                  <StopCircle className="w-4 h-4 mr-2" />
                ) : (
                  <PlayCircle className="w-4 h-4 mr-2" />
                )}
                {status.inProgress ? 'Đang chạy...' : 'Bắt đầu đồng bộ'}
              </button>
              <button
                className="px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg shadow-sm text-sm font-medium flex items-center transition-colors"
                onClick={() => router.push('/settings/system')}
              >
                <Settings className="w-4 h-4 mr-2" />
                Cài đặt
              </button>
            </div>
          }
        />
        
        {/* Cấu hình đồng bộ */}
        <div className="mb-6">
          <Card>
            <div className="p-6">
              <h2 className="text-lg font-semibold mb-4">Thiết lập đồng bộ</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Loại đồng bộ
                  </label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={syncType}
                    onChange={(e) => setSyncType(e.target.value as any)}
                  >
                    <option value="all">Đồng bộ tất cả dữ liệu</option>
                    <option value="inventory">Chỉ đồng bộ tồn kho</option>
                    <option value="price">Chỉ đồng bộ giá</option>
                    <option value="orders">Đơn hàng</option>
                  </select>
                </div>
                
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Kho đồng bộ
                  </label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={warehouseId}
                    onChange={(e) => setWarehouseId(e.target.value)}
                  >
                    {warehouses.map(warehouse => (
                      <option key={warehouse.id} value={warehouse.id}>
                        {warehouse.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                {/* Thêm checkbox đồng bộ tất cả sản phẩm */}
                <div className="flex-1">
                  <div className="mt-8 flex items-center">
                    <input
                      type="checkbox"
                      id="syncAll"
                      checked={syncAll}
                      onChange={() => setSyncAll(!syncAll)}
                      className="h-4 w-4 border-gray-300 rounded text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="syncAll" className="ml-2 text-sm text-slate-700">
                      Đồng bộ tất cả sản phẩm (bao gồm cả sản phẩm lỗi)
                    </label>
                  </div>
                  {syncAll && (
                    <div className="mt-2 text-xs text-amber-600 bg-amber-50 p-2 rounded-md">
                      <b>Lưu ý:</b> Tùy chọn này sẽ đồng bộ lại TẤT CẢ sản phẩm, bao gồm cả những sản phẩm đang có trạng thái lỗi.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </div>
        
        {/* Thống kê và trạng thái */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <Card>
            <div className="p-6">
              <h2 className="text-lg font-semibold mb-4">Trạng thái đồng bộ</h2>
              
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-500">Trạng thái:</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.inProgress ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                    {status.inProgress ? 'Đang chạy' : 'Đã dừng'}
                  </span>
                </div>
                
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-500">Đồng bộ lần cuối:</span>
                  <span className="text-sm font-medium">
                    {formatTime(status.lastSyncTime)}
                  </span>
                </div>
                
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-500">Thời gian bắt đầu:</span>
                  <span className="text-sm font-medium">
                    {formatTime(status?.stats?.startTime)}
                  </span>
                </div>
                
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-500">Thời gian kết thúc:</span>
                  <span className="text-sm font-medium">
                    {status.inProgress ? '—' : formatTime(status?.stats?.endTime)}
                  </span>
                </div>
                
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-500">Thời gian chạy:</span>
                  <span className="text-sm font-medium">
                    {getElapsedTime()}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Sản phẩm hiện tại:</span>
                  <span className="text-sm font-medium truncate max-w-[180px]">
                    {status?.stats?.currentProduct || '—'}
                  </span>
                </div>
              </div>
              
              <div className="mt-4">
                <div className="flex justify-between mb-1">
                  <span className="text-sm text-gray-500">Tiến trình: {status?.stats?.progress || 0}%</span>
                </div>
                <SyncProgress progress={status?.stats?.progress || 0} />
              </div>
            </div>
          </Card>
          
          <Card>
            <div className="p-6">
              <h2 className="text-lg font-semibold mb-4">Kết quả đồng bộ</h2>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-500">Tổng số sản phẩm:</span>
                    <span className="text-sm font-medium">
                      {status?.stats?.total || 0}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-500 flex items-center">
                      <Package className="w-4 h-4 mr-1 text-gray-400" />
                      Sản phẩm đã xử lý:
                    </span>
                    <span className="text-sm font-medium">
                      {(status?.stats?.success || 0) + (status?.stats?.error || 0) + (status?.stats?.skipped || 0)}
                    </span>
                  </div>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-500 flex items-center">
                      <CheckCircle className="w-4 h-4 mr-1 text-green-500" />
                      Thành công:
                    </span>
                    <span className="text-sm font-medium text-green-600">
                      {status?.stats?.success || 0}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-500 flex items-center">
                      <XCircle className="w-4 h-4 mr-1 text-red-500" />
                      Lỗi:
                    </span>
                    <span className="text-sm font-medium text-red-600">
                      {status?.stats?.error || 0}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500 flex items-center">
                      <Clock className="w-4 h-4 mr-1 text-gray-400" />
                      Bỏ qua:
                    </span>
                    <span className="text-sm font-medium">
                      {status?.stats?.skipped || 0}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Biểu đồ */}
              <div className="mt-4">
                <div className="h-16 bg-gray-50 rounded-lg overflow-hidden flex items-stretch">
                  {(status?.stats?.total || 0) > 0 && (
                    <>
                      <div 
                        className="bg-green-500 h-full flex items-center justify-center text-xs text-white font-medium" 
                        style={{ width: `${((status?.stats?.success || 0) / (status?.stats?.total || 1)) * 100}%` }}
                      >
                        {Math.round(((status?.stats?.success || 0) / (status?.stats?.total || 1)) * 100)}%
                      </div>
                      <div 
                        className="bg-red-500 h-full flex items-center justify-center text-xs text-white font-medium" 
                        style={{ width: `${((status?.stats?.error || 0) / (status?.stats?.total || 1)) * 100}%` }}
                      >
                        {Math.round(((status?.stats?.error || 0) / (status?.stats?.total || 1)) * 100)}%
                      </div>
                      <div 
                        className="bg-gray-300 h-full flex items-center justify-center text-xs text-gray-700 font-medium" 
                        style={{ width: `${((status?.stats?.skipped || 0) / (status?.stats?.total || 1)) * 100}%` }}
                      >
                        {Math.round(((status?.stats?.skipped || 0) / (status?.stats?.total || 1)) * 100)}%
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </div>
        
        {/* Ghi chú hướng dẫn */}
        <Card>
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-4">Hướng dẫn</h2>
            
            <div className="space-y-4">
              <div className="flex items-start">
                <div className="bg-gray-100 p-2 rounded-full mr-3">
                  <Zap className="w-5 h-5 text-primary-600" />
                </div>
                <div>
                  <h3 className="text-sm font-medium">Đồng bộ tự động</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Nhấn nút "Bắt đầu đồng bộ" để đồng bộ tất cả sản phẩm đã được mapping. Quá trình sẽ diễn ra ở nền và bạn có thể theo dõi tiến trình ở đây.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="bg-gray-100 p-2 rounded-full mr-3">
                  <Settings className="w-5 h-5 text-primary-600" />
                </div>
                <div>
                  <h3 className="text-sm font-medium">Cài đặt đồng bộ tự động</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Bạn có thể thiết lập thời gian đồng bộ tự động định kỳ trong mục "Cài đặt hệ thống". Hãy đảm bảo rằng bạn đã bật tính năng "Đồng bộ tự động".
                  </p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="bg-gray-100 p-2 rounded-full mr-3">
                  <FileBarChart className="w-5 h-5 text-primary-600" />
                </div>
                <div>
                  <h3 className="text-sm font-medium">Xem lịch sử đồng bộ</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Bạn có thể xem lịch sử đồng bộ chi tiết trong phần "Báo cáo" hoặc tại trang "Lịch sử đồng bộ". Nó giúp bạn theo dõi quá trình đồng bộ và xác định các lỗi.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </PageContainer>
    </Layout>
  );
} 