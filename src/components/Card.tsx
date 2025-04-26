import React, { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  title?: string;
  description?: string;
  icon?: ReactNode;
  footer?: ReactNode;
  actions?: ReactNode;
  className?: string;
  loading?: boolean;
  variant?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info';
  compact?: boolean;
  hoverable?: boolean;
  clickable?: boolean;
  onClick?: () => void;
}

export default function Card({
  children,
  title,
  description,
  icon,
  footer,
  actions,
  className = '',
  loading = false,
  variant = 'default',
  compact = false,
  hoverable = false,
  clickable = false,
  onClick,
}: CardProps) {
  // Generate variant styling
  const variantStyles = {
    default: 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700',
    primary: 'bg-primary-50 dark:bg-primary-900/10 border-primary-200 dark:border-primary-800',
    secondary: 'bg-secondary-50 dark:bg-secondary-900/10 border-secondary-200 dark:border-secondary-800',
    success: 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800',
    warning: 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800',
    danger: 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800',
    info: 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800',
  };

  // Generate header text color
  const headerTextColor = {
    default: 'text-gray-900 dark:text-white',
    primary: 'text-primary-900 dark:text-primary-100',
    secondary: 'text-secondary-900 dark:text-secondary-100',
    success: 'text-green-900 dark:text-green-100',
    warning: 'text-amber-900 dark:text-amber-100',
    danger: 'text-red-900 dark:text-red-100',
    info: 'text-blue-900 dark:text-blue-100',
  };

  return (
    <div 
      className={`
        rounded-xl border shadow-soft overflow-hidden 
        ${variantStyles[variant]}
        ${compact ? 'p-3 md:p-4' : 'p-4 md:p-5'}
        ${hoverable ? 'transition-all duration-200 hover:shadow-card hover:-translate-y-1' : ''}
        ${clickable ? 'cursor-pointer' : ''}
        ${className}
      `}
      onClick={clickable && onClick ? onClick : undefined}
    >
      {loading ? (
        <div className="animate-pulse space-y-3 md:space-y-4">
          <div className="h-3 md:h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
          <div className="space-y-1 md:space-y-2">
            <div className="h-2 md:h-3 bg-gray-300 dark:bg-gray-600 rounded"></div>
            <div className="h-2 md:h-3 bg-gray-300 dark:bg-gray-600 rounded w-5/6"></div>
          </div>
        </div>
      ) : (
        <>
          {(title || icon || actions) && (
            <div className="flex items-center justify-between mb-3 md:mb-4">
              <div className="flex items-center">
                {icon && (
                  <div className="mr-2 md:mr-3 flex-shrink-0">
                    {icon}
                  </div>
                )}
                <div>
                  {title && (
                    <h3 className={`text-base md:text-lg font-medium ${headerTextColor[variant]}`}>
                      {title}
                    </h3>
                  )}
                  {description && (
                    <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 mt-0.5 md:mt-1">
                      {description}
                    </p>
                  )}
                </div>
              </div>
              {actions && (
                <div className="ml-4 flex-shrink-0">
                  {actions}
                </div>
              )}
            </div>
          )}
          <div className="text-gray-800 dark:text-gray-200">
            {children}
          </div>
          {footer && (
            <div className="mt-3 md:mt-4 pt-3 md:pt-4 border-t border-gray-200 dark:border-gray-700">
              {footer}
            </div>
          )}
        </>
      )}
    </div>
  );
} 