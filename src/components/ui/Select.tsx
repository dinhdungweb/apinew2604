'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, Check, X, Search } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
  description?: string;
  icon?: React.ReactNode;
}

export interface SelectGroup {
  label: string;
  options: SelectOption[];
}

export interface SelectProps {
  options: SelectOption[] | SelectGroup[];
  value?: string | string[];
  onChange?: (value: string | string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  label?: string;
  helperText?: string;
  className?: string;
  labelClassName?: string;
  optionsClassName?: string;
  containerClassName?: string;
  multiple?: boolean;
  clearable?: boolean;
  searchable?: boolean;
  maxHeight?: number;
  fullWidth?: boolean;
  size?: 'sm' | 'md' | 'lg';
  required?: boolean;
  name?: string;
  id?: string;
}

export const Select = React.forwardRef<HTMLDivElement, SelectProps>(({
  options,
  value,
  onChange,
  placeholder = 'Vui lòng chọn',
  disabled = false,
  error,
  label,
  helperText,
  className,
  labelClassName,
  optionsClassName,
  containerClassName,
  multiple = false,
  clearable = false,
  searchable = false,
  maxHeight = 250,
  fullWidth = false,
  size = 'md',
  required,
  name,
  id,
}, ref) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const selectRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Merge refs
  const combinedRef = React.useMemo(() => {
    return (node: HTMLDivElement) => {
      if (selectRef.current) selectRef.current = node;
      if (ref) {
        if (typeof ref === 'function') {
          ref(node);
        } else {
          ref.current = node;
        }
      }
    };
  }, [ref]);

  // Helper để kiểm tra xem options có phải là nhóm không
  const isGrouped = React.useMemo(
    () => options.length > 0 && 'options' in options[0],
    [options]
  );

  // Flatten options for search and selection
  const flattenedOptions = React.useMemo(() => {
    if (!isGrouped) return options as SelectOption[];
    return (options as SelectGroup[]).flatMap(group => group.options);
  }, [options, isGrouped]);

  // Filtered options based on search query
  const filteredOptions = React.useMemo(() => {
    if (!searchable || !searchQuery) return options;

    if (isGrouped) {
      return (options as SelectGroup[])
        .map(group => ({
          ...group,
          options: group.options.filter(option =>
            String(option.label || '').toLowerCase().includes(searchQuery.toLowerCase())
          ),
        }))
        .filter(group => group.options.length > 0);
    }

    return (options as SelectOption[]).filter(option =>
      String(option.label || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [options, searchQuery, searchable, isGrouped]);

  // Determine selected option label
  const selectedOptions = React.useMemo(() => {
    if (multiple && Array.isArray(value)) {
      return value.map(val => flattenedOptions.find(opt => opt.value === val)).filter(Boolean) as SelectOption[];
    } else if (!multiple && value) {
      const option = flattenedOptions.find(opt => opt.value === value);
      return option ? [option] : [];
    }
    return [];
  }, [value, flattenedOptions, multiple]);

  // Handle click outside to close dropdown
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        selectRef.current &&
        dropdownRef.current &&
        !selectRef.current.contains(event.target as Node) &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input when dropdown opens
  React.useEffect(() => {
    if (isOpen && searchable && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  }, [isOpen, searchable]);

  // Handle option selection
  const handleOptionClick = (option: SelectOption) => {
    if (option.disabled) return;

    if (multiple && Array.isArray(value)) {
      const isSelected = value.includes(option.value);
      const newValue = isSelected
        ? value.filter(val => val !== option.value)
        : [...value, option.value];
      onChange?.(newValue);
    } else {
      onChange?.(option.value);
      setIsOpen(false);
      setSearchQuery('');
    }
  };

  // Handle clear button click
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (multiple) {
      onChange?.([]);
    } else {
      onChange?.('');
    }
  };

  // Handle toggle dropdown
  const handleToggleDropdown = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
      if (isOpen) {
        setSearchQuery('');
      }
    }
  };

  // Handle key navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setSearchQuery('');
    } else if (e.key === 'Enter' && !isOpen) {
      setIsOpen(true);
    }
  };

  // Size classes
  const sizeClasses = {
    sm: {
      trigger: 'h-8 px-2 text-xs',
      option: 'px-2 py-1 text-xs',
      icon: 'h-3.5 w-3.5',
    },
    md: {
      trigger: 'h-10 px-3 text-sm',
      option: 'px-3 py-2 text-sm',
      icon: 'h-4 w-4',
    },
    lg: {
      trigger: 'h-12 px-4 text-base',
      option: 'px-4 py-2.5 text-base',
      icon: 'h-5 w-5',
    },
  };

  // Helper to render individual option
  function renderOption(option: SelectOption) {
    const isSelected = multiple
      ? Array.isArray(value) && value.includes(option.value)
      : option.value === value;

    return (
      <div
        key={option.value}
        onClick={() => handleOptionClick(option)}
        className={cn(
          'flex items-center justify-between',
          'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700',
          option.disabled && 'opacity-50 cursor-not-allowed pointer-events-none',
          isSelected && 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300',
          sizeClasses[size].option
        )}
        role="option"
        aria-selected={isSelected}
        aria-disabled={option.disabled}
      >
        <div className="flex items-center gap-2 flex-grow">
          {option.icon && <span>{option.icon}</span>}
          <div>
            <div className="font-medium">{option.label}</div>
            {option.description && (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {option.description}
              </div>
            )}
          </div>
        </div>
        {isSelected && (
          <Check className={cn('text-primary-600 dark:text-primary-400', sizeClasses[size].icon)} />
        )}
      </div>
    );
  }

