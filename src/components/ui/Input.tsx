'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix'> {
  // Thuộc tính mở rộng
  label?: string;
  helperText?: string;
  error?: string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  fullWidth?: boolean;
  variant?: 'default' | 'filled' | 'outlined';
  size?: 'sm' | 'md' | 'lg';
  containerClassName?: string;
  labelClassName?: string;
  inputContainerClassName?: string;
  helperTextClassName?: string;
  errorClassName?: string;
  // Mở rộng cho password
  isPasswordInput?: boolean;
  showPasswordToggle?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({
    className,
    containerClassName,
    labelClassName,
    inputContainerClassName,
    helperTextClassName,
    errorClassName,
    label,
    helperText,
    error,
    prefix,
    suffix,
    fullWidth = false,
    variant = 'default',
    size = 'md',
    type,
    isPasswordInput = false,
    showPasswordToggle = false,
    disabled,
    ...props
  }, ref) => {
    // State cho password visibility
    const [showPassword, setShowPassword] = React.useState(false);
    const togglePasswordVisibility = () => setShowPassword(!showPassword);

    // Xác định type thực tế cho input
    const actualType = React.useMemo(() => {
      if (isPasswordInput) {
        return showPassword ? 'text' : 'password';
      }
      return type;
    }, [isPasswordInput, showPassword, type]);

    // Tính toán các classes dựa trên props
    const variantClasses = {
      default: 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 focus:border-primary-500 dark:focus:border-primary-500',
      filled: 'bg-gray-100 dark:bg-gray-700 border border-transparent focus:bg-white dark:focus:bg-gray-800 focus:border-primary-500 dark:focus:border-primary-500',
      outlined: 'bg-transparent border border-gray-300 dark:border-gray-700 focus:border-primary-500 dark:focus:border-primary-500',
    };

    const sizeClasses = {
      sm: 'py-1 text-xs',
      md: 'py-2 text-sm',
      lg: 'py-2.5 text-base',
    };

    const paddingClasses = {
      sm: prefix ? 'pl-7' : 'pl-3',
      md: prefix ? 'pl-9' : 'pl-3.5',
      lg: prefix ? 'pl-10' : 'pl-4',
    };

    // Xác định padding bên phải dựa trên suffix hoặc password toggle
    const rightPaddingClass = React.useMemo(() => {
      if (isPasswordInput && showPasswordToggle) {
        return {
          sm: 'pr-7',
          md: 'pr-9',
          lg: 'pr-10',
        }[size];
      }
      if (suffix) {
        return {
          sm: 'pr-7',
          md: 'pr-9',
          lg: 'pr-10',
        }[size];
      }
      return {
        sm: 'pr-3',
        md: 'pr-3.5',
        lg: 'pr-4',
      }[size];
    }, [isPasswordInput, showPasswordToggle, suffix, size]);

    // Định nghĩa kích thước cho prefix/suffix icons
    const iconSizeClass = {
      sm: 'w-4 h-4',
      md: 'w-5 h-5',
      lg: 'w-5 h-5',
    }[size];

    return (
      <div className={cn(
        'flex flex-col',
        fullWidth && 'w-full',
        containerClassName
      )}>
        {/* Label */}
        {label && (
          <label 
            htmlFor={props.id}
            className={cn(
              'mb-1.5 text-gray-700 dark:text-gray-300 font-medium',
              {
                'text-xs': size === 'sm',
                'text-sm': size === 'md' || size === 'lg',
              },
              disabled && 'opacity-60',
              labelClassName
            )}
          >
            {label}
          </label>
        )}
        
        {/* Input container */}
        <div 
          className={cn(
            'relative flex items-center',
            fullWidth && 'w-full',
            inputContainerClassName
          )}
        >
          {/* Prefix */}
          {prefix && (
            <div className="absolute left-0 inset-y-0 flex items-center pl-3">
              <span className={cn("text-gray-500 dark:text-gray-400", iconSizeClass)}>
                {prefix}
              </span>
            </div>
          )}
          
          {/* Input element */}
          <input
            type={actualType}
            ref={ref}
            disabled={disabled}
            className={cn(
              'block w-full rounded-md shadow-sm transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-opacity-50',
              paddingClasses[size],
              rightPaddingClass,
              sizeClasses[size],
              variantClasses[variant],
              error && 'border-red-500 dark:border-red-500 focus:border-red-500 dark:focus:border-red-500 focus:ring-red-500',
              disabled && 'opacity-60 cursor-not-allowed bg-gray-100 dark:bg-gray-800',
              className
            )}
            {...props}
          />
          
          {/* Password toggle */}
          {isPasswordInput && showPasswordToggle && (
            <button
              type="button"
              className={cn(
                "absolute right-0 inset-y-0 flex items-center pr-3",
                "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300",
                disabled && 'opacity-60 cursor-not-allowed'
              )}
              onClick={togglePasswordVisibility}
              disabled={disabled}
              tabIndex={-1}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <EyeOff className={iconSizeClass} />
              ) : (
                <Eye className={iconSizeClass} />
              )}
            </button>
          )}
          
          {/* Suffix */}
          {suffix && !isPasswordInput && (
            <div className="absolute right-0 inset-y-0 flex items-center pr-3">
              <span className={cn("text-gray-500 dark:text-gray-400", iconSizeClass)}>
                {suffix}
              </span>
            </div>
          )}
        </div>
        
        {/* Error or helper text */}
        {(error || helperText) && (
          <div className="mt-1.5">
            {error ? (
              <p className={cn(
                'flex items-center text-red-600 dark:text-red-500',
                {
                  'text-xs': size === 'sm',
                  'text-sm': size === 'md' || size === 'lg',
                },
                errorClassName
              )}>
                <AlertCircle className="w-3.5 h-3.5 mr-1.5" />
                {error}
              </p>
            ) : helperText ? (
              <p className={cn(
                'text-gray-500 dark:text-gray-400',
                {
                  'text-xs': size === 'sm',
                  'text-sm': size === 'md' || size === 'lg',
                },
                helperTextClassName
              )}>
                {helperText}
              </p>
            ) : null}
          </div>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input; 