import { useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState, TaskCard, useTheme } from '@/components/Redesign';
import { Radius } from '@/components/Redesign/theme';
import { FloatingFilterMenu, FloatingFilterOption } from '@/components/app/FloatingFilterMenu';
import { getFloatingFilterContentPadding } from '@/components/app/floatingLayout';
import { getReadableErrorMessage } from '@/lib/moodle/errors';
import { useAssignmentsQuery, useCoursesQuery } from '@/lib/queries/useMoodleQueries';
import { AssignmentStatus } from '@/types/moodle';
import { areAssignmentStatusesResolved } from '@/lib/utils/tasks';

type FilterKey = 'all' | AssignmentStatus;

const FILTER_OPTIONS: FloatingFilterOption<FilterKey>[] = [
  { key: 'all', label: 'Semua', icon: 'th-large' },
  { key: 'pending', label: 'Belum Dikerjakan', icon: 'edit' },
  { key: 'submitted', label: 'Sudah Submit', icon: 'check-circle' },
  { key: 'overdue', label: 'Terlambat', icon: 'warning' },
  { key: 'unknown', label: 'Belum Terverifikasi', icon: 'question-circle-o' },
];

export default function TasksScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<FilterKey>('all');
  const coursesQuery = useCoursesQuery();
  const assignmentsQuery = useAssignmentsQuery();
  const assignmentsReady = areAssignmentStatusesResolved(assignmentsQuery.data ?? []);
  const contentBottomPadding = getFloatingFilterContentPadding(insets.bottom);

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

  return (
    <View style={[styles.screen, { backgroundColor: colors.bgBase }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: contentBottomPadding }]}
        scrollIndicatorInsets={{ bottom: contentBottomPadding }}
        refreshControl={
          <RefreshControl
            refreshing={assignmentsQuery.isRefetching}
            onRefresh={() => assignmentsQuery.refetch()}
            tintColor={colors.accent}
          />
        }
      >
        <View style={styles.taskList}>
          {coursesQuery.isLoading || assignmentsQuery.isLoading ? (
            <View style={[styles.stateCard, { backgroundColor: colors.bgCard, borderColor: colors.borderSubtle }]}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={[styles.stateTitle, { color: colors.textPrimary }]}>Memuat daftar tugas...</Text>
              <Text style={[styles.stateDescription, { color: colors.textSecondary }]}>
                Menyiapkan data tugas dari SUNAN.
              </Text>
            </View>
          ) : coursesQuery.isError ? (
            <EmptyState
              title="Daftar tugas belum tersedia"
              description={getReadableErrorMessage(coursesQuery.error, 'tasks')}
              icon="warning"
            />
          ) : !assignmentsReady ? (
            <View style={[styles.stateCard, { backgroundColor: colors.bgCard, borderColor: colors.borderSubtle }]}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={[styles.stateTitle, { color: colors.textPrimary }]}>Menyelaraskan status tugas...</Text>
              <Text style={[styles.stateDescription, { color: colors.textSecondary }]}>
                Menunggu status submit terakhir agar daftar tetap stabil.
              </Text>
            </View>
          ) : assignmentsQuery.isError ? (
            <EmptyState
              title="Daftar tugas belum tersedia"
              description={getReadableErrorMessage(assignmentsQuery.error, 'tasks')}
              icon="warning"
            />
          ) : visibleTasks.length === 0 ? (
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
                detailLabel="Detail Tugas"
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
  },
  taskList: {
    gap: 10,
  },
  stateCard: {
    minHeight: 260,
    borderWidth: 1,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 24,
  },
  stateTitle: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  stateDescription: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
});
