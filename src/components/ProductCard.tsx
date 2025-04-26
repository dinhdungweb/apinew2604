import React from 'react';
import { Package, AlertCircle, Check, Tag, CheckCircle, XCircle } from 'lucide-react';
import Card from './Card';

// Interface cho props sản phẩm
interface ProductCardProps {
  product: {
    id: string;
    product_id: string;
    name: string;
    sku: string;
    price?: number;
    inventory?: number;
    image?: string;
  };
  onSelect?: (productId: string) => void;
  isSynced?: boolean;
  hasError?: boolean;
  syncStatus?: string;
  variant?: 'grid' | 'card';
}

export default function ProductCard({ 
  product, 
  onSelect,
  isSynced = false,
  hasError = false,
  syncStatus = 'pending',
  variant = 'grid'
}: ProductCardProps) {
  // Format giá tiền
  const formatPrice = (price?: number) => {
    if (price === undefined) return 'N/A';
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(price);
  };

  // Status badge dựa trên tình trạng kho
  const getInventoryStatus = () => {
    if (product.inventory === undefined) return null;
    if (product.inventory <= 0) {
      return <span className="inline-flex items-center px-1.5 py-0.5 xs:px-2.5 xs:py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">Hết hàng</span>;
    } else if (product.inventory <= 5) {
      return <span className="inline-flex items-center px-1.5 py-0.5 xs:px-2.5 xs:py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">Sắp hết</span>;
    } else {
      return <span className="inline-flex items-center px-1.5 py-0.5 xs:px-2.5 xs:py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">Còn hàng</span>;
    }
  };

  // Sync status badge
  const getSyncStatus = () => {
    if (hasError) {
      return <div className="flex items-center text-red-500 dark:text-red-400 text-xs font-medium"><XCircle size={14} className="mr-1" /> Lỗi đồng bộ</div>;
    }
    if (isSynced) {
      return <div className="flex items-center text-green-500 dark:text-green-400 text-xs font-medium"><CheckCircle size={14} className="mr-1" /> Đã đồng bộ</div>;
    }
    return <div className="flex items-center text-gray-500 dark:text-gray-400 text-xs font-medium"><AlertCircle size={14} className="mr-1" /> Chưa đồng bộ</div>;
  };

  return (
    <Card 
      hoverable 
      clickable={!!onSelect} 
      onClick={() => onSelect && onSelect(product.id)}
      className="h-full flex flex-col"
    >
      <div className={`relative ${variant === 'grid' ? 'pb-3/4' : 'pb-2/3'}`}>
        {product.image ? (
          <img 
            src={product.image} 
            alt={product.name} 
            className="absolute h-full w-full object-cover rounded-lg mb-3"
          />
        ) : (
          <div className="absolute h-full w-full bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center mb-3">
            <Package className={`${variant === 'grid' ? 'h-8 w-8 xs:h-10 xs:w-10' : 'h-10 w-10 xs:h-12 xs:w-12'} text-gray-400 dark:text-gray-500`} />
          </div>
        )}
      </div>
      
      <div className={`${variant === 'grid' ? 'pt-2 xs:pt-3' : 'pt-3 xs:pt-4 px-2'} flex-grow`}>
        <h3 className={`font-medium text-gray-900 dark:text-white ${variant === 'grid' ? 'text-xs xs:text-sm mb-1 line-clamp-2' : 'text-sm xs:text-base mb-1 xs:mb-2 line-clamp-2'}`}>
          {product.name}
        </h3>
        <div className="text-gray-500 dark:text-gray-400 text-xs mb-1 xs:mb-2">SKU: {product.sku}</div>
        
        <div className="flex flex-wrap xs:flex-nowrap items-center justify-between gap-1 mb-1 xs:mb-2">
          <div className={`font-semibold text-gray-900 dark:text-white ${variant === 'card' ? 'text-base xs:text-lg' : 'text-sm xs:text-base'}`}>
            {formatPrice(product.price)}
          </div>
          {getInventoryStatus()}
        </div>
        
        <div className="mt-1 xs:mt-2 pt-1 xs:pt-2 border-t border-gray-100 dark:border-gray-700">
          {getSyncStatus()}
        </div>
      </div>
    </Card>
  );
} 