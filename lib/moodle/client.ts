import { CONFIG } from '@/lib/config';
import {
  AppError,
  isAuthError,
  isAuthErrorCode,
  isMaintenanceError,
  MAINTENANCE_ERROR_CODE,
  normalizeErrorCode,
  SUNAN_MAINTENANCE_MESSAGE,
  toNetworkAwareError,
} from '@/lib/moodle/errors';
import {
  extractAttendanceFromCalendar,
  mergeAttendanceSources,
} from '@/lib/utils/attendance';
import { mapSubmissionToStatus, sortAssignmentsByDeadline } from '@/lib/utils/tasks';
import { sanitizeRichText } from '@/lib/utils/text';
import {
  AttendanceItem,
  AssignmentItem,
  MoodleAssignment,
  MoodleAssignmentsPayload,
  MoodleCalendarEvent,
  MoodleCourse,
  MoodleQuizAttempt,
  MoodleQuizAttemptsPayload,
  MoodleQuiz,
  MoodleQuizzesPayload,
  MoodleSiteInfo,
  MoodleSubmissionStatus,
  MoodleTokenResponse,
} from '@/types/moodle';
import {
  MOCK_ASSIGNMENTS,
  MOCK_CALENDAR_EVENTS,
  MOCK_COURSES,
  MOCK_SITE_INFO,
  mockSubmissionStatus,
} from '@/lib/moodle/mock';

type MoodleExceptionPayload = {
  exception: string;
  errorcode: string;
  message: string;
  debuginfo?: string;
};

const CALENDAR_LIMIT_NUM = 50;
const CALENDAR_PADDING_DAYS = 7;
const MAINTENANCE_PROBE_CACHE_MS = 30 * 1000;
const QUIZ_TASK_ID_OFFSET = 2_000_000_000;

let maintenanceProbePromise: Promise<boolean> | null = null;
let lastMaintenanceProbeAt = 0;
let lastMaintenanceProbeResult = false;

export type CalendarQueryRange = {
  timeStart: number;
  timeEnd: number;
};

function buildTaskId(activityType: 'assignment' | 'quiz', sourceId: number): number {
  if (activityType === 'quiz') {
    return QUIZ_TASK_ID_OFFSET + sourceId;
  }

  return sourceId;
}

function isMoodleExceptionPayload(value: unknown): value is MoodleExceptionPayload {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const payload = value as Partial<MoodleExceptionPayload>;
  return typeof payload.exception === 'string' && typeof payload.message === 'string';
}

function appendParam(params: URLSearchParams, key: string, value: unknown): void {
  if (value === undefined || value === null) {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => appendParam(params, `${key}[${index}]`, item));
    return;
  }

  if (typeof value === 'object') {
    Object.entries(value as Record<string, unknown>).forEach(([nestedKey, nestedValue]) => {
      appendParam(params, `${key}[${nestedKey}]`, nestedValue);
    });
    return;
  }

  params.append(key, String(value));
}

function isMaintenanceHtml(text: string): boolean {
  const looksLikeHtml = /<!doctype html|<html|<head|<body/i.test(text);

  return (
    looksLikeHtml &&
    /maintenance|maintance|under maintenance|sedang maintenance|dalam perbaikan/i.test(text)
  );
}

async function probeSunanMaintenance(): Promise<boolean> {
  if (CONFIG.useMockData) {
    return false;
  }

  const now = Date.now();
  if (now - lastMaintenanceProbeAt <= MAINTENANCE_PROBE_CACHE_MS) {
    return lastMaintenanceProbeResult;
  }

  if (maintenanceProbePromise) {
    return maintenanceProbePromise;
  }

  maintenanceProbePromise = (async () => {
    try {
      const response = await fetch(CONFIG.moodleBaseUrl, {
        method: 'GET',
        headers: {
          Accept: 'text/html,application/xhtml+xml',
        },
      });
      const text = await response.text();
      const detected = isMaintenanceHtml(text);

      lastMaintenanceProbeAt = Date.now();
      lastMaintenanceProbeResult = detected;
      return detected;
    } catch {
      lastMaintenanceProbeAt = Date.now();
      lastMaintenanceProbeResult = false;
      return false;
    } finally {
      maintenanceProbePromise = null;
    }
  })();

  return maintenanceProbePromise;
}

