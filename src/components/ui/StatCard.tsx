import React, { ReactNode } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  change?: {
    value: number;
    type: 'increase' | 'decrease' | 'neutral';
  };
  icon?: ReactNode;
  prefix?: string;
  suffix?: string;
  className?: string;
  onClick?: () => void;
}

export default function StatCard({ 
  title, 
  value, 
  subtitle,
  change, 
  icon, 
  prefix = '', 
  suffix = '',
  className = '',
  onClick
}: StatCardProps) {
  const getTrendColor = () => {
    if (!change) return '';
    return change.type === 'increase' 
      ? 'text-success-500 dark:text-success-400' 
      : change.type === 'decrease' 
        ? 'text-danger-500 dark:text-danger-400' 
        : 'text-gray-500 dark:text-gray-400';
  };

  const getTrendIcon = () => {
    if (!change) return null;
    return change.type === 'increase' 
      ? <TrendingUp className="w-4 h-4" /> 
      : change.type === 'decrease' 
        ? <TrendingDown className="w-4 h-4" /> 
        : <Minus className="w-4 h-4" />;
  };

  return (
    <div 
      className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-soft hover:shadow-card transition-shadow p-4 md:p-6 ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
    >
      <div className="flex justify-between items-start">
        <div>
          <p className="text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
          <h3 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mt-1 md:mt-2">
            {prefix}{value}{suffix}
          </h3>
          
          {subtitle && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>
          )}
          
          {change && (
            <div className={`flex items-center mt-1 md:mt-2 ${getTrendColor()}`}>
              {getTrendIcon()}
              <span className="text-xs md:text-sm font-medium ml-1">
                {Math.abs(change.value)}%
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400 ml-1 hidden sm:inline">vs lần trước</span>
            </div>
          )}
        </div>
        
        {icon && (
          <div className="p-2 md:p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg text-primary-500 dark:text-primary-400">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
} 