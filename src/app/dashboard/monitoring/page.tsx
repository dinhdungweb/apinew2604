'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

export default function MonitoringDashboard() {
  const [metricsData, setMetricsData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  // Hàm lấy dữ liệu metrics
  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/metrics?format=json');
      
      if (!response.ok) {
        throw new Error(`Lỗi khi lấy metrics: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      setMetricsData(data);
      setLastUpdated(new Date().toLocaleTimeString());
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Lỗi không xác định khi lấy dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  // Gọi API khi component mount và thiết lập auto-refresh
  useEffect(() => {
    fetchMetrics();
    
    // Cập nhật dữ liệu mỗi 30 giây
    const interval = setInterval(fetchMetrics, 30000);
    
    // Dọn dẹp interval khi component unmount
    return () => clearInterval(interval);
  }, []);

  // Trạng thái hiện tại hệ thống
  const systemStatus = () => {
    if (!metricsData) return 'unknown';
    
    // Lấy thông tin của các circuit breaker
    const circuitBreakers = metricsData.metrics.filter(
      (m: any) => m.name === 'circuit_breaker_state'
    );
    
    // Nếu có bất kỳ circuit breaker nào đang mở, hệ thống có vấn đề
    const hasOpenCircuitBreaker = circuitBreakers.some(
      (cb: any) => cb.values.some((v: any) => v.value > 0)
    );
    
    // Kiểm tra rate limit
    const rateLimits = metricsData.metrics.filter(
      (m: any) => m.name === 'rate_limit_usage_percent'
    );
    
    const hasHighRateLimit = rateLimits.some(
      (rl: any) => rl.values.some((v: any) => v.value > 90)
    );
    
    if (hasOpenCircuitBreaker) return 'degraded';
    if (hasHighRateLimit) return 'warning';
    return 'healthy';
  };

  // Màu sắc cho trạng thái
  const statusColors = {
    healthy: 'bg-green-500',
    warning: 'bg-yellow-500',
    degraded: 'bg-red-500',
    unknown: 'bg-gray-500'
  };

  // Xử lý dữ liệu sync cho biểu đồ
  const prepareSyncData = () => {
    if (!metricsData) return [];
    
    const syncData = metricsData.metrics.filter(
      (m: any) => m.name === 'sync_total'
    );
    
    if (!syncData.length) return [];
    
    // Nhóm theo loại và trạng thái
    const result = [
      { name: 'Thành công', value: 0 },
      { name: 'Lỗi', value: 0 },
      { name: 'Bỏ qua', value: 0 }
    ];
    
    syncData.forEach((metric: any) => {
      metric.values.forEach((v: any) => {
        if (v.labels.status === 'success') {
          result[0].value += v.value;
        } else if (v.labels.status === 'error') {
          result[1].value += v.value;
        } else if (v.labels.status === 'skipped') {
          result[2].value += v.value;
        }
      });
    });
    
    return result;
  };

  // Dữ liệu workers
  const prepareWorkerData = () => {
    if (!metricsData) return { active: 0, queued: 0 };
    
    const activeWorkers = metricsData.metrics.find(
      (m: any) => m.name === 'active_workers'
    );
    
    const queuedJobs = metricsData.metrics.find(
      (m: any) => m.name === 'queued_jobs'
    );
    
    return {
      active: activeWorkers?.values[0]?.value || 0,
      queued: queuedJobs?.values[0]?.value || 0
    };
  };

  // Xử lý dữ liệu API response time
  const prepareApiResponseTimeData = () => {
    if (!metricsData) return [];
    
    const apiData = metricsData.metrics.find(
      (m: any) => m.name === 'api_response_time_seconds_sum'
    );
    
    if (!apiData) return [];
    
    // Nhóm theo endpoint
    const endpointData: any = {};
    
    apiData.values.forEach((v: any) => {
      const endpoint = v.labels.endpoint || 'unknown';
      if (!endpointData[endpoint]) {
        endpointData[endpoint] = 0;
      }
      endpointData[endpoint] += v.value;
    });
    
    return Object.entries(endpointData).map(([name, value]) => ({
      name,
      value
    }));
  };

  // Màu sắc cho các chart
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Bảng theo dõi hệ thống</h1>
        <div className="flex justify-between items-center">
          <p className="text-gray-500">
            Cập nhật lần cuối: {lastUpdated || 'Chưa có dữ liệu'}
          </p>
          <div className="flex space-x-4">
            <button
              onClick={fetchMetrics}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
              disabled={loading}
            >
              {loading ? 'Đang tải...' : 'Tải lại'}
            </button>
            <a
              href="/api/metrics"
              target="_blank"
              className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-800 transition"
            >
              Xem Prometheus metrics
            </a>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          <p>{error}</p>
        </div>
      )}

      {/* Tổng quan trạng thái */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Trạng thái hệ thống</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <div className={`w-4 h-4 rounded-full ${statusColors[systemStatus() as keyof typeof statusColors]} mr-2`}></div>
              <span className="capitalize font-medium">
                {systemStatus() === 'healthy' ? 'Hoạt động tốt' : 
                 systemStatus() === 'warning' ? 'Cảnh báo' :
                 systemStatus() === 'degraded' ? 'Đang gặp vấn đề' : 'Không xác định'}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Worker threads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between">
              <div>
                <p className="text-gray-500">Đang hoạt động</p>
                <p className="text-2xl font-bold">{prepareWorkerData().active}</p>
              </div>
              <div>
                <p className="text-gray-500">Đang chờ</p>
                <p className="text-2xl font-bold">{prepareWorkerData().queued}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Kích thước batch hiện tại</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <p className="text-4xl font-bold">
                {metricsData?.metrics.find((m: any) => m.name === 'current_batch_size')?.values[0]?.value || '-'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Biểu đồ tròn kết quả đồng bộ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Kết quả đồng bộ</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={prepareSyncData()}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }: { name: string; percent: number }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                >
                  {prepareSyncData().map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tỷ lệ sử dụng Rate Limit</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={
                  metricsData?.metrics.find((m: any) => m.name === 'rate_limit_usage_percent')?.values.map((v: any) => ({
                    name: v.labels.api,
                    value: v.value
                  })) || []
                }
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" fill="#8884d8" name="Tỷ lệ sử dụng (%)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Thời gian xử lý và lỗi */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Thời gian đồng bộ (giây)</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={
                  metricsData?.metrics.find((m: any) => m.name === 'sync_duration_seconds_sum')?.values.map((v: any) => ({
                    name: v.labels.type || 'all',
                    value: v.value.toFixed(2)
                  })) || []
                }
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" fill="#82ca9d" name="Thời gian (giây)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Số lỗi theo loại</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={
                    metricsData?.metrics.find((m: any) => m.name === 'error_count')?.values.map((v: any) => ({
                      name: v.labels.type,
                      value: v.value
                    })) || []
                  }
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }: { name: string; percent: number }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                >
                  {
                    (metricsData?.metrics.find((m: any) => m.name === 'error_count')?.values || []).map((_: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))
                  }
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <p className="text-xs text-gray-500">
          * Dữ liệu được cập nhật tự động mỗi 30 giây. Bạn có thể nhấn nút "Tải lại" để cập nhật thủ công.
        </p>
        <p className="text-xs text-gray-500">
          * Để giám sát chi tiết hơn, hãy sử dụng Prometheus và Grafana với endpoint /api/metrics.
        </p>
      </div>
    </div>
  );
} 