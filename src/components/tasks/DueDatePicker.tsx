import React, { useState, useRef, useEffect } from 'react';
import { Calendar, Clock, X, Check, Bell } from 'lucide-react';
import { formatTaskDueDate, getQuickPresets, formatToInputDatetime } from '../../utils/dateUtils';

interface DueDatePickerProps {
  value: string; // ISO datetime string or YYYY-MM-DD
  onChange: (val: string) => void;
  className?: string;
}

export const DueDatePicker: React.FC<DueDatePickerProps> = ({
  value,
  onChange,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [customVal, setCustomVal] = useState(value || '');
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Sync custom input with prop
  useEffect(() => {
    setCustomVal(value || '');
  }, [value]);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const dueInfo = value ? formatTaskDueDate(value) : null;
  const presets = getQuickPresets();

  const handleSelectPreset = (presetVal: string) => {
    onChange(presetVal);
    setIsOpen(false);
  };

  const handleApplyCustom = () => {
    if (customVal) {
      onChange(customVal);
    }
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setCustomVal('');
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      {/* Trigger Button */}
      {value && dueInfo ? (
        <div
          onClick={() => setIsOpen(!isOpen)}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer select-none group shadow-2xs ${
            dueInfo.status === 'overdue'
              ? 'bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300'
              : dueInfo.status === 'today'
              ? 'bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/50 dark:hover:bg-amber-900/60 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200'
              : 'bg-indigo-50/80 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300'
          }`}
          title={`Due: ${dueInfo.fullDateStr} (Click to change)`}
        >
          {dueInfo.hasTime ? (
            <Clock className="w-3.5 h-3.5 shrink-0" />
          ) : (
            <Calendar className="w-3.5 h-3.5 shrink-0" />
          )}
          <span className="truncate max-w-[130px] font-semibold">{dueInfo.label}</span>

          <button
            type="button"
            onClick={handleClear}
            className="ml-0.5 p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer"
            title="Remove due date"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-medium transition-all cursor-pointer select-none shadow-2xs"
          title="Set date and reminder notification"
        >
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>Due date &amp; reminder</span>
        </button>
      )}

      {/* Popover Card */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 z-40 w-72 p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xl backdrop-blur-md space-y-3 animate-in fade-in zoom-in-95 duration-100 text-xs select-none">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200">
              <Bell className="w-3.5 h-3.5 text-indigo-500" />
              <span>Due Date &amp; Reminder</span>
            </div>
            {value && (
              <button
                type="button"
                onClick={handleClear}
                className="text-[11px] text-rose-500 hover:underline cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          {/* Quick Presets */}
          <div className="space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
              Quick Suggestions
            </span>
            <div className="grid grid-cols-1 gap-1">
              {presets.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectPreset(p.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-300 border border-slate-200/60 dark:border-slate-700/60 text-left transition-colors flex items-center justify-between group cursor-pointer"
                >
                  <span className="font-medium">{p.label}</span>
                  <Clock className="w-3 h-3 text-slate-400 group-hover:text-indigo-500" />
                </button>
              ))}
            </div>
          </div>

          {/* Custom Date & Time Input */}
          <div className="space-y-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
            <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold block">
              Specific Date &amp; Time
            </label>
            <input
              type="datetime-local"
              value={customVal}
              onChange={(e) => setCustomVal(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Popover Actions */}
          <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-2.5 py-1 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-xs"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApplyCustom}
              disabled={!customVal}
              className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-medium transition-colors cursor-pointer flex items-center gap-1 text-xs shadow-2xs"
            >
              <Check className="w-3 h-3" />
              <span>Set Reminder</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
