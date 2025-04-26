import React from 'react';
import Image from 'next/image';
import { toast } from 'react-toastify';
import { 
  Package, AlertCircle, Search, RefreshCw, 
  Loader, EyeIcon, Clock, CheckCircle, DollarSign, Trash2
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
  variants?: {
    title: string;
    inventory_quantity?: number;
  }[];
}

interface NhanhProduct {
  idNhanh: string;
  name: string;
  code: string;
  inventory?: number;
}

interface ProductRowProps {
  product: ShopifyProduct;
  mappedProduct?: NhanhProduct;
  syncStatus?: string;
  syncError?: string;
  searchQuery: string;
  isLoading: boolean;
  isSearching: boolean;
  onInputChange: (id: string, value: string) => void;
  onSearch: (id: string) => void;
  onSyncInventory: (id: string) => void;
  onSyncPrice: (id: string) => void;
  onUnmapProduct: (id: string) => void;
  onViewDetails: (nhanhId: string) => void;
  onSearchFocus: (id: string) => void;
  onSearchBlur: (id: string) => void;
  showSearchResults: boolean;
  searchResults: NhanhProduct[];
  onSelectProduct: (shopifyId: string, nhanhProduct: NhanhProduct) => void;
  searchContainerRef: React.RefObject<HTMLDivElement>;
}

const ProductRow: React.FC<ProductRowProps> = ({
  product,
  mappedProduct,
  syncStatus,
  syncError,
  searchQuery,
  isLoading,
  isSearching,
  onInputChange,
  onSearch,
  onSyncInventory,
  onSyncPrice,
  onUnmapProduct,
  onViewDetails,
  onSearchFocus,
  onSearchBlur,
  showSearchResults,
  searchResults,
  onSelectProduct,
  searchContainerRef
}) => {
  return (
    <tr className="border-b dark:border-gray-700">
      {/* Ảnh và tên sản phẩm */}
      <td className="p-3 md:p-4">
        <div className="flex items-center space-x-3">
          <div className="relative w-12 h-12 flex-shrink-0 bg-gray-100 dark:bg-gray-800 rounded-md overflow-hidden">
            {product.image ? (
              <Image 
                src={product.image} 
                alt={product.name}
                fill
                className="object-contain p-1"
              />
            ) : (
              <div className="flex items-center justify-center h-full w-full">
                <Package className="text-gray-400 w-6 h-6" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">{product.name}</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              SKU: {product.sku || 'N/A'}
            </p>
          </div>
        </div>
      </td>
      
      {/* Thông tin tồn kho */}
      <td className="p-3 md:p-4 text-sm">
        <span className="font-medium">
          {product.inventory !== undefined ? product.inventory : 'N/A'}
        </span>
      </td>
      
      {/* Trạng thái đồng bộ */}
      <td className="p-3 md:p-4">
        {syncStatus === 'success' && (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            Đã đồng bộ
          </span>
        )}
        {syncStatus === 'error' && (
          <div>
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 mb-1">
              <AlertCircle className="w-3 h-3 mr-1" />
              Lỗi
            </span>
            {syncError && (
              <p className="text-xs text-red-600 max-w-xs truncate" title={syncError}>{syncError}</p>
            )}
          </div>
        )}
        {syncStatus === 'pending' && (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <Clock className="w-3 h-3 mr-1" />
            Chờ đồng bộ
          </span>
        )}
        {!syncStatus && (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            <Clock className="w-3 h-3 mr-1" />
            Chưa đồng bộ
          </span>
        )}
      </td>
      
      {/* Sản phẩm Nhanh.vn đã mapping */}
      <td className="p-3 md:p-4">
        {mappedProduct ? (
          <div className="flex flex-col">
            <span className="text-sm font-medium mb-1">{mappedProduct.name}</span>
            <div className="flex flex-wrap gap-1">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-800">
                ID: {mappedProduct.idNhanh}
              </span>
              {mappedProduct.code && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-800">
                  Mã: {mappedProduct.code}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="relative" ref={searchContainerRef}>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Tìm sản phẩm..."
                className="text-sm border border-gray-300 dark:border-gray-600 rounded p-2 w-full"
                value={searchQuery}
                onChange={(e) => onInputChange(product.id, e.target.value)}
                onFocus={() => onSearchFocus(product.id)}
                onBlur={() => onSearchBlur(product.id)}
              />
              <button
                onClick={() => onSearch(product.id)}
                className="p-2 bg-gray-100 dark:bg-gray-700 rounded"
                disabled={isSearching}
                title="Tìm kiếm"
              >
                {isSearching ? (
                  <Loader className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
              </button>
            </div>
            
            {/* Kết quả tìm kiếm */}
            {showSearchResults && searchResults.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 max-h-60 overflow-auto">
                {searchResults.map((item) => (
                  <div
                    key={item.idNhanh}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer text-sm"
                    onClick={() => onSelectProduct(product.id, item)}
                  >
                    <div className="font-medium">{item.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 flex gap-2 mt-1">
                      <span>ID: {item.idNhanh}</span>
                      {item.code && <span>Mã: {item.code}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </td>
      
      {/* Hành động */}
      <td className="p-3 md:p-4">
        <div className="flex items-center space-x-2">
          {mappedProduct ? (
            <>
              <button
                onClick={() => onSyncInventory(product.id)}
                className="p-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors duration-200"
                disabled={isLoading}
                title="Đồng bộ tồn kho"
              >
                {isLoading ? (
                  <Loader className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
              </button>
              
              <button
                onClick={() => onSyncPrice(product.id)}
                className="p-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors duration-200"
                disabled={isLoading}
                title="Đồng bộ giá"
              >
                <DollarSign className="w-4 h-4" />
              </button>
              
              <button
                onClick={() => onViewDetails(mappedProduct.idNhanh)}
                className="p-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors duration-200"
                title="Xem chi tiết"
              >
                <EyeIcon className="w-4 h-4" />
              </button>
              
              <button
                onClick={() => onUnmapProduct(product.id)}
                className="p-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors duration-200"
                title="Bỏ mapping"
              >
                <Trash2 className="w-4 h-4" />
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
              className="p-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors duration-200"
              title="Tìm kiếm"
            >
              <Search className="w-4 h-4" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
};

export default ProductRow; 