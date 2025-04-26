import React from 'react';
import { Filter, Search, ArrowUpDown } from 'lucide-react';

interface ProductFiltersProps {
  filterStatus: string;
  onFilterChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  searchTerm: string;
  onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  currentSort?: {
    field: string;
    order: string;
  };
  onSort?: (field: string) => void;
}

const ProductFilters: React.FC<ProductFiltersProps> = ({
  filterStatus,
  onFilterChange,
  searchTerm,
  onSearchChange,
  currentSort,
  onSort
}) => {
  return (
    <div className="mb-6 flex flex-col sm:flex-row gap-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex-1 flex flex-col md:flex-row gap-4">
        {/* Filter dropdown */}
        <div className="relative">
          <label htmlFor="filter-status" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Lọc sản phẩm</label>
          <div className="relative">
            <select
              id="filter-status"
              value={filterStatus}
              onChange={onFilterChange}
              className="appearance-none block w-full min-w-[200px] pl-3 pr-10 py-2 text-base border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
            >
              <option value="all">Tất cả sản phẩm</option>
              <option value="mapped">Đã mapping</option>
              <option value="unmapped">Chưa mapping</option>
              <option value="synced">Đã đồng bộ</option>
              <option value="unsynced">Chưa đồng bộ</option>
              <option value="error">Lỗi đồng bộ</option>
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
              <Filter className="h-4 w-4 text-gray-400" />
            </div>
          </div>
        </div>
        
        {/* Search input */}
        <div className="flex-1">
          <label htmlFor="search-products" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Tìm kiếm sản phẩm
          </label>
          <div className="relative">
            <input
              type="text"
              id="search-products"
              className="appearance-none block w-full pl-3 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm text-gray-900 dark:text-white"
              placeholder="Tìm theo tên, SKU..."
              value={searchTerm}
              onChange={onSearchChange}
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
          </div>
        </div>
      </div>
      
      {/* Sort options */}
      {onSort && (
        <div className="flex flex-wrap gap-3 items-end">
          <button
            onClick={() => onSort('name')}
            className={`px-3 py-2 text-sm font-medium rounded-md flex items-center space-x-1 transition-colors ${
              currentSort?.field === 'name' 
                ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            <span>Tên</span>
            {currentSort?.field === 'name' && (
              <ArrowUpDown className="h-3.5 w-3.5" />
            )}
          </button>
          
          <button
            onClick={() => onSort('sku')}
            className={`px-3 py-2 text-sm font-medium rounded-md flex items-center space-x-1 transition-colors ${
              currentSort?.field === 'sku' 
                ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            <span>SKU</span>
            {currentSort?.field === 'sku' && (
              <ArrowUpDown className="h-3.5 w-3.5" />
            )}
          </button>
          
          <button
            onClick={() => onSort('inventory')}
            className={`px-3 py-2 text-sm font-medium rounded-md flex items-center space-x-1 transition-colors ${
              currentSort?.field === 'inventory' 
                ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            <span>Tồn kho</span>
            {currentSort?.field === 'inventory' && (
              <ArrowUpDown className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default ProductFilters; 