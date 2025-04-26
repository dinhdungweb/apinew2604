import Cookies from 'js-cookie';

/**
 * Lấy token xác thực từ cookie hoặc localStorage
 */
const getAuthToken = () => {
  // Ưu tiên lấy từ Cookies trước
  const tokenFromCookie = Cookies.get('token');
  if (tokenFromCookie) {
    return tokenFromCookie;
  }
  
  // Nếu không có trong Cookies, thử lấy từ localStorage
  if (typeof window !== 'undefined') {
    const tokenFromStorage = localStorage.getItem('token');
    if (tokenFromStorage) {
      // Đồng bộ lại vào cookies để các request sau dùng được
      Cookies.set('token', tokenFromStorage, { expires: 1 }); 
      return tokenFromStorage;
    }
  }
  
  return null;
};

/**
 * API client cho Dashboard
 */
export const fetchDashboardStats = async (period: string = '7days') => {
  try {
    const token = getAuthToken();
    if (!token) {
      throw new Error('Không có token xác thực');
    }

    console.log('Fetch dashboard với token:', token.substring(0, 15) + '...');

    const response = await fetch(`/api/dashboard?period=${period}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Lỗi khi lấy dữ liệu dashboard');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    throw error;
  }
};

/**
 * API để kiểm tra Sync Logs
 */
export const checkSyncLogs = async () => {
  try {
    const token = getAuthToken();
    if (!token) {
      throw new Error('Không có token xác thực');
    }
    
    const response = await fetch('/api/sync/check-logs', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Lỗi khi kiểm tra Sync Logs');
    }

    return await response.json();
  } catch (error) {
    console.error('Error checking sync logs:', error);
    throw error;
  }
};

/**
 * API để thực hiện đồng bộ thủ công
 */
export const manualSync = async (productId?: number) => {
  try {
    const token = getAuthToken();
    if (!token) {
      throw new Error('Không có token xác thực');
    }

    // Debug: ghi nhận request
    console.log('Gửi yêu cầu đồng bộ với token:', token.substring(0, 10) + '...');
    
    const response = await fetch('/api/sync/manual', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ productId })
    });

    // Debug: ghi nhận response
    console.log('Nhận phản hồi từ API đồng bộ:', response.status);
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Lỗi API đồng bộ:', errorData);
      throw new Error(errorData.message || 'Lỗi khi thực hiện đồng bộ');
    }

    const data = await response.json();
    console.log('Kết quả đồng bộ:', data);
    return data;
  } catch (error) {
    console.error('Error running manual sync:', error);
    throw error;
  }
};

/**
 * API để xóa lịch sử đồng bộ
 */
export const clearSyncHistory = async () => {
  try {
    const token = getAuthToken();
    if (!token) {
      throw new Error('Không có token xác thực');
    }
    
    const response = await fetch('/api/sync/history/clear', {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Lỗi khi xóa lịch sử đồng bộ');
    }

    return await response.json();
  } catch (error) {
    console.error('Error clearing sync history:', error);
    throw error;
  }
};

/**
 * API client cho Users
 */
export const fetchUsers = async (search?: string, role?: string) => {
  try {
    const token = getAuthToken();
    if (!token) {
      throw new Error('Không có token xác thực');
    }

    let url = '/api/users';
    if (search || role) {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (role) params.append('role', role);
      url += `?${params.toString()}`;
    }

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Lỗi khi lấy danh sách người dùng');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching users:', error);
    throw error;
  }
};

export const createUser = async (userData: {
  username: string;
  password: string;
  email?: string;
  role?: string;
}) => {
  try {
    const token = getAuthToken();
    if (!token) {
      throw new Error('Không có token xác thực');
    }

    const response = await fetch('/api/users', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(userData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Lỗi khi tạo người dùng');
    }

    return await response.json();
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
};

export const updateUser = async (userData: {
  id: number;
  email?: string;
  role?: string;
  status?: string;
  password?: string;
}) => {
  try {
    const token = getAuthToken();
    if (!token) {
      throw new Error('Không có token xác thực');
    }

    const response = await fetch('/api/users', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(userData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Lỗi khi cập nhật người dùng');
    }

    return await response.json();
  } catch (error) {
    console.error('Error updating user:', error);
    throw error;
  }
};

export const deleteUser = async (id: number) => {
  try {
    const token = getAuthToken();
    if (!token) {
      throw new Error('Không có token xác thực');
    }

    const response = await fetch(`/api/users?id=${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Lỗi khi xóa người dùng');
    }

    return await response.json();
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
};

/**
 * API client cho Settings
 */
export const fetchSettings = async (group?: string) => {
  try {
    const token = getAuthToken();
    if (!token) {
      throw new Error('Không có token xác thực');
    }

    let url = '/api/settings';
    if (group) {
      url += `?group=${group}`;
    }

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Lỗi khi lấy cài đặt');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching settings:', error);
    throw error;
  }
};

export const updateSetting = async (settingData: {
  key: string;
  value: string;
  description?: string;
  group?: string;
}) => {
  try {
    const token = getAuthToken();
    if (!token) {
      throw new Error('Không có token xác thực');
    }

    const response = await fetch('/api/settings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(settingData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Lỗi khi cập nhật cài đặt');
    }

    return await response.json();
  } catch (error) {
    console.error('Error updating setting:', error);
    throw error;
  }
};

export const deleteSetting = async (key: string) => {
  try {
    const token = getAuthToken();
    if (!token) {
      throw new Error('Không có token xác thực');
    }

    const response = await fetch(`/api/settings?key=${key}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Lỗi khi xóa cài đặt');
    }

    return await response.json();
  } catch (error) {
    console.error('Error deleting setting:', error);
    throw error;
  }
};

export async function initializeDefaultSettings() {
  const defaultSettings = [
    { key: 'shopify_access_token', value: '', description: 'API key cho Shopify', group: 'api' },
    { key: 'shopify_store', value: '', description: 'Tên store Shopify', group: 'api' },
    { key: 'shopify_location_id', value: '', description: 'ID location mặc định cho Shopify API', group: 'api' },
    { key: 'nhanh_api_key', value: '', description: 'API key cho Nhanh.vn', group: 'api' },
    { key: 'nhanh_business_id', value: '', description: 'Business ID của Nhanh.vn', group: 'api' },
    { key: 'nhanh_app_id', value: '', description: 'App ID của Nhanh.vn', group: 'api' },
    { key: 'sync_interval', value: '30', description: 'Khoảng thời gian đồng bộ tự động (phút)', group: 'system' },
    { key: 'sync_auto', value: 'false', description: 'Bật/tắt đồng bộ tự động', group: 'system' }
  ];

  try {
    const token = getAuthToken();
    if (!token) {
      throw new Error('Không có token xác thực');
    }

    const response = await fetch('/api/settings', {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        createOnly: true
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Lỗi khi khởi tạo cài đặt mặc định');
    }

    return await response.json();
  } catch (error) {
    console.error('Error initializing default settings:', error);
    throw error;
  }
} 