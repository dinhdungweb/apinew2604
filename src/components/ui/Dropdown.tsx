'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

type Position = 'top' | 'right' | 'bottom' | 'left';
type Alignment = 'start' | 'center' | 'end';
type Trigger = 'click' | 'hover';

interface DropdownProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  position?: Position;
  align?: Alignment;
  triggerType?: Trigger;
  className?: string;
  minWidth?: number | string;
  maxHeight?: number | string;
  disabled?: boolean;
  closeOnItemClick?: boolean;
  closeOnClickOutside?: boolean;
}

export function Dropdown({
  trigger,
  children,
  position = 'bottom',
  align = 'start',
  triggerType = 'click',
  className = '',
  minWidth = 220,
  maxHeight,
  disabled = false,
  closeOnItemClick = true,
  closeOnClickOutside = true,
}: DropdownProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [coords, setCoords] = React.useState({ x: 0, y: 0, width: 0, height: 0 });
  
  const triggerRef = React.useRef<HTMLDivElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const [isMounted, setIsMounted] = React.useState(false);

  // Chức năng xử lý vị trí dropdown
  const updatePosition = React.useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setCoords({
        x: rect.left + window.scrollX,
        y: rect.top + window.scrollY,
        width: rect.width,
        height: rect.height,
      });
    }
  }, []);

  // Set mounted state cho SSR
  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  // Theo dõi sự kiện click outside để đóng dropdown
  React.useEffect(() => {
    if (!closeOnClickOutside) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        isOpen &&
        dropdownRef.current &&
        triggerRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, closeOnClickOutside]);

  // Cập nhật vị trí khi trigger thay đổi kích thước
  React.useEffect(() => {
    updatePosition();
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('resize', updatePosition);
    };
  }, [updatePosition]);

  // Cập nhật vị trí khi dropdown mở
  React.useEffect(() => {
    if (isOpen) {
      updatePosition();
    }
  }, [isOpen, updatePosition]);

  // Xử lý toggle dropdown
  const handleToggle = () => {
    if (!disabled) {
      setIsOpen((prev) => !prev);
    }
  };

  // Xử lý hover
  const handleMouseEnter = () => {
    if (triggerType === 'hover' && !disabled) {
      setIsOpen(true);
    }
  };

  const handleMouseLeave = () => {
    if (triggerType === 'hover' && !disabled) {
      setIsOpen(false);
    }
  };

  // Xử lý click vào item
  const handleItemClick = () => {
    if (closeOnItemClick) {
      setIsOpen(false);
    }
  };

  // Tính vị trí và căn chỉnh
  const getPositionStyles = (): React.CSSProperties => {
    const style: React.CSSProperties = {
      minWidth: minWidth,
      maxHeight: maxHeight,
    };

    switch (position) {
      case 'top':
        style.bottom = window.innerHeight - coords.y + 8;
        break;
      case 'right':
        style.left = coords.x + coords.width + 8;
        break;
      case 'left':
        style.right = window.innerWidth - coords.x + 8;
        break;
      case 'bottom':
      default:
        style.top = coords.y + coords.height + 8;
        break;
    }

    if (position === 'left' || position === 'right') {
      if (align === 'start') {
        style.top = coords.y;
      } else if (align === 'center') {
        style.top = coords.y + coords.height / 2;
        style.transform = 'translateY(-50%)';
      } else {
        style.top = coords.y + coords.height;
        style.transform = 'translateY(-100%)';
      }
    } else {
      if (align === 'start') {
        style.left = coords.x;
      } else if (align === 'center') {
        style.left = coords.x + coords.width / 2;
        style.transform = 'translateX(-50%)';
      } else {
        style.left = coords.x + coords.width;
        style.transform = 'translateX(-100%)';
      }
    }

    return style;
  };

  if (!isMounted) return null;

  return (
    <>
      <div
        ref={triggerRef}
        onClick={triggerType === 'click' ? handleToggle : undefined}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={cn('inline-block', disabled && 'opacity-50 cursor-not-allowed')}
        style={{ userSelect: 'none' }}
      >
        {trigger}
      </div>

      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            onMouseEnter={triggerType === 'hover' ? handleMouseEnter : undefined}
            onMouseLeave={triggerType === 'hover' ? handleMouseLeave : undefined}
            onClick={handleItemClick}
            className={cn(
              'z-50 fixed bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-md animate-fade-in overflow-auto',
              className
            )}
            style={getPositionStyles()}
            role="menu"
            aria-orientation="vertical"
          >
            {children}
          </div>,
          document.body
        )}
    </>
  );
}

// Sub-components
Dropdown.Item = function DropdownItem({
  children,
  className,
  disabled,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { disabled?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        'w-full text-left px-4 py-2.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2',
        disabled && 'opacity-50 cursor-not-allowed pointer-events-none',
        className
      )}
      role="menuitem"
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};

Dropdown.Header = function DropdownHeader({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

Dropdown.Divider = function DropdownDivider({ className }: { className?: string }) {
  return (
    <div
      className={cn('h-px my-1 bg-gray-200 dark:bg-gray-700', className)}
      role="separator"
    />
  );
};

// Button with dropdown support
export function DropdownButton({
  label,
  icon,
  items,
  variant = 'default',
  size = 'md',
  position = 'bottom',
  align = 'start',
  disabled = false,
  className,
}: {
  label: string;
  icon?: React.ReactNode;
  items: React.ReactNode;
  variant?: 'default' | 'primary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  position?: Position;
  align?: Alignment;
  disabled?: boolean;
  className?: string;
}) {
  const btnClasses = {
    default: 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700',
    primary: 'bg-primary-600 border-primary-600 text-white hover:bg-primary-700 dark:bg-primary-700 dark:border-primary-700 dark:hover:bg-primary-800',
    outline: 'bg-transparent border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800',
  };

  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-2',
    lg: 'text-base px-4 py-2',
  };

  return (
    <Dropdown
      position={position}
      align={align}
      disabled={disabled}
      trigger={
        <button
          type="button"
          className={cn(
            'inline-flex items-center font-medium border rounded transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500',
            btnClasses[variant],
            sizeClasses[size],
            className
          )}
          disabled={disabled}
        >
          {icon && <span className="mr-2">{icon}</span>}
          {label}
          <ChevronDown className="ml-2 -mr-1 h-4 w-4" />
        </button>
      }
    >
      {items}
    </Dropdown>
  );
}

export default Dropdown; 