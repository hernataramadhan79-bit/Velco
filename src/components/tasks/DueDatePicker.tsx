import React, { useState, useRef, useEffect } from 'react';
import {
  Calendar,
  Clock,
  X,
  Check,
  Bell,
  Sun,
  Moon,
  Sunrise,
  Coffee,
  CalendarDays,
  Rocket,
  AlertCircle,
} from 'lucide-react';
import {
  formatTaskDueDate,
  getSmartPresets,
  formatToInputDatetime,
  formatDateOnly,
  formatTimeOnly,
  parseDueDate,
  hasSpecificTime,
  SmartPreset,
} from '../../utils/dateUtils';

interface DueDatePickerProps {
  value: string; // ISO datetime string or YYYY-MM-DD
  onChange: (val: string) => void;
  className?: string;
  align?: 'left' | 'right';
}

export const DueDatePicker: React.FC<DueDatePickerProps> = ({
  value,
  onChange,
  className = '',
  align = 'right',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Form state inside popover
  const [datePart, setDatePart] = useState('');
  const [timePart, setTimePart] = useState('09:00');
  const [includeTime, setIncludeTime] = useState(true);

  // Synchronize internal state when popover opens or `value` changes
  useEffect(() => {
    if (value) {
      const parsed = parseDueDate(value);
      if (!isNaN(parsed.getTime())) {
        setDatePart(formatDateOnly(parsed));
        if (hasSpecificTime(value)) {
          setTimePart(formatTimeOnly(parsed));
          setIncludeTime(true);
        } else {
          setTimePart('18:00');
          setIncludeTime(false);
        }
        return;
      }
    }

    // Default when empty: Tomorrow 09:00
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setDatePart(formatDateOnly(tomorrow));
    setTimePart('09:00');
    setIncludeTime(true);
  }, [value, isOpen]);

  // Click outside to close popover
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
  const presets = getSmartPresets();

  // 1-Click Preset Selection
  const handleSelectPreset = (preset: SmartPreset) => {
    onChange(preset.value);
    setIsOpen(false);
  };

  // Quick Date Shortcut buttons (Hari Ini, Besok, Lusa)
  const handleSetQuickDate = (daysAhead: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    setDatePart(formatDateOnly(d));
  };

  // Quick Time Shortcut buttons (09:00, 13:00, 17:00, 20:00)
  const handleSetQuickTime = (hhmm: string) => {
    setTimePart(hhmm);
    setIncludeTime(true);
  };

  // Adjust time by +/- 15 minutes
  const handleAdjustMinutes = (delta: number) => {
    const [h, m] = (timePart || '09:00').split(':').map(Number);
    const totalMinutes = (h * 60 + m + delta + 1440) % 1440;
    const newH = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
    const newM = String(totalMinutes % 60).padStart(2, '0');
    setTimePart(`${newH}:${newM}`);
    setIncludeTime(true);
  };

  // Apply custom schedule
  const handleApplyCustom = () => {
    if (!datePart) return;
    let finalValue = datePart;
    if (includeTime && timePart) {
      finalValue = `${datePart}T${timePart}`;
    }
    onChange(finalValue);
    setIsOpen(false);
  };

  // Clear date
  const handleClear = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    onChange('');
    setIsOpen(false);
  };

  // Helper icon for preset card
  const getPresetIcon = (type: SmartPreset['iconType']) => {
    switch (type) {
      case 'today':
        return <Sun className="w-3.5 h-3.5 text-amber-500" />;
      case 'tonight':
        return <Moon className="w-3.5 h-3.5 text-indigo-400" />;
      case 'tomorrow':
        return <Sunrise className="w-3.5 h-3.5 text-blue-500" />;
      case 'afternoon':
        return <Coffee className="w-3.5 h-3.5 text-amber-600" />;
      case 'weekend':
        return <CalendarDays className="w-3.5 h-3.5 text-emerald-500" />;
      case 'next_week':
        return <Rocket className="w-3.5 h-3.5 text-purple-500" />;
      default:
        return <Clock className="w-3.5 h-3.5 text-blue-500" />;
    }
  };

  // Live preview inside popover
  const previewDueDate = datePart
    ? includeTime && timePart
      ? `${datePart}T${timePart}`
      : datePart
    : '';
  const previewInfo = previewDueDate ? formatTaskDueDate(previewDueDate) : null;

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      {/* Trigger Button */}
      {value && dueInfo ? (
        <div
          onClick={() => setIsOpen(!isOpen)}
          className={`group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all cursor-pointer select-none shadow-2xs hover:shadow-xs active:scale-98 ${
            dueInfo.status === 'overdue'
              ? 'bg-rose-50 hover:bg-rose-100/90 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 ring-1 ring-rose-400/20'
              : dueInfo.status === 'today'
              ? 'bg-amber-50 hover:bg-amber-100/90 dark:bg-amber-950/50 dark:hover:bg-amber-900/60 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200 ring-1 ring-amber-400/20'
              : 'bg-indigo-50/90 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-400/20'
          }`}
          title={`Jadwal: ${dueInfo.fullDateStr} (${dueInfo.relativeStr || ''}) — Klik untuk mengubah`}
        >
          {dueInfo.status === 'overdue' ? (
            <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0 animate-pulse" />
          ) : dueInfo.hasTime ? (
            <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
          ) : (
            <Calendar className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
          )}

          <span className="truncate max-w-[140px] tracking-tight">{dueInfo.label}</span>

          <button
            type="button"
            onClick={handleClear}
            className="ml-0.5 p-0.5 rounded-md hover:bg-black/10 dark:hover:bg-white/10 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
            title="Hapus batas waktu"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/90 dark:bg-slate-800/80 dark:hover:bg-slate-800 border border-slate-200/90 dark:border-slate-700/80 text-slate-600 dark:text-slate-300 text-xs font-medium transition-all cursor-pointer select-none shadow-2xs hover:border-indigo-400 dark:hover:border-indigo-500 active:scale-98"
          title="Atur jadwal dan pengingat notifikasi"
        >
          <Calendar className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
          <span>Jadwal &amp; Pengingat</span>
        </button>
      )}

      {/* Popover Card */}
      {isOpen && (
        <div
          className={`absolute ${
            align === 'right' ? 'right-0' : 'left-0'
          } top-full mt-2 z-50 w-[340px] p-3.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl space-y-3.5 animate-in fade-in zoom-in-95 duration-150 text-xs select-none`}
        >
          {/* Popover Header */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-2xs">
                <Bell className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="font-semibold text-slate-800 dark:text-slate-200 text-xs leading-none">
                  Atur Pengingat Tugas
                </div>
                <div className="text-[10px] text-slate-400 font-medium leading-none mt-1">
                  Windows Native Push &amp; In-App Toast
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {value && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="px-2 py-0.5 rounded-md text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 transition-colors cursor-pointer"
                  title="Hapus batas waktu"
                >
                  Hapus
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Section 1: 1-Click Smart Presets Grid */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                Pilihan Cepat (1-Klik)
              </span>
              <span className="text-[10px] text-indigo-500 font-medium">Auto-apply</span>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {presets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectPreset(p)}
                  className="px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-indigo-50/80 dark:hover:bg-indigo-950/60 border border-slate-200/70 dark:border-slate-700/60 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all text-left flex items-center justify-between group cursor-pointer active:scale-98 shadow-2xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="p-1 rounded-lg bg-white dark:bg-slate-800 shadow-2xs group-hover:scale-110 transition-transform shrink-0">
                      {getPresetIcon(p.iconType)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-300 truncate text-[11px]">
                        {p.label}
                      </div>
                      <div className="text-[10px] text-slate-400 font-medium">
                        {p.sublabel}
                      </div>
                    </div>
                  </div>

                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-white dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border border-slate-200/50 dark:border-slate-700/50 shrink-0 ml-1">
                    {p.timeLabel}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Section 2: Custom Date & Time Controls */}
          <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                Tanggal &amp; Waktu Khusus
              </span>
            </div>

            {/* Quick Day Chips */}
            <div className="flex items-center gap-1">
              {[
                { label: 'Hari Ini', days: 0 },
                { label: 'Besok', days: 1 },
                { label: 'Lusa', days: 2 },
              ].map((chip) => {
                const testDate = new Date();
                testDate.setDate(testDate.getDate() + chip.days);
                const isSelected = datePart === formatDateOnly(testDate);
                return (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => handleSetQuickDate(chip.days)}
                    className={`flex-1 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-blue-600 text-white font-semibold border-blue-600 shadow-2xs'
                        : 'bg-slate-100/80 dark:bg-slate-800/60 hover:bg-slate-200 dark:hover:bg-slate-700/70 border-slate-200/60 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>

            {/* Date Input */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="date"
                  value={datePart}
                  onChange={(e) => setDatePart(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                />
              </div>
            </div>

            {/* Time Toggle & Picker */}
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeTime}
                    onChange={(e) => setIncludeTime(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-600 cursor-pointer"
                  />
                  <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                    Sertakan Jam Pengingat
                  </span>
                </label>

                {includeTime && (
                  <span className="text-[10px] font-mono text-indigo-500 font-semibold">
                    {timePart} WIB
                  </span>
                )}
              </div>

              {includeTime && (
                <div className="space-y-2 animate-in fade-in duration-100">
                  {/* Quick Hour Chips */}
                  <div className="grid grid-cols-4 gap-1">
                    {[
                      { label: '09:00', sub: 'Pagi' },
                      { label: '13:00', sub: 'Siang' },
                      { label: '17:00', sub: 'Sore' },
                      { label: '20:00', sub: 'Malam' },
                    ].map((t) => {
                      const isTimeSelected = timePart === t.label;
                      return (
                        <button
                          key={t.label}
                          type="button"
                          onClick={() => handleSetQuickTime(t.label)}
                          className={`py-1 px-1 rounded-lg text-center transition-all cursor-pointer border ${
                            isTimeSelected
                              ? 'bg-indigo-600 text-white font-semibold border-indigo-600 shadow-2xs'
                              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                          }`}
                        >
                          <div className="text-[11px] font-mono leading-none">{t.label}</div>
                          <div className={`text-[9px] mt-0.5 ${isTimeSelected ? 'text-indigo-200' : 'text-slate-400'}`}>
                            {t.sub}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Time Input with Micro-Adjusters */}
                  <div className="flex items-center gap-1.5">
                    <div className="relative flex-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="time"
                        value={timePart}
                        onChange={(e) => setTimePart(e.target.value)}
                        className="w-full pl-8 pr-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs font-mono font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAdjustMinutes(-15)}
                      className="px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-mono font-medium transition-colors cursor-pointer"
                      title="Kurang 15 menit"
                    >
                      -15m
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAdjustMinutes(15)}
                      className="px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-mono font-medium transition-colors cursor-pointer"
                      title="Tambah 15 menit"
                    >
                      +15m
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Live Preview & Status */}
          {previewInfo && previewInfo.status !== 'none' && (
            <div className="p-2.5 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200/70 dark:border-indigo-800/60 space-y-1">
              <div className="flex items-center gap-1.5 text-indigo-900 dark:text-indigo-200 font-semibold text-[11px]">
                <Clock className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <span className="truncate">{previewInfo.fullDateStr}</span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-indigo-700/80 dark:text-indigo-300/80">
                <span>Status: {previewInfo.label}</span>
                {previewInfo.relativeStr && (
                  <span className="font-medium bg-indigo-200/50 dark:bg-indigo-900/50 px-1.5 py-0.2 rounded text-indigo-800 dark:text-indigo-200">
                    {previewInfo.relativeStr}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Section 4: Popover Footer Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-3 py-1.5 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-xs font-medium"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleApplyCustom}
              disabled={!datePart}
              className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-semibold transition-all cursor-pointer flex items-center gap-1.5 text-xs shadow-md shadow-blue-500/20 active:scale-98"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Terapkan Jadwal</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
