import React, { useRef, useEffect } from 'react';
import { Search, Loader } from 'lucide-react';
import { toast } from 'react-toastify';

// Định nghĩa kiểu dữ liệu
interface NhanhProduct {
  idNhanh: string;
  name: string;
  code: string;
  inventory?: number;
}

interface ProductSearchBoxProps {
  id: string;
  searchQuery: string;
  isSearching: boolean;
  showResults: boolean;
  results: NhanhProduct[];
  noResults: boolean;
  onInputChange: (id: string, value: string) => void;
  onSearch: (id: string) => void;
  onSelectProduct: (id: string, product: NhanhProduct) => void;
  onFocus: (id: string) => void;
  onBlur: (id: string) => void;
  containerRef?: React.RefObject<HTMLDivElement>;
}

const ProductSearchBox: React.FC<ProductSearchBoxProps> = ({
  id,
  searchQuery,
  isSearching,
  showResults,
  results,
  noResults,
  onInputChange,
  onSearch,
  onSelectProduct,
  onFocus,
  onBlur,
  containerRef
}) => {
  const localRef = useRef<HTMLDivElement>(null);
  const ref = containerRef || localRef;

  // Effect để đóng kết quả khi click bên ngoài
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        // Click ngoài component, nên ẩn kết quả
        if (showResults) {
          onBlur(id);
        }
      }
    };

    // Thêm event listener
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      // Cleanup listener
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [id, onBlur, ref, showResults]);

  const handleSearchClick = () => {
    if (searchQuery && searchQuery.length >= 2) {
      onSearch(id);
    } else {
      toast.info('Nhập ít nhất 2 ký tự để tìm kiếm');
    }
  };

  return (
    <div className="relative" ref={ref}>
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Tìm sản phẩm Nhanh.vn..."
          className="text-sm border border-gray-300 dark:border-gray-600 rounded-md p-2 w-full focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          value={searchQuery}
          onChange={(e) => onInputChange(id, e.target.value)}
          onFocus={() => onFocus(id)}
        />
        <button
          onClick={handleSearchClick}
          className="p-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
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
      {showResults && (
        <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 max-h-60 overflow-auto">
          {results.length > 0 ? (
            results.map((item) => (
              <div
                key={item.idNhanh}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                onClick={() => onSelectProduct(id, item)}
              >
                <div className="font-medium text-sm text-gray-900 dark:text-white">{item.name}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 flex gap-2 mt-1">
                  <span>ID: {item.idNhanh}</span>
                  {item.code && <span>Mã: {item.code}</span>}
                  {item.inventory !== undefined && <span>Tồn: {item.inventory}</span>}
                </div>
              </div>
            ))
          ) : noResults ? (
            <div className="p-3 text-sm text-gray-500 dark:text-gray-400 text-center">
              Không tìm thấy sản phẩm phù hợp
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default ProductSearchBox; 