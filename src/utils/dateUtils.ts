/**
 * Task Due Date & Reminder Utilities for Velco
 */

export type DueStatus = 'overdue' | 'today' | 'upcoming' | 'completed' | 'none';

export interface DueDateInfo {
  label: string;
  status: DueStatus;
  hasTime: boolean;
  timeStr?: string;
  fullDateStr: string;
  relativeStr?: string;
}

export interface SmartPreset {
  id: string;
  label: string;
  sublabel: string;
  timeLabel: string;
  iconType: 'today' | 'tonight' | 'tomorrow' | 'afternoon' | 'weekend' | 'next_week';
  value: string;
}

/**
 * Check if a date string includes a specific time (e.g. contains 'T' or ':')
 */
export function hasSpecificTime(dateStr: string): boolean {
  if (!dateStr) return false;
  return dateStr.includes('T') || dateStr.includes(':');
}

/**
 * Parses a dueDate string into a JavaScript Date object in local time safely.
 */
export function parseDueDate(dueDateStr: string): Date {
  if (!dueDateStr) return new Date(NaN);

  // Pure date 'YYYY-MM-DD'
  if (/^\d{4}-\d{2}-\d{2}$/.test(dueDateStr)) {
    const [year, month, day] = dueDateStr.split('-').map(Number);
    return new Date(year, month - 1, day, 23, 59, 59, 999);
  }

  // If contains timezone offset or Z suffix (ISO UTC/Offset), use standard Date parser
  if (/[zZ]$|[+-]\d{2}:\d{2}$/.test(dueDateStr)) {
    return new Date(dueDateStr);
  }

  // 'YYYY-MM-DDTHH:mm' or 'YYYY-MM-DD HH:mm'
  const match = dueDateStr.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (match) {
    const [, y, m, d, hr, min, sec] = match;
    return new Date(Number(y), Number(m) - 1, Number(d), Number(hr), Number(min), Number(sec || 0));
  }

  return new Date(dueDateStr);
}

/**
 * Determines if a task is overdue
 */
export function isTaskOverdue(dueDate: string | null | undefined, completed?: boolean): boolean {
  if (completed || !dueDate) return false;
  const due = parseDueDate(dueDate);
  if (isNaN(due.getTime())) return false;

  const now = new Date();
  if (!hasSpecificTime(dueDate)) {
    const endOfDueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate(), 23, 59, 59, 999);
    return now > endOfDueDay;
  }

  return now > due;
}

/**
 * Determines if a task is due today
 */
export function isTaskDueToday(dueDate: string | null | undefined, completed?: boolean): boolean {
  if (completed || !dueDate) return false;
  const due = parseDueDate(dueDate);
  if (isNaN(due.getTime())) return false;

  const now = new Date();
  return (
    due.getFullYear() === now.getFullYear() &&
    due.getMonth() === now.getMonth() &&
    due.getDate() === now.getDate()
  );
}

/**
 * Formats a due date into a human-friendly status and label
 */
