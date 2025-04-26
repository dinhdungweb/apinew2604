'use client';

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { Server, Save, RefreshCw, Activity, PlayCircle, StopCircle, AlertCircle, Clock, CheckSquare, AlertTriangle, Play, Square } from 'lucide-react';
import { toast } from 'react-toastify';
import { fetchSettings, updateSetting, initializeDefaultSettings } from '../../dashboard/sync-api';
import Card from '@/components/Card';

// Định nghĩa kiểu dữ liệu cho Setting
interface Setting {
  id: number;
  key: string;
  value: string;
  description: string | null;
  group: string;
}

// Mở rộng kiểu dữ liệu cho workerStatus
interface WorkerStatus {
  isRunning: boolean;
  uptime: string;
  pendingJobs: number;
  lastCheck: number;
  activeTasks?: any[];
  error?: string;
}

export default function SystemSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<Setting[]>([]);
  const [workerStatus, setWorkerStatus] = useState<WorkerStatus>({
    isRunning: false,
    uptime: '',
    pendingJobs: 0,
    lastCheck: 0
  });
  const [workerLoading, setWorkerLoading] = useState(false);
  const [formData, setFormData] = useState({
    shopify_access_token: '',
    shopify_store: '',
    shopify_location_id: '',
    nhanh_api_key: '',
    nhanh_business_id: '',
    nhanh_app_id: '',
    sync_interval: '30',
    sync_auto: 'false'
  });
  const [workerLogs, setWorkerLogs] = useState<Array<{
    message: string;
    timestamp: number;
    type: 'info' | 'warning' | 'error';
  }>>([]);

  // Tải dữ liệu cài đặt từ API
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);
        
        // Khởi tạo cài đặt mặc định nếu cần
        await initializeDefaultSettings();
        
        // Lấy cài đặt từ API
        const response = await fetchSettings();
        
        if (response.success) {
          const allSettings: Setting[] = [];
          
          // Gộp tất cả cài đặt từ các nhóm
          Object.values(response.settings).forEach((groupSettings: any) => {
            allSettings.push(...groupSettings);
          });
          
          setSettings(allSettings);
          
          // Cập nhật dữ liệu form
          const newFormData = { ...formData };
          allSettings.forEach(setting => {
            if (formData.hasOwnProperty(setting.key)) {
              (newFormData as any)[setting.key] = setting.value;
            }
          });
          
          setFormData(newFormData);
        } else {
          toast.error(response.message || 'Không thể tải cài đặt');
        }
      } catch (error: any) {
        console.error('Error loading settings:', error);
        toast.error(error.message || 'Lỗi khi tải cài đặt');
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
    loadWorkerStatus();
  }, []);

  // Tải trạng thái worker
  const loadWorkerStatus = async () => {
    try {
      setWorkerLoading(true);
      const response = await fetch('/api/worker/status', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setWorkerStatus(data.workerStatus);
        } else {
          console.error('Lỗi khi tải trạng thái worker:', data.message);
        }
      } else {
        console.error('Lỗi kết nối API:', response.status);
      }
    } catch (error) {
      console.error('Lỗi khi tải trạng thái worker:', error);
    } finally {
      setWorkerLoading(false);
    }
  };

  // Xử lý thay đổi input
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Xử lý lưu cài đặt
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setSaving(true);
      
      // Cập nhật từng cài đặt
      for (const [key, value] of Object.entries(formData)) {
        const setting = settings.find(s => s.key === key);
        
        if (setting) {
          await updateSetting({
            key,
            value: String(value),
            description: setting.description || undefined,
            group: setting.group
          });
        }
      }
      
      toast.success('Đã lưu cài đặt thành công');
    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast.error(error.message || 'Lỗi khi lưu cài đặt');
    } finally {
      setSaving(false);
    }
  };

  // Hiển thị thông tin worker status
  const renderWorkerStatus = () => {
    if (workerLoading) {
      return (
        <div className="text-center py-6">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-3"></div>
          <span className="text-slate-500">Đang tải trạng thái worker...</span>
        </div>
      );
    }

    if (!workerStatus) {
      return (
        <div className="text-center py-6">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="w-6 h-6 text-slate-400" />
          </div>
          <span className="text-slate-700">Worker chưa được khởi động</span>
        </div>
      );
    }

    const isActive = workerStatus.isRunning;
    
    return (
      <div className="space-y-6">
        {/* Thông tin cơ bản */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center mb-4">
            <div className={`w-3 h-3 rounded-full mr-3 ${isActive ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className={`text-lg font-medium ${isActive ? 'text-green-700' : 'text-red-700'}`}>
            {isActive ? 'Worker đang hoạt động' : 'Worker không hoạt động'}
          </span>
        </div>
        
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        {workerStatus.uptime && (
              <div className="flex items-center">
                <Clock className="w-4 h-4 mr-2 text-indigo-500" />
                <span className="font-medium mr-2">Khởi động lúc:</span>
                <span>{new Date(workerStatus.uptime).toLocaleString()}</span>
              </div>
        )}
        
        {workerStatus.lastCheck && (
              <div className="flex items-center">
                <CheckSquare className="w-4 h-4 mr-2 text-indigo-500" />
                <span className="font-medium mr-2">Kiểm tra lần cuối:</span>
                <span>{new Date(workerStatus.lastCheck).toLocaleString()}</span>
              </div>
        )}
          </div>
        </div>
        
        {/* Thống kê tác vụ */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white border border-gray-200 p-4 rounded-lg shadow-sm">
            <div className="text-blue-600 font-semibold text-2xl">{workerStatus.pendingJobs || 0}</div>
            <div className="text-sm text-gray-600">Đang chờ</div>
          </div>
          
          <div className="bg-white border border-gray-200 p-4 rounded-lg shadow-sm">
            <div className="text-yellow-600 font-semibold text-2xl">{workerStatus.pendingJobs || 0}</div>
            <div className="text-sm text-gray-600">Đang xử lý</div>
          </div>
          
          <div className="bg-white border border-gray-200 p-4 rounded-lg shadow-sm">
            <div className="text-green-600 font-semibold text-2xl">{workerStatus.pendingJobs || 0}</div>
            <div className="text-sm text-gray-600">Hoàn thành</div>
          </div>
          
          <div className="bg-white border border-gray-200 p-4 rounded-lg shadow-sm">
            <div className="text-red-600 font-semibold text-2xl">{workerStatus.pendingJobs || 0}</div>
            <div className="text-sm text-gray-600">Thất bại</div>
          </div>
        </div>
        
        {/* Danh sách tác vụ đang xử lý */}
        {workerStatus.pendingJobs > 0 && workerStatus.activeTasks && (
          <div className="mt-6">
            <h3 className="text-md font-semibold mb-3">Tác vụ đang xử lý</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ID
                    </th>
                    <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Loại
                    </th>
                    <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tiến độ
                    </th>
                    <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Thời gian bắt đầu
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {workerStatus.activeTasks.map((task: any) => (
                    <tr key={task.id}>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                        {task.id}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                        {task.name || 'Không xác định'}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-full bg-gray-200 rounded-full h-2.5 mr-2" style={{ width: '100px' }}>
                            <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${task.progress || 0}%` }}></div>
                          </div>
                          <span className="text-xs text-gray-500">{Math.round(task.progress || 0)}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                        {task.processedOn ? new Date(task.processedOn).toLocaleString() : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        {/* Hiển thị lỗi nếu có */}
        {workerStatus.error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center mb-2">
              <AlertTriangle className="w-5 h-5 text-red-500 mr-2" />
              <span className="font-medium text-red-700">Lỗi worker gần đây nhất</span>
            </div>
            <pre className="text-sm text-red-700 overflow-x-auto">{workerStatus.error}</pre>
          </div>
        )}
        
        {/* Nút thao tác */}
        <div className="flex flex-wrap gap-3 mt-4">
          <button
            className="px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg shadow-sm text-sm font-medium flex items-center"
            onClick={loadWorkerStatus}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Làm mới trạng thái
          </button>
          
          <button
            className="px-4 py-2 bg-yellow-100 text-yellow-700 hover:bg-yellow-200 rounded-lg shadow-sm text-sm font-medium flex items-center"
            onClick={() => {
              toast.info("Để khởi động lại worker, vui lòng chạy lệnh sau trên máy chủ: pm2 restart apimodern-worker");
            }}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Khởi động lại Worker
          </button>
        </div>
      </div>
    );
  };

  const handleToggleWorker = async () => {
    try {
      setWorkerLoading(true);
      const response = await fetch('/api/worker/toggle', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setWorkerStatus(data.workerStatus);
        } else {
          console.error('Lỗi khi điều khiển worker:', data.message);
        }
      } else {
        console.error('Lỗi kết nối API:', response.status);
      }
    } catch (error) {
      console.error('Lỗi khi điều khiển worker:', error);
    } finally {
      setWorkerLoading(false);
    }
  };

  const handleRefreshWorkerStatus = async () => {
    try {
      setWorkerLoading(true);
      const response = await fetch('/api/worker/status', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setWorkerStatus(data.workerStatus);
          setWorkerLogs(data.workerLogs);
        } else {
          console.error('Lỗi khi tải trạng thái worker:', data.message);
        }
      } else {
        console.error('Lỗi kết nối API:', response.status);
      }
    } catch (error) {
      console.error('Lỗi khi tải trạng thái worker:', error);
    } finally {
      setWorkerLoading(false);
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  // Button trong phần worker management
  const renderStopIcon = () => {
    return (
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width="24" 
        height="24" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        className="w-4 h-4"
      >
        <rect x="6" y="6" width="12" height="12" />
      </svg>
    );
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <Server className="h-7 w-7 text-blue-600 mr-3" />
            <h1 className="text-2xl font-bold text-slate-800">Cài đặt hệ thống</h1>
          </div>
          <button
            type="button"
            onClick={loadWorkerStatus}
            className="flex items-center px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg"
          >
            <RefreshCw className="h-4 w-4 mr-1.5" />
            <span className="text-sm">Làm mới</span>
          </button>
        </div>

        {/* Worker Status Section */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200 mb-6">
          <div className="flex items-center mb-4">
            <Activity className="h-5 w-5 text-blue-600 mr-2" />
            <h2 className="text-lg font-semibold text-slate-800">Trạng thái Worker</h2>
          </div>
          
          <div className="mb-4">
            <Card title="Quản lý Worker đồng bộ" loading={loading}>
              <div className="p-6 space-y-4">
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Trạng thái Worker
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Worker xử lý đồng bộ tự động chạy ngầm
                      </p>
                    </div>
                    
                    <div className="flex items-center">
                      <div className={`w-3 h-3 rounded-full mr-2 ${workerStatus.isRunning ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <span className={`text-sm font-medium ${workerStatus.isRunning ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {workerStatus.isRunning ? 'Đang chạy' : 'Đã dừng'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="bg-white dark:bg-gray-900 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Thời gian hoạt động</p>
                      <p className="text-lg font-semibold">{workerStatus.uptime || '—'}</p>
                    </div>
                    
                    <div className="bg-white dark:bg-gray-900 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Công việc đang chờ</p>
                      <p className="text-lg font-semibold">{workerStatus.pendingJobs || 0}</p>
                    </div>
                    
                    <div className="bg-white dark:bg-gray-900 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Lần kiểm tra gần nhất</p>
                      <p className="text-lg font-semibold">{workerStatus.lastCheck ? formatTime(workerStatus.lastCheck) : '—'}</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-3">
                    <button
                      className={`px-4 py-2 text-white rounded-lg shadow-sm flex items-center gap-2 ${
                        workerStatus.isRunning ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
                      }`}
                      onClick={handleToggleWorker}
                      disabled={workerLoading}
                    >
                      {workerLoading ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : workerStatus.isRunning ? (
                        <StopCircle className="w-4 h-4" />
                      ) : (
                        <PlayCircle className="w-4 h-4" />
                      )}
                      <span>{workerStatus.isRunning ? 'Dừng Worker' : 'Khởi động Worker'}</span>
                    </button>
                    
                    <button
                      className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg shadow-sm hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center gap-2"
                      onClick={handleRefreshWorkerStatus}
                      disabled={workerLoading}
                    >
                      <RefreshCw className={`w-4 h-4 ${workerLoading ? 'animate-spin' : ''}`} />
                      <span>Làm mới</span>
                    </button>
                  </div>
                </div>
                
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Nhật ký hoạt động
                  </h3>
                  
                  <div className="bg-white dark:bg-gray-900 p-3 rounded-lg border border-gray-200 dark:border-gray-700 max-h-60 overflow-y-auto">
                    {workerLogs.length > 0 ? (
                      <div className="divide-y divide-gray-200 dark:divide-gray-700">
                        {workerLogs.map((log, index) => (
                          <div key={index} className="py-2">
                            <div className="flex items-center justify-between">
                              <span className={`text-sm ${
                                log.type === 'error' ? 'text-red-600 dark:text-red-400' :
                                log.type === 'warning' ? 'text-amber-600 dark:text-amber-400' :
                                'text-gray-800 dark:text-gray-200'
                              }`}>
                                {log.message}
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {formatTime(log.timestamp)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                        <p>Chưa có nhật ký hoạt động</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </div>
          
          <div className="text-sm text-slate-500 mb-4">
            Worker chạy độc lập với ứng dụng web và quản lý các tác vụ đồng bộ tự động theo lịch.
            Worker này không phụ thuộc vào trình duyệt và sẽ tiếp tục chạy ngay cả khi không có người dùng đăng nhập.
          </div>
          
          <div className="flex space-x-3">
            <button 
              type="button"
              className="flex items-center px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg"
              onClick={() => toast.info("Để quản lý worker, vui lòng sử dụng script 'scripts/start-worker.ps1' trên máy chủ.")}
            >
              <PlayCircle className="h-4 w-4 mr-1.5" />
              <span className="text-sm">Hướng dẫn khởi động Worker</span>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Shopify API Key</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={formData.shopify_access_token}
                    onChange={handleChange}
                    name="shopify_access_token"
                    placeholder="Nhập Shopify API Key"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Shopify Store</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={formData.shopify_store}
                    onChange={handleChange}
                    name="shopify_store"
                    placeholder="Nhập Shopify API Secret"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Shopify Location ID</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={formData.shopify_location_id}
                    onChange={handleChange}
                    name="shopify_location_id"
                    placeholder="Nhập Shopify Location ID"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Nhanh.vn API Key</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={formData.nhanh_api_key}
                    onChange={handleChange}
                    name="nhanh_api_key"
                    placeholder="Nhập Nhanh.vn API Key"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Nhanh.vn Business ID</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={formData.nhanh_business_id}
                    onChange={handleChange}
                    name="nhanh_business_id"
                    placeholder="Nhập Nhanh.vn API Secret"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Nhanh.vn App ID</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={formData.nhanh_app_id}
                    onChange={handleChange}
                    name="nhanh_app_id"
                    placeholder="Nhập Nhanh.vn App ID"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Thời gian đồng bộ (phút)</label>
                  <input
                    type="number"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={formData.sync_interval}
                    onChange={handleChange}
                    name="sync_interval"
                    min="5"
                    max="1440"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Đồng bộ tự động</label>
                  <select
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={formData.sync_auto}
                    onChange={handleChange}
                    name="sync_auto"
                  >
                    <option value="true">Bật</option>
                    <option value="false">Tắt</option>
                  </select>
                </div>
              </div>

              <div className="mt-8 flex justify-end">
                <button 
                  type="button" 
                  className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-lg mr-3 flex items-center"
                  onClick={() => toast.info('Đang tải lại dữ liệu...')}
                >
                  <RefreshCw size={18} className="mr-2" />
                  Tải lại
                </button>
                
                <button 
                  type="submit" 
                  className="px-5 py-2.5 bg-blue-600 text-white rounded-lg flex items-center"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <RefreshCw size={18} className="mr-2 animate-spin" />
                      Đang xử lý...
                    </>
                  ) : (
                    <>
                      <Save size={18} className="mr-2" />
                      Lưu cài đặt
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </Layout>
  );
} 