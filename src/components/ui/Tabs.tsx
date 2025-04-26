'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

// Context để quản lý trạng thái active tab
interface TabsContextType {
  activeValue: string;
  setActiveValue: (value: string) => void;
}

const TabsContext = React.createContext<TabsContextType | undefined>(undefined);

interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  onValueChange: (value: string) => void;
}

export function Tabs({ 
  className, 
  value, 
  onValueChange, 
  children,
  ...props 
}: TabsProps) {
  const [activeValue, setActiveValue] = React.useState(value);
  
  React.useEffect(() => {
    setActiveValue(value);
  }, [value]);
  
  const handleValueChange = React.useCallback((newValue: string) => {
    setActiveValue(newValue);
    onValueChange?.(newValue);
  }, [onValueChange]);
  
  return (
    <TabsContext.Provider value={{ activeValue, setActiveValue: handleValueChange }}>
      <div 
        className={cn('space-y-4', className)} 
        data-state={activeValue} 
        {...props}
      >
        {children}
      </div>
    </TabsContext.Provider>
  );
}

// Sửa lỗi "An interface declaring no members is equivalent to its supertype"
interface TabsListProps extends React.HTMLAttributes<HTMLDivElement> {
  // Thêm một tham số không bắt buộc để tránh lỗi interface rỗng
  customProp?: boolean;
}

export function TabsList({ 
  className, 
  ...props 
}: TabsListProps) {
  return (
    <div 
      className={cn(
        'inline-flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 p-1',
        className
      )} 
      {...props} 
    />
  );
}

interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

export function TabsTrigger({ 
  className, 
  value,
  children,
  ...props 
}: TabsTriggerProps) {
  const context = React.useContext(TabsContext);
  
  if (!context) {
    throw new Error('TabsTrigger must be used within a Tabs component');
  }
  
  const { activeValue, setActiveValue } = context;
  const isActive = activeValue === value;
  
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
        isActive
          ? 'bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-50 shadow-sm'
          : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-50',
        className
      )}
      onClick={() => setActiveValue(value)}
      data-state={isActive ? 'active' : 'inactive'}
      {...props}
    >
      {children}
    </button>
  );
}

interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

export function TabsContent({ 
  className, 
  value,
  children,
  ...props 
}: TabsContentProps) {
  const context = React.useContext(TabsContext);
  
  if (!context) {
    throw new Error('TabsContent must be used within a Tabs component');
  }
  
  const { activeValue } = context;
  const isActive = activeValue === value;
  
  if (!isActive) return null;
  
  return (
    <div
      className={cn(
        'mt-2 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2',
        className
      )}
      data-state={isActive ? 'active' : 'inactive'}
      {...props}
    >
      {children}
    </div>
  );
} 