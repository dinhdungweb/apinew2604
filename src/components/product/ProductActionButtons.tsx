import React from 'react';
import { Loader, RefreshCw, EyeIcon, Trash2, DollarSign, Search } from 'lucide-react';
import { toast } from 'react-toastify';

interface ProductActionButtonsProps {
  productId: string;
  isLoading: boolean;
  isSearching: boolean;
  isMapped: boolean;
  searchQuery: string;
  nhanhId?: string;
  onSyncInventory: (id: string) => void;
  onSyncPrice: (id: string) => void;
  onUnmapProduct: (id: string) => void;
  onViewDetails: (nhanhId: string) => void;
  onSearch: (id: string) => void;
  className?: string;
  compact?: boolean;
}

const ProductActionButtons: React.FC<ProductActionButtonsProps> = ({
  productId,
  isLoading,
  isSearching,
  isMapped,
  searchQuery,
  nhanhId,
  onSyncInventory,
  onSyncPrice,
  onUnmapProduct,
  onViewDetails,
  onSearch,
  className = '',
  compact = false
}) => {
  const handleSearch = () => {
    if (searchQuery && searchQuery.length >= 2) {
      onSearch(productId);
    } else {
      toast.info('Nhập tên sản phẩm để tìm kiếm');
    }
  };
  
  // Styles cho buttons
  const buttonBaseClass = compact 
    ? "p-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors duration-200" 
    : "flex-1 bg-gray-100 text-gray-700 hover:bg-gray-200 py-2 rounded transition-colors duration-200 text-sm flex items-center justify-center";
  
  // Icon size
  const iconSize = compact ? 16 : 14;
  const iconClass = compact ? "" : "mr-1.5";
  
  return (
    <div className={`flex ${compact ? "items-center space-x-2" : "mt-auto space-x-2"} ${className}`}>
      {isMapped && nhanhId ? (
        <>
          <button
            onClick={() => onSyncInventory(productId)}
            disabled={isLoading}
            className={buttonBaseClass}
            title="Đồng bộ tồn kho"
          >
            {isLoading ? (
              <Loader size={iconSize} className={`animate-spin ${iconClass}`} />
            ) : (
              <RefreshCw size={iconSize} className={iconClass} />
            )}
            {!compact && "Đồng bộ"}
          </button>
          
          <button
            onClick={() => onSyncPrice(productId)}
            disabled={isLoading}
            className={buttonBaseClass}
            title="Đồng bộ giá"
          >
            {isLoading ? (
              <Loader size={iconSize} className={`animate-spin ${iconClass}`} />
            ) : (
              <DollarSign size={iconSize} className={iconClass} />
            )}
            {!compact && "Đồng bộ giá"}
          </button>
          
          <button
            onClick={() => onViewDetails(nhanhId)}
            className={buttonBaseClass}
            title="Xem chi tiết"
          >
            <EyeIcon size={iconSize} className={iconClass} />
            {!compact && "Chi tiết"}
          </button>
          
          <button
            onClick={() => onUnmapProduct(productId)}
            className={buttonBaseClass}
            title="Bỏ mapping"
          >
            <Trash2 size={iconSize} className={iconClass} />
            {!compact && "Bỏ map"}
          </button>
        </>
      ) : (
        <button
          onClick={handleSearch}
          className={compact ? buttonBaseClass : "w-full bg-gray-100 text-gray-700 hover:bg-gray-200 py-2 rounded transition-colors duration-200 text-sm flex items-center justify-center"}
          title="Tìm kiếm"
        >
          {isSearching ? (
            <Loader size={iconSize} className="animate-spin" />
          ) : (
            <>
              <Search size={iconSize} className={!compact ? "mr-1.5" : ""} />
              {!compact && "Tìm kiếm"}
            </>
          )}
        </button>
      )}
    </div>
  );
};

export default ProductActionButtons; 