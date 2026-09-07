import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';
import { Item } from '../../types/item';
import { isTaskOverdue, isTaskDueToday, parseDueDate, hasSpecificTime } from '../../utils/dateUtils';
import { playReminderChime } from '../../utils/audioUtils';

const STORAGE_KEY = 'velco_notified_reminders_v1';

class ReminderService {
  private timer: any = null;
  private permissionGranted = false;
  private notifiedRecords: Record<string, string> = {}; // { [itemId]: dueDate }
  private getItemsFn: (() => Promise<Item[]> | Item[]) | null = null;
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
   * Check if notification permission is currently granted
   */
  async checkPermissionStatus(): Promise<boolean> {
    try {
      const granted = await isPermissionGranted();
      this.permissionGranted = granted;
      return granted;
    } catch {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        const granted = Notification.permission === 'granted';
        this.permissionGranted = granted;
        return granted;
      }
      return false;
    }
  }

  /**
   * Request native desktop notification permission from the OS (best triggered from user gesture)
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
      console.warn('Notification permission check failed:', err);
      // Fallback to browser Notification if available
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'granted') {
          this.permissionGranted = true;
          return true;
        }
        try {
          const res = await Notification.requestPermission();
          this.permissionGranted = res === 'granted';
          return this.permissionGranted;
        } catch {
          return false;
        }
      }
      return false;
    }
  }

  /**
   * Start periodic background checking (every 30 seconds)
   */
  start(getItems: () => Promise<Item[]> | Item[], onInAppNotify?: (msg: string) => void) {
    this.getItemsFn = getItems;
    if (onInAppNotify) this.onInAppNotifyFn = onInAppNotify;

    // Check permission status
    this.checkPermissionStatus().catch(() => {});

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
    const items = await this.getItemsFn();
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
   * Trigger native OS notification and in-app feedback + audio chime
   */
  private async triggerNotification(task: Item, dueDateStr: string) {
    // Record as notified first to prevent duplicate alerts
    this.notifiedRecords[task.id] = dueDateStr;
    this.saveNotifiedRecords();

    const priorityLabel = task.task?.priority ? `[${task.task.priority.toUpperCase()}] ` : '';
    const title = `Task Reminder: ${priorityLabel}${task.title}`;
    const body = task.content
      ? task.content.slice(0, 100)
      : `Due time has arrived for your task in Velco.`;

    // 1. Play audible notification chime
    playReminderChime();

    // 2. Native Windows Notification via Tauri Plugin / Web API
    try {
      if (!this.permissionGranted) {
        await this.ensurePermission();
      }

      sendNotification({
        title,
        body,
      });
    } catch {
      // Browser fallback if Tauri notification fails
      try {
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          new Notification(title, { body });
        }
      } catch (browserErr) {
        console.warn('Failed to send desktop notification:', browserErr);
      }
    }

    // 3. In-App Notification Toast
    if (this.onInAppNotifyFn) {
      this.onInAppNotifyFn(title);
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
   * Clear all notification history (useful when testing)
   */
  clearAllRecords() {
    this.notifiedRecords = {};
    this.saveNotifiedRecords();
  }

  /**
   * Manually test native desktop notification & audio chime (triggered by user click)
   */
  async testNotification(
    title = 'Velco Task Reminder',
    body = 'Desktop reminder notifications & audio chime are working normally.'
  ): Promise<{ granted: boolean }> {
    // 1. Play sound immediately
    playReminderChime();

    // 2. Request / Ensure permission via user gesture
    const granted = await this.ensurePermission();

    // 3. Send desktop notification
    try {
      sendNotification({ title, body });
    } catch {
      try {
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          new Notification(title, { body });
        }
      } catch (err) {
        console.warn('Test notification error:', err);
      }
    }

    // 4. Trigger in-app notification feedback
    if (this.onInAppNotifyFn) {
      this.onInAppNotifyFn(title);
    }

    return { granted };
  }
}

export const reminderService = new ReminderService();
