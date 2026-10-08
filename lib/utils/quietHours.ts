export type QuietHours = {
  enabled: boolean;
  start: string;
  end: string;
};

export const DEFAULT_QUIET_HOURS: QuietHours = {
  enabled: false,
  start: '22:00',
  end: '07:00',
};

const JAKARTA_TIME_ZONE = 'Asia/Jakarta';
const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

type JakartaDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

function parseTime(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours > 23 || minutes > 59) {
    return null;
  }

  return hours * 60 + minutes;
}

function formatTime(minutesSinceMidnight: number): string {
  const hours = Math.floor(minutesSinceMidnight / 60);
  const minutes = minutesSinceMidnight % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function getJakartaDateParts(date: Date): JakartaDateParts {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: JAKARTA_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date);

    const values = Object.fromEntries(
      parts
        .filter((part) => part.type !== 'literal')
        .map((part) => [part.type, Number(part.value)])
    );

    if (
      Number.isFinite(values.year) &&
      Number.isFinite(values.month) &&
      Number.isFinite(values.day) &&
      Number.isFinite(values.hour) &&
      Number.isFinite(values.minute)
    ) {
      return {
        year: values.year,
        month: values.month,
        day: values.day,
        hour: values.hour,
        minute: values.minute,
      };
    }
  } catch {
    // Asia/Jakarta has a fixed UTC+7 offset. The fallback keeps scheduling
    // deterministic on runtimes with partial Intl support.
  }

  const jakartaAsUtc = new Date(date.getTime() + JAKARTA_OFFSET_MS);
  return {
    year: jakartaAsUtc.getUTCFullYear(),
    month: jakartaAsUtc.getUTCMonth() + 1,
    day: jakartaAsUtc.getUTCDate(),
    hour: jakartaAsUtc.getUTCHours(),
    minute: jakartaAsUtc.getUTCMinutes(),
  };
}

function buildJakartaDate(
  parts: Pick<JakartaDateParts, 'year' | 'month' | 'day'>,
  minutesSinceMidnight: number,
  daysToAdd = 0
): Date {
  const base = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day + daysToAdd, 0, minutesSinceMidnight)
  );

  return new Date(base.getTime() - JAKARTA_OFFSET_MS);
}

export function normalizeQuietHours(input?: Partial<QuietHours> | null): QuietHours {
  const startMinutes = typeof input?.start === 'string' ? parseTime(input.start) : null;
  const endMinutes = typeof input?.end === 'string' ? parseTime(input.end) : null;

  return {
    enabled: input?.enabled === true,
    start: startMinutes === null ? DEFAULT_QUIET_HOURS.start : formatTime(startMinutes),
    end: endMinutes === null ? DEFAULT_QUIET_HOURS.end : formatTime(endMinutes),
  };
}

export function isQuietHoursConfigurationValid(input?: Partial<QuietHours> | null): boolean {
  if (input?.enabled !== true) {
    return true;
  }

  const startMinutes = typeof input.start === 'string' ? parseTime(input.start) : null;
  const endMinutes = typeof input.end === 'string' ? parseTime(input.end) : null;
  return startMinutes !== null && endMinutes !== null && startMinutes !== endMinutes;
}

/**
 * Returns the first instant after quiet hours for an intended notification
 * delivery time. `null` means the intended time is outside quiet hours.
 * Equal start/end deliberately means no quiet window, avoiding an accidental
 * 24-hour notification blackout.
 */
export function getQuietHoursEndDate(
  intendedDate: Date,
  input?: Partial<QuietHours> | null
): Date | null {
  const quietHours = normalizeQuietHours(input);
  if (!quietHours.enabled || !Number.isFinite(intendedDate.getTime())) {
    return null;
  }

  const startMinutes = parseTime(quietHours.start);
  const endMinutes = parseTime(quietHours.end);
  if (startMinutes === null || endMinutes === null || startMinutes === endMinutes) {
    return null;
  }

  const dateParts = getJakartaDateParts(intendedDate);
  const currentMinutes = dateParts.hour * 60 + dateParts.minute;
  const crossesMidnight = startMinutes > endMinutes;
  const insideQuietHours = crossesMidnight
    ? currentMinutes >= startMinutes || currentMinutes < endMinutes
    : currentMinutes >= startMinutes && currentMinutes < endMinutes;

  if (!insideQuietHours) {
    return null;
  }

  const endsTomorrow = crossesMidnight && currentMinutes >= startMinutes;
  return buildJakartaDate(dateParts, endMinutes, endsTomorrow ? 1 : 0);
}

export function deferNotificationForQuietHours(
  intendedDate: Date,
  input?: Partial<QuietHours> | null
): Date {
  return getQuietHoursEndDate(intendedDate, input) ?? intendedDate;
}
