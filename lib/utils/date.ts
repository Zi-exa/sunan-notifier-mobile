const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('id-ID', {
  weekday: 'short',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const DATE_ONLY_FORMATTER = new Intl.DateTimeFormat('id-ID', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

export function formatDateTime(unixSeconds: number): string {
  if (!unixSeconds) {
    return '-';
  }

  return DATE_TIME_FORMATTER.format(new Date(unixSeconds * 1000));
}

export function formatDate(unixSeconds: number): string {
  if (!unixSeconds) {
    return '-';
  }

  return DATE_ONLY_FORMATTER.format(new Date(unixSeconds * 1000));
}

export function toDateKey(unixSeconds: number): string {
  const date = new Date(unixSeconds * 1000);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function startOfTodayMs(nowMs = Date.now()): number {
  const date = new Date(nowMs);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function isSameDate(unixSeconds: number, dateKey: string): boolean {
  return toDateKey(unixSeconds) === dateKey;
}
