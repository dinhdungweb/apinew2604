'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import PageContainer from '@/components/ui/PageContainer';
import { PageHeader, PageSection } from '@/components/ui/PageSection';
import Card from '@/components/Card';
import { 
  Key, Plus, Clipboard, Eye, EyeOff, 
  Check, RefreshCw, Trash2, AlertCircle, Copy
} from 'lucide-react';
import { toast } from 'react-toastify';

// Mock data API keys
const mockApiKeys = [
  {
    id: 'key_' + Math.random().toString(36).substring(2, 15),
    name: 'Production API Key',
    key: 'pk_' + Math.random().toString(36).substring(2, 34),
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    lastUsed: new Date(Date.now() - 12 * 60 * 60 * 1000),
    status: 'active',
    permissions: ['read', 'write', 'delete'],
    usageCount: 1423,
    ipRestrictions: []
  },
  {
    id: 'key_' + Math.random().toString(36).substring(2, 15),
    name: 'Staging API Key',
    key: 'pk_' + Math.random().toString(36).substring(2, 34),
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
    lastUsed: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    status: 'active',
    permissions: ['read', 'write'],
    usageCount: 387,
    ipRestrictions: ['192.168.1.1/24']
  },
  {
    id: 'key_' + Math.random().toString(36).substring(2, 15),
    name: 'Read-only API Key',
    key: 'pk_' + Math.random().toString(36).substring(2, 34),
    createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
    expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    lastUsed: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    status: 'active',
    permissions: ['read'],
    usageCount: 256,
    ipRestrictions: []
  },
  {
    id: 'key_' + Math.random().toString(36).substring(2, 15),
    name: 'Dev Testing Key',
    key: 'pk_' + Math.random().toString(36).substring(2, 34),
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    expiresAt: null,
    lastUsed: null,
    status: 'inactive',
    permissions: ['read', 'write', 'delete'],
    usageCount: 0,
    ipRestrictions: []
  }
];

// Format date
const formatDate = (date: Date | null) => {
  if (!date) return 'N/A';
  
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
};

