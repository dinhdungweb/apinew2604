'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/context/AppContext';
import dynamic from 'next/dynamic';
import Layout from '@/components/Layout';
import PageContainer, { PageHeader, PageSection } from '@/components/ui/PageContainer';
import StatCard from '@/components/ui/StatCard';
import Pagination from '@/components/ui/Pagination';
import { toast } from 'react-toastify';
import { 
  RefreshCw, Filter, Download, Upload, 
  Package, BarChart2, AlertCircle, Clock,
  Grid, List, LayoutGrid, Search, Sliders, ChevronDown
} from 'lucide-react';
import PageSizeSelector from '@/components/ui/PageSizeSelector';
import { 
  Skeleton, 
  TableRowSkeleton, 
  CardSkeleton, 
  StatCardSkeleton 
} from '@/components/ui/Skeleton';

// Lazy load components
const ProductTable = dynamic(() => import('@/components/ProductTable'), {
  loading: () => <ProductTableSkeleton />,
  ssr: false
});

const ProductGridView = dynamic(() => import('@/components/ProductGridView'), {
  loading: () => <ProductGridSkeleton />,
  ssr: false
});

// Skeleton components
const ProductTableSkeleton = () => (
  <div className="animate-pulse">
    <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
    <div className="space-y-3">
      {[...Array(10)].map((_, i) => (
        <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
      ))}
    </div>
  </div>
);

const ProductGridSkeleton = () => (
  <div className="animate-pulse grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
    {[...Array(9)].map((_, i) => (
      <div key={i} className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
    ))}
  </div>
);

