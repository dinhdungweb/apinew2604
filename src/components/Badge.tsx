import React, { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info';
  size?: 'sm' | 'md' | 'lg';
  rounded?: boolean;
  icon?: ReactNode;
  className?: string;
  dot?: boolean;
}

export default function Badge({
  children,
  variant = 'default',
  size = 'md',
  rounded = false,
  icon,
  className = '',
  dot = false,
}: BadgeProps) {
  const baseStyles = 'inline-flex items-center font-medium';
  
  const variantStyles = {
    default: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
    primary: 'bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-300',
    secondary: 'bg-secondary-100 text-secondary-800 dark:bg-secondary-900/30 dark:text-secondary-300',
    success: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    danger: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  };
  
  const dotColors = {
    default: 'bg-gray-500',
    primary: 'bg-primary-500',
    secondary: 'bg-secondary-500',
    success: 'bg-green-500',
    danger: 'bg-red-500',
    warning: 'bg-amber-500',
    info: 'bg-blue-500',
  };
  
  const sizeStyles = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-xs px-2.5 py-0.5',
    lg: 'text-sm px-3 py-1',
  };
  
  const roundedStyles = rounded ? 'rounded-full' : 'rounded-md';

  return (
    <span
      className={`
        ${baseStyles}
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${roundedStyles}
        ${className}
      `}
    >
      {dot && (
        <span 
          className={`mr-1.5 inline-block h-2 w-2 flex-shrink-0 rounded-full ${dotColors[variant]}`}
          aria-hidden="true" 
        />
      )}
      {icon && <span className="mr-1.5">{icon}</span>}
      {children}
    </span>
  );
} 