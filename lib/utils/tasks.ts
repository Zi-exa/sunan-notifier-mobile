import { AssignmentItem, AssignmentStatus } from '@/types/moodle';
import { startOfTodayMs } from '@/lib/utils/date';

export function mapSubmissionToStatus(
  submissionStatus: string | undefined,
  dueDate: number,
  nowMs = Date.now()
): AssignmentStatus {
  if (!submissionStatus) {
    const isLate = dueDate > 0 && dueDate * 1000 < nowMs;
    return isLate ? 'overdue' : 'pending';
  }

  if (submissionStatus === 'submitted') {
    return 'submitted';
  }

  if (submissionStatus === 'new' || submissionStatus === 'draft') {
    const isLate = dueDate > 0 && dueDate * 1000 < nowMs;
    return isLate ? 'overdue' : 'pending';
  }

  return 'unknown';
}

export function sortAssignmentsByDeadline(items: AssignmentItem[]): AssignmentItem[] {
  const nowUnixSeconds = Math.floor(Date.now() / 1000);

  return [...items].sort((a, b) => {
    const aHasDueDate = a.dueDate > 0;
    const bHasDueDate = b.dueDate > 0;

    if (!aHasDueDate && !bHasDueDate) {
      return a.name.localeCompare(b.name);
    }

    if (!aHasDueDate) {
      return 1;
    }

    if (!bHasDueDate) {
      return -1;
    }

    const aSubmitted = a.status === 'submitted';
    const bSubmitted = b.status === 'submitted';
    if (aSubmitted !== bSubmitted) {
      return aSubmitted ? 1 : -1;
    }

    const aDistance = Math.abs(a.dueDate - nowUnixSeconds);
    const bDistance = Math.abs(b.dueDate - nowUnixSeconds);
    if (aDistance !== bDistance) {
      return aDistance - bDistance;
    }

    const aPastDue = a.dueDate < nowUnixSeconds;
    const bPastDue = b.dueDate < nowUnixSeconds;
    if (aPastDue !== bPastDue) {
      return aPastDue ? -1 : 1;
    }

    if (a.dueDate !== b.dueDate) {
      return a.dueDate - b.dueDate;
    }

    if (a.status !== b.status) {
      const statusOrder: Record<AssignmentStatus, number> = {
        overdue: 0,
        pending: 1,
        unknown: 2,
        submitted: 3,
      };

      return statusOrder[a.status] - statusOrder[b.status];
    }

    if (a.courseName !== b.courseName) {
      return a.courseName.localeCompare(b.courseName, 'id-ID');
    }

    return a.name.localeCompare(b.name, 'id-ID');
  });
}

export function countPendingAssignments(items: AssignmentItem[]): number {
  // Only count 'pending' — overdue tasks have their own separate KPI card on the dashboard.
  // This also matches the 'Belum Dikerjakan' filter in the tasks tab which filters by 'pending' only.
  return items.filter((item) => item.status === 'pending').length;
}

export function areAssignmentStatusesResolved(items: AssignmentItem[]): boolean {
  return items.every((item) => item.statusResolved !== false);
}

export function shouldSendH1Reminder(dueDateUnixSeconds: number, nowMs = Date.now()): boolean {
  if (!dueDateUnixSeconds) {
    return false;
  }

  const todayStart = startOfTodayMs(nowMs);
  const tomorrowStart = todayStart + 24 * 60 * 60 * 1000;
  const dayAfterTomorrowStart = tomorrowStart + 24 * 60 * 60 * 1000;
  const dueMs = dueDateUnixSeconds * 1000;

  return dueMs >= tomorrowStart && dueMs < dayAfterTomorrowStart;
}

export function shouldSendTodayReminder(dueDateUnixSeconds: number, nowMs = Date.now()): boolean {
  if (!dueDateUnixSeconds) {
    return false;
  }

  const todayStart = startOfTodayMs(nowMs);
  const tomorrowStart = todayStart + 24 * 60 * 60 * 1000;
  const dueMs = dueDateUnixSeconds * 1000;

  return dueMs >= todayStart && dueMs < tomorrowStart;
}
