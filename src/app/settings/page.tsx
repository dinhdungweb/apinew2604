'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import PageContainer from '@/components/ui/PageContainer';
import { PageHeader, PageSection } from '@/components/ui/PageSection';
import Card from '@/components/Card';
import { 
  Save, AlertCircle, Database, Globe, LucideIcon,
  Bell, Lock, Users, Zap, Clock, HardDrive, 
  Server, Cloud, Mail, Brush, Moon, Sun,
  Settings, RefreshCw, Terminal, Shield
} from 'lucide-react';
import { toast } from 'react-toastify';
import CacheSettings from '@/components/settings/CacheSettings';

// Định nghĩa component TabPanel
interface TabPanelProps {
  children?: React.ReactNode;
  value: string;
  className?: string;
}

const TabPanel: React.FC<TabPanelProps> = ({ 
  children, 
  value, 
  className = '' 
}) => {
  return (
    <div 
      role="tabpanel"
      id={`tabpanel-${value}`}
      aria-labelledby={`tab-${value}`}
      className={className}
    >
      {children}
    </div>
  );
};

// Các loại cài đặt và cấu hình của hệ thống
const settingsSections = [
  {
    id: 'general',
    title: 'Cài đặt chung',
    description: 'Cấu hình cơ bản cho hệ thống',
    icon: Globe,
  },
  {
    id: 'api',
    title: 'Cấu hình API',
    description: 'Thiết lập kết nối API và đồng bộ hóa',
    icon: Server,
  },
  {
    id: 'cache',
    title: 'Quản lý Cache',
    description: 'Cấu hình và quản lý bộ nhớ đệm',
    icon: Database,
  },
  {
    id: 'notifications',
    title: 'Thông báo',
    description: 'Cấu hình thông báo và cảnh báo',
    icon: Bell,
  },
  {
    id: 'security',
    title: 'Bảo mật',
    description: 'Cài đặt bảo mật và quyền truy cập',
    icon: Lock,
  },
  {
    id: 'storage',
    title: 'Lưu trữ',
    description: 'Quản lý dữ liệu và lưu trữ',
    icon: HardDrive,
  },
  {
    id: 'backup',
    title: 'Sao lưu & Phục hồi',
    description: 'Cấu hình sao lưu dữ liệu',
    icon: Database,
  },
  {
    id: 'smtp',
    title: 'Cấu hình Email',
    description: 'Thiết lập SMTP và mẫu email',
    icon: Mail,
  },
  {
    id: 'appearance',
    title: 'Giao diện',
    description: 'Tùy chỉnh giao diện người dùng',
    icon: Brush,
  }
];