export function getAuthenticatedMoodleFileUrl(
  token: string,
  rawUrl?: string | null,
  siteUrl = CONFIG.moodleBaseUrl
): string | undefined {
  if (!rawUrl) {
    return undefined;
  }

  try {
    const baseUrl = new URL(siteUrl);
    const url = new URL(rawUrl, baseUrl);

    if (url.origin !== baseUrl.origin) {
      return url.toString();
    }

    const path = url.pathname;
    const isWebservicePluginFile = /\/webservice\/pluginfile\.php(?:\/|$)/.test(path);
    const isTokenPluginFile = /\/tokenpluginfile\.php(?:\/|$)/.test(path);
    const isPluginFile = /\/pluginfile\.php(?:\/|$)/.test(path);

    if (!isWebservicePluginFile && !isTokenPluginFile && !isPluginFile) {
      return url.toString();
    }

    if (isTokenPluginFile) {
      url.pathname = path.replace(/\/tokenpluginfile\.php(?=\/|$)/, '/webservice/pluginfile.php');
    } else if (isPluginFile && !isWebservicePluginFile) {
      url.pathname = path.replace(/\/pluginfile\.php(?=\/|$)/, '/webservice/pluginfile.php');
    }

    url.searchParams.set('token', token);
    return url.toString();
  } catch {
    return rawUrl;
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let data: unknown;

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    const responseSnippet = text.trim().slice(0, 160).replace(/\s+/g, ' ');
    const looksLikeHtml = /<!doctype html|<html|<head|<body/i.test(text);
    const looksLikeMaintenance = isMaintenanceHtml(text);

    throw new AppError({
      kind: 'server',
      code: looksLikeMaintenance ? MAINTENANCE_ERROR_CODE : undefined,
      status: response.status,
      message: looksLikeMaintenance
        ? SUNAN_MAINTENANCE_MESSAGE
        : looksLikeHtml
          ? 'SUNAN membalas halaman web, bukan respons API JSON.'
          : 'Respons SUNAN tidak valid (bukan JSON).',
      details: responseSnippet || undefined,
    });
  }

  if (!response.ok) {
    const isAuthStatus = response.status === 401;

    if (isAuthStatus && (await probeSunanMaintenance())) {
      throw new AppError({
        kind: 'server',
        code: MAINTENANCE_ERROR_CODE,
        status: response.status,
        message: SUNAN_MAINTENANCE_MESSAGE,
      });
    }

    throw new AppError({
      kind: isAuthStatus ? 'auth' : 'server',
      status: response.status,
      message: isAuthStatus
        ? 'Sesi SUNAN berakhir. Silakan login ulang.'
        : `Request gagal (${response.status}).`,
    });
  }

  if (isMoodleExceptionPayload(data)) {
    const errorCode = normalizeErrorCode(data.errorcode);
    const normalizedException = normalizeErrorCode(data.exception);
    const isAuthFailure =
      isAuthErrorCode(errorCode) || normalizedException === 'require_login_exception';

    if (isAuthFailure && (await probeSunanMaintenance())) {
      throw new AppError({
        kind: 'server',
        code: MAINTENANCE_ERROR_CODE,
        message: SUNAN_MAINTENANCE_MESSAGE,
        details: data.debuginfo,
      });
    }

    throw new AppError({
      kind: isAuthFailure ? 'auth' : 'server',
      code: errorCode || undefined,
      message: isAuthFailure
        ? 'Sesi SUNAN berakhir. Silakan login ulang.'
        : `${data.errorcode}: ${data.message}`,
      details: data.debuginfo,
    });
  }

  return data as T;
}

