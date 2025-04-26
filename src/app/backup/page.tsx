'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import PageContainer from '@/components/ui/PageContainer';
import { PageHeader, PageSection } from '@/components/ui/PageSection';
import Card from '@/components/Card';
import { 
  Database, Download, Upload, RefreshCw, Calendar, 
  Clock, File, Trash2, Settings, Search, Plus, CloudOff, 
  CheckCircle, AlertCircle, DownloadCloud, Package, Users
} from 'lucide-react';
import { toast } from 'react-toastify';

// Mock backup data
const mockBackups = [
  {
    id: 'bkp-001',
    name: 'Backup-20231215-120000',
    createdAt: '2023-12-15T12:00:00Z',
    size: '24.5 MB',
    status: 'completed',
    type: 'manual',
    items: {
      products: 1245,
      settings: 32,
      users: 5,
      logs: 8765
    }
  },
  {
    id: 'bkp-002',
    name: 'Backup-20231214-010000',
    createdAt: '2023-12-14T01:00:00Z',
    size: '23.8 MB',
    status: 'completed',
    type: 'automatic',
    items: {
      products: 1240,
      settings: 32,
      users: 5,
      logs: 8560
    }
  },
  {
    id: 'bkp-003',
    name: 'Backup-20231213-010000',
    createdAt: '2023-12-13T01:00:00Z',
    size: '23.2 MB',
    status: 'completed',
    type: 'automatic',
    items: {
      products: 1235,
      settings: 32,
      users: 5,
      logs: 8310
    }
  },
  {
    id: 'bkp-004',
    name: 'Backup-20231212-150000',
    createdAt: '2023-12-12T15:00:00Z',
    size: '23.0 MB',
    status: 'completed',
    type: 'manual',
    items: {
      products: 1230,
      settings: 32,
      users: 5,
      logs: 8220
    }
  },
  {
    id: 'bkp-005',
    name: 'Backup-20231212-010000',
    createdAt: '2023-12-12T01:00:00Z',
    size: '22.8 MB',
    status: 'completed',
    type: 'automatic',
    items: {
      products: 1225,
      settings: 31,
      users: 5,
      logs: 8160
    }
  }
];

// Mock backup settings
const mockBackupSettings = {
  enableAutoBackup: true,
  backupFrequency: 'daily',
  backupTime: '01:00',
  keepBackups: 7,
  backupData: ['products', 'settings', 'users', 'logs'],
  backupLocation: 'local',
  compressionLevel: 'medium',
};