  return (
    <div className={cn('relative', fullWidth && 'w-full', containerClassName)}>
      {/* Label */}
      {label && (
        <label
          htmlFor={id}
          className={cn(
            'mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300',
            disabled && 'opacity-60',
            labelClassName
          )}
        >
          {label}
          {required && <span className="ml-1 text-red-500">*</span>}
        </label>
      )}

      {/* Select trigger */}
      <div
        ref={combinedRef}
        onClick={handleToggleDropdown}
        onKeyDown={handleKeyDown}
        className={cn(
          'flex items-center justify-between gap-1 rounded-md border bg-white transition-all',
          'border-gray-300 dark:border-gray-700 dark:bg-gray-800',
          'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-opacity-50',
          isOpen && 'ring-2 ring-primary-500 ring-opacity-50',
          error && 'border-red-500 focus:ring-red-500',
          disabled && 'cursor-not-allowed opacity-60 bg-gray-100 dark:bg-gray-900',
          sizeClasses[size].trigger,
          fullWidth && 'w-full',
          className
        )}
        tabIndex={disabled ? -1 : 0}
        role="combobox"
        aria-expanded={isOpen}
        aria-disabled={disabled}
        id={id}
      >
        {/* Selected value display */}
        <div className="flex flex-grow items-center gap-1 overflow-hidden">
          {selectedOptions.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {selectedOptions.map((option) => (
                <div
                  key={option.value}
                  className={cn(
                    'flex items-center gap-1',
                    multiple && 'bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-xs'
                  )}
                >
                  {option.icon && <span>{option.icon}</span>}
                  <span className="truncate">{option.label}</span>
                  {multiple && (
                    <button
                      type="button"
                      className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOptionClick(option);
                      }}
                      aria-label={`Remove ${String(option.label)}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <span className="truncate text-gray-500 dark:text-gray-400">
              {placeholder}
            </span>
          )}
        </div>

        {/* Right actions */}
        <div className="flex shrink-0 items-center">
          {/* Clear button */}
          {clearable && selectedOptions.length > 0 && (
            <button
              type="button"
              onClick={handleClear}
              className="mr-1 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
              aria-label="Clear selection"
            >
              <X className={sizeClasses[size].icon} />
            </button>
          )}

          {/* Dropdown indicator */}
          <ChevronDown
            className={cn(
              'text-gray-400 transition-transform',
              isOpen && 'rotate-180',
              sizeClasses[size].icon
            )}
          />
        </div>
      </div>

      {/* Error or helper text */}
      {(error || helperText) && (
        <div className="mt-1.5 text-xs">
          {error ? (
            <p className="text-red-600 dark:text-red-500">{error}</p>
          ) : helperText ? (
            <p className="text-gray-500 dark:text-gray-400">{helperText}</p>
          ) : null}
        </div>
      )}

      {/* Hidden form input for form submission */}
      {name && (
        <input
          type="hidden"
          name={name}
          value={multiple ? (value as string[])?.join(',') : (value as string) || ''}
        />
      )}

      {/* Dropdown menu */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className={cn(
            'absolute mt-1 z-50 w-full overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg',
            'dark:border-gray-700 dark:bg-gray-800',
            optionsClassName
          )}
        >
          {/* Search input */}
          {searchable && (
            <div className="sticky top-0 p-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={16} />
                <input
                  ref={inputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={cn(
                    'w-full rounded-md border border-gray-200 pl-8 pr-2 py-1.5',
                    'dark:border-gray-700 dark:bg-gray-700 text-sm',
                    'focus:outline-none focus:ring-1 focus:ring-primary-500',
                    'placeholder:text-gray-400 dark:placeholder:text-gray-500'
                  )}
                  placeholder="Tìm kiếm..."
                  autoComplete="off"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>
          )}

          {/* Options list */}
          <div
            className="overflow-auto"
            style={{ maxHeight: `${maxHeight}px` }}
            role="listbox"
            aria-multiselectable={multiple}
          >
            {isGrouped ? (
              // Grouped options
              (filteredOptions as SelectGroup[]).map((group) => (
                <div key={group.label} role="group" aria-labelledby={`group-${group.label}`}>
                  <div
                    id={`group-${group.label}`}
                    className="px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 sticky top-0 bg-gray-50 dark:bg-gray-900"
                  >
                    {group.label}
                  </div>
                  {group.options.map((option) => renderOption(option))}
                </div>
              ))
            ) : (
              // Flat options
              (filteredOptions as SelectOption[]).map((option) => renderOption(option))
            )}

            {/* Empty state */}
            {(isGrouped ? 
              (filteredOptions as SelectGroup[]).length === 0 || 
              (filteredOptions as SelectGroup[]).every(group => group.options.length === 0) : 
              (filteredOptions as SelectOption[]).length === 0) && (
              <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 text-center">
                Không có kết quả phù hợp
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

Select.displayName = 'Select';

export default Select; 