export default function ApiKeysPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyData, setNewKeyData] = useState({
    name: '',
    expiryDays: 365,
    permissions: {
      read: true,
      write: true,
      delete: false
    },
    ipRestriction: ''
  });
  const [newKeyInfo, setNewKeyInfo] = useState<{id: string, key: string} | null>(null);
  
  // Load API keys
  useEffect(() => {
    const fetchApiKeys = async () => {
      setLoading(true);
      try {
        // Giả lập API call
        await new Promise(resolve => setTimeout(resolve, 600));
        setApiKeys(mockApiKeys);
      } catch (error) {
        console.error('Error fetching API keys:', error);
        toast.error('Không thể tải dữ liệu API keys');
      } finally {
        setLoading(false);
      }
    };

    fetchApiKeys();
  }, []);

  // Xử lý hiển thị key
  const toggleKeyVisibility = (id: string) => {
    setVisibleKeys(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };
  
  // Xử lý copy key
  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key)
      .then(() => {
        toast.success('Đã sao chép API key vào clipboard');
      })
      .catch((error) => {
        console.error('Error copying API key:', error);
        toast.error('Không thể sao chép API key');
      });
  };
  
  // Xử lý revoke key
  const handleRevokeKey = (id: string) => {
    if (window.confirm('Bạn có chắc chắn muốn thu hồi API key này không? Hành động này không thể hoàn tác.')) {
      setApiKeys(prev => prev.map(key => 
        key.id === id ? { ...key, status: 'revoked' } : key
      ));
      toast.success('Đã thu hồi API key');
    }
  };
  
  // Xử lý regenerate key
  const handleRegenerateKey = (id: string) => {
    if (window.confirm('Bạn có chắc chắn muốn tạo lại API key này không? Key cũ sẽ không còn hoạt động.')) {
      const newKey = 'pk_' + Math.random().toString(36).substring(2, 34);
      
      setApiKeys(prev => prev.map(key => 
        key.id === id ? { 
          ...key, 
          key: newKey,
          createdAt: new Date(),
          lastUsed: null,
          usageCount: 0
        } : key
      ));
      
      toast.success('Đã tạo lại API key');
      
      // Hiển thị key mới
      setVisibleKeys(prev => ({
        ...prev,
        [id]: true
      }));
      
      // Hiển thị modal với key mới
      const keyObj = apiKeys.find(k => k.id === id);
      if (keyObj) {
        setNewKeyInfo({
          id: keyObj.id,
          key: newKey
        });
      }
    }
  };
  
  // Xử lý create key
  const handleCreateKey = () => {
    // Validate input
    if (!newKeyData.name.trim()) {
      toast.error('Vui lòng nhập tên cho API key');
      return;
    }
    
    const newKey = {
      id: 'key_' + Math.random().toString(36).substring(2, 15),
      name: newKeyData.name,
      key: 'pk_' + Math.random().toString(36).substring(2, 34),
      createdAt: new Date(),
      expiresAt: newKeyData.expiryDays ? new Date(Date.now() + newKeyData.expiryDays * 24 * 60 * 60 * 1000) : null,
      lastUsed: null,
      status: 'active',
      permissions: Object.keys(newKeyData.permissions).filter(p => newKeyData.permissions[p as keyof typeof newKeyData.permissions]),
      usageCount: 0,
      ipRestrictions: newKeyData.ipRestriction ? [newKeyData.ipRestriction] : []
    };
    
    setApiKeys(prev => [...prev, newKey]);
    setNewKeyInfo({
      id: newKey.id,
      key: newKey.key
    });
    
    // Reset form
    setNewKeyData({
      name: '',
      expiryDays: 365,
      permissions: {
        read: true,
        write: true,
        delete: false
      },
      ipRestriction: ''
    });
  };
  
  // Reset new key info
  const resetNewKeyInfo = () => {
    setNewKeyInfo(null);
    setShowCreateModal(false);
  };

  return (
    <Layout>
      <PageContainer>
        <PageHeader 
          title="Quản lý API Keys" 
          description="Tạo và quản lý API keys để truy cập hệ thống"
          actions={
            <div className="flex gap-3">
              <button 
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg shadow-sm text-sm font-medium flex items-center gap-2 transition-colors"
                onClick={() => setShowCreateModal(true)}
              >
                <Plus className="w-4 h-4" />
                Tạo API Key
              </button>
            </div>
          }
        />
        
        {/* Cảnh báo bảo mật */}
        <div className="mb-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900/30 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-yellow-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Lưu ý bảo mật quan trọng</h3>
              <div className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
                <p>
                  API Keys cung cấp quyền truy cập vào dữ liệu của bạn. Hãy bảo vệ keys của bạn và chỉ chia sẻ chúng với các dịch vụ đáng tin cậy. 
                  API Keys chỉ được hiển thị một lần khi tạo. Hãy lưu lại cẩn thận.
                </p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Danh sách API keys */}
        <Card loading={loading}>
          {loading ? (
            <div className="animate-pulse">
              {[...Array(4)].map((_, index) => (
                <div key={index} className="border-b border-gray-200 dark:border-gray-700 last:border-0 p-6">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full flex-shrink-0"></div>
                    <div className="flex-1">
                      <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4"></div>
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-4"></div>
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : apiKeys.length > 0 ? (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {apiKeys.map((apiKey) => (
                <div key={apiKey.id} className="p-6">
                  <div className="flex items-start justify-between flex-wrap gap-4">
                    <div className="flex items-center">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                        apiKey.status === 'active' 
                          ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' 
                          : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        <Key className="h-5 w-5" />
                      </div>
                      <div className="ml-4">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                          {apiKey.name}
                        </h3>
                        <div className="flex items-center mt-1">
                          <div className={`h-2 w-2 rounded-full mr-2 ${
                            apiKey.status === 'active' 
                              ? 'bg-green-500' 
                              : 'bg-red-500'
                          }`}></div>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {apiKey.status === 'active' ? 'Đang hoạt động' : 'Đã thu hồi'}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleRegenerateKey(apiKey.id)}
                        className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded text-gray-700 dark:text-gray-300 text-sm flex items-center gap-1 transition-colors"
                        title="Tạo lại key"
                        disabled={apiKey.status !== 'active'}
                      >
                        <RefreshCw className="w-4 h-4" />
                        <span className="hidden sm:inline">Tạo lại</span>
                      </button>
                      
                      <button
                        onClick={() => handleRevokeKey(apiKey.id)}
                        className="px-3 py-1.5 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 rounded text-red-700 dark:text-red-300 text-sm flex items-center gap-1 transition-colors"
                        title="Thu hồi key"
                        disabled={apiKey.status !== 'active'}
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="hidden sm:inline">Thu hồi</span>
                      </button>
                    </div>
                  </div>
                  
                  <div className="mt-4 bg-gray-50 dark:bg-gray-800 rounded-lg p-3 relative">
                    <div className="flex items-center mb-2">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">API Key:</p>
                      <button
                        onClick={() => toggleKeyVisibility(apiKey.id)}
                        className="ml-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                        title={visibleKeys[apiKey.id] ? 'Ẩn key' : 'Hiện key'}
                      >
                        {visibleKeys[apiKey.id] ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <code className="bg-gray-100 dark:bg-gray-900 px-3 py-1 rounded text-sm font-mono flex-1 overflow-x-auto">
                        {visibleKeys[apiKey.id] ? apiKey.key : '•'.repeat(Math.min(apiKey.key.length, 40))}
                      </code>
                      
                      <button
                        onClick={() => handleCopyKey(apiKey.key)}
                        className="p-1.5 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded text-gray-700 dark:text-gray-300"
                        title="Sao chép"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">Ngày tạo:</p>
                      <p className="font-medium text-gray-900 dark:text-white">{formatDate(apiKey.createdAt)}</p>
                    </div>
                    
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">Hết hạn:</p>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {apiKey.expiresAt ? formatDate(apiKey.expiresAt) : 'Không bao giờ'}
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">Sử dụng lần cuối:</p>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {apiKey.lastUsed ? formatDate(apiKey.lastUsed) : 'Chưa sử dụng'}
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">Lượt gọi:</p>
                      <p className="font-medium text-gray-900 dark:text-white">{apiKey.usageCount.toLocaleString()}</p>
                    </div>
                  </div>
                  
                  <div className="mt-4 flex flex-wrap gap-2">
                    <div className="text-gray-500 dark:text-gray-400">Quyền:</div>
                    {apiKey.permissions.includes('read') && (
                      <span className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full">
                        Đọc
                      </span>
                    )}
                    {apiKey.permissions.includes('write') && (
                      <span className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-full">
                        Ghi
                      </span>
                    )}
                    {apiKey.permissions.includes('delete') && (
                      <span className="px-2 py-1 text-xs bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded-full">
                        Xóa
                      </span>
                    )}
                  </div>
                  
                  {apiKey.ipRestrictions && apiKey.ipRestrictions.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <div className="text-gray-500 dark:text-gray-400">IP hạn chế:</div>
                      {apiKey.ipRestrictions.map((ip: string, index: number) => (
                        <span key={index} className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 rounded-full">
                          {ip}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center">
              <Key className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-700" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">Chưa có API Key nào</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">Tạo API key đầu tiên của bạn để bắt đầu tích hợp</p>
              <button 
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium inline-flex items-center gap-2 transition-colors"
                onClick={() => setShowCreateModal(true)}
              >
                <Plus className="w-4 h-4" />
                Tạo API Key
              </button>
            </div>
          )}
        </Card>
        
        {/* Thông tin cách sử dụng */}
        <PageSection title="Cách sử dụng API Keys" className="mt-8">
          <Card>
            <div className="p-6 space-y-4">
              <p className="text-gray-700 dark:text-gray-300">
                API Keys được sử dụng để xác thực các yêu cầu đến API của chúng tôi. Bạn cần gửi API Key trong header của mỗi request.
              </p>
              
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Ví dụ sử dụng API Key với cURL:</p>
                <pre className="bg-gray-100 dark:bg-gray-900 p-3 rounded-md text-sm font-mono overflow-x-auto">
                  {`curl -X GET "https://api.example.com/v1/products" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json"`}
                </pre>
                
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mt-4 mb-2">Ví dụ sử dụng API Key với JavaScript:</p>
                <pre className="bg-gray-100 dark:bg-gray-900 p-3 rounded-md text-sm font-mono overflow-x-auto">
                  {`fetch('https://api.example.com/v1/products', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  }
})
.then(response => response.json())
.then(data => console.log(data));`}
                </pre>
              </div>
              
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                Để biết thêm chi tiết, vui lòng tham khảo <a href="#" className="text-primary-600 dark:text-primary-400 hover:underline">Tài liệu API</a> của chúng tôi.
              </p>
            </div>
          </Card>
        </PageSection>
      </PageContainer>
      
      {/* Modal tạo API Key mới */}
      {showCreateModal && !newKeyInfo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Tạo API Key mới</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tên API Key
                </label>
                <input
                  type="text"
                  value={newKeyData.name}
                  onChange={(e) => setNewKeyData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="VD: Production API Key"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Đặt tên dễ nhớ để xác định mục đích sử dụng của key.
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Thời hạn
                </label>
                <select
                  value={newKeyData.expiryDays}
                  onChange={(e) => setNewKeyData(prev => ({ ...prev, expiryDays: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="30">30 ngày</option>
                  <option value="90">90 ngày</option>
                  <option value="180">180 ngày</option>
                  <option value="365">1 năm</option>
                  <option value="0">Không hết hạn</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Quyền
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={newKeyData.permissions.read}
                      onChange={(e) => setNewKeyData(prev => ({ 
                        ...prev, 
                        permissions: { ...prev.permissions, read: e.target.checked } 
                      }))}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Đọc (GET requests)</span>
                  </label>
                  
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={newKeyData.permissions.write}
                      onChange={(e) => setNewKeyData(prev => ({ 
                        ...prev, 
                        permissions: { ...prev.permissions, write: e.target.checked } 
                      }))}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Ghi (POST, PUT, PATCH requests)</span>
                  </label>
                  
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={newKeyData.permissions.delete}
                      onChange={(e) => setNewKeyData(prev => ({ 
                        ...prev, 
                        permissions: { ...prev.permissions, delete: e.target.checked } 
                      }))}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Xóa (DELETE requests)</span>
                  </label>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Giới hạn IP (tùy chọn)
                </label>
                <input
                  type="text"
                  value={newKeyData.ipRestriction}
                  onChange={(e) => setNewKeyData(prev => ({ ...prev, ipRestriction: e.target.value }))}
                  placeholder="VD: 192.168.1.1/24"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Để trống nếu không muốn giới hạn IP.
                </p>
              </div>
            </div>
            
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Hủy
              </button>
              
              <button
                type="button"
                onClick={handleCreateKey}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                Tạo API Key
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal hiển thị API Key mới tạo */}
      {newKeyInfo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-center text-green-500 mb-4">
              <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Check className="h-6 w-6" />
              </div>
            </div>
            
            <h2 className="text-xl font-bold text-gray-900 dark:text-white text-center mb-2">API Key đã được tạo!</h2>
            <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
              API Key sẽ chỉ hiển thị một lần. Vui lòng sao chép và lưu trữ an toàn.
            </p>
            
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">API Key:</p>
                <button
                  onClick={() => handleCopyKey(newKeyInfo.key)}
                  className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 text-sm flex items-center gap-1"
                >
                  <Clipboard className="w-4 h-4" />
                  Sao chép
                </button>
              </div>
              
              <pre className="bg-gray-100 dark:bg-gray-900 p-3 rounded-md text-sm font-mono break-all">
                {newKeyInfo.key}
              </pre>
            </div>
            
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={resetNewKeyInfo}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                Đã sao chép, quay lại
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
} 