async function callMoodleFunction<T>(
  token: string,
  functionName: string,
  params: Record<string, unknown> = {}
): Promise<T> {
  const body = new URLSearchParams();
  body.append('wstoken', token);
  body.append('wsfunction', functionName);
  body.append('moodlewsrestformat', 'json');

  Object.entries(params).forEach(([key, value]) => appendParam(body, key, value));

  let response: Response;
  try {
    response = await fetch(`${CONFIG.moodleBaseUrl}/webservice/rest/server.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });
  } catch (error) {
    throw toNetworkAwareError(error, 'Tidak dapat menghubungi SUNAN. Periksa koneksi internet.');
  }

  return parseResponse<T>(response);
}

function toAssignmentItem(courseName: string, assignment: MoodleAssignment): AssignmentItem {
  return {
    id: buildTaskId('assignment', assignment.id),
    sourceId: assignment.id,
    activityType: 'assignment',
    cmid: assignment.cmid,
    courseId: assignment.course,
    courseName: sanitizeRichText(courseName) ?? courseName,
    name: sanitizeRichText(assignment.name) ?? `Tugas #${assignment.id}`,
    intro: sanitizeRichText(assignment.intro),
    openDate: assignment.allowsubmissionsfromdate > 0 ? assignment.allowsubmissionsfromdate : undefined,
    dueDate: assignment.duedate,
    cutoffDate: assignment.cutoffdate,
    status: 'pending',
    statusResolved: false,
    quickLink: `${CONFIG.moodleBaseUrl}/mod/assign/view.php?id=${assignment.cmid}`,
  };
}

function toQuizTaskItem(quiz: MoodleQuiz, courseName?: string): AssignmentItem {
  const sourceId = quiz.id;
  const cmid = quiz.cmid ?? quiz.coursemodule ?? sourceId;
  const dueDate = quiz.timeclose > 0 ? quiz.timeclose : quiz.timeopen;
  const sanitizedCourseName = sanitizeRichText(courseName) ?? courseName;

  return {
    id: buildTaskId('quiz', sourceId),
    sourceId,
    activityType: 'quiz',
    cmid,
    courseId: quiz.course,
    courseName: sanitizedCourseName ?? `Matkul #${quiz.course}`,
    name: sanitizeRichText(quiz.name) ?? `Quiz #${quiz.id}`,
    intro: sanitizeRichText(quiz.intro),
    openDate: quiz.timeopen > 0 ? quiz.timeopen : undefined,
    dueDate,
    cutoffDate: dueDate,
    status: mapSubmissionToStatus(undefined, dueDate),
    statusResolved: false,
    quickLink:
      cmid > 0
        ? `${CONFIG.moodleBaseUrl}/mod/quiz/view.php?id=${cmid}`
        : `${CONFIG.moodleBaseUrl}/mod/quiz/view.php?q=${quiz.id}`,
  };
}

function sanitizeCalendarEvent(event: MoodleCalendarEvent): MoodleCalendarEvent {
  return {
    ...event,
    name: sanitizeRichText(event.name) ?? event.name,
    description: sanitizeRichText(event.description),
    course: event.course
      ? {
          ...event.course,
          fullname: sanitizeRichText(event.course.fullname),
          shortname: sanitizeRichText(event.course.shortname),
        }
      : undefined,
  };
}

function toCalendarEventArray(value: unknown): MoodleCalendarEvent[] {
  const rawEvents = Array.isArray(value)
    ? value
    : value && typeof value === 'object'
      ? Object.values(value as Record<string, unknown>)
      : [];

  return rawEvents.flatMap((event) => {
    if (!event || typeof event !== 'object') {
      return [];
    }

    const raw = event as Partial<MoodleCalendarEvent> & { id?: unknown; timestart?: unknown };
    const rawCourse =
      raw.course && typeof raw.course === 'object' ? (raw.course as Record<string, unknown>) : undefined;
    const id = typeof raw.id === 'number' ? raw.id : Number(raw.id);
    const timestart = typeof raw.timestart === 'number' ? raw.timestart : Number(raw.timestart);

    if (!Number.isFinite(id) || !Number.isFinite(timestart)) {
      return [];
    }

    return [
      {
        ...raw,
        id,
        timestart,
        timeduration:
          typeof raw.timeduration === 'number' ? raw.timeduration : Number(raw.timeduration ?? 0),
        courseid:
          typeof raw.courseid === 'number'
            ? raw.courseid
            : raw.courseid !== undefined
              ? Number(raw.courseid)
              : rawCourse && rawCourse.id !== undefined
                ? Number(rawCourse.id)
              : undefined,
        instance:
          typeof raw.instance === 'number'
            ? raw.instance
            : raw.instance !== undefined
              ? Number(raw.instance)
              : undefined,
      } as MoodleCalendarEvent,
    ];
  });
}

function extractActionEventsFromPayload(payload: unknown): MoodleCalendarEvent[] {
  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const parsed = payload as Record<string, unknown>;
  const directEvents = toCalendarEventArray(parsed.events);
  if (directEvents.length > 0) {
    return directEvents;
  }

  const grouped = parsed.groupedbycourse;

  if (Array.isArray(grouped)) {
    return grouped.flatMap((groupedItem) => {
      if (!groupedItem || typeof groupedItem !== 'object') {
        return [];
      }

      return toCalendarEventArray((groupedItem as Record<string, unknown>).events);
    });
  }

  if (grouped && typeof grouped === 'object') {
    return Object.values(grouped as Record<string, unknown>).flatMap((groupedItem) => {
      if (Array.isArray(groupedItem)) {
        return toCalendarEventArray(groupedItem);
      }

      if (groupedItem && typeof groupedItem === 'object') {
        return toCalendarEventArray((groupedItem as Record<string, unknown>).events);
      }

      return [];
    });
  }

  return [];
}

function extractUpcomingEventsFromPayload(payload: unknown): MoodleCalendarEvent[] {
  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const parsed = payload as Record<string, unknown>;
  const directEvents = toCalendarEventArray(parsed.events);
  if (directEvents.length > 0) {
    return directEvents;
  }

  return Object.values(parsed).flatMap((value) => {
    if (!value || typeof value !== 'object') {
      return [];
    }

    return toCalendarEventArray((value as Record<string, unknown>).events);
  });
}

function mergeCalendarEvents(
  primaryEvents: MoodleCalendarEvent[],
  secondaryEvents: MoodleCalendarEvent[]
): MoodleCalendarEvent[] {
  const mergedById = new Map<number, MoodleCalendarEvent>();

  [...secondaryEvents, ...primaryEvents].forEach((event) => {
    mergedById.set(event.id, event);
  });

  return [...mergedById.values()].sort((a, b) => a.timestart - b.timestart);
}

function startOfMonthUnix(year: number, monthIndex: number): number {
  return Math.floor(new Date(year, monthIndex, 1, 0, 0, 0, 0).getTime() / 1000);
}

function endOfMonthUnix(year: number, monthIndex: number): number {
  return Math.floor(new Date(year, monthIndex + 1, 0, 23, 59, 59, 999).getTime() / 1000);
}

export function getDefaultCalendarRange(nowMs = Date.now()): CalendarQueryRange {
  const date = new Date(nowMs);
  return getCalendarRangeForMonth(date.getFullYear(), date.getMonth());
}

export function getCalendarRangeForMonth(year: number, monthIndex: number): CalendarQueryRange {
  const monthStart = startOfMonthUnix(year, monthIndex);
  const monthEnd = endOfMonthUnix(year, monthIndex);
  const paddingSeconds = CALENDAR_PADDING_DAYS * 24 * 60 * 60;

  return {
    timeStart: monthStart - paddingSeconds,
    timeEnd: monthEnd + paddingSeconds,
  };
}

export async function requestMoodleToken(nim: string, password: string): Promise<string> {
  if (CONFIG.useMockData) {
    return 'mock-token';
  }

  const body = new URLSearchParams({
    username: nim,
    password,
    service: CONFIG.moodleService,
  });

  let response: Response;
  try {
    response = await fetch(`${CONFIG.moodleBaseUrl}/login/token.php`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });
  } catch (error) {
    throw toNetworkAwareError(error, 'Tidak dapat menghubungi SUNAN. Periksa koneksi internet.');
  }

  const payload = await parseResponse<MoodleTokenResponse>(response);

  if (!payload.token) {
    const errorCode = normalizeErrorCode(payload.errorcode);
    const errorMessage = payload.error ?? 'Gagal mengambil token Moodle.';

    if (
      errorCode === 'invalidlogin' ||
      /invalid\s*login|invalid\s*username|invalid\s*password|login gagal/i.test(errorMessage)
    ) {
      throw new AppError({
        kind: 'validation',
        code: errorCode || undefined,
        message: 'NIM atau password SUNAN tidak valid.',
      });
    }

    if (isAuthErrorCode(errorCode)) {
      throw new AppError({
        kind: 'auth',
        code: errorCode || undefined,
        message: 'Sesi SUNAN berakhir. Silakan login ulang.',
      });
    }

    throw new AppError({
      kind: 'server',
      code: errorCode || undefined,
      message: errorMessage,
    });
  }

  return payload.token;
}

