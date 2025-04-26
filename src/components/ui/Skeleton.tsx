import React from 'react';

interface SkeletonProps {
  height?: string | number;
  width?: string | number;
  className?: string;
  variant?: 'rectangular' | 'circular' | 'text';
}

export const Skeleton: React.FC<SkeletonProps> = ({
  height = 'auto',
  width = '100%',
  className = '',
  variant = 'rectangular'
}) => {
  const baseClasses = "animate-pulse bg-gray-200 dark:bg-gray-700";
  
  const variantClasses = {
    rectangular: "rounded",
    circular: "rounded-full",
    text: "h-4 rounded"
  };
  
  const styles = {
    height: typeof height === 'number' ? `${height}px` : height,
    width: typeof width === 'number' ? `${width}px` : width
  };
  
  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      style={styles}
    />
  );
};

export const TableRowSkeleton: React.FC<{ columns: number }> = ({ columns }) => (
  <tr className="animate-pulse">
    {[...Array(columns)].map((_, i) => (
      <td key={i} className="p-3">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
      </td>
    ))}
  </tr>
);

export const CardSkeleton: React.FC = () => (
  <div className="animate-pulse bg-white dark:bg-gray-800 rounded-lg shadow p-4">
    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-4"></div>
    <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
  </div>
);

export const StatCardSkeleton: React.FC = () => (
  <div className="animate-pulse bg-white dark:bg-gray-800 rounded-lg shadow p-5">
    <div className="flex justify-between mb-3">
      <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
      <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
    </div>
    <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-3"></div>
    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
  </div>
);

export const ProductItemSkeleton: React.FC = () => (
  <div className="animate-pulse bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex">
    <div className="mr-4 w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
    <div className="flex-1">
      <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2"></div>
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
    </div>
    <div className="w-24">
      <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
    </div>
  </div>
);

export default Skeleton; 