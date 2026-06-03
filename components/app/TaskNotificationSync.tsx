import { useEffect, useRef } from 'react';
import {
  cancelScheduledNotificationsForKinds,
  scheduleTaskLocalNotification,
  sendImmediateTaskNotification,
} from '@/lib/notifications';
import { useAssignmentsQuery } from '@/lib/queries/useMoodleQueries';
import { useNotificationDedupeStore } from '@/lib/stores/notificationDedupeStore';
import { usePushTokenSyncStore } from '@/lib/stores/pushTokenSyncStore';
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
  const notifyNewTask = useSettingsStore((state) => state.notifications.notifyNewTask);
  const notifyDeadlineH1 = useSettingsStore((state) => state.notifications.notifyDeadlineH1);
  const notifyDeadlineToday = useSettingsStore((state) => state.notifications.notifyDeadlineToday);
  const notifyTaskOpen = useSettingsStore((state) => state.notifications.notifyTaskOpen);
  const monitoredCourseIds = useSettingsStore((state) => state.monitoredCourseIds);
  const pushStatus = usePushTokenSyncStore((state) => state.status);
  const assignmentsQuery = useAssignmentsQuery();
  const dedupeHydrated = useNotificationDedupeStore((state) => state.hydrated);
  const hasKey = useNotificationDedupeStore((state) => state.hasKey);
  const markKey = useNotificationDedupeStore((state) => state.markKey);
  const taskDiscoveryBaselineSeeded = useNotificationDedupeStore(
    (state) => state.taskDiscoveryBaselineSeeded
  );
  const seedTaskDiscoveryBaseline = useNotificationDedupeStore(
    (state) => state.seedTaskDiscoveryBaseline
  );
  const pruneOlderThan = useNotificationDedupeStore((state) => state.pruneOlderThan);
  const pendingKeysRef = useRef(new Set<string>());
  const remoteBackedKindsCancelledRef = useRef(false);

  useEffect(() => {
    if (
      !dedupeHydrated ||
      (!notifyNewTask && !notifyDeadlineH1 && !notifyDeadlineToday && !notifyTaskOpen)
    ) {
      return;
    }

    if (pushStatus !== 'ready') {
      remoteBackedKindsCancelledRef.current = false;
    }

    if (pushStatus === 'ready') {
      if (!remoteBackedKindsCancelledRef.current) {
        remoteBackedKindsCancelledRef.current = true;
        void cancelScheduledNotificationsForKinds([
          'new_task',
          'deadline_h1',
          'deadline_today',
          'task_open',
          'task_closing',
        ]);
      }
      return;
    }

    const nowUnix = Math.floor(Date.now() / 1000);
    const OPEN_FALLBACK_WINDOW_SECONDS = 15 * 60; // keep recovery narrow so old tasks do not spam on app open
    const CLOSING_SOON_SECONDS = 30 * 60; // 30 minutes
    const retentionCutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;

    pruneOlderThan(retentionCutoff);

    if (!taskDiscoveryBaselineSeeded && (assignmentsQuery.data?.length ?? 0) > 0) {
      seedTaskDiscoveryBaseline(
        (assignmentsQuery.data ?? []).map(
          (task) => `task-new-${task.id}-${task.openDate ?? 0}-${task.dueDate}`
        )
      );
    }

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

      // ── new_task ───────────────────────────────────────────────────────────
      // Notify once when a task is first discovered by the app.
      if (notifyNewTask) {
        const key = `task-new-${task.id}-${task.openDate ?? 0}-${task.dueDate}`;
        if (taskDiscoveryBaselineSeeded && !hasKey(key) && !pendingKeysRef.current.has(key)) {
          pendingKeysRef.current.add(key);
          void scheduleTaskLocalNotification(task, 'new_task', { identifier: key }).then((notificationId) => {
            if (notificationId) {
              markKey(key);
            }
            pendingKeysRef.current.delete(key);
          });
        }
      }

      // ── deadline reminders ────────────────────────────────────────────────
      // Schedule once for H-1 and once for the due date at 07:00 local time.
      if (task.dueDate > 0) {
        if (notifyDeadlineH1) {
          const key = `task-deadline-h1-${task.id}-${task.dueDate}`;
          if (!hasKey(key) && !pendingKeysRef.current.has(key)) {
            pendingKeysRef.current.add(key);
            void scheduleTaskLocalNotification(task, 'deadline_h1', { identifier: key }).then((notificationId) => {
              if (notificationId) {
                markKey(key);
              }
              pendingKeysRef.current.delete(key);
            });
          }
        }

        if (notifyDeadlineToday) {
          const key = `task-deadline-today-${task.id}-${task.dueDate}`;
          if (!hasKey(key) && !pendingKeysRef.current.has(key)) {
            pendingKeysRef.current.add(key);
            void scheduleTaskLocalNotification(task, 'deadline_today', { identifier: key }).then((notificationId) => {
              if (notificationId) {
                markKey(key);
              }
              pendingKeysRef.current.delete(key);
            });
          }
        }
      }

      // ── task_open ──────────────────────────────────────────────────────────
      // Prefer scheduling at the actual open time; only fall back to immediate
      // delivery when the open time was crossed very recently.
      if (notifyTaskOpen && task.openDate && task.openDate > 0) {
        const key = `task-open-${task.id}-${task.openDate}`;
        if (!hasKey(key) && !pendingKeysRef.current.has(key)) {
          pendingKeysRef.current.add(key);

          if (task.openDate > nowUnix) {
            void scheduleTaskLocalNotification(task, 'task_open', {
              triggerDate: new Date(task.openDate * 1000),
              identifier: key,
            }).then((notificationId) => {
              if (notificationId) {
                markKey(key);
              }
              pendingKeysRef.current.delete(key);
            });
            continue;
          }

          const secondsSinceOpen = nowUnix - task.openDate;
          if (secondsSinceOpen >= 0 && secondsSinceOpen <= OPEN_FALLBACK_WINDOW_SECONDS) {
            void sendImmediateTaskNotification({
              title: 'Tugas Sudah Dibuka',
              body: `${task.name} (${task.courseName}) sudah bisa dikerjakan.`,
              kind: 'task_open',
              taskId: task.id,
              identifier: key,
            }).then((didSchedule) => {
              if (didSchedule) {
                markKey(key);
              }
              pendingKeysRef.current.delete(key);
            });
            continue;
          }

          if (secondsSinceOpen > OPEN_FALLBACK_WINDOW_SECONDS) {
            markKey(key);
          }

          pendingKeysRef.current.delete(key);
        }
      }

      // task_closing requires confirmed submission status to avoid notifying
      // already-submitted tasks whose hydration hasn't finished yet.
      if (task.statusResolved === false) {
        continue;
      }

      // ── task_closing ───────────────────────────────────────────────────────
      // Schedule at dueDate - 30 minutes when the task is seen early; if the app
      // only sees it inside that window, send immediately.
      if (notifyDeadlineToday && task.dueDate > 0) {
        const secondsLeft = task.dueDate - nowUnix;
        if (secondsLeft > 0) {
          const key = `task-closing-${task.id}-${task.dueDate}`;
          if (!hasKey(key) && !pendingKeysRef.current.has(key)) {
            pendingKeysRef.current.add(key);
            if (secondsLeft <= CLOSING_SOON_SECONDS) {
              const minutesLeft = Math.ceil(secondsLeft / 60);
              void sendImmediateTaskNotification({
                title: 'Tugas Segera Ditutup',
                body: `${task.name} (${task.courseName}) akan ditutup dalam ${minutesLeft} menit. Segera kirim tugas Anda.`,
                kind: 'task_closing',
                taskId: task.id,
              }).then((didSchedule) => {
                if (didSchedule) {
                  markKey(key);
                }
                pendingKeysRef.current.delete(key);
              });
            } else {
              void scheduleTaskLocalNotification(task, 'task_closing', { identifier: key }).then((notificationId) => {
                if (notificationId) {
                  markKey(key);
                }
                pendingKeysRef.current.delete(key);
              });
            }
          }
        }
      }
    }
  }, [
    assignmentsQuery.data,
    dedupeHydrated,
    hasKey,
    markKey,
    monitoredCourseIds,
    notifyDeadlineH1,
    notifyDeadlineToday,
    notifyNewTask,
    notifyTaskOpen,
    pruneOlderThan,
    pushStatus,
    seedTaskDiscoveryBaseline,
    taskDiscoveryBaselineSeeded,
  ]);

  return null;
}
