import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useFocusTrap } from './useFocusTrap';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl';
  bodyClassName?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'lg',
  bodyClassName = 'p-4',
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useFocusTrap(containerRef, isVisible && !isAnimatingOut, onClose);

  useEffect(() => {
    if (isOpen) {
      setIsAnimatingOut(false);
      setIsVisible(true);
    } else if (isVisible) {
      setIsAnimatingOut(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        setIsAnimatingOut(false);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isVisible) return null;

  const maxWidthClass = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
  }[maxWidth];

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 transform-gpu select-none ${
        isAnimatingOut ? 'modal-backdrop-exit' : 'modal-backdrop-enter'
      }`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={containerRef}
        className={`relative w-full max-w-full ${maxWidthClass} bg-white dark:bg-[#141418] rounded-xl shadow-2xl border border-slate-200 dark:border-white/[0.1] overflow-hidden flex flex-col max-h-[90vh] z-10 text-slate-900 dark:text-zinc-100 ${
          isAnimatingOut ? 'modal-content-exit' : 'modal-content-enter'
        }`}
      >
        {title && (
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-white/[0.07] bg-slate-50 dark:bg-[#101014]">
            <div id="modal-title" className="font-mono text-xs font-semibold text-slate-800 dark:text-zinc-200 uppercase tracking-wider">
              {title}
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded text-slate-400 hover:text-slate-700 dark:text-zinc-500 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-3.5 h-3.5 stroke-[1.5]" />
            </button>
          </div>
        )}
        <div className="overflow-y-auto overflow-x-hidden flex-1 text-xs">
          <div className={bodyClassName}>{children}</div>
        </div>
      </div>
    </div>
  );
};