export function formatTaskDueDate(
  dueDate: string | null | undefined,
  completed?: boolean
): DueDateInfo {
  if (!dueDate) {
    return {
      label: '',
      status: 'none',
      hasTime: false,
      fullDateStr: '',
    };
  }

  const due = parseDueDate(dueDate);
  if (isNaN(due.getTime())) {
    return {
      label: dueDate,
      status: 'none',
      hasTime: false,
      fullDateStr: dueDate,
    };
  }

  const hasTime = hasSpecificTime(dueDate);
  const timeStr = hasTime
    ? due.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
    : undefined;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());

  const diffTime = dueDay.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  let label = '';
  let status: DueStatus = 'upcoming';

  if (completed) {
    status = 'completed';
    if (diffDays === 0) label = timeStr ? `Completed (Today ${timeStr})` : 'Completed (Today)';
    else if (diffDays === -1) label = 'Completed (Yesterday)';
    else if (diffDays === 1) label = 'Completed (Tomorrow)';
    else label = due.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } else if (isTaskOverdue(dueDate, completed)) {
    status = 'overdue';
    if (diffDays === 0 && hasTime) {
      label = `Overdue (${timeStr})`;
    } else if (diffDays === -1) {
      label = hasTime ? `Overdue (Yesterday ${timeStr})` : 'Overdue (Yesterday)';
    } else if (diffDays < -1) {
      label = `Overdue (${Math.abs(diffDays)}d ago)`;
    } else {
      label = 'Overdue';
    }
  } else if (diffDays === 0) {
    status = 'today';
    label = hasTime ? `Today, ${timeStr}` : 'Today';
  } else if (diffDays === 1) {
    status = 'upcoming';
    label = hasTime ? `Tomorrow, ${timeStr}` : 'Tomorrow';
  } else if (diffDays > 1 && diffDays <= 6) {
    const dayName = due.toLocaleDateString([], { weekday: 'short' });
    label = hasTime ? `${dayName}, ${timeStr}` : dayName;
  } else {
    status = 'upcoming';
    const formatted = due.toLocaleDateString([], { month: 'short', day: 'numeric' });
    label = hasTime ? `${formatted}, ${timeStr}` : formatted;
  }

  // Relative description (e.g. "in 3 hours", "tomorrow morning")
  let relativeStr = '';
  const diffMs = due.getTime() - now.getTime();
  if (diffMs > 0) {
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));
    if (diffHours < 1) {
      const diffMins = Math.max(1, Math.round(diffMs / (1000 * 60)));
      relativeStr = `in ${diffMins} min`;
    } else if (diffHours < 24) {
      relativeStr = `in ${diffHours} hours`;
    } else {
      const d = Math.round(diffHours / 24);
      relativeStr = `in ${d} days`;
    }
  } else {
    const pastHours = Math.round(Math.abs(diffMs) / (1000 * 60 * 60));
    relativeStr = pastHours < 1 ? 'just now' : `${pastHours} hours ago`;
  }

  return {
    label,
    status,
    hasTime,
    timeStr,
    fullDateStr: due.toLocaleString([], {
      dateStyle: 'full',
      timeStyle: hasTime ? 'short' : undefined,
    }),
    relativeStr,
  };
}

/**
 * Returns dynamic smart presets adapted to the current time of day
 */
export function getSmartPresets(): SmartPreset[] {
  const now = new Date();
  const currentHour = now.getHours();

  const presets: SmartPreset[] = [];

  // 1. Today - Later today / Tonight
  if (currentHour < 16) {
    const todayEvening = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 17, 0);
    presets.push({
      id: 'today_evening',
      label: 'This Evening',
      sublabel: 'Today',
      timeLabel: '17:00',
      iconType: 'today',
      value: formatToInputDatetime(todayEvening),
    });
  }

  if (currentHour < 20) {
    const todayTonight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 20, 0);
    presets.push({
      id: 'today_tonight',
      label: 'Tonight',
      sublabel: 'Today',
      timeLabel: '20:00',
      iconType: 'tonight',
      value: formatToInputDatetime(todayTonight),
    });
  }

  // 2. Tomorrow Morning & Afternoon
  const tomorrowPagi = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0);
  presets.push({
    id: 'tomorrow_pagi',
    label: 'Tomorrow Morning',
    sublabel: 'Tomorrow',
    timeLabel: '09:00',
    iconType: 'tomorrow',
    value: formatToInputDatetime(tomorrowPagi),
  });

  const tomorrowSiang = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 13, 0);
  presets.push({
    id: 'tomorrow_siang',
    label: 'Tomorrow Afternoon',
    sublabel: 'Tomorrow',
    timeLabel: '13:00',
    iconType: 'afternoon',
    value: formatToInputDatetime(tomorrowSiang),
  });

  // 3. Weekend (Saturday 10:00)
  const daysUntilSaturday = (6 - now.getDay() + 7) % 7 || 7;
  const weekend = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntilSaturday, 10, 0);
  presets.push({
    id: 'weekend',
    label: 'Weekend',
    sublabel: 'Saturday',
    timeLabel: '10:00',
    iconType: 'weekend',
    value: formatToInputDatetime(weekend),
  });

  // 4. Next Monday (09:00)
  const daysUntilMonday = (1 + 7 - now.getDay()) % 7 || 7;
  const nextMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntilMonday, 9, 0);
  presets.push({
    id: 'next_week',
    label: 'Next Monday',
    sublabel: 'Next Week',
    timeLabel: '09:00',
    iconType: 'next_week',
    value: formatToInputDatetime(nextMonday),
  });

  return presets.slice(0, 6);
}

/**
 * Backward compatibility alias for getQuickPresets
 */
export function getQuickPresets(): { label: string; value: string }[] {
  return getSmartPresets().map((p) => ({
    label: `${p.label} (${p.timeLabel})`,
    value: p.value,
  }));
}

/**
 * Formats a Date object to YYYY-MM-DDTHH:mm
 */
export function formatToInputDatetime(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Formats a Date object to YYYY-MM-DD
 */
export function formatDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formats a Date object to HH:mm
 */
export function formatTimeOnly(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}