export default function BackupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [backups, setBackups] = useState<any[]>([]);
  const [settings, setSettings] = useState(mockBackupSettings);
  const [search, setSearch] = useState('');
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  // Load backups
  useEffect(() => {
    const fetchBackups = async () => {
      setLoading(true);
      try {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 800));
        setBackups(mockBackups);
      } catch (error) {
        console.error('Error loading backups:', error);
        toast.error('Không thể tải danh sách backup');
      } finally {
        setLoading(false);
      }
    };

    fetchBackups();
  }, []);

  // Create new backup
  const handleCreateBackup = async () => {
    setCreatingBackup(true);
    
    try {
      // Simulate backup process
      toast.info('Đang tạo backup mới...');
      await new Promise(resolve => setTimeout(resolve, 2500));
      
      // Add new backup to the list
      const newBackup = {
        id: `bkp-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
        name: `Backup-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${new Date().toTimeString().split(':').slice(0, 2).join('')}`,
        createdAt: new Date().toISOString(),
        size: '24.8 MB',
        status: 'completed',
        type: 'manual',
        items: {
          products: 1250,
          settings: 32,
          users: 5,
          logs: 8800
        }
      };
      
      setBackups([newBackup, ...backups]);
      toast.success('Tạo backup thành công');
    } catch (error) {
      console.error('Error creating backup:', error);
      toast.error('Không thể tạo backup');
    } finally {
      setCreatingBackup(false);
    }
  };

  // Restore from backup
  const handleRestore = async (backupId: string) => {
    if (!confirm('Bạn có chắc chắn muốn phục hồi từ bản backup này? Dữ liệu hiện tại sẽ bị thay thế.')) {
      return;
    }
    
    setRestoring(true);
    setSelectedBackup(backupId);
    
    try {
      // Simulate restore process
      toast.info('Đang phục hồi dữ liệu từ backup...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      toast.success('Phục hồi dữ liệu thành công');
    } catch (error) {
      console.error('Error restoring backup:', error);
      toast.error('Không thể phục hồi dữ liệu');
    } finally {
      setRestoring(false);
      setSelectedBackup(null);
    }
  };

  // Download backup
  const handleDownload = (backupId: string) => {
    toast.info('Đang chuẩn bị tải xuống...');
    setTimeout(() => {
      toast.success('Bắt đầu tải xuống');
    }, 1000);
  };

  // Delete backup
  const handleDelete = (backupId: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa bản backup này?')) {
      return;
    }
    
    setBackups(backups.filter(backup => backup.id !== backupId));
    toast.success('Đã xóa backup');
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  // Filter backups by search
  const filteredBackups = backups.filter(backup => 
    backup.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout>
      <PageContainer>
        <PageHeader 
          title="Sao lưu & Phục hồi" 
          description="Quản lý sao lưu và phục hồi dữ liệu của hệ thống"
          actions={
            <div className="flex gap-3">
              <button 
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg shadow-sm text-sm font-medium flex items-center gap-2 transition-colors"
                onClick={handleCreateBackup}
                disabled={creatingBackup}
              >
                <Database className={`w-4 h-4 ${creatingBackup ? 'animate-pulse' : ''}`} />
                {creatingBackup ? 'Đang tạo...' : 'Tạo backup'}
              </button>
              <button
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg shadow-sm text-sm font-medium flex items-center gap-2 transition-colors"
                onClick={() => setShowSettings(!showSettings)}
              >
                <Settings className="w-4 h-4" />
                Thiết lập
              </button>
            </div>
          }
        />
        
        {loading ? (
          <div className="grid grid-cols-1 gap-6">
            <Card loading>
              <div className="h-32"></div>
            </Card>
            <Card loading>
              <div className="h-32"></div>
            </Card>
          </div>
        ) : (
          <>
            {showSettings && (
              <PageSection title="Cấu hình sao lưu" className="mb-8">
                <Card>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Sao lưu tự động
                      </label>
                      <select
                        className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800"
                        value={settings.enableAutoBackup ? 'true' : 'false'}
                        onChange={(e) => setSettings({...settings, enableAutoBackup: e.target.value === 'true'})}
                      >
                        <option value="true">Bật</option>
                        <option value="false">Tắt</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Tần suất sao lưu
                      </label>
                      <select
                        className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800"
                        value={settings.backupFrequency}
                        onChange={(e) => setSettings({...settings, backupFrequency: e.target.value})}
                        disabled={!settings.enableAutoBackup}
                      >
                        <option value="daily">Hàng ngày</option>
                        <option value="weekly">Hàng tuần</option>
                        <option value="monthly">Hàng tháng</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Thời gian sao lưu
                      </label>
                      <input
                        type="time"
                        className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800"
                        value={settings.backupTime}
                        onChange={(e) => setSettings({...settings, backupTime: e.target.value})}
                        disabled={!settings.enableAutoBackup}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Giữ bản sao lưu (ngày)
                      </label>
                      <input
                        type="number"
                        className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800"
                        value={settings.keepBackups}
                        onChange={(e) => setSettings({...settings, keepBackups: parseInt(e.target.value)})}
                        min="1"
                        max="90"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Vị trí lưu trữ
                      </label>
                      <select
                        className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800"
                        value={settings.backupLocation}
                        onChange={(e) => setSettings({...settings, backupLocation: e.target.value})}
                      >
                        <option value="local">Máy chủ cục bộ</option>
                        <option value="cloud">Đám mây</option>
                        <option value="both">Cả hai</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Mức nén
                      </label>
                      <select
                        className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800"
                        value={settings.compressionLevel}
                        onChange={(e) => setSettings({...settings, compressionLevel: e.target.value})}
                      >
                        <option value="none">Không nén</option>
                        <option value="low">Thấp</option>
                        <option value="medium">Trung bình</option>
                        <option value="high">Cao</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-end">
                    <button
                      className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg shadow-sm text-sm font-medium flex items-center gap-2 transition-colors"
                      onClick={() => {
                        toast.success('Đã lưu cấu hình sao lưu');
                      }}
                    >
                      <RefreshCw className="w-4 h-4" />
                      Lưu cấu hình
                    </button>
                  </div>
                </Card>
              </PageSection>
            )}
            
            <PageSection title="Lịch sử sao lưu" className="mb-6">
              <Card>
                <div className="mb-4 flex flex-col sm:flex-row gap-4 justify-between">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Tìm kiếm backup..."
                      className="w-full sm:w-80 pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  </div>
                  
                  <div className="flex items-center text-sm text-slate-500 dark:text-slate-400">
                    <Database className="w-4 h-4 mr-1" /> 
                    {backups.length} bản sao lưu | 
                    <Clock className="w-4 h-4 mx-1" /> 
                    Tự động sao lưu: {settings.enableAutoBackup ? 'Bật' : 'Tắt'}
                  </div>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                    <thead className="bg-slate-50 dark:bg-slate-800/50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          Tên backup
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          Thời gian
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          Kích thước
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          Loại
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          Trạng thái
                        </th>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          Thao tác
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                      {filteredBackups.length > 0 ? (
                        filteredBackups.map((backup) => (
                          <tr key={backup.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-white">
                              <div className="flex items-center">
                                <Database className="h-5 w-5 text-blue-500 mr-2" />
                                {backup.name}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                              {formatDate(backup.createdAt)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                              {backup.size}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                backup.type === 'automatic' 
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' 
                                  : 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                              }`}>
                                {backup.type === 'automatic' ? (
                                  <>
                                    <Clock className="h-3 w-3 mr-1" />
                                    Tự động
                                  </>
                                ) : (
                                  <>
                                    <Database className="h-3 w-3 mr-1" />
                                    Thủ công
                                  </>
                                )}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                backup.status === 'completed' 
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                  : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                              }`}>
                                {backup.status === 'completed' ? (
                                  <>
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Hoàn thành
                                  </>
                                ) : (
                                  <>
                                    <AlertCircle className="h-3 w-3 mr-1" />
                                    Đang xử lý
                                  </>
                                )}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <div className="flex justify-end gap-2">
                                <button
                                  className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                                  onClick={() => handleRestore(backup.id)}
                                  disabled={restoring}
                                >
                                  {restoring && selectedBackup === backup.id ? (
                                    <RefreshCw className="h-5 w-5 animate-spin" />
                                  ) : (
                                    <Upload className="h-5 w-5" />
                                  )}
                                </button>
                                <button
                                  className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                                  onClick={() => handleDownload(backup.id)}
                                >
                                  <DownloadCloud className="h-5 w-5" />
                                </button>
                                <button
                                  className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                                  onClick={() => handleDelete(backup.id)}
                                >
                                  <Trash2 className="h-5 w-5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="px-6 py-4 text-center text-sm text-slate-500 dark:text-slate-400">
                            <div className="flex flex-col items-center py-6">
                              <CloudOff className="h-12 w-12 text-slate-400 mb-2" />
                              <p>Không tìm thấy bản sao lưu nào</p>
                              {search && (
                                <button
                                  className="mt-2 text-blue-600 hover:underline"
                                  onClick={() => setSearch('')}
                                >
                                  Xóa bộ lọc
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </PageSection>
            
            <PageSection title="Chi tiết dữ liệu">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card title="Sản phẩm" description="Dữ liệu sản phẩm và biến thể">
                  <div className="py-3 flex justify-between items-center">
                    <span className="text-2xl font-bold text-slate-900 dark:text-white">1,250</span>
                    <Package className="h-8 w-8 text-blue-500" />
                  </div>
                </Card>
                
                <Card title="Người dùng" description="Tài khoản người dùng">
                  <div className="py-3 flex justify-between items-center">
                    <span className="text-2xl font-bold text-slate-900 dark:text-white">5</span>
                    <Users className="h-8 w-8 text-green-500" />
                  </div>
                </Card>
                
                <Card title="Cài đặt" description="Cấu hình hệ thống">
                  <div className="py-3 flex justify-between items-center">
                    <span className="text-2xl font-bold text-slate-900 dark:text-white">32</span>
                    <Settings className="h-8 w-8 text-purple-500" />
                  </div>
                </Card>
                
                <Card title="Nhật ký" description="Log hoạt động và đồng bộ">
                  <div className="py-3 flex justify-between items-center">
                    <span className="text-2xl font-bold text-slate-900 dark:text-white">8,800</span>
                    <File className="h-8 w-8 text-amber-500" />
                  </div>
                </Card>
              </div>
            </PageSection>
          </>
        )}
      </PageContainer>
    </Layout>
  );
} 