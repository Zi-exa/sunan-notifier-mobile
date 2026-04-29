import { useEffect } from 'react';
import { sendImmediateAttendanceNotification } from '@/lib/notifications';
import { useAttendanceSessionsQuery } from '@/lib/queries/useMoodleQueries';
import { resolveAttendanceItemStatus } from '@/lib/utils/attendance';
import { useNotificationDedupeStore } from '@/lib/stores/notificationDedupeStore';
import { useSettingsStore } from '@/lib/stores/settingsStore';

/**
 * AttendanceNotificationSync — renders nothing, runs as a background sync effect.
 *
 * Fires a local notification when:
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
  const attendanceQuery = useAttendanceSessionsQuery();
  const dedupeHydrated = useNotificationDedupeStore((state) => state.hydrated);
  const hasKey = useNotificationDedupeStore((state) => state.hasKey);
  const markKey = useNotificationDedupeStore((state) => state.markKey);
  const pruneOlderThan = useNotificationDedupeStore((state) => state.pruneOlderThan);

  useEffect(() => {
    if (!notifyAttendance || !dedupeHydrated) {
      return;
    }

    const nowUnix = Math.floor(Date.now() / 1000);
    const now = new Date();
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

      // ── attendance_open ──────────────────────────────────────────────────────
      // Fire whenever an attendance is open (= not yet attended, since Moodle's
      // upcoming view only surfaces unfinished events). Deduplicate once per day.
      if (liveStatus === 'open' || liveStatus === 'available') {
        const key = `open-${attendance.eventId}-${today}`;
        if (!hasKey(key)) {
          markKey(key);
          sendImmediateAttendanceNotification({
            title: 'Absensi Dibuka',
            body: `${attendance.title} (${attendance.courseName}) sudah dibuka. Segera isi sekarang.`,
            kind: 'attendance_open',
            eventId: attendance.eventId,
          });
        }
      }

      // ── attendance_closing ───────────────────────────────────────────────────
      // Fire once when there are ≤ 30 minutes left. Use liveStatus so this works
      // even if the cached status is still 'open'.
      if (liveStatus === 'closing_soon') {
        if (!attendance.closesAt) {
          continue;
        }

        const secondsLeft = attendance.closesAt - nowUnix;
        if (secondsLeft < 0 || secondsLeft > 30 * 60) {
          continue;
        }

        const key = `closing-${attendance.eventId}-${attendance.closesAt}`;
        if (!hasKey(key)) {
          markKey(key);
          sendImmediateAttendanceNotification({
            title: 'Absensi Segera Ditutup',
            body: `${attendance.title} (${attendance.courseName}) akan ditutup dalam ${Math.ceil(secondsLeft / 60)} menit. Segera isi sekarang.`,
            kind: 'attendance_closing',
            eventId: attendance.eventId,
          });
        }
      }
    }
  }, [attendanceQuery.data, dedupeHydrated, hasKey, markKey, monitoredCourseIds, notifyAttendance, pruneOlderThan]);

  return null;
}
