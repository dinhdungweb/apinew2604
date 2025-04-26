'use client';

import { useState } from 'react';
import { toast } from 'react-toastify';

interface SyncBatchFormProps {
  onSuccess?: (data: any) => void;
  defaultBatchSize?: number;
}

export default function SyncBatchForm({ onSuccess, defaultBatchSize = 20 }: SyncBatchFormProps) {
  const [loading, setLoading] = useState(false);
  const [syncType, setSyncType] = useState<'inventory' | 'price' | 'all'>('inventory');
  const [batchSize, setBatchSize] = useState(defaultBatchSize);
  const [productIds, setProductIds] = useState<string>('');
  const [selectedOption, setSelectedOption] = useState<'all' | 'selected'>('all');

  // Xử lý đồng bộ
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (loading) return;
    
    try {
      setLoading(true);
      toast.info('Đang bắt đầu đồng bộ...');
      
      // Chuẩn bị danh sách sản phẩm để đồng bộ
      let parsedProductIds: number[] = [];
      
      if (selectedOption === 'selected' && productIds.trim()) {
        // Xử lý chuỗi ID nhập vào
        parsedProductIds = productIds
          .split(',')
          .map(id => id.trim())
          .filter(id => id) // Loại bỏ chuỗi rỗng
          .map(id => parseInt(id, 10))
          .filter(id => !isNaN(id)); // Loại bỏ giá trị không phải số
      }
      
      // Lấy token xác thực
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Không có token xác thực, vui lòng đăng nhập lại');
      }
      
      // Gọi API để bắt đầu đồng bộ
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          syncType,
          batchSize,
          productIds: selectedOption === 'selected' ? parsedProductIds : []
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Không thể bắt đầu đồng bộ');
      }
      
      const data = await response.json();
      
      toast.success(`Đã bắt đầu đồng bộ ${syncType}. ID log: ${data.syncLogId}`);
      
      if (onSuccess) {
        onSuccess(data);
      }
    } catch (error: any) {
      console.error('Error starting sync:', error);
      toast.error(error.message || 'Lỗi khi bắt đầu đồng bộ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
      <h3 className="text-lg font-medium mb-4">Đồng bộ sản phẩm hàng loạt</h3>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-3">
          <label className="block text-sm font-medium">
            Loại đồng bộ:
          </label>
          <div className="flex flex-wrap gap-4">
            <label className="inline-flex items-center">
              <input
                type="radio"
                className="rounded text-blue-600 focus:ring-blue-500"
                checked={syncType === 'inventory'}
                onChange={() => setSyncType('inventory')}
              />
              <span className="ml-2">Tồn kho</span>
            </label>
            <label className="inline-flex items-center">
              <input
                type="radio"
                className="rounded text-blue-600 focus:ring-blue-500"
                checked={syncType === 'price'}
                onChange={() => setSyncType('price')}
              />
              <span className="ml-2">Giá</span>
            </label>
            <label className="inline-flex items-center">
              <input
                type="radio"
                className="rounded text-blue-600 focus:ring-blue-500"
                checked={syncType === 'all'}
                onChange={() => setSyncType('all')}
              />
              <span className="ml-2">Tất cả</span>
            </label>
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-2">
            Kích thước batch (số sản phẩm mỗi lô):
          </label>
          <input
            type="number"
            min="1"
            max="100"
            value={batchSize}
            onChange={(e) => setBatchSize(parseInt(e.target.value) || defaultBatchSize)}
            className="w-full px-3 py-2 border dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700"
          />
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Giá trị hợp lý từ 10-50. Giá trị càng lớn càng nhanh nhưng có thể gây lỗi API.
          </p>
        </div>
        
        <div className="space-y-3">
          <label className="block text-sm font-medium">
            Sản phẩm cần đồng bộ:
          </label>
          <div className="space-y-2">
            <label className="inline-flex items-center">
              <input
                type="radio"
                className="rounded text-blue-600 focus:ring-blue-500"
                checked={selectedOption === 'all'}
                onChange={() => setSelectedOption('all')}
              />
              <span className="ml-2">Tất cả sản phẩm</span>
            </label>
            <label className="inline-flex items-center">
              <input
                type="radio"
                className="rounded text-blue-600 focus:ring-blue-500"
                checked={selectedOption === 'selected'}
                onChange={() => setSelectedOption('selected')}
              />
              <span className="ml-2">Chọn theo ID</span>
            </label>
          </div>
          
          {selectedOption === 'selected' && (
            <div className="mt-3">
              <label className="block text-sm font-medium mb-2">
                ID sản phẩm (phân cách bằng dấu phẩy):
              </label>
              <textarea
                value={productIds}
                onChange={(e) => setProductIds(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700"
                placeholder="1, 2, 3, 4, 5"
              />
            </div>
          )}
        </div>
        
        <div className="pt-4">
          <button
            type="submit"
            disabled={loading}
            className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Đang xử lý...
              </>
            ) : (
              'Bắt đầu đồng bộ'
            )}
          </button>
        </div>
      </form>
    </div>
  );
} 