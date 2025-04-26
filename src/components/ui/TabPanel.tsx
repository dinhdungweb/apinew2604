import React, { ReactNode } from 'react';

interface TabPanelProps {
  children?: ReactNode;
  value: string;
  className?: string;
}

export const TabPanel: React.FC<TabPanelProps> = ({ 
  children, 
  value, 
  className = '' 
}) => {
  return (
    <div 
      role="tabpanel"
      id={`tabpanel-${value}`}
      aria-labelledby={`tab-${value}`}
      className={className}
    >
      {children}
    </div>
  );
}; 