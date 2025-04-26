import React from 'react';
import Image from 'next/image';
import { toast } from 'react-toastify';
import { 
  Package, CheckCircle, AlertCircle, Search, 
  RefreshCw, EyeIcon, Clock, Loader, DollarSign
} from 'lucide-react';

// Định nghĩa kiểu dữ liệu
interface ShopifyProduct {
  id: string;
  product_id: string;
  name: string;
  sku: string;
  price: number;
  inventory?: number;
  inventory_item_id?: string;
  image?: string | null;
}

interface NhanhProduct {
  idNhanh: string;
  name: string;
  code: string;
  inventory?: number;
}

interface ProductCardProps {
  product: ShopifyProduct;
  mappedProduct?: NhanhProduct;
  syncStatus?: string;
  searchQuery: string;
  isLoading: boolean;
  isSearching: boolean;
  onInputChange: (id: string, value: string) => void;
  onSearch: (id: string) => void;
  onSyncInventory: (id: string) => void;
  onSyncPrice: (id: string) => void;
  onViewDetails: (nhanhId: string) => void;
  onSearchFocus: (id: string) => void;
  onSearchBlur: (id: string) => void;
}

const ProductCard: React.FC<ProductCardProps> = ({
  product,
  mappedProduct,
  syncStatus,
  searchQuery,
  isLoading,
  isSearching,
  onInputChange,
  onSearch,
  onSyncInventory,
  onSyncPrice,
  onViewDetails,
  onSearchFocus,
  onSearchBlur
}) => {
  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200 hover:shadow-md transition-shadow duration-200 flex flex-col h-full">
      <div className="relative pt-[75%] bg-gray-50">
        {product.image ? (
          <Image 
            src={product.image} 
            alt={product.name}
            fill
            className="object-contain p-4"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Package size={42} className="text-gray-300" />
          </div>
        )}
        
        {/* Status badge */}
        <div className="absolute top-3 right-3">
          {syncStatus === 'success' && (
            <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium flex items-center">
              <CheckCircle size={12} className="mr-1" />
              Đã đồng bộ
            </span>
          )}
          {syncStatus === 'error' && (
            <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium flex items-center">
              <AlertCircle size={12} className="mr-1" />
              Lỗi
            </span>
          )}
          {(!syncStatus || syncStatus === 'pending') && (
            <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium flex items-center">
              <Clock size={12} className="mr-1" />
              Chưa đồng bộ
            </span>
          )}
        </div>
      </div>
      
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          <h3 className="font-medium text-gray-900 line-clamp-2 mb-1">{product.name}</h3>
          <div className="text-sm text-gray-500 mb-3 flex flex-wrap gap-1.5">
            <span className="inline-flex items-center px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
              <span className="font-medium">SKU:</span>&nbsp;{product.sku || 'N/A'}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
              <span className="font-medium">Tồn:</span>&nbsp;{product.inventory !== undefined ? product.inventory : 'N/A'}
            </span>
          </div>
        </div>
        
        {mappedProduct ? (
          <div className="bg-gray-50 p-3 rounded-lg mb-3 border border-gray-200">
            <div className="text-xs font-medium text-gray-700 mb-1">Đã mapping với:</div>
            <div className="text-sm font-medium line-clamp-1">{mappedProduct.name}</div>
            <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-1.5">
              <span className="inline-flex items-center px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                ID: {mappedProduct.idNhanh}
              </span>
              {mappedProduct.code && (
                <span className="inline-flex items-center px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                  Mã: {mappedProduct.code}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="relative mb-3">
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              value={searchQuery}
              onChange={(e) => onInputChange(product.id, e.target.value)}
              onFocus={() => onSearchFocus(product.id)}
              onBlur={() => onSearchBlur(product.id)}
              placeholder="Tìm sản phẩm Nhanh.vn..."
            />
          </div>
        )}
        
        <div className="flex mt-auto space-x-2">
          {mappedProduct ? (
            <>
              <button
                onClick={() => onSyncInventory(product.id)}
                disabled={isLoading}
                className="flex-1 bg-gray-100 text-gray-700 hover:bg-gray-200 py-2 rounded transition-colors duration-200 text-sm flex items-center justify-center"
              >
                {isLoading ? (
                  <Loader size={14} className="animate-spin mr-1.5" />
                ) : (
                  <RefreshCw size={14} className="mr-1.5" />
                )}
                Đồng bộ
              </button>
              <button
                onClick={() => onSyncPrice(product.id)}
                disabled={isLoading}
                className="flex-1 bg-gray-100 text-gray-700 hover:bg-gray-200 py-2 rounded transition-colors duration-200 text-sm flex items-center justify-center"
              >
                {isLoading ? (
                  <Loader size={14} className="animate-spin mr-1.5" />
                ) : (
                  <DollarSign size={14} className="mr-1.5" />
                )}
                Đồng bộ giá
              </button>
              <button
                onClick={() => onViewDetails(mappedProduct.idNhanh)}
                className="flex-1 bg-gray-100 text-gray-700 hover:bg-gray-200 py-2 rounded transition-colors duration-200 text-sm flex items-center justify-center"
              >
                <EyeIcon size={14} className="mr-1.5" />
                Chi tiết
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                if (searchQuery && searchQuery.length >= 2) {
                  onSearch(product.id);
                } else {
                  toast.info('Nhập tên sản phẩm để tìm kiếm');
                }
              }}
              className="w-full bg-gray-100 text-gray-700 hover:bg-gray-200 py-2 rounded transition-colors duration-200 text-sm flex items-center justify-center"
            >
              {isSearching ? (
                <Loader size={14} className="animate-spin" />
              ) : (
                <Search size={14} />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductCard; 