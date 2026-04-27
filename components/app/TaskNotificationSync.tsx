import { useEffect } from 'react';
import { sendImmediateTaskNotification } from '@/lib/notifications';
import { useAssignmentsQuery } from '@/lib/queries/useMoodleQueries';
import { useNotificationDedupeStore } from '@/lib/stores/notificationDedupeStore';
import { useSettingsStore } from '@/lib/stores/settingsStore';

/**
 * TaskNotificationSync — renders nothing, runs as a background sync effect.
 *
 * Fires a local notification when:
 *  • task_open   — a task's openDate has just passed (within 1 h) and the task is not yet submitted.
 *  • task_closing — a task's dueDate is ≤ 30 min away and the task is not yet submitted.
 *
 * Deduplicates via a persisted local key store so the same notification is not
 * re-fired just because the app is force-closed and reopened in the same window.
 */
export function TaskNotificationSync() {
  const notifyTaskOpen = useSettingsStore((state) => state.notifications.notifyTaskOpen);
  const monitoredCourseIds = useSettingsStore((state) => state.monitoredCourseIds);
  const assignmentsQuery = useAssignmentsQuery();
  const dedupeHydrated = useNotificationDedupeStore((state) => state.hydrated);
  const hasKey = useNotificationDedupeStore((state) => state.hasKey);
  const markKey = useNotificationDedupeStore((state) => state.markKey);
  const pruneOlderThan = useNotificationDedupeStore((state) => state.pruneOlderThan);

  useEffect(() => {
    if (!notifyTaskOpen || !dedupeHydrated) {
      return;
    }

    const nowUnix = Math.floor(Date.now() / 1000);
    const OPEN_WINDOW_SECONDS = 60 * 60; // 1 hour
    const CLOSING_SOON_SECONDS = 30 * 60; // 30 minutes
    const retentionCutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;

    pruneOlderThan(retentionCutoff);

    for (const task of assignmentsQuery.data ?? []) {
      const withinMonitoredScope =
        monitoredCourseIds.length === 0 ||
        !task.courseId ||
        monitoredCourseIds.includes(task.courseId);

      if (!withinMonitoredScope) {
        continue;
      }

      if (task.statusResolved === false) {
        continue;
      }

      // Skip already-submitted tasks — no action needed.
      if (task.status === 'submitted') {
        continue;
      }

      // ── task_open ──────────────────────────────────────────────────────────
      // Notify when openDate exists and was crossed within the last hour.
      if (task.openDate && task.openDate > 0) {
        const secondsSinceOpen = nowUnix - task.openDate;
        if (secondsSinceOpen >= 0 && secondsSinceOpen <= OPEN_WINDOW_SECONDS) {
          const key = `task-open-${task.id}-${task.openDate}`;
          if (!hasKey(key)) {
            markKey(key);
            sendImmediateTaskNotification({
              title: 'Tugas Sudah Dibuka',
              body: `${task.name} (${task.courseName}) sudah bisa dikerjakan.`,
              kind: 'task_open',
              taskId: task.id,
            });
          }
        }
      }

      // ── task_closing ───────────────────────────────────────────────────────
      // Notify when dueDate is within 30 minutes from now.
      if (task.dueDate > 0) {
        const secondsLeft = task.dueDate - nowUnix;
        if (secondsLeft > 0 && secondsLeft <= CLOSING_SOON_SECONDS) {
          const key = `task-closing-${task.id}-${task.dueDate}`;
          if (!hasKey(key)) {
            markKey(key);
            const minutesLeft = Math.ceil(secondsLeft / 60);
            sendImmediateTaskNotification({
              title: 'Tugas Segera Ditutup',
              body: `${task.name} (${task.courseName}) akan ditutup dalam ${minutesLeft} menit. Segera kirim tugas Anda.`,
              kind: 'task_closing',
              taskId: task.id,
            });
          }
        }
      }
    }
  }, [assignmentsQuery.data, dedupeHydrated, hasKey, markKey, monitoredCourseIds, notifyTaskOpen, pruneOlderThan]);

  return null;
}
