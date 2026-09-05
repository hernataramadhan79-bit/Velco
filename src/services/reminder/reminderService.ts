import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';
import { Item } from '../../types/item';
import { isTaskOverdue, isTaskDueToday, parseDueDate, hasSpecificTime } from '../../utils/dateUtils';

const STORAGE_KEY = 'velco_notified_reminders_v1';

class ReminderService {
  private timer: any = null;
  private permissionGranted = false;
  private notifiedRecords: Record<string, string> = {}; // { [itemId]: dueDate }
  private getItemsFn: (() => Item[]) | null = null;
  private onInAppNotifyFn: ((msg: string) => void) | null = null;

  constructor() {
    this.loadNotifiedRecords();
  }

  private loadNotifiedRecords() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.notifiedRecords = JSON.parse(raw);
      }
    } catch {
      this.notifiedRecords = {};
    }
  }

  private saveNotifiedRecords() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.notifiedRecords));
    } catch {
      // ignore
    }
  }

  /**
   * Request native desktop notification permission from the OS
   */
  async ensurePermission(): Promise<boolean> {
    try {
      let granted = await isPermissionGranted();
      if (!granted) {
        const permission = await requestPermission();
        granted = permission === 'granted';
      }
      this.permissionGranted = granted;
      return granted;
    } catch (err) {
      console.warn('Notification permission check failed (running in browser mode?):', err);
      // Fallback to browser Notification if available
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'granted') {
          this.permissionGranted = true;
          return true;
        }
        const res = await Notification.requestPermission();
        this.permissionGranted = res === 'granted';
        return this.permissionGranted;
      }
      return false;
    }
  }

  /**
   * Start periodic background checking (every 30 seconds)
   */
  start(getItems: () => Item[], onInAppNotify?: (msg: string) => void) {
    this.getItemsFn = getItems;
    if (onInAppNotify) this.onInAppNotifyFn = onInAppNotify;

    // Ask permission once on start
    this.ensurePermission();

    // Clear any existing timer
    if (this.timer) {
      clearInterval(this.timer);
    }

    // Run first check after 2 seconds, then every 30 seconds
    setTimeout(() => this.checkTasks(), 2000);
    this.timer = setInterval(() => this.checkTasks(), 30000);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Evaluate all pending tasks against current time
   */
  async checkTasks() {
    if (!this.getItemsFn) return;
    const items = this.getItemsFn();
    const now = new Date();

    const pendingTasks = items.filter(
      (item) => item.type === 'task' && !item.task?.completed && item.task?.dueDate
    );

    for (const task of pendingTasks) {
      const dueDateStr = task.task?.dueDate;
      if (!dueDateStr) continue;

      const due = parseDueDate(dueDateStr);
      if (isNaN(due.getTime())) continue;

      // Has this exact task dueDate already been notified?
      if (this.notifiedRecords[task.id] === dueDateStr) {
        continue;
      }

      // Check overdue distance: if older than 24h, mark notified to avoid flooding on fresh startup
      const diffMs = now.getTime() - due.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      if (diffHours > 24) {
        this.notifiedRecords[task.id] = dueDateStr;
        this.saveNotifiedRecords();
        continue;
      }

      // Check if task is due or overdue
      const isOverdue = isTaskOverdue(dueDateStr, false);
      const isDueToday = isTaskDueToday(dueDateStr, false);
      const hasTime = hasSpecificTime(dueDateStr);

      let shouldNotify = false;

      if (hasTime) {
        // If task has specific time (e.g. 14:00): notify if current time >= due time
        if (now >= due) {
          shouldNotify = true;
        }
      } else {
        // If task is date-only (e.g. today's date): notify once on that day
        if (isDueToday || isOverdue) {
          shouldNotify = true;
        }
      }

      if (shouldNotify) {
        await this.triggerNotification(task, dueDateStr);
      }
    }
  }

  /**
   * Trigger native OS notification and in-app feedback
   */
  private async triggerNotification(task: Item, dueDateStr: string) {
    // Record as notified first to prevent race conditions
    this.notifiedRecords[task.id] = dueDateStr;
    this.saveNotifiedRecords();

    const priorityLabel = task.task?.priority ? `[${task.task.priority.toUpperCase()}] ` : '';
    const title = `Pengingat Tugas: ${priorityLabel}${task.title}`;
    const body = task.content
      ? task.content.slice(0, 100)
      : `Waktu pengerjaan tugas di Velco telah tiba.`;

    // 1. Native Windows Notification via Tauri Plugin
    try {
      if (!this.permissionGranted) {
        await this.ensurePermission();
      }

      sendNotification({
        title,
        body,
      });
    } catch (err) {
      // Browser fallback if Tauri notification fails
      try {
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          new Notification(title, { body });
        }
      } catch (browserErr) {
        console.warn('Failed to send desktop notification:', browserErr);
      }
    }

    // 2. In-App Notification Toast
    if (this.onInAppNotifyFn) {
      this.onInAppNotifyFn(`🔔 ${title}`);
    }
  }

  /**
   * Clear notification record for a rescheduled or reset task
   */
  clearRecord(taskId: string) {
    if (this.notifiedRecords[taskId]) {
      delete this.notifiedRecords[taskId];
      this.saveNotifiedRecords();
    }
  }

  /**
   * Manually test native desktop notification
   */
  async testNotification(title = 'Velco Task Reminder', body = 'Notifikasi pengingat desktop berfungsi normal.') {
    await this.ensurePermission();
    try {
      sendNotification({ title, body });
      if (this.onInAppNotifyFn) {
        this.onInAppNotifyFn(`🔔 ${title}`);
      }
    } catch (err) {
      console.warn('Test notification error:', err);
    }
  }
}

export const reminderService = new ReminderService();
