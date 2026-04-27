import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AttendanceCard, EmptyState, useTheme } from '@/components/Redesign';
import { Radius } from '@/components/Redesign/theme';
import { FloatingFilterMenu, FloatingFilterOption } from '@/components/app/FloatingFilterMenu';
import { getFloatingFilterContentPadding } from '@/components/app/floatingLayout';
import { getReadableErrorMessage } from '@/lib/moodle/errors';
import { useAttendanceSessionsQuery, useCoursesQuery } from '@/lib/queries/useMoodleQueries';
import { AttendanceStatus } from '@/types/moodle';

type FilterKey = 'all' | AttendanceStatus;

const FILTER_OPTIONS: FloatingFilterOption<FilterKey>[] = [
  { key: 'all', label: 'Semua', icon: 'th-large' },
  { key: 'open', label: 'Dibuka', icon: 'unlock-alt' },
  { key: 'closing_soon', label: 'Segera Tutup', icon: 'clock-o' },
  { key: 'upcoming', label: 'Akan Datang', icon: 'calendar-o' },
  { key: 'available', label: 'Tersedia', icon: 'check-square-o' },
  { key: 'closed', label: 'Riwayat', icon: 'history' },
];

function normalizeFilterParam(value: string | string[] | undefined): FilterKey {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return 'all';
  if (FILTER_OPTIONS.some((o) => o.key === raw)) return raw as FilterKey;
  return 'all';
}

function parseEventIdParam(value: string | string[] | undefined): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function AttendanceScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ filter?: string | string[]; eventId?: string | string[] }>();
  const [filter, setFilter] = useState<FilterKey>(() => normalizeFilterParam(params.filter));
  const coursesQuery = useCoursesQuery();
  const attendanceQuery = useAttendanceSessionsQuery();
  const targetEventId = useMemo(() => parseEventIdParam(params.eventId), [params.eventId]);
  const contentBottomPadding = getFloatingFilterContentPadding(insets.bottom);

  useEffect(() => {
    const nextFilter = normalizeFilterParam(params.filter);
    setFilter((current) => (current === nextFilter ? current : nextFilter));
  }, [params.filter]);

  const visibleSessions = useMemo(() => {
    const sessions = attendanceQuery.data ?? [];
    let filtered = filter === 'all' ? sessions : sessions.filter((s) => s.status === filter);

    if (targetEventId === null) return filtered;

    const target = sessions.find((s) => s.eventId === targetEventId);
    if (target && !filtered.some((s) => s.eventId === targetEventId)) {
      filtered = [target, ...filtered];
    }

    return [...filtered].sort((a, b) => {
      if (a.eventId === targetEventId) return -1;
      if (b.eventId === targetEventId) return 1;
      return 0;
    });
  }, [attendanceQuery.data, filter, targetEventId]);
  const emptyStateTitle = filter === 'closed' ? 'Belum ada riwayat absensi' : 'Tidak ada absensi';
  const emptyStateDescription =
    filter === 'closed'
      ? 'Riwayat menampilkan absensi yang waktunya sudah lewat.'
      : 'Belum ada sesi absensi untuk filter yang dipilih.';

  return (
    <View style={[styles.screen, { backgroundColor: colors.bgBase }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: contentBottomPadding }]}
        scrollIndicatorInsets={{ bottom: contentBottomPadding }}
        refreshControl={
          <RefreshControl
            refreshing={attendanceQuery.isRefetching}
            onRefresh={() => attendanceQuery.refetch()}
            tintColor={colors.accent}
          />
        }
      >
        <View style={styles.list}>
          {coursesQuery.isLoading || attendanceQuery.isLoading ? (
            <View style={[styles.stateCard, { backgroundColor: colors.bgCard, borderColor: colors.borderSubtle }]}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={[styles.stateTitle, { color: colors.textPrimary }]}>Memuat absensi SUNAN...</Text>
              <Text style={[styles.stateDescription, { color: colors.textSecondary }]}>
                Menyiapkan data absensi.
              </Text>
            </View>
          ) : coursesQuery.isError ? (
            <EmptyState
              title="Absensi belum tersedia"
              description={getReadableErrorMessage(coursesQuery.error, 'attendance')}
              icon="warning"
            />
          ) : attendanceQuery.isError ? (
            <EmptyState
              title="Absensi belum tersedia"
              description={getReadableErrorMessage(attendanceQuery.error, 'attendance')}
              icon="warning"
            />
          ) : visibleSessions.length === 0 ? (
            <EmptyState
              title={emptyStateTitle}
              description={emptyStateDescription}
              icon="check-square-o"
            />
          ) : (
            visibleSessions.map((session) => (
              <AttendanceCard
                key={session.eventId}
                attendance={session}
                highlight={targetEventId !== null && session.eventId === targetEventId}
              />
            ))
          )}
        </View>
      </ScrollView>
      <FloatingFilterMenu
        title="Filter Absensi"
        options={FILTER_OPTIONS}
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
  list: {
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