export async function getSiteInfo(token: string): Promise<MoodleSiteInfo> {
  if (CONFIG.useMockData) {
    return MOCK_SITE_INFO;
  }

  return callMoodleFunction<MoodleSiteInfo>(token, 'core_webservice_get_site_info');
}

export type SessionValidationResult = 'valid' | 'invalid' | 'maintenance' | 'unavailable';

export async function validateMoodleSession(token: string): Promise<SessionValidationResult> {
  try {
    await getSiteInfo(token);
    return 'valid';
  } catch (error) {
    if (isAuthError(error)) {
      return 'invalid';
    }

    if (isMaintenanceError(error)) {
      return 'maintenance';
    }

    return 'unavailable';
  }
}

export async function getCourses(token: string, userId: number): Promise<MoodleCourse[]> {
  if (CONFIG.useMockData) {
    return MOCK_COURSES;
  }

  return callMoodleFunction<MoodleCourse[]>(token, 'core_enrol_get_users_courses', {
    userid: userId,
  });
}

export async function getAssignments(
  token: string,
  courseIds: number[],
  availableCourses: MoodleCourse[] = []
): Promise<AssignmentItem[]> {
  if (CONFIG.useMockData) {
    return sortAssignmentsByDeadline(MOCK_ASSIGNMENTS);
  }

  const courseNameById = new Map<number, string>();
  availableCourses.forEach((course) => {
    courseNameById.set(course.id, course.fullname);
  });

  const payload = await callMoodleFunction<MoodleAssignmentsPayload>(
    token,
    'mod_assign_get_assignments',
    {
      courseids: courseIds,
    }
  );

  payload.courses.forEach((course) => {
    courseNameById.set(course.id, course.fullname);
  });

  const assignments = payload.courses.flatMap((course) =>
    course.assignments.map((assignment) => toAssignmentItem(course.fullname, assignment))
  );

  let quizzes: AssignmentItem[] = [];
  try {
    const quizPayload = await callMoodleFunction<MoodleQuizzesPayload>(
      token,
      'mod_quiz_get_quizzes_by_courses',
      {
        courseids: courseIds,
      }
    );

    quizzes = (quizPayload.quizzes ?? []).map((quiz) =>
      toQuizTaskItem(quiz, courseNameById.get(quiz.course))
    );
  } catch (error) {
    if (isAuthError(error)) {
      throw error;
    }

    quizzes = [];
  }

  return sortAssignmentsByDeadline([...assignments, ...quizzes]);
}

