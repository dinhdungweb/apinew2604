import React, { ReactNode } from 'react';

interface PageContainerProps {
  children: ReactNode;
  className?: string;
  fluid?: boolean;
}

export default function PageContainer({
  children,
  className = '',
  fluid = false,
}: PageContainerProps) {
  return (
    <div className={`py-6 md:py-8 w-full animate-fade-in ${className}`}>
      <div className={fluid ? 'w-full' : 'w-full px-4 md:px-6'}>
        {children}
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  className = '',
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mb-6 ${className}`}>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-1">
            {title}
          </h1>
          {description && (
            <p className="text-gray-500 dark:text-gray-400">{description}</p>
          )}
        </div>
        {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
      </div>
    </div>
  );
}

export function PageSection({
  title,
  description,
  children,
  actions,
  className = '',
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  // Kiểm tra có className overflow-hidden hay không
  const hasOverflowHidden = className.includes('overflow-hidden');
  
  return (
    <div className={`mb-8 ${className}`}>
      {(title || actions) && (
        <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${hasOverflowHidden ? 'px-6 pt-6 pb-4' : 'mb-4'}`}>
          <div>
            {title && (
              <h2 className="text-xl font-medium text-gray-800 dark:text-gray-200">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {description}
              </p>
            )}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
} 