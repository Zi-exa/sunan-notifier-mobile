import { ReactNode, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AppSplashScreen } from '@/components/Redesign';
import {
  getAttendanceSessions,
  getAssignments,
  getCalendarEvents,
  getCourses,
  hydrateAssignmentsWithSubmissionStatus,
} from '@/lib/moodle/client';
import { useAuthStore } from '@/lib/stores/authStore';
import { useTabsBootStore } from '@/lib/stores/tabsBootStore';
import { sortAssignmentsByDeadline } from '@/lib/utils/tasks';

const STALE_TIME_MS = 5 * 60 * 1000;
const LOADING_STEPS = [
  'Menyiapkan SUNAN Notifier...',
  'Mengambil data mata kuliah...',
  'Memuat tugas dan absensi...',
  'Menyiapkan dashboard awal...',
  'Hampir selesai...',
];

type BootStatus = 'loading' | 'ready' | 'failed';

function useLoadingStep(active: boolean, resetKey: string) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    setStep(0);

    if (!active) {
      return;
    }

    const interval = setInterval(() => {
      setStep((current) => Math.min(current + 1, LOADING_STEPS.length - 1));
    }, 900);

    return () => clearInterval(interval);
  }, [active, resetKey]);

  return LOADING_STEPS[step];
}

type InitialDataGateProps = {
  children: ReactNode;
};

export function InitialDataGate({ children }: InitialDataGateProps) {
  const queryClient = useQueryClient();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const setTabsBootStatus = useTabsBootStore((state) => state.setStatus);
  const [bootStatus, setBootStatus] = useState<BootStatus>('loading');
  const preloadKey = useMemo(() => `${user?.id ?? 'anon'}`, [user?.id]);
  const subtext = useLoadingStep(bootStatus === 'loading', preloadKey);

  useEffect(() => {
    setTabsBootStatus(bootStatus);
  }, [bootStatus, setTabsBootStatus]);

  useEffect(() => {
    if (!token || !user?.id) {
      setBootStatus('failed');
      return;
    }

    const sessionToken = token;
    const userId = user.id;
    let cancelled = false;
    setBootStatus('loading');

    async function preloadAppData() {
      try {
        const courses = await queryClient.fetchQuery({
          queryKey: ['courses', userId],
          queryFn: () => getCourses(sessionToken, userId),
          staleTime: STALE_TIME_MS,
        });

        const allCourseIds = courses.map((course) => course.id);
        const allCourseIdKey = allCourseIds.join(',');
        const assignmentsQueryKey = ['assignments', userId, allCourseIdKey];
        const attendanceQueryKey = ['attendance-sessions', userId, allCourseIdKey];
        const calendarQueryKey = ['calendar-events', userId, allCourseIdKey];

        if (allCourseIds.length === 0) {
          queryClient.setQueryData(assignmentsQueryKey, []);
          queryClient.setQueryData(attendanceQueryKey, []);
          queryClient.setQueryData(calendarQueryKey, []);

          if (!cancelled) {
            setBootStatus('ready');
          }

          return;
        }

        const [assignments, attendances] = await Promise.all([
          getAssignments(sessionToken, allCourseIds, courses),
          getAttendanceSessions(sessionToken, allCourseIds),
        ]);

        queryClient.setQueryData(assignmentsQueryKey, assignments);
        queryClient.setQueryData(attendanceQueryKey, attendances);

        if (!cancelled) {
          setBootStatus('ready');
        }

        void (async () => {
          try {
            const hydratedAssignments = await hydrateAssignmentsWithSubmissionStatus(
              sessionToken,
              assignments
            );

            if (!cancelled) {
              queryClient.setQueryData(
                assignmentsQueryKey,
                sortAssignmentsByDeadline(hydratedAssignments)
              );
            }
          } catch {
            // Fall back to lightweight assignment data if hydration fails.
          }
        })();

        void queryClient.prefetchQuery({
          queryKey: calendarQueryKey,
          queryFn: () => getCalendarEvents(sessionToken, allCourseIds),
          staleTime: STALE_TIME_MS,
        });
      } catch {
        if (!cancelled) {
          setBootStatus('failed');
        }
      }
    }

    void preloadAppData();

    return () => {
      cancelled = true;
    };
  }, [queryClient, token, user?.id]);

  if (bootStatus === 'loading') {
    return <AppSplashScreen text="SUNAN Notifier" subtext={subtext} />;
  }

  return <>{children}</>;
}