export async function getCalendarEvents(
  token: string,
  courseIds: number[],
  range = getDefaultCalendarRange()
): Promise<MoodleCalendarEvent[]> {
  if (CONFIG.useMockData) {
    return MOCK_CALENDAR_EVENTS;
  }
  const { timeStart, timeEnd } = range;

  let actionEvents: MoodleCalendarEvent[] = [];
  try {
    const actionPayload = await callMoodleFunction<unknown>(
      token,
      'core_calendar_get_action_events_by_courses',
      {
        courseids: courseIds,
        timesortfrom: timeStart,
        timesortto: timeEnd,
        limitnum: CALENDAR_LIMIT_NUM,
      }
    );

    actionEvents = extractActionEventsFromPayload(actionPayload);
  } catch (error) {
    if (isAuthError(error)) {
      throw error;
    }

    actionEvents = [];
  }

  let calendarEvents: MoodleCalendarEvent[] = [];
  try {
    const calendarPayload = await callMoodleFunction<Record<string, unknown>>(
      token,
      'core_calendar_get_calendar_events',
      {
        events: {
          courseids: courseIds,
        },
        options: {
          timestart: timeStart,
          timeend: timeEnd,
          userevents: false,
          siteevents: false,
          ignorehidden: true,
        },
      }
    );

    // Moodle can return events as an array or a keyed object — normalise both forms.
    calendarEvents = toCalendarEventArray(calendarPayload.events);
  } catch (error) {
    if (isAuthError(error)) {
      throw error;
    }

    calendarEvents = [];
  }

  const mergedEvents = mergeCalendarEvents(actionEvents, calendarEvents);
  return mergedEvents.map((event) => sanitizeCalendarEvent(event));
}

async function getUpcomingCalendarEvents(
  token: string,
  courseIds: number[]
): Promise<MoodleCalendarEvent[]> {
  if (CONFIG.useMockData) {
    return MOCK_CALENDAR_EVENTS.filter((event) => event.timestart >= Math.floor(Date.now() / 1000));
  }

  try {
    const payload = await callMoodleFunction<unknown>(
      token,
      'core_calendar_get_calendar_upcoming_view'
    );
    const upcomingEvents = extractUpcomingEventsFromPayload(payload)
      .filter((event) => courseIds.length === 0 || !event.courseid || courseIds.includes(event.courseid))
      .map((event) => sanitizeCalendarEvent(event));

    return upcomingEvents.sort((a, b) => a.timestart - b.timestart);
  } catch (error) {
    if (isAuthError(error)) {
      throw error;
    }

    return [];
  }
}

