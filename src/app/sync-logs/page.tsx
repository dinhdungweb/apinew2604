'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import PageContainer from '@/components/ui/PageContainer';
import { PageHeader, PageSection } from '@/components/ui/PageSection';
import Card from '@/components/Card';
import { 
  Search, Filter, RefreshCw, Download, 
  Clock, CheckCircle, AlertTriangle, XCircle,
  ArrowUpDown, Calendar
} from 'lucide-react';
import { toast } from 'react-toastify';

// Tạo dữ liệu mẫu cho logs
const mockLogs = Array(100).fill(null).map((_, index) => {
  const statusOptions = ['success', 'error', 'warning', 'pending'];
  const status = statusOptions[Math.floor(Math.random() * statusOptions.length)];
  
  const productTypes = ['Lazada', 'Shopee', 'TikTok', 'WooCommerce', 'Magento', 'Local Database'];
  const productType = productTypes[Math.floor(Math.random() * productTypes.length)];
  
  // Ngày giảm dần để hiển thị gần đây nhất trước
  const days = Math.floor(Math.random() * 30);
  const hours = Math.floor(Math.random() * 24);
  const minutes = Math.floor(Math.random() * 60);
  const timestamp = new Date();
  timestamp.setDate(timestamp.getDate() - days);
  timestamp.setHours(timestamp.getHours() - hours);
  timestamp.setMinutes(timestamp.getMinutes() - minutes);
  
  let message = '';
  let detail = '';
  
  if (status === 'success') {
    message = `Đồng bộ thành công từ ${productType}`;
    detail = `Đã đồng bộ ${Math.floor(Math.random() * 100) + 1} sản phẩm từ ${productType}`;
  } else if (status === 'error') {
    message = `Lỗi đồng bộ từ ${productType}`;
    detail = `Không thể kết nối đến API của ${productType}. Timeout sau 30 giây.`;
  } else if (status === 'warning') {
    message = `Cảnh báo khi đồng bộ từ ${productType}`;
    detail = `${Math.floor(Math.random() * 10) + 1} sản phẩm có thông tin không đầy đủ.`;
  } else {
    message = `Đang đồng bộ từ ${productType}`;
    detail = `Đang xử lý ${Math.floor(Math.random() * 100) + 1} sản phẩm...`;
  }
  
  return {
    id: `LOG${100000 + index}`,
    timestamp,
    status,
    message,
    detail,
    source: productType,
    duration: status === 'pending' ? null : Math.floor(Math.random() * 300) + 1,
    itemsProcessed: status === 'pending' ? null : Math.floor(Math.random() * 1000) + 1,
  };
}).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

// Định dạng thời gian
const formatTime = (date: Date) => {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(date);
};

// Định dạng thời lượng
const formatDuration = (seconds: number | null) => {
  if (seconds === null) return 'Đang tính toán...';
  
  if (seconds < 60) {
    return `${seconds} giây`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes} phút ${remainingSeconds} giây`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours} giờ ${minutes} phút`;
  }
};

