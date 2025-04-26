'use client';

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import PageContainer from '@/components/ui/PageContainer';
import { PageHeader, PageSection } from '@/components/ui/PageSection';
import Card from '@/components/Card';
import { 
  BarChart, LineChart, PieChart, 
  ArrowDown, Calendar, Filter, 
  RefreshCw, TrendingUp, TrendingDown
} from 'lucide-react';
import { toast } from 'react-toastify';

// Fake data cho biểu đồ
const salesData = {
  labels: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'],
  datasets: [
    {
      label: 'Doanh số',
      data: [65, 78, 90, 81, 86, 95, 91, 85, 87, 91, 95, 102],
      backgroundColor: 'rgba(59, 130, 246, 0.5)',
      borderColor: '#3b82f6',
    }
  ]
};

const conversionData = {
  labels: ['Trang chủ', 'Danh mục', 'Sản phẩm', 'Giỏ hàng', 'Thanh toán', 'Xác nhận'],
  datasets: [
    {
      label: 'Tỉ lệ chuyển đổi',
      data: [100, 72, 45, 30, 22, 18],
      backgroundColor: 'rgba(16, 185, 129, 0.5)',
      borderColor: '#10b981',
    }
  ]
};

const categoryData = {
  labels: ['Điện thoại', 'Laptop', 'Máy tính bảng', 'Phụ kiện', 'Đồng hồ', 'Khác'],
  datasets: [
    {
      label: 'Doanh số theo danh mục',
      data: [35, 25, 15, 12, 8, 5],
      backgroundColor: [
        'rgba(59, 130, 246, 0.7)',
        'rgba(16, 185, 129, 0.7)',
        'rgba(249, 115, 22, 0.7)',
        'rgba(139, 92, 246, 0.7)',
        'rgba(236, 72, 153, 0.7)',
        'rgba(107, 114, 128, 0.7)'
      ],
      borderColor: '#fff',
    }
  ]
};

// Mock top products
const topProducts = [
  { id: 1, name: 'iPhone 15 Pro Max 256GB', sales: 156, revenue: 312000000, growth: 12.5 },
  { id: 2, name: 'Samsung Galaxy S24 Ultra', sales: 143, revenue: 286000000, growth: 8.2 },
  { id: 3, name: 'Macbook Pro M3', sales: 87, revenue: 348000000, growth: 15.8 },
  { id: 4, name: 'iPad Pro 12.9"', sales: 76, revenue: 192000000, growth: -3.4 },
  { id: 5, name: 'AirPods Pro 2', sales: 234, revenue: 164000000, growth: 24.1 },
];

// Format tiền VND
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    minimumFractionDigits: 0
  }).format(amount);
};