export async function getAttendanceSessions(
  token: string,
  courseIds: number[]
): Promise<AttendanceItem[]> {
  const nowUnixSeconds = Math.floor(Date.now() / 1000);

  if (CONFIG.useMockData) {
    return extractAttendanceFromCalendar(MOCK_CALENDAR_EVENTS, nowUnixSeconds);
  }

  const [calendarEvents, upcomingEvents] = await Promise.all([
    getCalendarEvents(token, courseIds),
    getUpcomingCalendarEvents(token, courseIds),
  ]);

  const calendarAttendances = extractAttendanceFromCalendar(calendarEvents, nowUnixSeconds);
  const upcomingAttendances = extractAttendanceFromCalendar(upcomingEvents, nowUnixSeconds);

  return mergeAttendanceSources(upcomingAttendances, calendarAttendances);
}

export async function getSubmissionStatus(
  token: string,
  assignmentId: number
): Promise<MoodleSubmissionStatus> {
  if (CONFIG.useMockData) {
    return mockSubmissionStatus(assignmentId);
  }

  return callMoodleFunction<MoodleSubmissionStatus>(token, 'mod_assign_get_submission_status', {
    assignid: assignmentId,
  });
}

export async function getQuizAttempts(
  token: string,
  quizId: number
): Promise<MoodleQuizAttemptsPayload> {
  if (CONFIG.useMockData) {
    return {
      attempts: [],
    };
  }

  return callMoodleFunction<MoodleQuizAttemptsPayload>(token, 'mod_quiz_get_user_attempts', {
    quizid: quizId,
    status: 'all',
    includepreviews: 0,
  });
}

function resolveQuizTaskState(
  assignment: AssignmentItem,
  attempts: MoodleQuizAttempt[]
): Pick<AssignmentItem, 'status' | 'submissionModifiedAt'> {
  const fallbackStatus = mapSubmissionToStatus(undefined, assignment.dueDate);
  const states = attempts.map((attempt) => (attempt.state ?? '').toLowerCase());
  const hasFinishedAttempt = states.some((state) => state === 'finished' || state === 'submitted');
  const hasOverdueAttempt = states.some((state) => state === 'overdue');

  const lastAttemptTimestamp = attempts.reduce((maxTimestamp, attempt) => {
    const modifiedAt =
      typeof attempt.timemodified === 'number' && attempt.timemodified > 0
        ? attempt.timemodified
        : typeof attempt.timefinish === 'number' && attempt.timefinish > 0
          ? attempt.timefinish
          : 0;

    return modifiedAt > maxTimestamp ? modifiedAt : maxTimestamp;
  }, 0);

  if (hasFinishedAttempt) {
    return {
      status: 'submitted',
      submissionModifiedAt: lastAttemptTimestamp || undefined,
    };
  }

  if (hasOverdueAttempt) {
    return {
      status: 'overdue',
      submissionModifiedAt: lastAttemptTimestamp || undefined,
    };
  }

  return {
    status: fallbackStatus,
    submissionModifiedAt: lastAttemptTimestamp || undefined,
  };
}

export async function hydrateAssignmentsWithSubmissionStatus(
  token: string,
  assignments: AssignmentItem[]
): Promise<AssignmentItem[]> {
  const resolved = await Promise.all(
    assignments.map(async (assignment) => {
      if (assignment.activityType === 'quiz') {
        try {
          const attemptsPayload = await getQuizAttempts(token, assignment.sourceId);
          const quizState = resolveQuizTaskState(assignment, attemptsPayload.attempts ?? []);

          return {
            ...assignment,
            status: quizState.status,
            submissionModifiedAt: quizState.submissionModifiedAt,
            statusResolved: true,
          };
        } catch (error) {
          if (isAuthError(error)) {
            throw error;
          }

          return {
            ...assignment,
            status: mapSubmissionToStatus(undefined, assignment.dueDate),
            submissionModifiedAt: undefined,
            statusResolved: true,
          };
        }
      }

      try {
        const submission = await getSubmissionStatus(token, assignment.sourceId);
        const rawStatus = submission.lastattempt?.submission?.status;
        const updatedStatus = mapSubmissionToStatus(rawStatus, assignment.dueDate);

        return {
          ...assignment,
          status: updatedStatus,
          submissionModifiedAt: submission.lastattempt?.submission?.timemodified,
          statusResolved: true,
        };
      } catch (error) {
        if (isAuthError(error)) {
          throw error;
        }

        return {
          ...assignment,
          statusResolved: true,
        };
      }
    })
  );

  return sortAssignmentsByDeadline(resolved);
}