export default function ProductsPage() {
  const { token } = useAppContext();
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'grid' | 'card'>('table');
  const [stats, setStats] = useState({
    total: 0,
    synced: 0,
    unsynced: 0,
    hasErrors: 0
  });
  const [filterOpen, setFilterOpen] = useState(false);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [mappedProducts, setMappedProducts] = useState({});
  const [syncStatus, setSyncStatus] = useState({});
  const [syncErrors, setSyncErrors] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [filterStats, setFilterStats] = useState({
    total: 0,
    filtered: 0,
    instock: 0,
    outofstock: 0,
    lowstock: 0
  });
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Authentication check
    if (!token) {
      router.push('/login');
    }
    
    // Load settings from localStorage
    const savedViewMode = localStorage.getItem('productsViewMode') as 'table' | 'grid' | 'card' | null;
    if (savedViewMode) {
      setViewMode(savedViewMode);
    }
    
    const savedPageSize = localStorage.getItem('productsPageSize');
    if (savedPageSize) {
      setPageSize(parseInt(savedPageSize, 10));
    }
    
    // Tạo hàm async để đảm bảo thứ tự thực thi đúng
    const initData = async () => {
      console.log('Đang khởi tạo dữ liệu sản phẩm...');
      // Fetch data including stats trong một lần gọi
      await fetchData();
      setInitialLoading(false);
    };
    
    // Gọi hàm khởi tạo
    if (token) {
      initData();
    }
  }, [token, router]);

  // Mỗi khi các tham số lọc, tìm kiếm hoặc phân trang thay đổi, cập nhật lại dữ liệu
  useEffect(() => {
    if (token && !initialLoading) {
      fetchData();
    }
  }, [currentPage, statusFilter, sortBy, sortOrder, pageSize]);

  // Handling search with debounce
  useEffect(() => {
    if (initialLoading) return;
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      fetchData();
    }, 500); // 500ms debounce
    
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchTerm]);

  // Consolidated fetch function that gets products and stats in one call
  const fetchData = async () => {
    if (!token) return;
    
    setLoading(true);
    try {
      // Xây dựng URL với các tham số lọc và phân trang
      const queryParams = new URLSearchParams({
        page: currentPage.toString(),
        pageSize: pageSize.toString(),
        filter: statusFilter,
        sortBy,
        sortOrder,
        includeStats: 'true' // Thêm param mới để API trả về cả stats
      });
      
      if (searchTerm) {
        queryParams.set('search', searchTerm);
      }
      
      const response = await fetch(`/api/products?${queryParams.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setProducts(data.products || []);
        
        // Cập nhật thông tin phân trang
        if (data.pagination) {
          setCurrentPage(data.pagination.current_page || 1);
          setTotalPages(data.pagination.total_pages || 1);
          setPageSize(data.pagination.page_size || 20);
        }
        
        // Cập nhật thống kê bộ lọc
        if (data.filter_stats) {
          setFilterStats(data.filter_stats);
        }
        
        // Cập nhật stats nếu có
        if (data.stats) {
          setStats({
            total: data.stats.total || 0,
            synced: data.stats.synced || 0,
            unsynced: data.stats.unsynced || 0,
            hasErrors: data.stats.hasErrors || 0
          });
        }
        
        // Lấy thông tin mapping nếu có
        if (data.mappings) {
          setMappedProducts(data.mappings.mappings || {});
          setSyncStatus(data.mappings.syncStatus || {});
          setSyncErrors(data.mappings.syncErrors || {});
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Không thể tải dữ liệu sản phẩm');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!token || isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      const response = await fetch('/api/products/refresh-cache', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        toast.success('Đã cập nhật dữ liệu sản phẩm từ Shopify thành công');
        await fetchData();
      } else {
        const error = await response.json();
        toast.error(`Lỗi khi cập nhật: ${error.message || 'Không thể kết nối với Shopify API'}`);
      }
    } catch (error) {
      toast.error('Lỗi khi cập nhật dữ liệu sản phẩm');
      console.error('Refresh error:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleExportCsv = () => {
    toast.info('Đang xuất dữ liệu sang CSV...');
    // Add CSV export functionality here
  };

  const toggleViewMode = (mode: 'table' | 'grid' | 'card') => {
    setViewMode(mode);
    // Lưu tùy chọn vào localStorage để giữ lại cho lần truy cập sau
    localStorage.setItem('productsViewMode', mode);
  };

  // Hàm xử lý khi thay đổi số sản phẩm mỗi trang
  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1); // Reset về trang 1 khi thay đổi pageSize
    // Lưu lại giá trị pageSize trong localStorage
    localStorage.setItem('productsPageSize', newSize.toString());
  };

  // Hàm xử lý khi thay đổi từ khóa tìm kiếm
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  // Hàm xử lý khi thay đổi filter trạng thái
  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setCurrentPage(1); // Reset về trang 1 khi thay đổi filter
  };

  // Hàm xử lý khi thay đổi trang
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Hàm xử lý khi thay đổi sắp xếp
  const handleSortChange = (field: string) => {
    if (sortBy === field) {
      // Nếu đang sắp xếp theo field này rồi, thì đổi thứ tự sắp xếp
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // Nếu chuyển sang field mới, mặc định sắp xếp tăng dần
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const handleProductSelect = (productId: string) => {
    router.push(`/products/${productId}`);
  };

  // Tính toán các giá trị change để chuyển thành number
  const calculateSyncedPercent = (): number => {
    if (stats.total <= 0) return 0;
    return Number(((stats.synced / stats.total) * 100).toFixed(0));
  };

  const calculateErrorPercent = (): number => {
    if (stats.total <= 0) return 0;
    return Number(((stats.hasErrors / stats.total) * 100).toFixed(0));
  };

  return (
    <Layout>
      <PageContainer>
        <PageHeader 
          title="Sản phẩm" 
          description="Quản lý sản phẩm Shopify và đồng bộ với Nhanh.vn"
          actions={
            <div className="flex items-center gap-2">
              <button 
                onClick={handleRefresh} 
                disabled={isRefreshing}
                className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? 'Đang cập nhật...' : 'Cập nhật'}
              </button>
              
              <button 
                onClick={handleExportCsv}
                className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                <Download className="mr-2 h-4 w-4" />
                Xuất CSV
              </button>
              
              <div className="border-l border-gray-300 dark:border-gray-600 h-8 mx-1"></div>
              
              <div className="inline-flex rounded-md shadow-sm">
                <button
                  onClick={() => toggleViewMode('table')}
                  className={`px-3 py-2 border border-r-0 border-gray-300 dark:border-gray-600 rounded-l-md ${
                    viewMode === 'table' 
                      ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300' 
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200'
                  }`}
                >
                  <List className="h-4 w-4" />
                </button>
                <button
                  onClick={() => toggleViewMode('grid')}
                  className={`px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-r-md ${
                    viewMode === 'grid' 
                      ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300' 
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200'
                  }`}
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
              </div>
            </div>
          }
        />
        
        {/* Stats cards */}
        <PageSection>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {initialLoading ? (
              <>
                <StatCardSkeleton />
                <StatCardSkeleton />
                <StatCardSkeleton />
                <StatCardSkeleton />
              </>
            ) : (
              <>
                <StatCard 
                  title="Tổng số sản phẩm" 
                  value={stats.total} 
                  icon={<Package className="w-5 h-5" />}
                />
                
                <StatCard 
                  title="Đã đồng bộ" 
                  value={stats.synced} 
                  icon={<BarChart2 className="w-5 h-5" />}
                  change={{ value: calculateSyncedPercent(), type: 'increase' }}
                />
                
                <StatCard 
                  title="Chưa đồng bộ" 
                  value={stats.unsynced} 
                  icon={<Clock className="w-5 h-5" />}
                />
                
                <StatCard 
                  title="Lỗi đồng bộ" 
                  value={stats.hasErrors} 
                  icon={<AlertCircle className="w-5 h-5" />}
                  change={{ value: calculateErrorPercent(), type: 'decrease' }}
                />
              </>
            )}
          </div>
        </PageSection>
        
        {/* Filters */}
        <PageSection>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow mb-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-4">
              <div className="flex-1 w-full sm:w-auto">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Tìm kiếm sản phẩm..."
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    value={searchTerm}
                    onChange={handleSearchChange}
                  />
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-gray-400" />
                  </div>
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer text-gray-400 hover:text-gray-500"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
              
              <div className="flex items-center space-x-3 w-full sm:w-auto">
                <select
                  className="block border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  value={statusFilter}
                  onChange={(e) => handleStatusFilterChange(e.target.value)}
                >
                  <option value="all">Tất cả sản phẩm</option>
                  <option value="instock">Còn hàng</option>
                  <option value="outofstock">Hết hàng</option>
                  <option value="lowstock">Sắp hết hàng</option>
                </select>
                
                <PageSizeSelector
                  pageSize={pageSize}
                  onPageSizeChange={handlePageSizeChange}
                  options={[10, 20, 50, 100]}
                />
                
                <button 
                  onClick={() => setFilterOpen(!filterOpen)}
                  className="inline-flex items-center p-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  <Sliders className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            {filterOpen && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Sắp xếp theo
                  </label>
                  <select
                    className="block w-full border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    value={sortBy}
                    onChange={(e) => {
                      setSortBy(e.target.value);
                      setSortOrder('asc');
                    }}
                  >
                    <option value="name">Tên sản phẩm</option>
                    <option value="price">Giá</option>
                    <option value="inventory">Tồn kho</option>
                    <option value="sku">SKU</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Thứ tự
                  </label>
                  <select
                    className="block w-full border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                  >
                    <option value="asc">Tăng dần</option>
                    <option value="desc">Giảm dần</option>
                  </select>
                </div>
              </div>
            )}
            
            <div className="flex items-center justify-between flex-wrap mt-4">
              <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-2 sm:mb-0">
                <span>Hiển thị {products.length} trên tổng số {filterStats.filtered} sản phẩm</span>
                <span className="mx-2">|</span>
                <span>Còn hàng: {filterStats.instock}</span>
                <span className="mx-2">|</span>
                <span>Hết hàng: {filterStats.outofstock}</span>
                <span className="mx-2">|</span>
                <span>Sắp hết hàng: {filterStats.lowstock}</span>
              </div>
            </div>
          </div>
        </PageSection>
        
        {/* Products Table/Grid */}
        <PageSection>
          {initialLoading ? (
            viewMode === 'table' ? <ProductTableSkeleton /> : <ProductGridSkeleton />
          ) : (
            <>
              {viewMode === 'table' && (
                <ProductTable 
                  products={products} 
                  loading={loading}
                  viewMode={viewMode}
                  mappedProducts={mappedProducts}
                  syncStatus={syncStatus}
                  syncErrors={syncErrors}
                  onSort={handleSortChange}
                  currentSort={{
                    field: sortBy,
                    order: sortOrder
                  }}
                />
              )}
              
              {viewMode === 'grid' && (
                <ProductGridView 
                  products={products}
                  loading={loading}
                  mappedProducts={mappedProducts}
                  syncStatus={syncStatus}
                  syncErrors={syncErrors}
                  onSelectProduct={handleProductSelect}
                />
              )}
            </>
          )}
          
          {/* Pagination */}
          {totalPages > 1 && !initialLoading && (
            <div className="mt-6">
              <Pagination 
                currentPage={currentPage} 
                totalPages={totalPages} 
                onPageChange={handlePageChange}
              />
            </div>
          )}
        </PageSection>
      </PageContainer>
    </Layout>
  );
} 