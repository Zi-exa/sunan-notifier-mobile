import { useEffect, useRef } from 'react';
import {
  cancelScheduledNotificationsForKinds,
  scheduleAttendanceLocalNotification,
  sendImmediateAttendanceNotification,
} from '@/lib/notifications';
import { useAttendanceSessionsQuery } from '@/lib/queries/useMoodleQueries';
import { resolveAttendanceItemStatus } from '@/lib/utils/attendance';
import { useNotificationDedupeStore } from '@/lib/stores/notificationDedupeStore';
import { usePushTokenSyncStore } from '@/lib/stores/pushTokenSyncStore';
import { useSettingsStore } from '@/lib/stores/settingsStore';

function toLocalDateKeyFromUnix(unixSeconds: number): string {
  const date = new Date(unixSeconds * 1000);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
}

/**
 * AttendanceNotificationSync — renders nothing, runs as a background sync effect.
 *
 * Fires a local notification when:
 *  • attendance_h1       — an attendance session is 1 day away.
 *  • attendance_preopen  — an attendance session opens in 1 hour.
 *  • attendance_open     — an upcoming attendance session is scheduled locally
 *                          for its start time when the app discovers it early.
 *  • attendance_open     — an attendance session is currently open and the user hasn't
 *                          attended yet (inferred: Moodle only includes unattended sessions
 *                          in the upcoming view). Deduplicates once per calendar day so
 *                          the notification fires whenever the user opens the app while
 *                          a session is open, but not more than once per day per session.
 *  • attendance_closing  — an open session has ≤ 30 min left. Sends once per window
 *                          and persists that dedupe across app restarts.
 *
 * IMPORTANT: Status is re-derived from startsAt/closesAt at notification time, NOT from
 * the cached `attendance.status` value. The cached value can be stale if the app was
 * backgrounded or the data was pre-loaded at boot time.
 */