const tabs = [
  { id: 'general', label: 'Chung', icon: <Settings className="w-4 h-4" /> },
  { id: 'sync', label: 'Đồng bộ', icon: <RefreshCw className="w-4 h-4" /> },
  { id: 'api', label: 'API', icon: <Terminal className="w-4 h-4" /> },
  { id: 'cache', label: 'Cache', icon: <Database className="w-4 h-4" /> },
  { id: 'security', label: 'Bảo mật', icon: <Shield className="w-4 h-4" /> },
  { id: 'system', label: 'Hệ thống', icon: <Server className="w-4 h-4" /> },
];

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState('general');
  const [darkMode, setDarkMode] = useState(false);
  const [formChanged, setFormChanged] = useState(false);
  
  // Mock form data
  const [generalSettings, setGeneralSettings] = useState({
    siteName: 'API Hub',
    siteDescription: 'Nền tảng quản lý và đồng bộ dữ liệu sản phẩm',
    timezone: 'Asia/Ho_Chi_Minh',
    language: 'vi',
    itemsPerPage: 20,
    enablePublicAccess: false,
  });
  
  const [apiSettings, setApiSettings] = useState({
    apiTimeout: 30,
    maxRetries: 3,
    enableRateLimiting: true,
    rateLimit: 100,
    rateLimitWindow: 60,
    enableLogging: true,
    logLevel: 'info',
    syncInterval: 60,
    enableAutoSync: true,
  });
  
  const [notificationSettings, setNotificationSettings] = useState({
    enableEmailNotifications: true,
    enablePushNotifications: false,
    notifyOnSyncSuccess: false,
    notifyOnSyncFailure: true,
    notifyOnSystemEvents: true,
    digestFrequency: 'daily',
  });
  
  const [securitySettings, setSecuritySettings] = useState({
    sessionTimeout: 30,
    passwordMinLength: 8,
    requireSpecialChars: true,
    requireNumbers: true,
    requireMixedCase: true,
    maxLoginAttempts: 5,
    twoFactorAuth: false,
    forcePasswordReset: 90,
  });
  
  const [storageSettings, setStorageSettings] = useState({
    storageProvider: 'local',
    s3Bucket: '',
    s3Region: '',
    cloudStorageProvider: '',
    maxUploadSize: 10,
    allowedFileTypes: '.jpg,.png,.pdf,.xlsx,.csv',
    compressUploads: true,
    imageQuality: 80,
    storageQuota: 1000,
  });
  
  const [backupSettings, setBackupSettings] = useState({
    enableAutoBackup: true,
    backupFrequency: 'daily',
    backupTime: '01:00',
    keepBackups: 7,
    backupData: ['products', 'settings', 'users', 'logs'],
    backupLocation: 'local',
    compressionLevel: 'medium',
  });
  
  const [smtpSettings, setSmtpSettings] = useState({
    smtpHost: '',
    smtpPort: 587,
    smtpUsername: '',
    smtpPassword: '',
    smtpEncryption: 'tls',
    fromEmail: 'no-reply@apihub.example.com',
    fromName: 'API Hub',
    enableSmtp: false,
  });
  
  const [appearanceSettings, setAppearanceSettings] = useState({
    theme: 'light',
    primaryColor: '#3B82F6',
    accentColor: '#8B5CF6',
    dangerColor: '#EF4444',
    successColor: '#10B981',
    warningColor: '#F59E0B',
    infoColor: '#3B82F6',
    logoUrl: '/logo.png',
    favicon: '/favicon.ico',
    customCss: '',
  });

  // Load settings data
  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      try {
        // Giả lập API call
        await new Promise(resolve => setTimeout(resolve, 600));
        // Đã khởi tạo với mock data ở trên
      } catch (error) {
        console.error('Error fetching settings:', error);
        toast.error('Không thể tải dữ liệu cài đặt');
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);
  
  // Lưu cài đặt
  const handleSaveSettings = async () => {
    setSaving(true);
    
    try {
      // Giả lập API call
      await new Promise(resolve => setTimeout(resolve, 800));
      toast.success('Đã lưu cài đặt thành công');
      setFormChanged(false);
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Không thể lưu cài đặt');
    } finally {
      setSaving(false);
    }
  };
  
  // Chuyển đổi giữa các phần
  const handleSectionChange = (sectionId: string) => {
    if (formChanged) {
      if (window.confirm('Bạn có thay đổi chưa được lưu. Bạn có chắc chắn muốn chuyển trang không?')) {
        setActiveSection(sectionId);
      }
    } else {
      setActiveSection(sectionId);
    }
  };
  
  // Xử lý thay đổi form
  const handleGeneralChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    const checked = type === 'checkbox' ? (e.target as HTMLInputElement).checked : undefined;
    
    setGeneralSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    setFormChanged(true);
  };
  
  // Toggle dark mode
  const handleToggleDarkMode = () => {
    setDarkMode(!darkMode);
    setAppearanceSettings(prev => ({
      ...prev,
      theme: prev.theme === 'light' ? 'dark' : 'light'
    }));
    setFormChanged(true);
  };
  
  // Render the active section content
  const renderSectionContent = () => {
    switch (activeSection) {
      case 'general':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tên hệ thống
                </label>
                <input
                  type="text"
                  name="siteName"
                  value={generalSettings.siteName}
                  onChange={handleGeneralChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-800 dark:text-white"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Mô tả
                </label>
                <input
                  type="text"
                  name="siteDescription"
                  value={generalSettings.siteDescription}
                  onChange={handleGeneralChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-800 dark:text-white"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Múi giờ
                </label>
                <select
                  name="timezone"
                  value={generalSettings.timezone}
                  onChange={handleGeneralChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-800 dark:text-white"
                >
                  <option value="Asia/Ho_Chi_Minh">Hồ Chí Minh (GMT+7)</option>
                  <option value="Asia/Bangkok">Bangkok (GMT+7)</option>
                  <option value="Asia/Singapore">Singapore (GMT+8)</option>
                  <option value="Asia/Tokyo">Tokyo (GMT+9)</option>
                  <option value="Europe/London">London (GMT+0)</option>
                  <option value="America/New_York">New York (GMT-5)</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Ngôn ngữ
                </label>
                <select
                  name="language"
                  value={generalSettings.language}
                  onChange={handleGeneralChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-800 dark:text-white"
                >
                  <option value="vi">Tiếng Việt</option>
                  <option value="en">English</option>
                  <option value="zh">中文</option>
                  <option value="ja">日本語</option>
                  <option value="ko">한국어</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Số mục trên mỗi trang
                </label>
                <select
                  name="itemsPerPage"
                  value={generalSettings.itemsPerPage}
                  onChange={handleGeneralChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-800 dark:text-white"
                >
                  <option value="10">10</option>
                  <option value="20">20</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select>
              </div>
            </div>
            
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  name="enablePublicAccess"
                  checked={generalSettings.enablePublicAccess}
                  onChange={handleGeneralChange}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  Cho phép truy cập không cần xác thực (API công khai)
                </span>
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">
                Khi bật, một số API sẽ có thể được truy cập mà không cần xác thực. Điều này có thể gây ra rủi ro bảo mật.
              </p>
            </div>
          </div>
        );
        
      case 'api':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Thời gian chờ API (giây)
                </label>
                <input
                  type="number"
                  name="apiTimeout"
                  value={apiSettings.apiTimeout}
                  onChange={(e) => {
                    setApiSettings(prev => ({
                      ...prev,
                      apiTimeout: parseInt(e.target.value)
                    }));
                    setFormChanged(true);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-800 dark:text-white"
                  min="1"
                  max="300"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Số lần thử lại tối đa
                </label>
                <input
                  type="number"
                  name="maxRetries"
                  value={apiSettings.maxRetries}
                  onChange={(e) => {
                    setApiSettings(prev => ({
                      ...prev,
                      maxRetries: parseInt(e.target.value)
                    }));
                    setFormChanged(true);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-800 dark:text-white"
                  min="0"
                  max="10"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Chu kỳ đồng bộ (phút)
                </label>
                <select
                  name="syncInterval"
                  value={apiSettings.syncInterval}
                  onChange={(e) => {
                    setApiSettings(prev => ({
                      ...prev,
                      syncInterval: parseInt(e.target.value)
                    }));
                    setFormChanged(true);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-800 dark:text-white"
                >
                  <option value="15">15 phút</option>
                  <option value="30">30 phút</option>
                  <option value="60">1 giờ</option>
                  <option value="180">3 giờ</option>
                  <option value="360">6 giờ</option>
                  <option value="720">12 giờ</option>
                  <option value="1440">24 giờ</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Mức độ nhật ký
                </label>
                <select
                  name="logLevel"
                  value={apiSettings.logLevel}
                  onChange={(e) => {
                    setApiSettings(prev => ({
                      ...prev,
                      logLevel: e.target.value
                    }));
                    setFormChanged(true);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-800 dark:text-white"
                >
                  <option value="error">Chỉ lỗi</option>
                  <option value="warn">Cảnh báo</option>
                  <option value="info">Thông tin</option>
                  <option value="debug">Gỡ lỗi</option>
                  <option value="trace">Chi tiết</option>
                </select>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="enableRateLimiting"
                    checked={apiSettings.enableRateLimiting}
                    onChange={(e) => {
                      setApiSettings(prev => ({
                        ...prev,
                        enableRateLimiting: e.target.checked
                      }));
                      setFormChanged(true);
                    }}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    Bật giới hạn tốc độ API
                  </span>
                </label>
                
                {apiSettings.enableRateLimiting && (
                  <div className="grid grid-cols-2 gap-4 pl-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Giới hạn yêu cầu
                      </label>
                      <input
                        type="number"
                        name="rateLimit"
                        value={apiSettings.rateLimit}
                        onChange={(e) => {
                          setApiSettings(prev => ({
                            ...prev,
                            rateLimit: parseInt(e.target.value)
                          }));
                          setFormChanged(true);
                        }}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-800 dark:text-white"
                        min="1"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Thời gian (giây)
                      </label>
                      <input
                        type="number"
                        name="rateLimitWindow"
                        value={apiSettings.rateLimitWindow}
                        onChange={(e) => {
                          setApiSettings(prev => ({
                            ...prev,
                            rateLimitWindow: parseInt(e.target.value)
                          }));
                          setFormChanged(true);
                        }}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-800 dark:text-white"
                        min="1"
                      />
                    </div>
                  </div>
                )}
              </div>
              
              <div className="space-y-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="enableLogging"
                    checked={apiSettings.enableLogging}
                    onChange={(e) => {
                      setApiSettings(prev => ({
                        ...prev,
                        enableLogging: e.target.checked
                      }));
                      setFormChanged(true);
                    }}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    Bật ghi nhật ký API
                  </span>
                </label>
                
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="enableAutoSync"
                    checked={apiSettings.enableAutoSync}
                    onChange={(e) => {
                      setApiSettings(prev => ({
                        ...prev,
                        enableAutoSync: e.target.checked
                      }));
                      setFormChanged(true);
                    }}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    Tự động đồng bộ theo lịch
                  </span>
                </label>
              </div>
            </div>
            
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900/30 rounded-lg p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <AlertCircle className="h-5 w-5 text-yellow-400" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Lưu ý về cài đặt API</h3>
                  <div className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
                    <p>
                      Các cài đặt giới hạn tốc độ có thể ảnh hưởng đến hiệu suất API. Thiết lập quá thấp có thể làm chậm quá trình đồng bộ.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
        
      case 'appearance':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Giao diện
                </label>
                <div className="flex gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAppearanceSettings(prev => ({ ...prev, theme: 'light' }));
                      setDarkMode(false);
                      setFormChanged(true);
                    }}
                    className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                      appearanceSettings.theme === 'light'
                        ? 'bg-primary-100 text-primary-700 border-2 border-primary-500'
                        : 'bg-white text-gray-700 border border-gray-300'
                    }`}
                  >
                    <Sun className="h-5 w-5" />
                    Sáng
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => {
                      setAppearanceSettings(prev => ({ ...prev, theme: 'dark' }));
                      setDarkMode(true);
                      setFormChanged(true);
                    }}
                    className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                      appearanceSettings.theme === 'dark'
                        ? 'bg-primary-900 text-primary-100 border-2 border-primary-500'
                        : 'bg-gray-800 text-gray-100 border border-gray-700'
                    }`}
                  >
                    <Moon className="h-5 w-5" />
                    Tối
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => {
                      setAppearanceSettings(prev => ({ ...prev, theme: 'system' }));
                      setFormChanged(true);
                    }}
                    className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                      appearanceSettings.theme === 'system'
                        ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-100 border-2 border-primary-500'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-100 border border-gray-300 dark:border-gray-700'
                    }`}
                  >
                    <span className="flex">
                      <Sun className="h-5 w-5" />
                      <Moon className="h-5 w-5 -ml-1" />
                    </span>
                    Hệ thống
                  </button>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Màu chính
                </label>
                <div className="flex gap-3 flex-wrap">
                  {['#3B82F6', '#8B5CF6', '#EC4899', '#EF4444', '#F59E0B', '#10B981'].map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => {
                        setAppearanceSettings(prev => ({ ...prev, primaryColor: color }));
                        setFormChanged(true);
                      }}
                      className={`h-8 w-8 rounded-full ${
                        appearanceSettings.primaryColor === color
                          ? 'ring-2 ring-offset-2 ring-gray-400 dark:ring-gray-600'
                          : ''
                      }`}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  URL Logo
                </label>
                <input
                  type="text"
                  name="logoUrl"
                  value={appearanceSettings.logoUrl}
                  onChange={(e) => {
                    setAppearanceSettings(prev => ({
                      ...prev,
                      logoUrl: e.target.value
                    }));
                    setFormChanged(true);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-800 dark:text-white"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  URL Favicon
                </label>
                <input
                  type="text"
                  name="favicon"
                  value={appearanceSettings.favicon}
                  onChange={(e) => {
                    setAppearanceSettings(prev => ({
                      ...prev,
                      favicon: e.target.value
                    }));
                    setFormChanged(true);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-800 dark:text-white"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                CSS tùy chỉnh
              </label>
              <textarea
                name="customCss"
                value={appearanceSettings.customCss}
                onChange={(e) => {
                  setAppearanceSettings(prev => ({
                    ...prev,
                    customCss: e.target.value
                  }));
                  setFormChanged(true);
                }}
                rows={5}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-800 dark:text-white font-mono text-sm"
                placeholder=".custom-class { color: red; }"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                CSS tùy chỉnh sẽ được áp dụng cho toàn bộ ứng dụng. Sử dụng cẩn thận.
              </p>
            </div>
          </div>
        );
        
      case 'cache':
        return <CacheSettings />;
      
      default:
        return (
          <div className="py-12 text-center">
            <p className="text-gray-500 dark:text-gray-400">Vui lòng chọn một mục cài đặt từ menu bên trái</p>
          </div>
        );
    }
  };

  return (
    <Layout>
      <PageContainer>
        <PageHeader 
          title="Cài đặt hệ thống" 
          description="Quản lý cấu hình và tùy chỉnh hệ thống"
          actions={
            <div className="flex gap-3">
              <button 
                className={`px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg shadow-sm text-sm font-medium flex items-center gap-2 transition-colors ${saving ? 'opacity-70 cursor-not-allowed' : ''}`}
                onClick={handleSaveSettings}
                disabled={saving || !formChanged}
              >
                <Save className="w-4 h-4" />
                {saving ? 'Đang lưu...' : 'Lưu cài đặt'}
              </button>
            </div>
          }
        />
        
        {loading ? (
          <Card loading={true}>
            <div className="h-96"></div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Sidebar */}
            <div className="md:col-span-1">
              <Card>
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {settingsSections.map((section) => {
                    const Icon = section.icon;
                    
                    return (
                      <button
                        key={section.id}
                        onClick={() => handleSectionChange(section.id)}
                        className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors ${
                          activeSection === section.id
                            ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-200'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        <Icon className={`w-5 h-5 mt-0.5 ${
                          activeSection === section.id
                            ? 'text-primary-500 dark:text-primary-400'
                            : 'text-gray-400 dark:text-gray-500'
                        }`} />
                        <div>
                          <h3 className="font-medium">{section.title}</h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{section.description}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </Card>
            </div>
            
            {/* Content */}
            <div className="md:col-span-3">
              <Card>
                <div className="px-1 py-1">
                  {renderSectionContent()}
                </div>
              </Card>
            </div>
          </div>
        )}
      </PageContainer>
    </Layout>
  );
} 