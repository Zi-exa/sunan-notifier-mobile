import { useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { EmptyState, LoadingView, TaskCard, useTheme } from '@/components/Redesign';
import { FloatingFilterMenu } from '@/components/app/FloatingFilterMenu';
import { getReadableErrorMessage } from '@/lib/moodle/errors';
import { useAssignmentsQuery } from '@/lib/queries/useMoodleQueries';
import { AssignmentStatus } from '@/types/moodle';
import { areAssignmentStatusesResolved } from '@/lib/utils/tasks';

type FilterKey = 'all' | AssignmentStatus;

const FILTER_OPTIONS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'Semua' },
  { key: 'pending', label: 'Belum Dikerjakan' },
  { key: 'submitted', label: 'Sudah Submit' },
  { key: 'overdue', label: 'Terlambat' },
  { key: 'unknown', label: 'Belum Terverifikasi' },
];

export default function TasksScreen() {
  const { colors } = useTheme();
  const [filter, setFilter] = useState<FilterKey>('all');
  const assignmentsQuery = useAssignmentsQuery();
  const assignmentsReady = areAssignmentStatusesResolved(assignmentsQuery.data ?? []);

  const availableFilters = useMemo(() => {
    const hasUnknown = (assignmentsQuery.data ?? []).some((task) => task.status === 'unknown');
    const base = FILTER_OPTIONS.filter((o) => o.key !== 'unknown');
    return hasUnknown ? FILTER_OPTIONS : base;
  }, [assignmentsQuery.data]);

  useEffect(() => {
    if (!availableFilters.some((o) => o.key === filter)) {
      setFilter('all');
    }
  }, [availableFilters, filter]);

  const visibleTasks = useMemo(() => {
    const tasks = assignmentsQuery.data ?? [];
    if (filter === 'all') return tasks;
    return tasks.filter((task) => task.status === filter);
  }, [assignmentsQuery.data, filter]);

  if (assignmentsQuery.isLoading) {
    return <LoadingView text="Memuat daftar tugas..." />;
  }

  if (!assignmentsReady) {
    return <LoadingView text="Menyelaraskan status tugas..." />;
  }

  if (assignmentsQuery.isError) {
    return (
      <View style={styles.screen}>
        <View style={styles.content}>
          <EmptyState
            title="Daftar tugas belum tersedia"
            description={getReadableErrorMessage(assignmentsQuery.error, 'tasks')}
            icon="warning"
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.bgBase }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={assignmentsQuery.isRefetching}
            onRefresh={() => assignmentsQuery.refetch()}
            tintColor={colors.accent}
          />
        }
      >
        <View style={styles.taskList}>
          {visibleTasks.length === 0 ? (
            <EmptyState
              title="Tidak ada tugas"
              description="Filter yang dipilih tidak memiliki tugas saat ini."
              icon="inbox"
            />
          ) : (
            visibleTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onPress={(selectedTask) => router.push(`/task/${selectedTask.id}`)}
              />
            ))
          )}
        </View>
      </ScrollView>
      <FloatingFilterMenu
        title="Filter Tugas"
        options={availableFilters}
        selected={filter}
        onSelect={setFilter}
        allKey="all"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 176,
  },
  taskList: {
    gap: 10,
  },
});
