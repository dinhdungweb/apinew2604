import React, { useState, useEffect } from 'react';
import Card from '@/components/Card';
import { RefreshCw, TrendingUp, TrendingDown, Clock, Database, AlertCircle } from 'lucide-react';
import { toast } from 'react-toastify';

interface MetricsWidgetProps {
  onRefresh?: () => void;
}

export default function MetricsWidget({ onRefresh }: MetricsWidgetProps) {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<any>(null);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  const fetchMetrics = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/metrics?format=json', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Không thể lấy dữ liệu metrics');
      }
      
      const data = await response.json();
      setMetrics(data);
    } catch (error) {
      console.error('Error fetching metrics:', error);
      toast.error('Không thể tải dữ liệu metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    
    const interval = setInterval(() => {
      fetchMetrics();
    }, 30000); // Cập nhật mỗi 30 giây
    
    setRefreshInterval(interval);
    
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, []);

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('vi-VN').format(num);
  };

  const renderMetricGauge = (value: number, max: number, title: string, icon: React.ReactNode) => {
    const percentage = Math.min(Math.round((value / max) * 100), 100);
    
    return (
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
            {title}
          </h3>
          {icon}
        </div>
        
        <div className="mt-2">
          <div className="flex justify-between mb-1">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {percentage}%
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {formatNumber(value)} / {formatNumber(max)}
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
            <div 
              className={`h-2.5 rounded-full ${
                percentage > 80 ? 'bg-red-600' : 
                percentage > 60 ? 'bg-yellow-500' : 
                'bg-green-600'
              }`}
              style={{ width: `${percentage}%` }}
            ></div>
          </div>
        </div>
      </div>
    );
  };

  const renderCacheStats = () => {
    if (!metrics || !metrics.metrics) return null;
    
    const cacheMetrics = metrics.metrics.find((m: any) => m.name === 'cache_hit_ratio') || { values: [] };
    const redisCache = cacheMetrics.values.find((v: any) => v.labels.cache === 'redis') || { value: 0 };
    const memoryCache = cacheMetrics.values.find((v: any) => v.labels.cache === 'memory') || { value: 0 };
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {renderMetricGauge(
          redisCache.value || 0, 
          100, 
          'Redis Cache Hit Ratio', 
          <Database className="w-4 h-4 text-blue-500" />
        )}
        {renderMetricGauge(
          memoryCache.value || 0, 
          100, 
          'Memory Cache Hit Ratio', 
          <Database className="w-4 h-4 text-green-500" />
        )}
      </div>
    );
  };

  const renderRateLimitStats = () => {
    if (!metrics || !metrics.metrics) return null;
    
    const rateLimitMetrics = metrics.metrics.find((m: any) => m.name === 'rate_limit_usage_percent') || { values: [] };
    const shopifyLimit = rateLimitMetrics.values.find((v: any) => v.labels.api === 'shopify') || { value: 0 };
    const nhanhLimit = rateLimitMetrics.values.find((v: any) => v.labels.api === 'nhanh') || { value: 0 };
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {renderMetricGauge(
          shopifyLimit.value || 0, 
          100, 
          'Shopify API Rate Limit', 
          <TrendingUp className="w-4 h-4 text-purple-500" />
        )}
        {renderMetricGauge(
          nhanhLimit.value || 0, 
          100, 
          'Nhanh API Rate Limit', 
          <TrendingUp className="w-4 h-4 text-orange-500" />
        )}
      </div>
    );
  };

  const renderWorkerStats = () => {
    if (!metrics || !metrics.metrics) return null;
    
    const activeWorkersMetric = metrics.metrics.find((m: any) => m.name === 'active_workers') || { values: [] };
    const queuedJobsMetric = metrics.metrics.find((m: any) => m.name === 'queued_jobs') || { values: [] };
    
    const activeWorkers = activeWorkersMetric.values[0]?.value || 0;
    const queuedJobs = queuedJobsMetric.values[0]?.value || 0;
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Worker Threads
            </h3>
            <Clock className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-xl font-semibold">
            {formatNumber(activeWorkers)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Worker threads đang hoạt động
          </p>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Queued Jobs
            </h3>
            <Clock className="w-4 h-4 text-orange-500" />
          </div>
          <p className="text-xl font-semibold">
            {formatNumber(queuedJobs)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Tasks đang chờ xử lý
          </p>
        </div>
      </div>
    );
  };

  const renderSystemStats = () => {
    if (!metrics || !metrics.system) return null;
    
    const { memory, uptime } = metrics.system;
    const memoryUsed = memory.heapUsed / 1024 / 1024;
    const memoryTotal = memory.heapTotal / 1024 / 1024;
    
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {renderMetricGauge(
          memoryUsed, 
          memoryTotal, 
          'Memory Usage', 
          <Database className="w-4 h-4 text-blue-500" />
        )}
        
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Uptime
            </h3>
            <Clock className="w-4 h-4 text-green-500" />
          </div>
          <p className="text-xl font-semibold">
            {hours}h {minutes}m
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Thời gian hoạt động hệ thống
          </p>
        </div>
      </div>
    );
  };

  const handleRefresh = () => {
    setLoading(true);
    fetchMetrics();
    if (onRefresh) {
      onRefresh();
    }
  };

  return (
    <Card loading={loading}>
      <div className="space-y-6">
        {!metrics ? (
          <div className="text-center py-6">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">Chưa có dữ liệu metrics</p>
          </div>
        ) : (
          <>
            <h4 className="text-lg font-medium mb-4">Cache Performance</h4>
            {renderCacheStats()}
            
            <h4 className="text-lg font-medium mb-4 mt-8">API Rate Limits</h4>
            {renderRateLimitStats()}
            
            <h4 className="text-lg font-medium mb-4 mt-8">Worker Threads</h4>
            {renderWorkerStats()}
            
            <h4 className="text-lg font-medium mb-4 mt-8">System Resources</h4>
            {renderSystemStats()}
          </>
        )}
      </div>
    </Card>
  );
} 