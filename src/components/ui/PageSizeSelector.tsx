import React from 'react';

interface PageSizeSelectorProps {
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  className?: string;
  options?: number[];
}

export default function PageSizeSelector({
  pageSize,
  onPageSizeChange,
  className = '',
  options = [10, 20, 50, 100]
}: PageSizeSelectorProps) {
  return (
    <div className={`flex justify-end ${className}`}>
      <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
        <span className="mr-2">Số sản phẩm mỗi trang:</span>
        <select
          value={pageSize}
          onChange={(e) => {
            const newSize = Number(e.target.value);
            onPageSizeChange(newSize);
          }}
          className="px-2 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          {options.map(option => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </div>
    </div>
  );
} 