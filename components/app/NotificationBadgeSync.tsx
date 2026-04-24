import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useAssignmentsQuery } from '@/lib/queries/useMoodleQueries';
import { setAppBadgeCount } from '@/lib/notifications';
import { countPendingAssignments } from '@/lib/utils/tasks';

export function NotificationBadgeSync() {
  const assignmentsQuery = useAssignmentsQuery();

  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }

    const pendingCount = countPendingAssignments(assignmentsQuery.data ?? []);
    setAppBadgeCount(pendingCount);
  }, [assignmentsQuery.data]);

  return null;
}
