'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  className?: string;
  showCloseButton?: boolean;
  closeOnBackdropClick?: boolean;
  closeOnEsc?: boolean;
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  className = '',
  showCloseButton = true,
  closeOnBackdropClick = true,
  closeOnEsc = true,
}: ModalProps) {
  const [isMounted, setIsMounted] = React.useState(false);
  const modalRef = React.useRef<HTMLDivElement>(null);

  // Handle ESC key press
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (closeOnEsc && event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Disable scroll on body when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Re-enable scroll when modal is closed
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose, closeOnEsc]);

  // Set mounted state for SSR
  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) return null;

  // Don't render if modal is closed
  if (!isOpen) return null;

  // Close when clicking outside of modal content
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (
      closeOnBackdropClick &&
      modalRef.current &&
      !modalRef.current.contains(e.target as Node)
    ) {
      onClose();
    }
  };

  // Size classes for the modal content
  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    full: 'max-w-full mx-4',
  };

  // Render via portal to avoid z-index issues
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm transition-opacity"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      <div
        ref={modalRef}
        className={cn(
          'bg-white dark:bg-gray-800 rounded-lg shadow-lg w-full animate-fade-in border border-gray-200 dark:border-gray-700',
          sizeClasses[size],
          className
        )}
      >
        {/* Modal header */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            {title && (
              <h3
                id="modal-title"
                className="text-lg font-medium text-gray-900 dark:text-gray-100"
              >
                {title}
              </h3>
            )}
            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded-full text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
                aria-label="Đóng"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        )}

        {/* Modal body */}
        <div className="p-5">{children}</div>
      </div>
    </div>,
    document.body
  );
}

// Sub-components for structured content
Modal.Header = function ModalHeader({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'p-4 border-b border-gray-200 dark:border-gray-700 text-lg font-medium',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

Modal.Body = function ModalBody({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('p-5', className)} {...props}>
      {children}
    </div>
  );
};

Modal.Footer = function ModalFooter({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export default Modal; 