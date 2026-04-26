import { useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { isAuthError, isOfflineError } from '@/lib/moodle/errors';
import {
  CalendarQueryRange,
  getAttendanceSessions,
  getAssignments,
  getCalendarEvents,
  getCourses,
  hydrateAssignmentsWithSubmissionStatus,
  validateMoodleSession,
} from '@/lib/moodle/client';
import { useAttendanceHistoryStore } from '@/lib/stores/attendanceHistoryStore';
import { useAuthStore } from '@/lib/stores/authStore';
import { sortAssignmentsByDeadline } from '@/lib/utils/tasks';

const STALE_TIME_MS = 5 * 60 * 1000;
const SESSION_VALIDATION_COOLDOWN_MS = 60 * 1000;
let activeSessionValidation:
  | {
      signature: string;
      promise: Promise<Awaited<ReturnType<typeof validateMoodleSession>>>;
    }
  | null = null;

function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (isAuthError(error)) {
    return false;
  }

  if (isOfflineError(error)) {
    return failureCount < 3;
  }

  return failureCount < 2;
}

function validateSessionForErrorSignature(token: string, signature: string) {
  if (activeSessionValidation?.signature === signature) {
    return activeSessionValidation.promise;
  }

  const promise = validateMoodleSession(token).finally(() => {
    if (activeSessionValidation?.signature === signature) {
      activeSessionValidation = null;
    }
  });

  activeSessionValidation = {
    signature,
    promise,
  };

  return promise;
}

function useSessionExpiryGuard(error: unknown, isError: boolean) {
  const token = useAuthStore((state) => state.token);
  const expireSession = useAuthStore((state) => state.expireSession);
  const lastHandledErrorRef = useRef<string>('');
  const lastSkippedErrorRef = useRef<{ signature: string; timestamp: number } | null>(null);

  useEffect(() => {
    if (!isError || !isAuthError(error) || !token) {
      lastHandledErrorRef.current = '';
      lastSkippedErrorRef.current = null;
    }
  }, [error, isError, token]);

  useEffect(() => {
    if (!isError || !isAuthError(error) || !token) {
      return;
    }

    const signature = `${error.code ?? 'auth'}:${error.message}`;
    if (lastHandledErrorRef.current === signature) {
      return;
    }

    const skipped = lastSkippedErrorRef.current;
    const now = Date.now();
    if (
      skipped?.signature === signature &&
      now - skipped.timestamp < SESSION_VALIDATION_COOLDOWN_MS
    ) {
      return;
    }

    void (async () => {
      const validation = await validateSessionForErrorSignature(token, signature);

      if (validation === 'invalid') {
        lastHandledErrorRef.current = signature;
        await expireSession();
        return;
      }

      lastSkippedErrorRef.current = {
        signature,
        timestamp: Date.now(),
      };
    })();
  }, [error, expireSession, isError, token]);
}

export function applyCourseScope(allCourseIds: number[], monitoredCourseIds: number[]): number[] {
  if (monitoredCourseIds.length === 0) {
    return allCourseIds;
  }

  const scoped = allCourseIds.filter((courseId) => monitoredCourseIds.includes(courseId));

  // If persisted filters come from a previous account, fall back to all available courses.
  if (scoped.length === 0) {
    return allCourseIds;
  }

  return scoped;
}

export function useCoursesQuery() {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);

  const query = useQuery({
    queryKey: ['courses', user?.id],
    enabled: Boolean(token && user?.id),
    staleTime: STALE_TIME_MS,
    retry: shouldRetryQuery,
    queryFn: () => getCourses(token as string, user?.id as number),
  });

  useSessionExpiryGuard(query.error, query.isError);
  return query;
}

export function useAssignmentsQuery() {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const coursesQuery = useCoursesQuery();

  const allCourseIds = useMemo(
    () => (coursesQuery.data ?? []).map((course) => course.id),
    [coursesQuery.data]
  );
  const allCourseIdKey = allCourseIds.join(',');

  const query = useQuery({
    queryKey: ['assignments', user?.id ?? 'anon', allCourseIdKey],
    enabled: Boolean(token && allCourseIds.length > 0),
    staleTime: STALE_TIME_MS,
    retry: shouldRetryQuery,
    queryFn: async () => {
      const assignments = await getAssignments(
        token as string,
        allCourseIds,
        coursesQuery.data ?? []
      );
      const withSubmissionStatus = await hydrateAssignmentsWithSubmissionStatus(
        token as string,
        assignments
      );

      return sortAssignmentsByDeadline(withSubmissionStatus);
    },
  });

  useSessionExpiryGuard(query.error, query.isError);
  return query;
}

export function useCalendarEventsQuery(range?: CalendarQueryRange) {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const coursesQuery = useCoursesQuery();

  const allCourseIds = useMemo(
    () => (coursesQuery.data ?? []).map((course) => course.id),
    [coursesQuery.data]
  );
  const allCourseIdKey = allCourseIds.join(',');
  const rangeKey = range ? `${range.timeStart}-${range.timeEnd}` : 'default';

  const query = useQuery({
    queryKey: ['calendar-events', user?.id ?? 'anon', allCourseIdKey, rangeKey],
    enabled: Boolean(token && allCourseIds.length > 0),
    staleTime: STALE_TIME_MS,
    retry: shouldRetryQuery,
    queryFn: () => getCalendarEvents(token as string, allCourseIds, range),
  });

  useSessionExpiryGuard(query.error, query.isError);
  return query;
}

export function useAttendanceSessionsQuery() {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const coursesQuery = useCoursesQuery();

  const allCourseIds = useMemo(
    () => (coursesQuery.data ?? []).map((course) => course.id),
    [coursesQuery.data]
  );
  const allCourseIdKey = allCourseIds.join(',');

  const query = useQuery({
    queryKey: ['attendance-sessions', user?.id ?? 'anon', allCourseIdKey],
    enabled: Boolean(token && allCourseIds.length > 0),
    staleTime: STALE_TIME_MS,
    retry: shouldRetryQuery,
    queryFn: async () => {
      const sessions = await getAttendanceSessions(token as string, allCourseIds);

      if (!user?.id) {
        return sessions;
      }

      return useAttendanceHistoryStore.getState().mergeSessionsForUser(user.id, sessions);
    },
  });

  useSessionExpiryGuard(query.error, query.isError);
  return query;
}
