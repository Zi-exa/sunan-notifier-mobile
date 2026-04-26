import { AttendanceItem, AttendanceStatus, MoodleCalendarEvent } from '@/types/moodle';
import { sanitizeRichText } from '@/lib/utils/text';

const ATTENDANCE_KEYWORDS = [
  'absensi',
  'presensi',
  'attendance',
  'kehadiran',
  'daftar hadir',
  'daftar kehadiran',
  'check in',
  'check-in',
];
const ATTENDANCE_MODULE_NAMES = new Set(['attendance', 'mod_attendance']);
const ATTENDANCE_URL_HINTS = ['/mod/attendance/', '/attendance/view.php'];
type AttendanceWindow = {
  startsAt?: number;
  closesAt?: number;
};

function toLocalDateKey(unixSeconds: number): string {
  const date = new Date(unixSeconds * 1000);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeText(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function normalizeUrl(value: string | undefined): string {
  return normalizeText(value).replace(/#.*$/, '');
}

export function resolveAttendanceWindowStatus(
  { startsAt, closesAt }: AttendanceWindow,
  nowUnixSeconds = Math.floor(Date.now() / 1000),
  closingSoonMinutes = 30
): AttendanceStatus {
  if (startsAt && nowUnixSeconds < startsAt) {
    return 'upcoming';
  }

  if (closesAt && nowUnixSeconds >= closesAt) {
    return 'closed';
  }

  if (closesAt && closesAt - nowUnixSeconds <= closingSoonMinutes * 60) {
    return 'closing_soon';
  }

  if (startsAt || closesAt) {
    return 'open';
  }

  return 'available';
}

export function resolveAttendanceItemStatus(
  item: Pick<AttendanceItem, 'startsAt' | 'closesAt'>,
  nowUnixSeconds = Math.floor(Date.now() / 1000),
  closingSoonMinutes = 30
): AttendanceStatus {
  return resolveAttendanceWindowStatus(
    {
      startsAt: item.startsAt,
      closesAt: item.closesAt,
    },
    nowUnixSeconds,
    closingSoonMinutes
  );
}
function buildAttendanceIdentity(item: AttendanceItem): string {
  // Each calendar event has a unique eventId — use it as primary identity.
  // This prevents different sessions of the same attendance module (which share
  // the same URL like view.php?id=652636) from overwriting each other.
  if (item.eventId) {
    return `event:${item.eventId}`;
  }

  const normalizedQuickLink = normalizeUrl(item.quickLink);
  if (normalizedQuickLink) {
    return `url:${normalizedQuickLink}`;
  }

  return `course:${item.courseId ?? 0}:${normalizeText(item.title)}`;
}

function mergeAttendanceItem(base: AttendanceItem | undefined, preferred: AttendanceItem): AttendanceItem {
  if (!base) {
    return preferred;
  }

  return {
    ...base,
    ...preferred,
    courseName: preferred.courseName || base.courseName,
    description: preferred.description ?? base.description,
    startsAt: preferred.startsAt ?? base.startsAt,
    closesAt: preferred.closesAt ?? base.closesAt,
    quickLink: preferred.quickLink ?? base.quickLink,
    source: preferred.source,
  };
}

export function isAttendanceEvent(event: MoodleCalendarEvent): boolean {
  const moduleName = normalizeText(event.modulename);
  if (ATTENDANCE_MODULE_NAMES.has(moduleName)) {
    return true;
  }

  const eventType = normalizeText(event.eventtype);
  if (eventType.includes('attendance') || eventType.includes('presensi') || eventType.includes('absensi')) {
    return true;
  }

  const eventUrl = normalizeUrl(event.url);
  if (ATTENDANCE_URL_HINTS.some((hint) => eventUrl.includes(hint))) {
    return true;
  }

  const targetText = normalizeText(
    `${sanitizeRichText(event.name) ?? event.name} ${sanitizeRichText(event.description) ?? ''} ${sanitizeRichText(event.course?.fullname) ?? ''} ${sanitizeRichText(event.course?.shortname) ?? ''}`
  );

  return ATTENDANCE_KEYWORDS.some((keyword) => targetText.includes(keyword));
}

export function resolveAttendanceStatus(
  event: MoodleCalendarEvent,
  nowUnixSeconds = Math.floor(Date.now() / 1000),
  closingSoonMinutes = 30
): AttendanceStatus {
  const startsAt = event.timestart;
  const closesAt = event.timeduration > 0 ? startsAt + event.timeduration : undefined;

  if (startsAt && !closesAt && nowUnixSeconds >= startsAt) {
    return toLocalDateKey(nowUnixSeconds) === toLocalDateKey(startsAt) ? 'available' : 'closed';
  }

  return resolveAttendanceWindowStatus({ startsAt, closesAt }, nowUnixSeconds, closingSoonMinutes);
}

export function mapCalendarEventToAttendance(
  event: MoodleCalendarEvent,
  nowUnixSeconds = Math.floor(Date.now() / 1000)
): AttendanceItem {
  const startsAt = event.timestart;
  const closesAt = event.timeduration > 0 ? startsAt + event.timeduration : undefined;
  const courseName =
    sanitizeRichText(event.course?.fullname) ??
    sanitizeRichText(event.course?.shortname) ??
    (event.courseid ? `Matkul #${event.courseid}` : 'Mata Kuliah');

  const title = sanitizeRichText(event.name) ?? 'Absensi';
  const description = sanitizeRichText(event.description);

  return {
    eventId: event.id,
    courseId: event.courseid,
    courseName,
    title,
    description,
    startsAt,
    closesAt,
    status: resolveAttendanceStatus(event, nowUnixSeconds),
    quickLink: event.url,
    source: 'calendar',
  };
}

export function sortAttendanceSessions(items: AttendanceItem[]): AttendanceItem[] {
  const nowUnixSeconds = Math.floor(Date.now() / 1000);

  return [...items].sort((a, b) => {
    const aClosed = a.status === 'closed';
    const bClosed = b.status === 'closed';
    if (aClosed !== bClosed) {
      return aClosed ? 1 : -1;
    }

    const resolveRelevantTimestamp = (item: AttendanceItem): number | undefined => {
      if (item.closesAt && item.closesAt >= nowUnixSeconds) {
        return item.closesAt;
      }

      if (item.startsAt && item.startsAt >= nowUnixSeconds) {
        return item.startsAt;
      }

      return item.closesAt ?? item.startsAt;
    };

    const aRelevantTime = resolveRelevantTimestamp(a);
    const bRelevantTime = resolveRelevantTimestamp(b);
    const aHasRelevantTime = typeof aRelevantTime === 'number' && Number.isFinite(aRelevantTime);
    const bHasRelevantTime = typeof bRelevantTime === 'number' && Number.isFinite(bRelevantTime);

    if (aHasRelevantTime !== bHasRelevantTime) {
      return aHasRelevantTime ? -1 : 1;
    }

    if (aHasRelevantTime && bHasRelevantTime) {
      const aDistance = Math.abs((aRelevantTime as number) - nowUnixSeconds);
      const bDistance = Math.abs((bRelevantTime as number) - nowUnixSeconds);

      if (aDistance !== bDistance) {
        return aDistance - bDistance;
      }

      if (aRelevantTime !== bRelevantTime) {
        return (aRelevantTime as number) - (bRelevantTime as number);
      }
    }

    if (a.status !== b.status) {
      const statusOrder: Record<AttendanceStatus, number> = {
        closing_soon: 0,
        open: 1,
        upcoming: 2,
        available: 3,
        closed: 4,
      };

      return statusOrder[a.status] - statusOrder[b.status];
    }

    if (a.courseName !== b.courseName) {
      return a.courseName.localeCompare(b.courseName, 'id-ID');
    }

    return a.title.localeCompare(b.title, 'id-ID');
  });
}

export function extractAttendanceFromCalendar(
  events: MoodleCalendarEvent[],
  nowUnixSeconds = Math.floor(Date.now() / 1000)
): AttendanceItem[] {
  const attendanceItems = events
    .filter((event) => isAttendanceEvent(event))
    .map((event) => mapCalendarEventToAttendance(event, nowUnixSeconds));

  return sortAttendanceSessions(attendanceItems);
}

export function mergeAttendanceSources(
  calendarItems: AttendanceItem[],
  moduleItems: AttendanceItem[]
): AttendanceItem[] {
  const merged = new Map<string, AttendanceItem>();

  [...moduleItems, ...calendarItems].forEach((item) => {
    const key = buildAttendanceIdentity(item);
    const current = merged.get(key);
    merged.set(key, mergeAttendanceItem(current, item));
  });

  return sortAttendanceSessions([...merged.values()]);
}
