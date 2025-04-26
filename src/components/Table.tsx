import React, { ReactNode } from 'react';

interface TableProps {
  children: ReactNode;
  className?: string;
  striped?: boolean;
  hoverable?: boolean;
  compact?: boolean;
  bordered?: boolean;
}

interface TableHeaderProps {
  children: ReactNode;
  className?: string;
}

interface TableBodyProps {
  children: ReactNode;
  className?: string;
  loading?: boolean;
  loadingRows?: number;
  columns?: number;
}

interface TableRowProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  clickable?: boolean;
  selected?: boolean;
}

interface TableCellProps {
  children: ReactNode;
  className?: string;
  align?: 'left' | 'center' | 'right';
  colSpan?: number;
}

interface TableHeadCellProps extends TableCellProps {
  sortable?: boolean;
  sorted?: 'asc' | 'desc' | null;
  onSort?: () => void;
}

export function Table({
  children,
  className = '',
  striped = false,
  hoverable = false,
  compact = false,
  bordered = false,
}: TableProps) {
  return (
    <div className="overflow-x-auto relative">
      <table 
        className={`
          w-full text-left
          ${bordered ? 'border border-gray-200 dark:border-gray-700' : ''}
          ${className}
        `}
      >
        {children}
      </table>
    </div>
  );
}

export function TableHeader({ children, className = '' }: TableHeaderProps) {
  return (
    <thead className={`text-xs uppercase bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 ${className}`}>
      {children}
    </thead>
  );
}

export function TableBody({ 
  children, 
  className = '', 
  loading = false,
  loadingRows = 5,
  columns = 4
}: TableBodyProps) {
  if (loading) {
    return (
      <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
        {[...Array(loadingRows)].map((_, rowIndex) => (
          <tr key={`loading-row-${rowIndex}`} className="animate-pulse">
            {[...Array(columns)].map((_, cellIndex) => (
              <td key={`loading-cell-${rowIndex}-${cellIndex}`} className="px-4 py-3">
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    );
  }

  return (
    <tbody 
      className={`
        bg-white dark:bg-gray-900 
        divide-y divide-gray-200 dark:divide-gray-700 
        ${className}
      `}
    >
      {children}
    </tbody>
  );
}

export function TableRow({ 
  children, 
  className = '', 
  onClick,
  clickable = false,
  selected = false,
}: TableRowProps) {
  return (
    <tr 
      className={`
        ${selected ? 'bg-primary-50 dark:bg-primary-900/20' : ''}
        ${clickable ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/70' : ''}
        ${className}
      `}
      onClick={clickable && onClick ? onClick : undefined}
    >
      {children}
    </tr>
  );
}

export function TableCell({ 
  children, 
  className = '', 
  align = 'left',
  colSpan,
}: TableCellProps) {
  const alignmentClasses = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  };

  return (
    <td 
      className={`
        px-4 py-3
        text-sm text-gray-700 dark:text-gray-300
        ${alignmentClasses[align]}
        ${className}
      `}
      colSpan={colSpan}
    >
      {children}
    </td>
  );
}

export function TableHeadCell({ 
  children, 
  className = '', 
  align = 'left',
  sortable = false,
  sorted = null,
  onSort,
  colSpan,
}: TableHeadCellProps) {
  const alignmentClasses = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  };

  return (
    <th 
      className={`
        px-4 py-3 font-medium
        ${alignmentClasses[align]}
        ${sortable ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700' : ''}
        ${className}
      `}
      onClick={sortable && onSort ? onSort : undefined}
      colSpan={colSpan}
    >
      <div className="flex items-center space-x-1">
        <span>{children}</span>
        {sortable && (
          <span className="inline-flex flex-col">
            <svg 
              className={`w-3 h-3 ${sorted === 'asc' ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}
              aria-hidden="true" 
              xmlns="http://www.w3.org/2000/svg" 
              fill="currentColor" 
              viewBox="0 0 24 24"
            >
              <path d="M11.3 6.3a1 1 0 0 1 1.4 0l6 6a1 1 0 0 1-1.4 1.4L12 8.4l-5.3 5.3a1 1 0 0 1-1.4-1.4l6-6z"/>
            </svg>
            <svg 
              className={`w-3 h-3 ${sorted === 'desc' ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}
              aria-hidden="true" 
              xmlns="http://www.w3.org/2000/svg" 
              fill="currentColor" 
              viewBox="0 0 24 24"
            >
              <path d="M17.7 17.7a1 1 0 0 1-1.4 0L12 13.4l-4.3 4.3a1 1 0 0 1-1.4-1.4l5-5a1 1 0 0 1 1.4 0l5 5a1 1 0 0 1 0 1.4z"/>
            </svg>
          </span>
        )}
      </div>
    </th>
  );
}

export function TableEmpty({ 
  colSpan = 1, 
  message = "No data available",
  className = ''
}: { 
  colSpan?: number, 
  message?: string | ReactNode,
  className?: string
}) {
  return (
    <tr>
      <td 
        colSpan={colSpan} 
        className={`px-4 py-8 text-center text-gray-500 dark:text-gray-400 ${className}`}
      >
        {message}
      </td>
    </tr>
  );
}

// Export all components as named exports and also as a default export
const TableComponents = {
  Table,
  Header: TableHeader,
  Body: TableBody,
  Row: TableRow,
  Cell: TableCell,
  HeadCell: TableHeadCell,
  Empty: TableEmpty
};

export default TableComponents; 