export function AttendanceNotificationSync() {
  const notifyAttendance = useSettingsStore((state) => state.notifications.notifyAttendance);
  const monitoredCourseIds = useSettingsStore((state) => state.monitoredCourseIds);
  const pushStatus = usePushTokenSyncStore((state) => state.status);
  const attendanceQuery = useAttendanceSessionsQuery();
  const dedupeHydrated = useNotificationDedupeStore((state) => state.hydrated);
  const hasKey = useNotificationDedupeStore((state) => state.hasKey);
  const markKey = useNotificationDedupeStore((state) => state.markKey);
  const pruneOlderThan = useNotificationDedupeStore((state) => state.pruneOlderThan);
  const pendingKeysRef = useRef(new Set<string>());
  const remoteBackedKindsCancelledRef = useRef(false);

  useEffect(() => {
    if (!notifyAttendance || !dedupeHydrated) {
      return;
    }

    const remotePushReady = pushStatus === 'ready';
    if (!remotePushReady) {
      remoteBackedKindsCancelledRef.current = false;
    }

    if (remotePushReady && !remoteBackedKindsCancelledRef.current) {
      remoteBackedKindsCancelledRef.current = true;
      void cancelScheduledNotificationsForKinds(['attendance_open', 'attendance_closing']);
    }

    const nowUnix = Math.floor(Date.now() / 1000);
    const now = new Date();
    const H1_SECONDS = 24 * 60 * 60;
    const PREOPEN_SECONDS = 60 * 60;
    const OPEN_FALLBACK_WINDOW_SECONDS = 15 * 60;
    const CLOSING_SOON_SECONDS = 30 * 60;
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')}`;
    const retentionCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    pruneOlderThan(retentionCutoff);
    // Use local date string (YYYY-MM-DD) as part of the dedup key so the same
    // session can re-notify once on each calendar day (e.g., app opened next morning
    // while attendance is still open).

    for (const attendance of attendanceQuery.data ?? []) {
      const withinMonitoredScope =
        monitoredCourseIds.length === 0 ||
        !attendance.courseId ||
        monitoredCourseIds.includes(attendance.courseId);

      if (!withinMonitoredScope) {
        continue;
      }

      // Re-derive status in real time from the raw time window fields.
      // The cached attendance.status may be stale if the data was loaded at boot
      // and the session has since transitioned (e.g., upcoming → open → closing_soon).
      const liveStatus = resolveAttendanceItemStatus(attendance, nowUnix);

      // ── attendance_open schedule ─────────────────────────────────────────────
      // If the app sees an upcoming attendance before it opens, schedule a local
      // notification for the actual start time instead of waiting for a later refetch.
      if (liveStatus === 'upcoming' && attendance.startsAt && attendance.startsAt > nowUnix) {
        const reminderDayKey = `h1-${attendance.eventId}-${attendance.startsAt}`;
        const reminderHourKey = `preopen-${attendance.eventId}-${attendance.startsAt}`;
        const openDateKey = toLocalDateKeyFromUnix(attendance.startsAt);
        const key = `open-${attendance.eventId}-${openDateKey}`;
        const h1TriggerUnix = attendance.startsAt - H1_SECONDS;
        const preopenTriggerUnix = attendance.startsAt - PREOPEN_SECONDS;

        if (
          h1TriggerUnix > nowUnix &&
          !hasKey(reminderDayKey) &&
          !pendingKeysRef.current.has(reminderDayKey)
        ) {
          pendingKeysRef.current.add(reminderDayKey);
          void scheduleAttendanceLocalNotification({
            title: 'Absensi Besok',
            body: `${attendance.title} (${attendance.courseName}) dibuka besok. Siapkan absensi Anda.`,
            kind: 'attendance_h1',
            eventId: attendance.eventId,
            triggerDate: new Date(h1TriggerUnix * 1000),
            identifier: reminderDayKey,
          }).then((notificationId) => {
            if (notificationId) {
              markKey(reminderDayKey);
            }
            pendingKeysRef.current.delete(reminderDayKey);
          });
        }

        if (
          preopenTriggerUnix > nowUnix &&
          !hasKey(reminderHourKey) &&
          !pendingKeysRef.current.has(reminderHourKey)
        ) {
          pendingKeysRef.current.add(reminderHourKey);
          void scheduleAttendanceLocalNotification({
            title: 'Absensi 1 Jam Lagi',
            body: `${attendance.title} (${attendance.courseName}) dibuka 1 jam lagi.`,
            kind: 'attendance_preopen',
            eventId: attendance.eventId,
            triggerDate: new Date(preopenTriggerUnix * 1000),
            identifier: reminderHourKey,
          }).then((notificationId) => {
            if (notificationId) {
              markKey(reminderHourKey);
            }
            pendingKeysRef.current.delete(reminderHourKey);
          });
        }

        if (!remotePushReady && !hasKey(key) && !pendingKeysRef.current.has(key)) {
          pendingKeysRef.current.add(key);
          void scheduleAttendanceLocalNotification({
            title: 'Absensi Dibuka',
            body: `${attendance.title} (${attendance.courseName}) sudah dibuka. Segera isi sekarang.`,
            kind: 'attendance_open',
            eventId: attendance.eventId,
            triggerDate: new Date(attendance.startsAt * 1000),
            identifier: key,
          }).then((notificationId) => {
            if (notificationId) {
              markKey(key);
            }
            pendingKeysRef.current.delete(key);
          });
        }

        const secondsSinceH1 = nowUnix - h1TriggerUnix;
        if (
          secondsSinceH1 >= 0 &&
          secondsSinceH1 <= OPEN_FALLBACK_WINDOW_SECONDS &&
          !hasKey(reminderDayKey) &&
          !pendingKeysRef.current.has(reminderDayKey)
        ) {
          pendingKeysRef.current.add(reminderDayKey);
          void sendImmediateAttendanceNotification({
            title: 'Absensi Besok',
            body: `${attendance.title} (${attendance.courseName}) dibuka besok. Siapkan absensi Anda.`,
            kind: 'attendance_h1',
            eventId: attendance.eventId,
          }).then((didSchedule) => {
            if (didSchedule) {
              markKey(reminderDayKey);
            }
            pendingKeysRef.current.delete(reminderDayKey);
          });
        }

        const secondsSincePreopen = nowUnix - preopenTriggerUnix;
        if (
          secondsSincePreopen >= 0 &&
          secondsSincePreopen <= OPEN_FALLBACK_WINDOW_SECONDS &&
          !hasKey(reminderHourKey) &&
          !pendingKeysRef.current.has(reminderHourKey)
        ) {
          pendingKeysRef.current.add(reminderHourKey);
          void sendImmediateAttendanceNotification({
            title: 'Absensi 1 Jam Lagi',
            body: `${attendance.title} (${attendance.courseName}) dibuka 1 jam lagi.`,
            kind: 'attendance_preopen',
            eventId: attendance.eventId,
          }).then((didSchedule) => {
            if (didSchedule) {
              markKey(reminderHourKey);
            }
            pendingKeysRef.current.delete(reminderHourKey);
          });
        }
      }

      const closingKey = attendance.closesAt
        ? `closing-${attendance.eventId}-${attendance.closesAt}`
        : null;
      const closesAtUnix = attendance.closesAt ?? 0;
      const closingTriggerUnix = closesAtUnix > 0 ? closesAtUnix - CLOSING_SOON_SECONDS : 0;

      // ── attendance_closing schedule ────────────────────────────────────────
      // If the close time is still far enough away, schedule it up front.
      if (
        !remotePushReady &&
        closingKey &&
        closesAtUnix > 0 &&
        closingTriggerUnix > nowUnix &&
        !hasKey(closingKey) &&
        !pendingKeysRef.current.has(closingKey)
      ) {
        pendingKeysRef.current.add(closingKey);
        void scheduleAttendanceLocalNotification({
          title: 'Absensi Segera Ditutup',
          body: `${attendance.title} (${attendance.courseName}) akan segera ditutup. Segera isi sekarang.`,
          kind: 'attendance_closing',
          eventId: attendance.eventId,
          triggerDate: new Date(closingTriggerUnix * 1000),
          identifier: closingKey,
        }).then((notificationId) => {
          if (notificationId) {
            markKey(closingKey);
          }
          pendingKeysRef.current.delete(closingKey);
        });
      }

      // ── attendance_open immediate ────────────────────────────────────────────
      // Only recover immediately if the open time was crossed recently. This
      // avoids blasting long-open sessions whenever the app refreshes.
      if (!remotePushReady && (liveStatus === 'open' || liveStatus === 'available')) {
        const key = `open-${attendance.eventId}-${today}`;
        const secondsSinceOpen = attendance.startsAt ? nowUnix - attendance.startsAt : 0;
        const shouldRecoverImmediately =
          !attendance.startsAt ||
          (secondsSinceOpen >= 0 && secondsSinceOpen <= OPEN_FALLBACK_WINDOW_SECONDS);

        if (shouldRecoverImmediately && !hasKey(key) && !pendingKeysRef.current.has(key)) {
          pendingKeysRef.current.add(key);
          void sendImmediateAttendanceNotification({
            title: 'Absensi Dibuka',
            body: `${attendance.title} (${attendance.courseName}) sudah dibuka. Segera isi sekarang.`,
            kind: 'attendance_open',
            eventId: attendance.eventId,
            identifier: key,
          }).then((didSchedule) => {
            if (didSchedule) {
              markKey(key);
            }
            pendingKeysRef.current.delete(key);
          });
        }
      }

      // ── attendance_closing immediate ────────────────────────────────────────
      // Recover only when the app enters the last 30-minute window after missing
      // the pre-scheduled notification.
      if (!remotePushReady && liveStatus === 'closing_soon') {
        if (!attendance.closesAt || !closingKey) {
          continue;
        }

        const secondsLeft = attendance.closesAt - nowUnix;
        if (secondsLeft < 0 || secondsLeft > CLOSING_SOON_SECONDS) {
          continue;
        }

        if (!hasKey(closingKey) && !pendingKeysRef.current.has(closingKey)) {
          pendingKeysRef.current.add(closingKey);
          void sendImmediateAttendanceNotification({
            title: 'Absensi Segera Ditutup',
            body: `${attendance.title} (${attendance.courseName}) akan ditutup dalam ${Math.ceil(secondsLeft / 60)} menit. Segera isi sekarang.`,
            kind: 'attendance_closing',
            eventId: attendance.eventId,
            identifier: closingKey,
          }).then((didSchedule) => {
            if (didSchedule) {
              markKey(closingKey);
            }
            pendingKeysRef.current.delete(closingKey);
          });
        }
      }
    }
  }, [
    attendanceQuery.data,
    dedupeHydrated,
    hasKey,
    markKey,
    monitoredCourseIds,
    notifyAttendance,
    pruneOlderThan,
    pushStatus,
  ]);

  return null;
}
