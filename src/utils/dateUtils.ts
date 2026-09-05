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
}

/**
 * Check if a date string includes a specific time (e.g. contains 'T' or ':')
 */
export function hasSpecificTime(dateStr: string): boolean {
  return dateStr.includes('T') || dateStr.includes(':');
}

/**
 * Parses a dueDate string into a JavaScript Date object safely.
 */
export function parseDueDate(dueDateStr: string): Date {
  // If it's pure date format 'YYYY-MM-DD', treat as end of day or specific local date
  if (/^\d{4}-\d{2}-\d{2}$/.test(dueDateStr)) {
    const [year, month, day] = dueDateStr.split('-').map(Number);
    return new Date(year, month - 1, day, 23, 59, 59, 999);
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
  // If the due date doesn't have a specific time, it's overdue only after the day ends
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
    if (diffDays === 0) label = timeStr ? `Today ${timeStr}` : 'Today';
    else if (diffDays === -1) label = 'Yesterday';
    else if (diffDays === 1) label = 'Tomorrow';
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

  return {
    label,
    status,
    hasTime,
    timeStr,
    fullDateStr: due.toLocaleString([], {
      dateStyle: 'medium',
      timeStyle: hasTime ? 'short' : undefined,
    }),
  };
}

/**
 * Returns preset dates for quick selection
 */
export function getQuickPresets(): { label: string; value: string }[] {
  const now = new Date();

  // 1. Today Afternoon (14:00) or Evening (18:00)
  const today18 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18, 0);
  const today18Str = formatToInputDatetime(today18);

  // 2. Tomorrow 09:00
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0);
  const tomorrowStr = formatToInputDatetime(tomorrow);

  // 3. Next Monday 09:00
  const nextMon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + ((1 + 7 - now.getDay()) % 7 || 7), 9, 0);
  const nextMonStr = formatToInputDatetime(nextMon);

  return [
    { label: 'Today 18:00', value: today18Str },
    { label: 'Tomorrow 09:00', value: tomorrowStr },
    { label: 'Next Week', value: nextMonStr },
  ];
}

/**
 * Formats a Date object to YYYY-MM-DDTHH:mm for <input type="datetime-local">
 */
export function formatToInputDatetime(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}
