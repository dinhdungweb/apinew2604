'use client';

import * as React from 'react';
import Image from 'next/image'; 
import { cn } from '@/lib/utils';

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string;
  fallback?: React.ReactNode;
  alt?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  status?: 'online' | 'offline' | 'away' | 'busy';
  statusPosition?: 'top-right' | 'bottom-right';
  shape?: 'circle' | 'square';
  border?: boolean;
  loading?: boolean;
}

export const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({
    className,
    src,
    fallback,
    alt = 'Avatar',
    size = 'md',
    status,
    statusPosition = 'bottom-right',
    shape = 'circle',
    border = false,
    loading = false,
    ...props
  }, ref) => {
    const [hasError, setHasError] = React.useState(false);
    
    // Handle image error
    const handleError = () => {
      setHasError(true);
    };
    
    // Size classes
    const sizeClasses = {
      xs: 'h-6 w-6 text-xs',
      sm: 'h-8 w-8 text-sm',
      md: 'h-10 w-10 text-base',
      lg: 'h-12 w-12 text-lg',
      xl: 'h-14 w-14 text-xl',
      '2xl': 'h-16 w-16 text-2xl',
    };
    
    // Status color classes
    const statusColorClasses = {
      online: 'bg-green-500',
      offline: 'bg-gray-400',
      away: 'bg-amber-500',
      busy: 'bg-red-500',
    };
    
    // Status position classes
    const statusPositionClasses = {
      'top-right': '-top-0.5 -right-0.5',
      'bottom-right': '-bottom-0.5 -right-0.5',
    };

    // Get initials from alt text
    const getInitials = (name: string) => {
      const nameParts = name.split(' ').filter(Boolean);
      if (nameParts.length >= 2) {
        return `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase();
      }
      return nameParts[0]?.[0].toUpperCase() || '?';
    };

    return (
      <div
        ref={ref}
        className={cn(
          'relative flex items-center justify-center overflow-hidden bg-gray-100 dark:bg-gray-800',
          sizeClasses[size],
          shape === 'circle' ? 'rounded-full' : 'rounded-md',
          border && 'border-2 border-white dark:border-gray-800',
          className
        )}
        {...props}
      >
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-200 dark:bg-gray-700 animate-pulse" />
        ) : !hasError && src ? (
          <Image
            src={src}
            alt={alt}
            fill
            className="object-cover"
            onError={handleError}
          />
        ) : fallback ? (
          <div className="flex h-full w-full items-center justify-center font-medium text-gray-600 dark:text-gray-300">
            {fallback}
          </div>
        ) : (
          <div className="flex h-full w-full items-center justify-center font-medium text-gray-600 dark:text-gray-300">
            {getInitials(alt)}
          </div>
        )}
        
        {status && (
          <span 
            className={cn(
              'absolute block rounded-full border-2 border-white dark:border-gray-800',
              statusPositionClasses[statusPosition],
              statusColorClasses[status],
              size === 'xs' ? 'h-1.5 w-1.5' : '',
              size === 'sm' ? 'h-2 w-2' : '',
              size === 'md' ? 'h-2.5 w-2.5' : '',
              size === 'lg' ? 'h-3 w-3' : '',
              size === 'xl' ? 'h-3.5 w-3.5' : '',
              size === '2xl' ? 'h-4 w-4' : '',
            )}
          />
        )}
      </div>
    );
  }
);

Avatar.displayName = 'Avatar';

export interface AvatarGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  max?: number;
  size?: AvatarProps['size'];
  spacing?: 'tight' | 'normal';
}

export const AvatarGroup = React.forwardRef<HTMLDivElement, AvatarGroupProps>(
  ({ children, className, max, size = 'md', spacing = 'normal', ...props }, ref) => {
    const childrenArray = React.Children.toArray(children);
    const excess = max !== undefined && childrenArray.length > max 
      ? childrenArray.length - max 
      : 0;
    
    const displayAvatars = max !== undefined 
      ? childrenArray.slice(0, max) 
      : childrenArray;
    
    const spacingValues = {
      tight: '-mr-3',
      normal: '-mr-2',
    };
    
    return (
      <div
        ref={ref}
        className={cn('flex flex-row-reverse justify-end', className)}
        {...props}
      >
        {excess > 0 && (
          <Avatar
            size={size}
            className={cn('ring-2 ring-white dark:ring-gray-800', spacingValues[spacing])}
            fallback={`+${excess}`}
          />
        )}
        
        {displayAvatars.map((child, i) => {
          if (React.isValidElement<AvatarProps>(child)) {
            return React.cloneElement(child, {
              key: i,
              size: (child.props as AvatarProps).size || size,
              className: cn(
                (child.props as AvatarProps).className,
                i !== displayAvatars.length - 1 && spacingValues[spacing],
                'ring-2 ring-white dark:ring-gray-800'
              ),
            });
          }
          return child;
        })}
      </div>
    );
  }
);

AvatarGroup.displayName = 'AvatarGroup';

export default Avatar; 