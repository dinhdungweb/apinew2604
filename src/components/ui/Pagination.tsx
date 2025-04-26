import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  className = '',
}: PaginationProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  
  // Kiểm tra kích thước màn hình theo cách an toàn trên client side
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 640);
      setIsSmallScreen(window.innerWidth < 480);
    };
    
    // Kiểm tra ban đầu
    checkScreenSize();
    
    // Cập nhật khi resize
    window.addEventListener('resize', checkScreenSize);
    
    // Cleanup
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);
  
  if (totalPages <= 1) return null;
  
  // Xác định các nút trang sẽ hiển thị dựa vào kích thước màn hình
  const getPageNumbers = () => {
    const pageNumbers = [];
    const maxVisible = isMobile ? 3 : 7;
    
    if (totalPages <= maxVisible) {
      // Nếu tổng số trang ít, hiện tất cả
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
      }
    } else {
      // Ở đầu hoặc cuối, cách hiển thị khác nhau cho mobile và desktop
      if (isMobile) {
        // Mobile chỉ hiển thị trang hiện tại và trang kề
        if (currentPage === 1) {
          pageNumbers.push(1, 2, 'ellipsis', totalPages);
        } else if (currentPage === totalPages) {
          pageNumbers.push(1, 'ellipsis', totalPages - 1, totalPages);
        } else {
          pageNumbers.push(1, 'ellipsis', currentPage, 'ellipsis', totalPages);
        }
      } else {
        // Desktop hiển thị nhiều trang hơn
        if (currentPage <= 4) {
          // Ở đầu: 1 2 3 4 5 ... n
          for (let i = 1; i <= 5; i++) {
            pageNumbers.push(i);
          }
          pageNumbers.push('ellipsis');
          pageNumbers.push(totalPages);
        } else if (currentPage >= totalPages - 3) {
          // Ở cuối: 1 ... n-4 n-3 n-2 n-1 n
          pageNumbers.push(1);
          pageNumbers.push('ellipsis');
          for (let i = totalPages - 4; i <= totalPages; i++) {
            pageNumbers.push(i);
          }
        } else {
          // Ở giữa: 1 ... p-1 p p+1 ... n
          pageNumbers.push(1);
          pageNumbers.push('ellipsis');
          for (let i = currentPage - 1; i <= currentPage + 1; i++) {
            pageNumbers.push(i);
          }
          pageNumbers.push('ellipsis');
          pageNumbers.push(totalPages);
        }
      }
    }
    
    return pageNumbers;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className={`flex justify-center ${className}`}>
      <div className="flex flex-wrap items-center justify-center gap-0.5 sm:gap-1">
        {/* Nút về trang đầu tiên - Ẩn trên màn hình rất nhỏ */}
        {!isSmallScreen && (
          <button
            disabled={currentPage === 1}
            onClick={() => onPageChange(1)}
            className="p-1 sm:p-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            aria-label="Trang đầu"
          >
            <ChevronsLeft size={14} className="sm:w-4 sm:h-4" />
          </button>
        )}
        
        {/* Nút Trước - Luôn hiển thị */}
        <button
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="p-1 sm:p-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:pointer-events-none transition-colors"
          aria-label="Trang trước"
        >
          <ChevronLeft size={14} className="sm:w-4 sm:h-4" />
        </button>
        
        {/* Các nút số trang */}
        {pageNumbers.map((pageNumber, index) => (
          pageNumber === 'ellipsis' ? (
            <span 
              key={`ellipsis-${index}`} 
              className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center text-gray-500 dark:text-gray-400 text-xs sm:text-sm"
            >
              ...
            </span>
          ) : (
            <button
              key={pageNumber}
              onClick={() => onPageChange(Number(pageNumber))}
              className={`w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-md text-xs sm:text-sm font-medium transition-colors ${
                currentPage === pageNumber
                  ? 'bg-blue-600 text-white border border-blue-600 dark:bg-blue-700 dark:border-blue-700'
                  : 'border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
              aria-label={`Trang ${pageNumber}`}
              aria-current={currentPage === pageNumber ? 'page' : undefined}
            >
              {pageNumber}
            </button>
          )
        ))}
        
        {/* Nút Tiếp - Luôn hiển thị */}
        <button
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="p-1 sm:p-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:pointer-events-none transition-colors"
          aria-label="Trang tiếp"
        >
          <ChevronRight size={14} className="sm:w-4 sm:h-4" />
        </button>
        
        {/* Nút đến trang cuối - Ẩn trên màn hình rất nhỏ */}
        {!isSmallScreen && (
          <button
            disabled={currentPage === totalPages}
            onClick={() => onPageChange(totalPages)}
            className="p-1 sm:p-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            aria-label="Trang cuối"
          >
            <ChevronsRight size={14} className="sm:w-4 sm:h-4" />
          </button>
        )}
      </div>
    </div>
  );
} 