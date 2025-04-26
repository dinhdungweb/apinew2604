import React, { useState } from 'react';
import ProductCard from './ProductCard';

interface Product {
  id: string;
  product_id: string;
  name: string;
  sku: string;
  price?: number;
  inventory?: number;
  image?: string;
}

interface ProductGridViewProps {
  products: Product[];
  mappedProducts?: Record<string, any>;
  syncStatus?: Record<string, string>;
  syncErrors?: Record<string, string>;
  onSelectProduct?: (productId: string) => void;
  loading?: boolean;
  variant?: 'grid' | 'card';
}

export default function ProductGridView({
  products,
  mappedProducts = {},
  syncStatus = {},
  syncErrors = {},
  onSelectProduct,
  loading = false,
  variant = 'grid'
}: ProductGridViewProps) {
  // Kiểm tra xem sản phẩm có lỗi đồng bộ không
  const hasError = (productId: string) => {
    return !!syncErrors[productId];
  };

  // Kiểm tra xem sản phẩm đã được đồng bộ chưa
  const isSynced = (productId: string) => {
    return !!mappedProducts[productId];
  };

  // Skeleton loader cho trạng thái loading
  if (loading) {
    return (
      <div className={`grid ${
        variant === 'grid' 
          ? 'grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4' 
          : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4 md:gap-6'
      }`}>
        {Array.from({ length: variant === 'grid' ? 10 : 6 }).map((_, index) => (
          <div key={index} className="border rounded-xl animate-pulse bg-white dark:bg-gray-800 dark:border-gray-700 overflow-hidden">
            <div className={`w-full ${variant === 'grid' ? 'aspect-square' : 'aspect-video'} bg-gray-200 dark:bg-gray-700`}></div>
            <div className="p-3 md:p-4 space-y-2 md:space-y-3">
              <div className="h-3 md:h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
              <div className="h-2 md:h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
              <div className="h-4 md:h-5 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
              <div className="h-2 md:h-3 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Nếu không có sản phẩm nào
  if (products.length === 0) {
    return (
      <div className="text-center py-6 md:py-12">
        <div className="text-gray-500 dark:text-gray-400">Không có sản phẩm nào phù hợp với điều kiện tìm kiếm</div>
      </div>
    );
  }

  return (
    <div className={`grid ${
      variant === 'grid' 
        ? 'grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4' 
        : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4 md:gap-6'
    }`}>
      {products.map(product => (
        <div key={product.id} className="h-full">
          <ProductCard
            product={product}
            onSelect={onSelectProduct}
            isSynced={isSynced(product.id)}
            hasError={hasError(product.id)}
            syncStatus={syncStatus[product.id] || 'pending'}
            variant={variant}
          />
        </div>
      ))}
    </div>
  );
} 