// Fake KPI data
const kpiData = {
  totalSales: 1568900000,
  targetSales: 2000000000,
  percentOfTarget: 78.4,
  previousPeriod: 1245000000,
  growthRate: 26.0,
  avgOrderValue: 1245000,
  previousAvgOrderValue: 1180000,
  avgOrderGrowth: 5.5
};

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('year');
  const [reportType, setReportType] = useState('sales');
  
  // Generate report
  useEffect(() => {
    const fetchReportData = async () => {
      setLoading(true);
      try {
        // Giả lập API call
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Data đã hardcode sẵn
      } catch (error) {
        console.error('Error fetching report data:', error);
        toast.error('Không thể tải dữ liệu báo cáo');
      } finally {
        setLoading(false);
      }
    };
    
    fetchReportData();
  }, [period, reportType]);
  
  // Change period
  const handlePeriodChange = (newPeriod: string) => {
    setPeriod(newPeriod);
  };
  
  // Change report type
  const handleReportTypeChange = (newType: string) => {
    setReportType(newType);
  };
  
  // Export report
  const handleExportReport = () => {
    toast.info('Đang xuất báo cáo...');
    setTimeout(() => {
      toast.success('Báo cáo đã được xuất thành công!');
    }, 1500);
  };
  
  // Refresh data
  const handleRefreshData = () => {
    setLoading(true);
    toast.info('Đang làm mới dữ liệu...');
    
    setTimeout(() => {
      setLoading(false);
      toast.success('Dữ liệu đã được cập nhật!');
    }, 1000);
  };

  return (
    <Layout>
      <PageContainer>
        <PageHeader 
          title="Báo cáo thống kê" 
          description="Xem báo cáo doanh số và hiệu suất kinh doanh"
          actions={
            <div className="flex gap-3">
              <div className="inline-flex overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
                <button 
                  className={`px-4 py-2 text-sm font-medium ${period === 'week' 
                    ? 'bg-primary-600 text-white' 
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                  onClick={() => handlePeriodChange('week')}
                >
                  Tuần
                </button>
                <button 
                  className={`px-4 py-2 text-sm font-medium ${period === 'month' 
                    ? 'bg-primary-600 text-white' 
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                  onClick={() => handlePeriodChange('month')}
                >
                  Tháng
                </button>
                <button 
                  className={`px-4 py-2 text-sm font-medium ${period === 'quarter' 
                    ? 'bg-primary-600 text-white' 
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                  onClick={() => handlePeriodChange('quarter')}
                >
                  Quý
                </button>
                <button 
                  className={`px-4 py-2 text-sm font-medium ${period === 'year' 
                    ? 'bg-primary-600 text-white' 
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                  onClick={() => handlePeriodChange('year')}
                >
                  Năm
                </button>
              </div>
              
              <button
                className="px-4 py-2 flex items-center gap-2 text-sm font-medium border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                onClick={handleRefreshData}
              >
                <RefreshCw className="w-4 h-4" />
                Làm mới
              </button>
              
              <button
                className="px-4 py-2 flex items-center gap-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                onClick={handleExportReport}
              >
                <ArrowDown className="w-4 h-4" />
                Xuất báo cáo
              </button>
            </div>
          }
        />
        
        {/* KPI Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <Card loading={loading}>
            <div className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Tổng doanh số</p>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                    {formatCurrency(kpiData.totalSales)}
                  </h3>
                  
                  <div className="mt-1 flex items-center">
                    {kpiData.growthRate > 0 ? (
                      <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-red-500 mr-1" />
                    )}
                    <span className={`text-sm font-medium ${kpiData.growthRate > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {kpiData.growthRate > 0 ? '+' : ''}{kpiData.growthRate}% so với kỳ trước
                    </span>
                  </div>
                </div>
                
                <div className="h-16 w-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <BarChart className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              
              <div className="mt-4">
                <div className="flex justify-between mb-1">
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {kpiData.percentOfTarget}% của mục tiêu
                  </span>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {formatCurrency(kpiData.totalSales)} / {formatCurrency(kpiData.targetSales)}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                  <div 
                    className="bg-blue-600 h-2.5 rounded-full" 
                    style={{ width: `${kpiData.percentOfTarget}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </Card>
          
          <Card loading={loading}>
            <div className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Giá trị đơn hàng trung bình</p>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                    {formatCurrency(kpiData.avgOrderValue)}
                  </h3>
                  
                  <div className="mt-1 flex items-center">
                    {kpiData.avgOrderGrowth > 0 ? (
                      <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-red-500 mr-1" />
                    )}
                    <span className={`text-sm font-medium ${kpiData.avgOrderGrowth > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {kpiData.avgOrderGrowth > 0 ? '+' : ''}{kpiData.avgOrderGrowth}% so với kỳ trước
                    </span>
                  </div>
                </div>
                
                <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <LineChart className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </div>
          </Card>
          
          <Card loading={loading}>
            <div className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Tỉ lệ chuyển đổi</p>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                    18.2%
                  </h3>
                  
                  <div className="mt-1 flex items-center">
                    <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                    <span className="text-sm font-medium text-green-600 dark:text-green-400">
                      +2.3% so với kỳ trước
                    </span>
                  </div>
                </div>
                
                <div className="h-16 w-16 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <PieChart className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </div>
          </Card>
          
          <Card loading={loading}>
            <div className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Tổng số đơn hàng</p>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                    1,245
                  </h3>
                  
                  <div className="mt-1 flex items-center">
                    <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                    <span className="text-sm font-medium text-green-600 dark:text-green-400">
                      +18.5% so với kỳ trước
                    </span>
                  </div>
                </div>
                
                <div className="h-16 w-16 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                  <Calendar className="w-8 h-8 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
            </div>
          </Card>
        </div>
        
        {/* Chart Tabs */}
        <div className="mb-6">
          <div className="border-b border-gray-200 dark:border-gray-700 mb-4">
            <ul className="flex flex-wrap -mb-px">
              <li className="mr-2">
                <button
                  className={`inline-block p-4 border-b-2 rounded-t-lg ${
                    reportType === 'sales' 
                      ? 'border-primary-600 text-primary-600 dark:text-primary-400 dark:border-primary-400' 
                      : 'border-transparent hover:text-gray-600 hover:border-gray-300 dark:hover:text-gray-300 text-gray-500 dark:text-gray-400'
                  }`}
                  onClick={() => handleReportTypeChange('sales')}
                >
                  Doanh số theo thời gian
                </button>
              </li>
              <li className="mr-2">
                <button
                  className={`inline-block p-4 border-b-2 rounded-t-lg ${
                    reportType === 'conversion' 
                      ? 'border-primary-600 text-primary-600 dark:text-primary-400 dark:border-primary-400' 
                      : 'border-transparent hover:text-gray-600 hover:border-gray-300 dark:hover:text-gray-300 text-gray-500 dark:text-gray-400'
                  }`}
                  onClick={() => handleReportTypeChange('conversion')}
                >
                  Tỉ lệ chuyển đổi
                </button>
              </li>
              <li className="mr-2">
                <button
                  className={`inline-block p-4 border-b-2 rounded-t-lg ${
                    reportType === 'categories' 
                      ? 'border-primary-600 text-primary-600 dark:text-primary-400 dark:border-primary-400' 
                      : 'border-transparent hover:text-gray-600 hover:border-gray-300 dark:hover:text-gray-300 text-gray-500 dark:text-gray-400'
                  }`}
                  onClick={() => handleReportTypeChange('categories')}
                >
                  Danh mục sản phẩm
                </button>
              </li>
            </ul>
          </div>
          
          <Card loading={loading}>
            <div className="p-6">
              {reportType === 'sales' && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Doanh số theo thời gian ({period === 'week' ? 'Tuần' : period === 'month' ? 'Tháng' : period === 'quarter' ? 'Quý' : 'Năm'})
                  </h2>
                  
                  {/* Placeholder for chart */}
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 h-80 flex items-center justify-center">
                    <div className="text-center p-6">
                      <BarChart className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-600 mb-4" />
                      <p className="text-gray-500 dark:text-gray-400">
                        Biểu đồ doanh số theo thời gian sẽ được hiển thị tại đây.
                        <br />
                        Vui lòng tích hợp thư viện biểu đồ như Chart.js hoặc Recharts.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {reportType === 'conversion' && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Tỉ lệ chuyển đổi qua các giai đoạn
                  </h2>
                  
                  {/* Placeholder for chart */}
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 h-80 flex items-center justify-center">
                    <div className="text-center p-6">
                      <LineChart className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-600 mb-4" />
                      <p className="text-gray-500 dark:text-gray-400">
                        Biểu đồ tỉ lệ chuyển đổi sẽ được hiển thị tại đây.
                        <br />
                        Vui lòng tích hợp thư viện biểu đồ như Chart.js hoặc Recharts.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {reportType === 'categories' && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Phân bố doanh số theo danh mục sản phẩm
                  </h2>
                  
                  {/* Placeholder for chart */}
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 h-80 flex items-center justify-center">
                    <div className="text-center p-6">
                      <PieChart className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-600 mb-4" />
                      <p className="text-gray-500 dark:text-gray-400">
                        Biểu đồ phân bố danh mục sẽ được hiển thị tại đây.
                        <br />
                        Vui lòng tích hợp thư viện biểu đồ như Chart.js hoặc Recharts.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
        
        {/* Top selling products */}
        <PageSection title="Top sản phẩm bán chạy">
          <Card loading={loading}>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Sản phẩm
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Đã bán
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Doanh thu
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Tăng trưởng
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
                  {topProducts.map((product) => (
                    <tr key={product.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">{product.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">{product.sales.toLocaleString()}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">{formatCurrency(product.revenue)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`inline-flex items-center text-sm font-medium ${
                          product.growth > 0 
                            ? 'text-green-600 dark:text-green-400' 
                            : 'text-red-600 dark:text-red-400'
                        }`}>
                          {product.growth > 0 ? (
                            <TrendingUp className="w-4 h-4 mr-1" />
                          ) : (
                            <TrendingDown className="w-4 h-4 mr-1" />
                          )}
                          {product.growth > 0 ? '+' : ''}{product.growth}%
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </PageSection>
        
        {/* Advanced Filters */}
        <PageSection title="Tùy chọn báo cáo nâng cao" className="mt-8">
          <Card>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Khoảng thời gian
                  </label>
                  <div className="flex space-x-2">
                    <div className="flex-1">
                      <input
                        type="date"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                    <div className="flex-1">
                      <input
                        type="date"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Phân loại
                  </label>
                  <select className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white">
                    <option value="">Tất cả danh mục</option>
                    <option value="phones">Điện thoại</option>
                    <option value="laptops">Laptop</option>
                    <option value="tablets">Máy tính bảng</option>
                    <option value="accessories">Phụ kiện</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    So sánh với
                  </label>
                  <select className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white">
                    <option value="previous_period">Kỳ trước</option>
                    <option value="previous_year">Cùng kỳ năm trước</option>
                    <option value="target">Mục tiêu</option>
                  </select>
                </div>
              </div>
              
              <div className="mt-6 flex justify-end">
                <button
                  className="px-4 py-2 flex items-center gap-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  <Filter className="w-4 h-4" />
                  Lọc báo cáo
                </button>
              </div>
            </div>
          </Card>
        </PageSection>
      </PageContainer>
    </Layout>
  );
} 