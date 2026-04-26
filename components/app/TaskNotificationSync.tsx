import { useEffect, useRef } from 'react';
import { sendImmediateTaskNotification } from '@/lib/notifications';
import { useAssignmentsQuery } from '@/lib/queries/useMoodleQueries';
import { useSettingsStore } from '@/lib/stores/settingsStore';

/**
 * TaskNotificationSync — renders nothing, runs as a background sync effect.
 *
 * Fires a local notification when:
 *  • task_open   — a task's openDate has just passed (within 1 h) and the task is not yet submitted.
 *  • task_closing — a task's dueDate is ≤ 30 min away and the task is not yet submitted.
 *
 * Deduplicates via a per-session Set so the same notification is never sent twice
 * within a single app lifecycle.
 */
export function TaskNotificationSync() {
  const notifyTaskOpen = useSettingsStore((state) => state.notifications.notifyTaskOpen);
  const monitoredCourseIds = useSettingsStore((state) => state.monitoredCourseIds);
  const assignmentsQuery = useAssignmentsQuery();
  const notifiedSetRef = useRef(new Set<string>());

  useEffect(() => {
    if (!notifyTaskOpen) {
      return;
    }

    const nowUnix = Math.floor(Date.now() / 1000);
    const OPEN_WINDOW_SECONDS = 60 * 60; // 1 hour
    const CLOSING_SOON_SECONDS = 30 * 60; // 30 minutes

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
          const key = `open-${task.id}`;
          if (!notifiedSetRef.current.has(key)) {
            notifiedSetRef.current.add(key);
            sendImmediateTaskNotification({
              title: 'Tugas/Quiz Sudah Dibuka',
              body: `${task.name} (${task.courseName}) sudah bisa dikerjakan. Segera kerjakan!`,
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
          const key = `closing-${task.id}`;
          if (!notifiedSetRef.current.has(key)) {
            notifiedSetRef.current.add(key);
            const minutesLeft = Math.ceil(secondsLeft / 60);
            sendImmediateTaskNotification({
              title: 'Tugas/Quiz Segera Ditutup',
              body: `${task.name} (${task.courseName}) akan ditutup dalam ${minutesLeft} menit. Segera submit!`,
              kind: 'task_closing',
              taskId: task.id,
            });
          }
        }
      }
    }
  }, [assignmentsQuery.data, monitoredCourseIds, notifyTaskOpen]);

  return null;
}
