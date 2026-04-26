import { useEffect, useRef } from 'react';
import { sendImmediateAttendanceNotification } from '@/lib/notifications';
import { useAttendanceSessionsQuery } from '@/lib/queries/useMoodleQueries';
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
 *  • attendance_closing  — an open session has ≤ 30 min left. Sends once per countdown
 *                          window so it doesn't fire again if the user re-opens the app.
 */
export function AttendanceNotificationSync() {
  const notifyAttendance = useSettingsStore((state) => state.notifications.notifyAttendance);
  const monitoredCourseIds = useSettingsStore((state) => state.monitoredCourseIds);
  const attendanceQuery = useAttendanceSessionsQuery();
  const notifiedSetRef = useRef(new Set<string>());

  useEffect(() => {
    if (!notifyAttendance) {
      return;
    }

    const nowUnix = Math.floor(Date.now() / 1000);
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')}`;
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

      // ── attendance_open ──────────────────────────────────────────────────────
      // Fire whenever an attendance is open (= not yet attended, since Moodle's
      // upcoming view only surfaces unfinished events). Deduplicate once per day.
      if (attendance.status === 'open' || attendance.status === 'available') {
        const key = `open-${attendance.eventId}-${today}`;
        if (!notifiedSetRef.current.has(key)) {
          notifiedSetRef.current.add(key);
          sendImmediateAttendanceNotification({
            title: 'Absensi Dibuka',
            body: `${attendance.title} (${attendance.courseName}) sedang dibuka. Segera isi absensi sekarang!`,
            kind: 'attendance_open',
            eventId: attendance.eventId,
          });
        }
      }

      // ── attendance_closing ───────────────────────────────────────────────────
      // Fire once when there are ≤ 30 minutes left. `closing_soon` status is
      // already set by resolveAttendanceStatus when closesAt – now ≤ 30 min.
      if (attendance.status === 'closing_soon') {
        if (!attendance.closesAt) {
          continue;
        }

        const secondsLeft = attendance.closesAt - nowUnix;
        if (secondsLeft < 0 || secondsLeft > 30 * 60) {
          continue;
        }

        const key = `closing-${attendance.eventId}`;
        if (!notifiedSetRef.current.has(key)) {
          notifiedSetRef.current.add(key);
          sendImmediateAttendanceNotification({
            title: 'Absensi Segera Ditutup!',
            body: `${attendance.title} (${attendance.courseName}) akan ditutup dalam ${Math.ceil(secondsLeft / 60)} menit. Segera isi sebelum terlambat!`,
            kind: 'attendance_closing',
            eventId: attendance.eventId,
          });
        }
      }
    }
  }, [attendanceQuery.data, monitoredCourseIds, notifyAttendance]);

  return null;
}
