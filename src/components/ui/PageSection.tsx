import React, { ReactNode } from 'react';

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
  return (
    <div className={`mb-8 ${className}`}>
      {(title || actions) && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
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