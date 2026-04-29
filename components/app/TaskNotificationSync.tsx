import { useEffect } from 'react';
import { sendImmediateTaskNotification } from '@/lib/notifications';
import { useAssignmentsQuery } from '@/lib/queries/useMoodleQueries';
import { useNotificationDedupeStore } from '@/lib/stores/notificationDedupeStore';
import { useSettingsStore } from '@/lib/stores/settingsStore';

/**
 * TaskNotificationSync — renders nothing, runs as a background sync effect.
 *
 * Fires a local notification when:
 *  • task_open   — a task's openDate was crossed within the last 24 hours and the task is not yet submitted.
 *  • task_closing — a task's dueDate is ≤ 30 min away and the task is not yet submitted.
 *
 * Deduplicates via a persisted local key store so the same notification is not
 * re-fired just because the app is force-closed and reopened in the same window.
 *
 * NOTE: task_open fires even when statusResolved is false (pre-hydration), because
 * the only guard required is that the task hasn't been submitted. task_closing is
 * guarded by statusResolved to avoid notifying already-submitted tasks before hydration.
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
    const OPEN_WINDOW_SECONDS = 24 * 60 * 60; // 24 hours — notify on the same calendar day the task opens
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

      // Skip already-submitted tasks — no action needed.
      // Note: we intentionally do NOT skip statusResolved === false here, because
      // task_open notifications must fire even before hydration finishes. The
      // only guard we need is that the task is not already submitted.
      if (task.status === 'submitted') {
        continue;
      }

      // ── task_open ──────────────────────────────────────────────────────────
      // Notify once on the same calendar day the task opens (within 24 h of openDate).
      // The dedupe key includes openDate so this fires at most once per task opening.
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

      // task_closing requires confirmed submission status to avoid notifying
      // already-submitted tasks whose hydration hasn't finished yet.
      if (task.statusResolved === false) {
        continue;
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