export default function SyncLogsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<any[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<any[]>([]);
  
  // Phân trang
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  
  // Tìm kiếm và lọc
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    status: '',
    source: '',
    dateRange: 'all',
  });
  
  // Custom date range
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);
  
  // Thêm các state mới
  const [totalItems, setTotalItems] = useState(0);
  const [statusCounts, setStatusCounts] = useState({
    success: 0,
    error: 0,
    warning: 0,
    pending: 0
  });
  const [availableSources, setAvailableSources] = useState<{name: string, count: number}[]>([]);

  // Load logs data
  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      try {
        // Sử dụng API thực
        const token = localStorage.getItem('token');
        if (!token) {
          router.push('/login');
          return;
        }

        // Xây dựng tham số truy vấn
        const queryParams = new URLSearchParams({
          page: currentPage.toString(),
          pageSize: itemsPerPage.toString()
        });

        // Thêm các tham số tìm kiếm và lọc
        if (searchTerm) {
          queryParams.set('search', searchTerm);
        }

        if (filters.status) {
          queryParams.set('status', filters.status);
        }

        if (filters.source) {
          queryParams.set('source', filters.source);
        }

        // Xử lý lọc theo thời gian
        if (filters.dateRange === 'today') {
          const today = new Date();
          queryParams.set('dateFrom', today.toISOString().split('T')[0]);
        } else if (filters.dateRange === 'yesterday') {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          queryParams.set('dateFrom', yesterday.toISOString().split('T')[0]);
          queryParams.set('dateTo', yesterday.toISOString().split('T')[0]);
        } else if (filters.dateRange === 'week') {
          const lastWeek = new Date();
          lastWeek.setDate(lastWeek.getDate() - 7);
          queryParams.set('dateFrom', lastWeek.toISOString().split('T')[0]);
        } else if (filters.dateRange === 'month') {
          const lastMonth = new Date();
          lastMonth.setMonth(lastMonth.getMonth() - 1);
          queryParams.set('dateFrom', lastMonth.toISOString().split('T')[0]);
        } else if (filters.dateRange === 'custom') {
          if (dateFrom) {
            queryParams.set('dateFrom', dateFrom.toISOString().split('T')[0]);
          }
          if (dateTo) {
            queryParams.set('dateTo', dateTo.toISOString().split('T')[0]);
          }
        }

        const response = await fetch(`/api/sync/check-logs?${queryParams.toString()}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error('Không thể tải dữ liệu');
        }

        const data = await response.json();
        
        // Cập nhật logs từ API
        setLogs(data.logs || []);
        setFilteredLogs(data.logs || []);
        
        // Cập nhật thông tin phân trang
        if (data.pagination) {
          setTotalItems(data.pagination.totalItems);
          setCurrentPage(data.pagination.currentPage);
        }
        
        // Cập nhật thông tin thống kê nếu có
        if (data.statistics) {
          // Có thể cập nhật thêm các state cho các số liệu thống kê
          setStatusCounts(data.statistics.statusCounts);
          setAvailableSources(data.statistics.sources);
        }
      } catch (error) {
        console.error('Error fetching logs:', error);
        toast.error('Không thể tải dữ liệu nhật ký đồng bộ');
        
        // Fallback to mock data if API fails
        setLogs(mockLogs);
        setFilteredLogs(mockLogs);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [currentPage, itemsPerPage, searchTerm, filters, dateFrom, dateTo, router]);

  // Xử lý tìm kiếm và lọc
  useEffect(() => {
    // Lọc theo tìm kiếm và bộ lọc
    const result = logs.filter(log => {
      // Tìm kiếm
      const searchMatch = 
        searchTerm === '' || 
        log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.detail.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.id.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Lọc theo trạng thái
      const statusMatch = 
        filters.status === '' || 
        log.status === filters.status;
      
      // Lọc theo nguồn
      const sourceMatch = 
        filters.source === '' || 
        log.source === filters.source;
      
      // Lọc theo khoảng thời gian
      let dateMatch = true;
      const now = new Date();
      
      if (filters.dateRange === 'today') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        dateMatch = log.timestamp >= today;
      } else if (filters.dateRange === 'yesterday') {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        dateMatch = log.timestamp >= yesterday && log.timestamp < today;
      } else if (filters.dateRange === 'week') {
        const lastWeek = new Date();
        lastWeek.setDate(lastWeek.getDate() - 7);
        dateMatch = log.timestamp >= lastWeek;
      } else if (filters.dateRange === 'month') {
        const lastMonth = new Date();
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        dateMatch = log.timestamp >= lastMonth;
      } else if (filters.dateRange === 'custom') {
        if (dateFrom && dateTo) {
          dateTo.setHours(23, 59, 59, 999);
          dateMatch = log.timestamp >= dateFrom && log.timestamp <= dateTo;
        } else if (dateFrom) {
          dateMatch = log.timestamp >= dateFrom;
        } else if (dateTo) {
          dateTo.setHours(23, 59, 59, 999);
          dateMatch = log.timestamp <= dateTo;
        }
      }
      
      return searchMatch && statusMatch && sourceMatch && dateMatch;
    });
    
    setFilteredLogs(result);
    setCurrentPage(1); // Reset về trang đầu khi lọc
  }, [searchTerm, filters, logs, dateFrom, dateTo]);

  // Xử lý phân trang
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  // Không cần slice dữ liệu vì đã được phân trang từ API
  // const currentItems = filteredLogs.slice(indexOfFirstItem, indexOfLastItem);
  const currentItems = filteredLogs;
  
  // Sử dụng totalItems từ API thay vì tính toán lại
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  // Điều hướng phân trang
  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);
  const nextPage = () => setCurrentPage(prev => Math.min(prev + 1, totalPages));
  const prevPage = () => setCurrentPage(prev => Math.max(prev - 1, 1));

  // Xóa logs
  const handleClearLogs = () => {
    if (window.confirm('Bạn có chắc chắn muốn xóa tất cả nhật ký đồng bộ?')) {
      toast.success('Đã xóa tất cả nhật ký đồng bộ');
      setLogs([]);
      setFilteredLogs([]);
    }
  };

  // Xem chi tiết log
  const handleViewLogDetail = (logId: string) => {
    const log = logs.find(item => item.id === logId);
    if (log) {
      toast.info(
        <div>
          <h3 className="font-bold mb-2">{log.message}</h3>
          <p className="mb-2">{log.detail}</p>
          <p className="text-xs opacity-70">ID: {log.id}</p>
          <p className="text-xs opacity-70">Thời gian: {formatTime(log.timestamp)}</p>
          {log.duration && <p className="text-xs opacity-70">Thời lượng: {formatDuration(log.duration)}</p>}
        </div>,
        { autoClose: 8000 }
      );
    }
  };

  // Lấy icon theo trạng thái
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-success-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-danger-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-warning-500" />;
      case 'pending':
        return <Clock className="w-5 h-5 text-primary-500 animate-pulse" />;
      default:
        return <RefreshCw className="w-5 h-5 text-gray-500" />;
    }
  };

  return (
    <Layout>
      <PageContainer>
        <PageHeader 
          title="Nhật ký đồng bộ" 
          description="Theo dõi lịch sử đồng bộ sản phẩm"
          actions={
            <div className="flex flex-wrap gap-3">
              <button 
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg shadow-sm text-sm font-medium flex items-center gap-2 transition-colors"
                onClick={() => {
                  toast.info('Đang làm mới dữ liệu...');
                  setTimeout(() => {
                    setLoading(true);
                    setTimeout(() => {
                      setLoading(false);
                      toast.success('Đã làm mới dữ liệu');
                    }, 800);
                  }, 500);
                }}
              >
                <RefreshCw className="w-4 h-4" />
                Làm mới
              </button>
              
              <button 
                className="px-4 py-2 bg-accent-600 hover:bg-accent-700 text-white rounded-lg shadow-sm text-sm font-medium flex items-center gap-2 transition-colors"
                onClick={() => toast.info('Đang xuất dữ liệu CSV...')}
              >
                <Download className="w-4 h-4" />
                Xuất CSV
              </button>
              
              <button 
                className="px-4 py-2 bg-danger-600 hover:bg-danger-700 text-white rounded-lg shadow-sm text-sm font-medium flex items-center gap-2 transition-colors"
                onClick={handleClearLogs}
              >
                <XCircle className="w-4 h-4" />
                Xóa tất cả
              </button>
            </div>
          }
        />
        
        {/* Bộ lọc và tìm kiếm */}
        <Card className="mb-6">
          <div className="flex flex-col lg:flex-row gap-4 p-4">
            <div className="flex-1 flex items-center bg-white border border-gray-300 rounded-lg px-3 dark:bg-gray-800 dark:border-gray-700">
              <Search className="w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Tìm kiếm trong nhật ký..."
                className="py-2 px-3 bg-transparent w-full focus:outline-none focus:ring-1 focus:ring-primary-500 text-gray-700 dark:text-gray-200"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="flex flex-wrap gap-4">
              <select
                className="px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-sm text-sm focus:outline-none focus:ring-1 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              >
                <option value="">Tất cả trạng thái</option>
                <option value="success">Thành công ({statusCounts.success})</option>
                <option value="error">Lỗi ({statusCounts.error})</option>
                <option value="warning">Cảnh báo ({statusCounts.warning})</option>
                <option value="pending">Đang xử lý ({statusCounts.pending})</option>
              </select>
              
              <select
                className="px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-sm text-sm focus:outline-none focus:ring-1 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                value={filters.source}
                onChange={(e) => setFilters(prev => ({ ...prev, source: e.target.value }))}
              >
                <option value="">Tất cả nguồn</option>
                {availableSources.map(source => (
                  <option key={source.name} value={source.name}>
                    {source.name} ({source.count})
                  </option>
                ))}
              </select>
              
              <select
                className="px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-sm text-sm focus:outline-none focus:ring-1 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                value={filters.dateRange}
                onChange={(e) => setFilters(prev => ({ ...prev, dateRange: e.target.value }))}
              >
                <option value="all">Tất cả thời gian</option>
                <option value="today">Hôm nay</option>
                <option value="yesterday">Hôm qua</option>
                <option value="week">7 ngày qua</option>
                <option value="month">30 ngày qua</option>
                <option value="custom">Tùy chỉnh...</option>
              </select>
              
              {filters.dateRange === 'custom' && (
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                      <Calendar className="w-4 h-4 text-gray-500" />
                    </div>
                    <input
                      type="date"
                      className="pl-10 px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-sm text-sm focus:outline-none focus:ring-1 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                      onChange={(e) => setDateFrom(e.target.value ? new Date(e.target.value) : null)}
                    />
                  </div>
                  <ArrowUpDown className="w-4 h-4 text-gray-400" />
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                      <Calendar className="w-4 h-4 text-gray-500" />
                    </div>
                    <input
                      type="date"
                      className="pl-10 px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-sm text-sm focus:outline-none focus:ring-1 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                      onChange={(e) => setDateTo(e.target.value ? new Date(e.target.value) : null)}
                    />
                  </div>
                </div>
              )}
              
              <button
                className="px-3 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                onClick={() => {
                  setSearchTerm('');
                  setFilters({ status: '', source: '', dateRange: 'all' });
                  setDateFrom(null);
                  setDateTo(null);
                }}
              >
                <Filter className="w-4 h-4" />
                Đặt lại bộ lọc
              </button>
            </div>
          </div>
        </Card>
        
        {/* Danh sách nhật ký */}
        <Card loading={loading}>
          {loading ? (
            <div className="animate-pulse">
              {[...Array(10)].map((_, index) => (
                <div key={index} className="border-b border-gray-200 dark:border-gray-700 last:border-0 p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full flex-shrink-0"></div>
                    <div className="flex-1">
                      <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2"></div>
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
                    </div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 flex-shrink-0"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredLogs.length > 0 ? (
            <div>
              {currentItems.map((log) => (
                <div 
                  key={log.id} 
                  className="border-b border-gray-200 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors p-4 cursor-pointer"
                  onClick={() => handleViewLogDetail(log.id)}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center">
                      {getStatusIcon(log.status)}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-white">
                        {log.message}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 line-clamp-1">
                        {log.detail}
                      </div>
                      <div className="mt-1 text-xs text-gray-500 dark:text-gray-500 flex items-center gap-3">
                        <span>ID: {log.id}</span>
                        <span>Nguồn: {log.source}</span>
                        {log.itemsProcessed && <span>{log.itemsProcessed} item(s)</span>}
                        {log.duration && <span>{formatDuration(log.duration)}</span>}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-500 flex-shrink-0 whitespace-nowrap">
                      {formatTime(log.timestamp)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center">
              <Clock className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-700" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">Không tìm thấy nhật ký nào</h3>
              <p className="text-gray-500 dark:text-gray-400">Thử thay đổi bộ lọc hoặc tạo một lần đồng bộ mới</p>
            </div>
          )}
          
          {/* Phân trang */}
          {!loading && filteredLogs.length > 0 && (
            <div className="mt-6 flex flex-col sm:flex-row justify-between items-center">
              <div className="text-sm text-gray-500 mb-4 sm:mb-0">
                Hiển thị {currentItems.length} trên {totalItems} bản ghi
              </div>
              
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => paginate(1)}
                  disabled={currentPage === 1}
                  className="px-2 py-1 text-xs rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300"
                >
                  Đầu
                </button>
                
                <button
                  onClick={prevPage}
                  disabled={currentPage === 1}
                  className="px-2 py-1 text-xs rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300"
                >
                  Trước
                </button>
                
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => paginate(pageNum)}
                      className={`px-3 py-1 text-xs rounded ${
                        currentPage === pageNum 
                          ? 'bg-primary-600 text-white' 
                          : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                
                <button
                  onClick={nextPage}
                  disabled={currentPage === totalPages}
                  className="px-2 py-1 text-xs rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300"
                >
                  Tiếp
                </button>
                
                <button
                  onClick={() => paginate(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-2 py-1 text-xs rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300"
                >
                  Cuối
                </button>
                
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    paginate(1); // Quay lại trang đầu khi thay đổi số lượng
                  }}
                  className="ml-2 px-2 py-1 text-xs border border-gray-300 rounded bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300"
                >
                  <option value="10">10 / trang</option>
                  <option value="20">20 / trang</option>
                  <option value="50">50 / trang</option>
                  <option value="100">100 / trang</option>
                </select>
              </div>
            </div>
          )}
        </Card>
      </PageContainer>
    </Layout>
  );
} 