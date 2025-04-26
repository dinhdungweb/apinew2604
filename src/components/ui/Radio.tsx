'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

// Radio Item Props
export interface RadioProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: React.ReactNode;
  description?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'card';
  error?: string;
  containerClassName?: string;
  labelClassName?: string;
  descriptionClassName?: string;
}

// Radio Group Props
export interface RadioGroupProps {
  children: React.ReactNode;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  name: string;
  className?: string;
  orientation?: 'horizontal' | 'vertical';
  error?: string;
  label?: React.ReactNode;
  required?: boolean;
  disabled?: boolean;
}

const RadioGroupContext = React.createContext<{
  name: string;
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
} | null>(null);

export const Radio = React.forwardRef<HTMLInputElement, RadioProps>(
  ({
    className,
    containerClassName,
    labelClassName,
    descriptionClassName,
    label,
    description,
    size = 'md',
    variant = 'default',
    error,
    disabled,
    ...props
  }, ref) => {
    const radioGroup = React.useContext(RadioGroupContext);
    
    // Use group's name and checked state if available
    const name = radioGroup?.name || props.name;
    const isChecked = 
      props.checked !== undefined 
        ? props.checked 
        : radioGroup?.value === props.value;
    const isDisabled = disabled || radioGroup?.disabled;
    
    // Handle radio change
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      props.onChange?.(e);
      if (e.target.checked && radioGroup?.onChange) {
        radioGroup.onChange(e.target.value);
      }
    };

    // Size classes for radio
    const sizeClasses = {
      sm: {
        radio: 'h-3.5 w-3.5',
        container: 'text-xs',
        spacing: 'gap-1.5',
      },
      md: {
        radio: 'h-4 w-4',
        container: 'text-sm',
        spacing: 'gap-2',
      },
      lg: {
        radio: 'h-5 w-5',
        container: 'text-base',
        spacing: 'gap-2.5',
      },
    };

    // Variant classes
    const variantClasses = {
      default: 'flex items-start',
      card: 'flex items-start p-3 border rounded-md bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700',
    };

    return (
      <div 
        className={cn(
          variantClasses[variant],
          sizeClasses[size].spacing,
          isChecked && variant === 'card' && 'border-primary-500 dark:border-primary-500 bg-primary-50 dark:bg-primary-900/30',
          isDisabled && 'opacity-60 cursor-not-allowed',
          containerClassName
        )}
      >
        <div className="relative flex items-center justify-center flex-shrink-0 pt-0.5">
          <input
            ref={ref}
            type="radio"
            className={cn(
              "appearance-none rounded-full border border-gray-300 dark:border-gray-600",
              "checked:border-primary-500 checked:dark:border-primary-500",
              "checked:after:absolute checked:after:inset-0 checked:after:rounded-full checked:after:flex checked:after:items-center checked:after:justify-center",
              "checked:after:m-auto checked:after:h-1.5 checked:after:w-1.5 checked:after:bg-primary-500 checked:after:dark:bg-primary-400",
              "checked:after:sm:h-1 checked:after:sm:w-1 checked:after:lg:h-2 checked:after:lg:w-2",
              "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800",
              "disabled:cursor-not-allowed disabled:opacity-60",
              error && 'border-red-500 dark:border-red-500',
              sizeClasses[size].radio,
              className
            )}
            disabled={isDisabled}
            name={name}
            checked={isChecked}
            onChange={handleChange}
            aria-describedby={description ? `${props.id}-description` : undefined}
            {...props}
          />
        </div>
        
        {(label || description) && (
          <div>
            {label && (
              <label 
                htmlFor={props.id} 
                className={cn(
                  "font-medium text-gray-900 dark:text-gray-100 cursor-pointer",
                  isDisabled && 'cursor-not-allowed',
                  labelClassName
                )}
              >
                {label}
              </label>
            )}
            
            {description && (
              <p 
                id={`${props.id}-description`}
                className={cn(
                  "text-gray-500 dark:text-gray-400 mt-0.5",
                  size === 'sm' && 'text-xs',
                  size === 'md' && 'text-xs',
                  size === 'lg' && 'text-sm',
                  descriptionClassName
                )}
              >
                {description}
              </p>
            )}
          </div>
        )}
      </div>
    );
  }
);

Radio.displayName = 'Radio';

export const RadioGroup = React.forwardRef<HTMLDivElement, RadioGroupProps>((
  {
    children,
    value,
    defaultValue,
    onChange,
    name,
    className,
    orientation = 'vertical',
    error,
    label,
    required,
    disabled,
    ...props
  },
  ref
) => {
  // Control or uncontrolled handling
  const [stateValue, setStateValue] = React.useState(defaultValue);
  const isControlled = value !== undefined;
  const currentValue = isControlled ? value : stateValue;
  
  // Handle radio change
  const handleChange = (newValue: string) => {
    if (!isControlled) {
      setStateValue(newValue);
    }
    onChange?.(newValue);
  };

  return (
    <div 
      ref={ref}
      className={cn('space-y-2', className)}
      role="radiogroup"
      aria-labelledby={label ? 'radio-group-label' : undefined}
      {...props}
    >
      {label && (
        <div 
          id="radio-group-label" 
          className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2"
        >
          {label}
          {required && <span className="ml-1 text-red-500">*</span>}
        </div>
      )}
      
      <RadioGroupContext.Provider value={{ name, value: currentValue, onChange: handleChange, disabled }}>
        <div 
          className={cn(
            orientation === 'vertical' ? 'flex flex-col space-y-2' : 'flex flex-wrap gap-4'
          )}
        >
          {children}
        </div>
      </RadioGroupContext.Provider>
      
      {error && (
        <p className="mt-1.5 text-xs text-red-600 dark:text-red-500">
          {error}
        </p>
      )}
    </div>
  );
});

RadioGroup.displayName = 'RadioGroup';

export default Radio; 