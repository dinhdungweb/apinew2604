'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import PageContainer from '@/components/ui/PageContainer';
import { PageHeader, PageSection } from '@/components/ui/PageSection';
import StatCard from '@/components/ui/StatCard';
import Card from '@/components/Card';
import { 
  Package, CheckCircle, AlertTriangle, 
  Database, TrendingUp, RefreshCw, Trash2, Settings, Clock
} from 'lucide-react';
import { toast } from 'react-toastify';
import { fetchDashboardStats, manualSync } from './sync-api';
import RecentActivities from '@/components/dashboard/RecentActivities';
import SyncStatusChart from '@/components/charts/SyncStatusChart';
import SyncPerformanceChart from '@/components/charts/SyncPerformanceChart';
import MetricsWidget from '@/components/dashboard/MetricsWidget';

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [syncHistory, setSyncHistory] = useState<any[]>([]);
  const [period, setPeriod] = useState('7days');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isLocalLoading, setIsLocalLoading] = useState(false);
  const [openPanel, setOpenPanel] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [syncStatus, setSyncStatus] = useState<any>(null);

  // Format thời gian
  const formatTime = (timestamp: string | number | Date) => {
    if (!timestamp) return '—';
    
    try {
      const date = timestamp instanceof Date 
        ? timestamp 
        : new Date(timestamp);
      
      return new Intl.DateTimeFormat('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    } catch (error) {
      console.error('Error formatting time:', error);
      return String(timestamp);
    }
  };

  // Lấy dữ liệu dashboard
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Lấy token xác thực
        const token = localStorage.getItem('token');
        if (!token) {
          throw new Error('Không có token xác thực');
        }

        // Gọi API để lấy dữ liệu dashboard
        const response = await fetch('/api/dashboard', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error('Lỗi khi lấy dữ liệu dashboard');
        }

        const data = await response.json();
        setDashboardData(data);
        
        // Lấy thông tin đồng bộ
        const syncResponse = await fetch('/api/sync/status', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (syncResponse.ok) {
          const syncData = await syncResponse.json();
          setSyncStatus(syncData);
        }
        
        // Lấy lịch sử đồng bộ gần đây
        const historyResponse = await fetch('/api/sync/history?limit=5', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (historyResponse.ok) {
          const historyData = await historyResponse.json();
          setSyncHistory(historyData.logs || []);
        }
      } catch (error) {
        console.error('Error loading dashboard data:', error);
        toast.error('Không thể tải dữ liệu dashboard');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router, period, refreshTrigger]);

  // Handle manual sync
  const handleManualSync = async () => {
    setSyncing(true);
    toast.info('Đang thực hiện đồng bộ dữ liệu...');
    
    try {
      // Gọi API đồng bộ thật
      await manualSync();
      toast.success('Đồng bộ dữ liệu thành công');
      setRefreshTrigger(prev => prev + 1);
    } catch (error: any) {
      console.error('Error running manual sync:', error);
      toast.error(error.message || 'Lỗi khi đồng bộ dữ liệu');
    } finally {
      setSyncing(false);
    }
  };

  // Handle change period
  const handlePeriodChange = (newPeriod: string) => {
    setPeriod(newPeriod);
  };

  return (
    <Layout>
      <PageContainer>
        <PageHeader 
          title="Dashboard" 
          description="Tổng quan về hoạt động đồng bộ dữ liệu"
          actions={
            <div className="flex gap-3">
              <select
                className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={period}
                onChange={(e) => handlePeriodChange(e.target.value)}
              >
                <option value="today">Hôm nay</option>
                <option value="yesterday">Hôm qua</option>
                <option value="7days">7 ngày qua</option>
                <option value="30days">30 ngày qua</option>
                <option value="custom">Tùy chỉnh...</option>
              </select>
              
              <button 
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm text-sm font-medium flex items-center gap-2 transition-colors"
                onClick={handleManualSync}
                disabled={syncing}
              >
                <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Đang đồng bộ...' : 'Đồng bộ ngay'}
              </button>
            </div>
          }
        />
        
        {/* Stats cards */}
        <PageSection>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard 
              title="Tổng số sản phẩm" 
              value={dashboardData?.stats?.totalProducts || 0} 
              icon={<Package className="w-5 h-5" />}
              subtitle={`Đã mapping: ${dashboardData?.stats?.mappedProductsCount || 0}`}
            />
            
            <StatCard 
              title="Đồng bộ thành công" 
              value={dashboardData?.stats?.successCount || 0} 
              icon={<CheckCircle className="w-5 h-5" />}
              change={{ value: dashboardData?.stats?.successRate || 0, type: 'increase' }}
            />
            
            <StatCard 
              title="Lỗi đồng bộ" 
              value={dashboardData?.stats?.errorCount || 0} 
              icon={<AlertTriangle className="w-5 h-5" />}
              change={{ value: 100 - (dashboardData?.stats?.successRate || 0), type: 'decrease' }}
            />
            
            <StatCard 
              title="API Calls" 
              value={dashboardData?.stats?.totalSyncs || 0} 
              icon={<Database className="w-5 h-5" />}
            />
          </div>
        </PageSection>
        
        {/* Charts */}
        <PageSection title="Biểu đồ phân tích">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card 
              title="Hiệu quả đồng bộ"
              description="Số lượng đồng bộ theo thời gian"
              loading={loading}
            >
              {loading ? (
                <div className="h-64 animate-pulse">
                  <div className="h-full bg-gray-200 dark:bg-gray-700 rounded-md"></div>
                </div>
              ) : (
                <SyncPerformanceChart 
                  dailyStats={dashboardData?.stats?.dailyStats || {}} 
                  loading={loading}
                />
              )}
            </Card>
            
            <Card 
              title="Phân bố trạng thái đồng bộ"
              description="Tỷ lệ các trạng thái đồng bộ"
              loading={loading}
            >
              {loading ? (
                <div className="h-64 animate-pulse">
                  <div className="h-full bg-gray-200 dark:bg-gray-700 rounded-md"></div>
                </div>
              ) : (
                <SyncStatusChart 
                  successCount={dashboardData?.stats?.successSyncs || 0}
                  errorCount={dashboardData?.stats?.errorSyncs || 0}
                  skippedCount={dashboardData?.stats?.skippedSyncs || 0}
                  loading={loading}
                />
              )}
            </Card>
          </div>
        </PageSection>
        
        {/* Recent activities */}
        <PageSection title="Hoạt động gần đây" description="Các hoạt động đồng bộ gần nhất">
          <Card loading={loading}>
            {loading ? (
              <div className="animate-pulse">
                {[...Array(5)].map((_, index) => (
                  <div key={index} className="py-3 border-b border-gray-200 dark:border-gray-700 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                      <div className="flex-1">
                        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <RecentActivities activities={syncHistory} loading={loading} />
            )}
          </Card>
        </PageSection>
        
        {/* System Metrics */}
        <PageSection 
          title="Thông số hệ thống" 
          description="Metrics và hiệu suất hệ thống"
          actions={
            <button
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 rounded-lg shadow-sm text-sm font-medium flex items-center gap-1 transition-colors"
              onClick={() => {
                setIsLocalLoading(true);
                setTimeout(() => setIsLocalLoading(false), 1000);
              }}
            >
              <RefreshCw className={`w-4 h-4 ${isLocalLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Làm mới</span>
            </button>
          }
        >
          <MetricsWidget 
            onRefresh={() => setIsLocalLoading(true)} 
          />
        </PageSection>
        
        {/* Admin tools */}
        <PageSection title="Công cụ quản trị" className="mt-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card
              title="Tạo dữ liệu mẫu"
              description="Tạo dữ liệu mẫu để kiểm thử hệ thống"
              hoverable
              clickable
              onClick={async () => {
                try {
                  toast.info('Đang tạo dữ liệu mẫu...');
                  const response = await fetch('/api/demo/generate-data');
                  if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Lỗi khi tạo dữ liệu mẫu');
                  }
                  const result = await response.json();
                  toast.success(`Đã tạo ${result.stats.products} sản phẩm và ${result.stats.logs} logs thành công!`);
                  
                  // Làm mới dữ liệu từ Shopify API
                  try {
                    toast.info('Đang làm mới dữ liệu sản phẩm từ Shopify...');
                    const refreshResponse = await fetch('/api/products/refresh-cache', {
                      method: 'POST',
                      headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`,
                        'Content-Type': 'application/json'
                      }
                    });
                    
                    if (refreshResponse.ok) {
                      toast.success('Làm mới dữ liệu sản phẩm thành công');
                    }
                  } catch (refreshError) {
                    console.error('Lỗi khi làm mới dữ liệu sản phẩm:', refreshError);
                  }
                  
                  // Cập nhật lại dữ liệu dashboard
                  setRefreshTrigger(prev => prev + 1);
                } catch (error: any) {
                  console.error('Error generating demo data:', error);
                  toast.error(`Lỗi: ${error.message}`);
                }
              }}
            >
              <div className="flex items-center justify-center py-4">
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg shadow-sm hover:bg-blue-700 transition-colors flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  <span>Tạo dữ liệu</span>
                </button>
              </div>
            </Card>
            
            <Card
              title="Làm sạch dữ liệu"
              description="Xóa dữ liệu đồng bộ không cần thiết"
              hoverable
              clickable
              onClick={async () => {
                try {
                  if (window.confirm('Bạn có chắc chắn muốn xóa nhật ký đồng bộ không?')) {
                    toast.info('Đang xóa nhật ký đồng bộ...');
                    
                    const response = await fetch('/api/sync/history/clear', {
                      method: 'DELETE',
                      headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`,
                        'Content-Type': 'application/json'
                      }
                    });
                    
                    if (!response.ok) {
                      const errorData = await response.json();
                      throw new Error(errorData.message || 'Không thể xóa nhật ký đồng bộ');
                    }
                    
                    const result = await response.json();
                    toast.success(`Đã xóa ${result.count || 0} bản ghi đồng bộ thành công!`);
                    
                    // Làm mới dữ liệu
                    setRefreshTrigger(prev => prev + 1);
                  }
                } catch (error: any) {
                  console.error('Error clearing sync logs:', error);
                  toast.error(`Lỗi: ${error.message}`);
                }
              }}
            >
              <div className="flex items-center justify-center py-4">
                <button className="px-4 py-2 bg-red-600 text-white rounded-lg shadow-sm hover:bg-red-700 transition-colors flex items-center gap-2">
                  <Trash2 className="w-4 h-4" />
                  <span>Xóa logs</span>
                </button>
              </div>
            </Card>
            
            <Card
              title="Cấu hình nâng cao"
              description="Thiết lập các tùy chọn nâng cao"
              hoverable
              clickable
              onClick={() => router.push('/settings')}
            >
              <div className="flex items-center justify-center py-4">
                <button className="px-4 py-2 bg-gray-600 dark:bg-gray-700 text-white rounded-lg shadow-sm hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  <span>Thiết lập</span>
                </button>
              </div>
            </Card>
            
            <Card
              title="Kiểm tra kết nối Shopify"
              description="Kiểm tra kết nối API với Shopify"
              hoverable
              clickable
              onClick={async () => {
                try {
                  toast.info('Đang kiểm tra kết nối Shopify API...');
                  
                  const response = await fetch('/api/products/check-connection', {
                    headers: {
                      'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                  });
                  
                  const result = await response.json();
                  
                  if (result.success) {
                    toast.success(`Kết nối thành công! Số sản phẩm: ${result.data.count}`);
                    console.log('Chi tiết kết nối:', result);
                  } else {
                    toast.error(`Lỗi kết nối: ${result.error.message}`);
                    console.error('Chi tiết lỗi:', result.error);
                  }
                } catch (error: any) {
                  toast.error(`Lỗi kiểm tra: ${error.message}`);
                  console.error('Lỗi:', error);
                }
              }}
            >
              <div className="flex items-center justify-center py-4">
                <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg shadow-sm hover:bg-indigo-700 transition-colors flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  <span>Kiểm tra</span>
                </button>
              </div>
            </Card>
          </div>
        </PageSection>
      </PageContainer>
    </Layout>
  );
}