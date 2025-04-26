'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/context/AppContext';
import Layout from '@/components/Layout';
import PageContainer, { PageHeader, PageSection } from '@/components/ui/PageContainer';
import {
  RefreshCw, Clock, Calendar, CheckCircle, 
  XCircle, Trash2, PlusCircle, Settings, 
  AlertCircle, PlayCircle, PauseCircle
} from 'lucide-react';
import { toast } from 'react-toastify';
import Card from '@/components/Card';
import { format, addMinutes, setHours, setMinutes } from 'date-fns';
import { vi } from 'date-fns/locale';

// Interface cho lịch đồng bộ
interface ScheduledSync {
  id: number;
  syncType: 'all' | 'inventory' | 'price';
  status: string;
  executionTime: string;
  createdBy: string;
  createdAt: string;
  message: string;
}

export default function AutoSyncPage() {
  const { token } = useAppContext();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [scheduledSyncs, setScheduledSyncs] = useState<ScheduledSync[]>([]);
  const [syncType, setSyncType] = useState<'all' | 'inventory' | 'price'>('all');
  const [scheduleType, setScheduleType] = useState<'delay' | 'specific'>('delay');
  const [delayMinutes, setDelayMinutes] = useState(30);
  const [specificTime, setSpecificTime] = useState<Date>(new Date());
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [syncAll, setSyncAll] = useState(true);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
  const [syncInterval, setSyncInterval] = useState(30);

  // Tải danh sách lịch đồng bộ đã lên lịch
  const fetchScheduledSyncs = async () => {
    if (!token) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/sync/schedule', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setScheduledSyncs(data.scheduledSyncs || []);
      }
    } catch (error) {
      console.error('Lỗi khi tải lịch đồng bộ:', error);
    } finally {
      setLoading(false);
    }
  };

  // Tải cài đặt đồng bộ tự động
  const fetchAutoSyncSettings = async () => {
    if (!token) return;
    
    try {
      const response = await fetch('/api/settings/sync', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setAutoSyncEnabled(data.sync_auto === 'true');
        setSyncInterval(parseInt(data.sync_interval || '30', 10));
      }
    } catch (error) {
      console.error('Lỗi khi tải cài đặt đồng bộ tự động:', error);
    }
  };

  // Khởi tạo
  useEffect(() => {
    if (!token) {
      router.push('/login');
      return;
    }
    
    fetchScheduledSyncs();
    fetchAutoSyncSettings();
  }, [token, router]);

  // Lên lịch đồng bộ mới
  const scheduleSync = async () => {
    if (!token) return;
    
    setLoading(true);
    try {
      let scheduledTime = new Date();
      
      if (scheduleType === 'delay') {
        // Tính thời gian dựa trên delay
        scheduledTime = addMinutes(new Date(), delayMinutes);
      } else {
        // Sử dụng thời gian cụ thể
        scheduledTime = specificTime;
      }
      
      // Tính số phút delay từ thời điểm hiện tại
      const delayMs = scheduledTime.getTime() - new Date().getTime();
      if (delayMs < 0) {
        toast.error('Thời gian lên lịch phải lớn hơn thời gian hiện tại');
        setLoading(false);
        return;
      }
      
      const delayMins = Math.ceil(delayMs / (60 * 1000));
      
      const response = await fetch('/api/sync/schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          syncType,
          delayMinutes: delayMins,
          syncAll
        })
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        toast.success('Đã lên lịch đồng bộ thành công');
        setShowScheduleForm(false);
        fetchScheduledSyncs();
      } else {
        toast.error(`Không thể lên lịch đồng bộ: ${data.message || 'Không xác định'}`);
      }
    } catch (error) {
      console.error('Lỗi khi lên lịch đồng bộ:', error);
      toast.error('Lỗi khi kết nối với máy chủ');
    } finally {
      setLoading(false);
    }
  };

  // Xóa lịch đồng bộ
  const deleteScheduledSync = async (id: number) => {
    if (!token) return;
    
    try {
      const response = await fetch(`/api/sync/schedule/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        toast.success('Đã xóa lịch đồng bộ');
        fetchScheduledSyncs();
      } else {
        const data = await response.json();
        toast.error(`Không thể xóa lịch đồng bộ: ${data.message || 'Không xác định'}`);
      }
    } catch (error) {
      console.error('Lỗi khi xóa lịch đồng bộ:', error);
      toast.error('Lỗi khi kết nối với máy chủ');
    }
  };

  // Thay đổi trạng thái đồng bộ tự động
  const toggleAutoSync = async () => {
    if (!token) return;
    
    try {
      const response = await fetch('/api/settings/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          sync_auto: (!autoSyncEnabled).toString()
        })
      });
      
      if (response.ok) {
        setAutoSyncEnabled(!autoSyncEnabled);
        toast.success(`Đồng bộ tự động đã được ${!autoSyncEnabled ? 'bật' : 'tắt'}`);
      } else {
        const data = await response.json();
        toast.error(`Không thể thay đổi trạng thái: ${data.message || 'Không xác định'}`);
      }
    } catch (error) {
      console.error('Lỗi khi thay đổi trạng thái đồng bộ tự động:', error);
      toast.error('Lỗi khi kết nối với máy chủ');
    }
  };

  // Cập nhật thời gian lặp lại đồng bộ tự động
  const updateSyncInterval = async () => {
    if (!token) return;
    
    try {
      const response = await fetch('/api/settings/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          sync_interval: syncInterval.toString()
        })
      });
      
      if (response.ok) {
        toast.success(`Đã cập nhật thời gian lặp lại thành ${syncInterval} phút`);
      } else {
        const data = await response.json();
        toast.error(`Không thể cập nhật thời gian: ${data.message || 'Không xác định'}`);
      }
    } catch (error) {
      console.error('Lỗi khi cập nhật thời gian lặp lại:', error);
      toast.error('Lỗi khi kết nối với máy chủ');
    }
  };

  // Format thời gian
  const formatDateTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, 'HH:mm - dd/MM/yyyy', { locale: vi });
    } catch {
      return dateString;
    }
  };

  // Chuyển đổi loại đồng bộ sang tiếng Việt
  const getSyncTypeText = (type: string) => {
    switch (type) {
      case 'all': return 'Tất cả dữ liệu';
      case 'inventory': return 'Tồn kho';
      case 'price': return 'Giá bán';
      default: return type;
    }
  };

  // Xử lý thay đổi thời gian cụ thể
  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const [hours, minutes] = e.target.value.split(':').map(Number);
    const newDate = new Date(specificTime);
    setSpecificTime(setHours(setMinutes(newDate, minutes), hours));
  };

  return (
    <Layout>
      <PageContainer>
        <PageHeader 
          title="Lên lịch đồng bộ tự động" 
          description="Quản lý và lên lịch đồng bộ tự động giữa Shopify và Nhanh.vn"
          actions={
            <div className="flex gap-2 sm:gap-3">
              <button
                className="px-3 sm:px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-md shadow-sm text-xs sm:text-sm font-medium flex items-center transition-colors dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                onClick={fetchScheduledSyncs}
                disabled={loading}
              >
                <RefreshCw className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                <span className="hidden xs:inline">Làm mới</span>
              </button>
              <button
                className="px-3 sm:px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md shadow-sm text-xs sm:text-sm font-medium flex items-center transition-colors"
                onClick={() => setShowScheduleForm(!showScheduleForm)}
              >
                <PlusCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                Lên lịch mới
              </button>
            </div>
          }
        />
        
        {/* Phần trạng thái và cài đặt */}
        <PageSection>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {/* Bảng thông tin trạng thái */}
            <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-sm overflow-hidden transition-all hover:shadow-md">
              <div className="p-5 sm:p-6">
                <div className="flex items-center mb-4">
                  <div className="rounded-md bg-primary-50 dark:bg-primary-900/30 p-2 mr-3">
                    <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-primary-500 dark:text-primary-400" />
                  </div>
                  <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Trạng thái đồng bộ tự động</h2>
                </div>
                
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-md p-4 sm:p-5">
                  <div className="flex items-center text-xs sm:text-sm mb-4">
                    <div className="flex-shrink-0 w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 mr-3">
                      <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                    </div>
                    <div>
                      <span className="font-medium text-gray-700 dark:text-gray-300">Trạng thái:</span>
                      <span className={`ml-2 ${autoSyncEnabled ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'} font-medium`}>
                        {autoSyncEnabled ? 'Đang hoạt động' : 'Đã tắt'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center text-xs sm:text-sm mb-4">
                    <div className="flex-shrink-0 w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 mr-3">
                      <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
                    </div>
                    <div>
                      <span className="font-medium text-gray-700 dark:text-gray-300">Thời gian lặp lại:</span>
                      <span className="ml-2 text-gray-900 dark:text-gray-100">{syncInterval} phút</span>
                    </div>
                  </div>
                  
                  {autoSyncEnabled && (
                    <div className="flex mt-4 p-3 sm:p-4 bg-amber-50 dark:bg-amber-900/20 rounded-md text-amber-800 dark:text-amber-200 border border-amber-100 dark:border-amber-800/30 text-xs sm:text-sm">
                      <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 mr-2" />
                      <span>
                        Hệ thống sẽ tự động đồng bộ sản phẩm mỗi {syncInterval} phút khi trạng thái đồng bộ tự động được bật.
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </Card>
            
            {/* Bảng cài đặt */}
            <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-sm overflow-hidden transition-all hover:shadow-md">
              <div className="p-5 sm:p-6">
                <div className="flex items-center mb-4">
                  <div className="rounded-md bg-primary-50 dark:bg-primary-900/30 p-2 mr-3">
                    <Settings className="h-4 w-4 sm:h-5 sm:w-5 text-primary-500 dark:text-primary-400" />
                  </div>
                  <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Cài đặt đồng bộ tự động</h2>
                </div>
                
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-md p-4 sm:p-5">
                  <div className="flex flex-col space-y-4 sm:space-y-5">
                    {/* Điều khiển bật/tắt */}
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Trạng thái đồng bộ tự động
                      </label>
                      <button
                        className={`px-3 sm:px-4 py-2 w-full ${autoSyncEnabled 
                          ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50' 
                          : 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/50'
                        } rounded-md shadow-sm text-xs sm:text-sm font-medium flex items-center justify-center transition-colors`}
                        onClick={toggleAutoSync}
                      >
                        {autoSyncEnabled ? (
                          <>
                            <PauseCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                            Tạm dừng đồng bộ tự động
                          </>
                        ) : (
                          <>
                            <PlayCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                            Kích hoạt đồng bộ tự động
                          </>
                        )}
                      </button>
                    </div>
                    
                    {/* Cài đặt thời gian lặp lại */}
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Thời gian lặp lại (phút)
                      </label>
                      <div className="flex items-center space-x-2 sm:space-x-3">
                        <input
                          type="number"
                          min="1"
                          max="1440"
                          className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-xs sm:text-sm"
                          value={syncInterval}
                          onChange={(e) => setSyncInterval(parseInt(e.target.value) || 30)}
                        />
                        <button
                          className="px-3 sm:px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md shadow-sm text-xs sm:text-sm font-medium whitespace-nowrap"
                          onClick={updateSyncInterval}
                        >
                          Cập nhật
                        </button>
                      </div>
                      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        Thiết lập thời gian lặp lại đồng bộ tự động (từ 1 đến 1440 phút).
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </PageSection>
        
        {/* Form lên lịch đồng bộ mới */}
        {showScheduleForm && (
          <PageSection>
            <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-sm overflow-hidden transition-all hover:shadow-md">
              <div className="p-5 sm:p-6">
                <div className="flex items-center mb-4">
                  <div className="rounded-md bg-primary-50 dark:bg-primary-900/30 p-2 mr-3">
                    <PlusCircle className="h-4 w-4 sm:h-5 sm:w-5 text-primary-500 dark:text-primary-400" />
                  </div>
                  <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Lên lịch đồng bộ mới</h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-5">
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Loại đồng bộ
                    </label>
                    <select
                      className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-xs sm:text-sm"
                      value={syncType}
                      onChange={(e) => setSyncType(e.target.value as any)}
                    >
                      <option value="all">Đồng bộ tất cả dữ liệu</option>
                      <option value="inventory">Chỉ đồng bộ tồn kho</option>
                      <option value="price">Chỉ đồng bộ giá</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Loại lên lịch
                    </label>
                    <div className="flex items-center flex-wrap sm:flex-nowrap gap-3 sm:gap-4">
                      <label className="inline-flex items-center">
                        <input
                          type="radio"
                          className="form-radio text-primary-600"
                          name="scheduleType"
                          value="delay"
                          checked={scheduleType === 'delay'}
                          onChange={() => setScheduleType('delay')}
                        />
                        <span className="ml-2 text-xs sm:text-sm text-gray-700 dark:text-gray-300">Sau một khoảng thời gian</span>
                      </label>
                      <label className="inline-flex items-center">
                        <input
                          type="radio"
                          className="form-radio text-primary-600"
                          name="scheduleType"
                          value="specific"
                          checked={scheduleType === 'specific'}
                          onChange={() => setScheduleType('specific')}
                        />
                        <span className="ml-2 text-xs sm:text-sm text-gray-700 dark:text-gray-300">Thời điểm cụ thể</span>
                      </label>
                    </div>
                  </div>
                </div>
                
                <div className="mb-5 bg-gray-50 dark:bg-gray-900/50 rounded-md p-4 sm:p-5">
                  {scheduleType === 'delay' ? (
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Thời gian chờ (phút)
                      </label>
                      <input
                        type="number"
                        min="1"
                        className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-xs sm:text-sm"
                        value={delayMinutes}
                        onChange={(e) => setDelayMinutes(parseInt(e.target.value) || 30)}
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Thời gian
                        </label>
                        <input
                          type="time"
                          className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-xs sm:text-sm"
                          value={format(specificTime, 'HH:mm')}
                          onChange={handleTimeChange}
                        />
                      </div>
                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Ngày
                        </label>
                        <input
                          type="date"
                          className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-xs sm:text-sm"
                          value={format(specificTime, 'yyyy-MM-dd')}
                          onChange={(e) => {
                            const [year, month, day] = e.target.value.split('-').map(Number);
                            const newDate = new Date(specificTime);
                            newDate.setFullYear(year, month - 1, day);
                            setSpecificTime(newDate);
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="mb-5">
                  <label className="inline-flex items-center">
                    <input
                      type="checkbox"
                      className="form-checkbox text-primary-600 rounded"
                      checked={syncAll}
                      onChange={(e) => setSyncAll(e.target.checked)}
                    />
                    <span className="ml-2 text-xs sm:text-sm text-gray-700 dark:text-gray-300">Đồng bộ tất cả sản phẩm (bao gồm cả sản phẩm có lỗi)</span>
                  </label>
                </div>
                
                <div className="flex justify-end space-x-2 sm:space-x-3">
                  <button
                    className="px-3 sm:px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-md shadow-sm text-xs sm:text-sm font-medium dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 transition-colors"
                    onClick={() => setShowScheduleForm(false)}
                  >
                    Hủy
                  </button>
                  <button
                    className="px-3 sm:px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md shadow-sm text-xs sm:text-sm font-medium transition-colors"
                    onClick={scheduleSync}
                    disabled={loading}
                  >
                    {loading ? 'Đang xử lý...' : 'Lên lịch đồng bộ'}
                  </button>
                </div>
              </div>
            </Card>
          </PageSection>
        )}
        
        {/* Danh sách lịch đồng bộ */}
        <div className="mb-6">
          <Card className="shadow-sm hover:shadow-md transition-all">
            <div className="p-5 sm:p-6">
              <div className="flex items-center mb-4">
                <div className="rounded-md bg-primary-50 dark:bg-primary-900/30 p-2 mr-3">
                  <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-primary-500 dark:text-primary-400" />
                </div>
                <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Danh sách lịch đồng bộ</h2>
              </div>
              
              {loading ? (
                <div className="py-6 text-center text-gray-500 text-sm">
                  <RefreshCw className="h-6 w-6 mx-auto mb-2 animate-spin text-primary-500" />
                  Đang tải dữ liệu...
                </div>
              ) : scheduledSyncs.length === 0 ? (
                <div className="py-8 text-center text-gray-500 text-sm">
                  <Calendar className="h-8 w-8 mx-auto mb-2 text-gray-400 dark:text-gray-600" />
                  Chưa có lịch đồng bộ nào được thiết lập
                </div>
              ) : (
                <div className="overflow-x-auto -mx-5 sm:-mx-6">
                  <div className="inline-block min-w-full px-5 sm:px-6">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-800/50">
                        <tr>
                          <th scope="col" className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            ID
                          </th>
                          <th scope="col" className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Loại đồng bộ
                          </th>
                          <th scope="col" className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Thời gian thực hiện
                          </th>
                          <th scope="col" className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Trạng thái
                          </th>
                          <th scope="col" className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Người tạo
                          </th>
                          <th scope="col" className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Thao tác
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {scheduledSyncs.map((sync) => (
                          <tr key={sync.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                            <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900 dark:text-gray-100">
                              {sync.id}
                            </td>
                            <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900 dark:text-gray-100">
                              {getSyncTypeText(sync.syncType)}
                            </td>
                            <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900 dark:text-gray-100">
                              {formatDateTime(sync.executionTime)}
                            </td>
                            <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                                sync.status === 'scheduled' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                                sync.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                                sync.status === 'running' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' :
                                sync.status === 'error' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                                'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                              }`}>
                                {sync.status === 'scheduled' ? 'Đã lên lịch' :
                                 sync.status === 'completed' ? 'Hoàn thành' :
                                 sync.status === 'running' ? 'Đang chạy' :
                                 sync.status === 'error' ? 'Lỗi' :
                                 sync.status}
                              </span>
                            </td>
                            <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900 dark:text-gray-100">
                              {sync.createdBy}
                            </td>
                            <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm font-medium">
                              <button
                                className={`p-1.5 rounded-full ${
                                  sync.status === 'running' || sync.status === 'completed' 
                                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500'
                                  : 'bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50'
                                }`}
                                onClick={() => deleteScheduledSync(sync.id)}
                                disabled={sync.status === 'running' || sync.status === 'completed'}
                                aria-label="Xóa lịch đồng bộ"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
        
        {/* Thông tin hướng dẫn */}
        <div className="mb-6">
          <Card className="shadow-sm hover:shadow-md transition-all">
            <div className="p-5 sm:p-6">
              <div className="flex items-center mb-4">
                <div className="rounded-md bg-blue-50 dark:bg-blue-900/30 p-2 mr-3">
                  <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500 dark:text-blue-400" />
                </div>
                <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Hướng dẫn đồng bộ tự động</h2>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-md p-4 sm:p-5 text-xs sm:text-sm text-gray-700 dark:text-gray-300 space-y-2">
                <p>Có 2 cách để thiết lập đồng bộ tự động:</p>
                <ol className="list-decimal pl-5 space-y-2">
                  <li><strong>Đồng bộ tự động định kỳ:</strong> Hệ thống sẽ tự động đồng bộ theo khoảng thời gian đã cài đặt (mặc định là 30 phút)</li>
                  <li><strong>Lên lịch đồng bộ:</strong> Bạn có thể lên lịch đồng bộ vào thời điểm cụ thể hoặc sau một khoảng thời gian nhất định</li>
                </ol>
                <p className="mt-2 px-3 py-2 bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-300 dark:border-yellow-700 rounded-r-md">
                  <strong>Lưu ý:</strong> Quá trình đồng bộ tự động chỉ hoạt động khi worker đang chạy. Bạn có thể kiểm tra trạng thái worker tại trang Cài đặt hệ thống.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </PageContainer>
    </Layout>
  );
} 