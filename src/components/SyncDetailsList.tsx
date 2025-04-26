import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { Package, AlertCircle, CheckCircle, Clock, Trash, RefreshCw } from 'lucide-react';

// Interface cho dữ liệu sản phẩm được đồng bộ
interface SyncProductDetail {
  productId: number;
  shopifyId: string;
  productName: string;
  inventoryBefore?: number;
  inventoryAfter?: number;
  priceBefore?: string;
  priceAfter?: string;
  syncTime: string;
  status: 'success' | 'error' | 'pending' | 'skipped';
  error?: string;
}

interface SyncDetailsListProps {
  syncId: number;
  token: string;
  onClose?: () => void;
}

const SyncDetailsList: React.FC<SyncDetailsListProps> = ({ syncId, token, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState<SyncProductDetail[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    success: 0,
    error: 0,
    skipped: 0
  });
  const [syncInfo, setSyncInfo] = useState<any>(null);
  
  // Tải dữ liệu chi tiết đồng bộ
  const loadSyncDetails = async () => {
    if (!token || !syncId) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/sync-logs/${syncId}/details`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setDetails(data.details || []);
        setStats(data.stats || { total: 0, success: 0, error: 0, skipped: 0 });
        setSyncInfo(data.syncInfo || null);
      } else {
        toast.error('Không thể tải dữ liệu chi tiết đồng bộ');
      }
    } catch (error) {
      console.error('Lỗi khi tải chi tiết đồng bộ:', error);
      toast.error('Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };
  
  // Tải dữ liệu khi component được mount
  useEffect(() => {
    loadSyncDetails();
  }, [syncId, token]);
  
  // Xử lý thử lại đồng bộ cho sản phẩm lỗi
  const handleRetrySync = async (productId: number) => {
    if (!token) return;
    
    try {
      const response = await fetch('/api/sync/manual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ productId })
      });
      
      if (response.ok) {
        toast.success('Đã thử lại đồng bộ sản phẩm');
        // Tải lại chi tiết sau 2 giây để thấy kết quả
        setTimeout(() => loadSyncDetails(), 2000);
      } else {
        const error = await response.json();
        toast.error(`Không thể thử lại: ${error.message}`);
      }
    } catch (error) {
      console.error('Lỗi khi thử lại đồng bộ:', error);
      toast.error('Lỗi kết nối máy chủ');
    }
  };
  
  // Hiển thị trạng thái
  const renderStatus = (status: string) => {
    switch (status) {
      case 'success':
        return (
          <div className="flex items-center text-green-600">
            <CheckCircle className="w-4 h-4 mr-1" />
            <span>Thành công</span>
          </div>
        );
      case 'error':
        return (
          <div className="flex items-center text-red-600">
            <AlertCircle className="w-4 h-4 mr-1" />
            <span>Lỗi</span>
          </div>
        );
      case 'pending':
        return (
          <div className="flex items-center text-blue-600">
            <Clock className="w-4 h-4 mr-1" />
            <span>Đang chờ</span>
          </div>
        );
      case 'skipped':
        return (
          <div className="flex items-center text-gray-600">
            <Trash className="w-4 h-4 mr-1" />
            <span>Đã bỏ qua</span>
          </div>
        );
      default:
        return <span>{status}</span>;
    }
  };
  
  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-semibold">Chi tiết đồng bộ #{syncId}</h2>
        <div className="flex gap-2">
          <button
            className="p-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg"
            onClick={loadSyncDetails}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          {onClose && (
            <button
              className="p-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg"
              onClick={onClose}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
      
      {/* Thông tin tổng quan */}
      {syncInfo && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-gray-500 text-xs uppercase">Loại đồng bộ</div>
            <div className="font-medium">{syncInfo.syncType || 'Không xác định'}</div>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-gray-500 text-xs uppercase">Thời gian</div>
            <div className="font-medium">{syncInfo.syncTime ? new Date(syncInfo.syncTime).toLocaleString() : 'Không xác định'}</div>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-gray-500 text-xs uppercase">Người thực hiện</div>
            <div className="font-medium">{syncInfo.createdBy || 'Hệ thống'}</div>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-gray-500 text-xs uppercase">Trạng thái</div>
            <div className="font-medium">{syncInfo.status || 'Không xác định'}</div>
          </div>
        </div>
      )}
      
      {/* Thống kê */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="bg-blue-50 p-3 rounded-lg">
          <div className="text-xl font-semibold text-blue-700">{stats.total}</div>
          <div className="text-sm text-blue-600">Tổng số</div>
        </div>
        <div className="bg-green-50 p-3 rounded-lg">
          <div className="text-xl font-semibold text-green-700">{stats.success}</div>
          <div className="text-sm text-green-600">Thành công</div>
        </div>
        <div className="bg-red-50 p-3 rounded-lg">
          <div className="text-xl font-semibold text-red-700">{stats.error}</div>
          <div className="text-sm text-red-600">Lỗi</div>
        </div>
        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="text-xl font-semibold text-gray-700">{stats.skipped}</div>
          <div className="text-sm text-gray-600">Bỏ qua</div>
        </div>
      </div>
      
      {/* Danh sách chi tiết */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-500">Đang tải dữ liệu...</p>
        </div>
      ) : details.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Không có dữ liệu chi tiết</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sản phẩm
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tồn kho
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Giá
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Thời gian
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Trạng thái
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {details.map((item) => (
                <tr key={item.productId} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="ml-2">
                        <div className="text-sm font-medium text-gray-900">{item.productName}</div>
                        <div className="text-xs text-gray-500">ID: {item.shopifyId}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {(item.inventoryBefore !== undefined && item.inventoryAfter !== undefined) ? (
                      <div className="text-sm">
                        <span className="line-through text-gray-500 mr-2">{item.inventoryBefore}</span>
                        <span className="text-green-600 font-medium">→ {item.inventoryAfter}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-500">N/A</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {(item.priceBefore && item.priceAfter) ? (
                      <div className="text-sm">
                        <span className="line-through text-gray-500 mr-2">{item.priceBefore}</span>
                        <span className="text-green-600 font-medium">→ {item.priceAfter}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-500">N/A</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {new Date(item.syncTime).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {renderStatus(item.status)}
                    {item.error && (
                      <div className="text-xs text-red-500 mt-1 max-w-xs truncate" title={item.error}>
                        {item.error}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                    {item.status === 'error' && (
                      <button
                        className="text-blue-600 hover:text-blue-900"
                        onClick={() => handleRetrySync(item.productId)}
                      >
                        Thử lại
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default SyncDetailsList; 