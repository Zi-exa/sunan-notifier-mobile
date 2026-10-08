import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, Image, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AttendanceCard,
  EmptyState,
  KpiGrid,
  LoadingView,
  SectionCard,
  TaskCard,
  useTheme,
} from '@/components/Redesign';
import { getDockContentPadding } from '@/components/app/floatingLayout';
import { TabScreenHeader } from '@/components/app/TabScreenHeader';
import {
  useAssignmentsQuery,
  useAttendanceSessionsQuery,
  useCoursesQuery,
} from '@/lib/queries/useMoodleQueries';
import { useAuthStore } from '@/lib/stores/authStore';
import { getReadableErrorMessage } from '@/lib/moodle/errors';
import { getAvatarInitial, getDisplayFirstName, getTimeBasedGreeting } from '@/lib/utils/displayName';
import { areAssignmentStatusesResolved, countPendingAssignments } from '@/lib/utils/tasks';

const HERO_PALETTE = {
  background: '#0F1731',
  border: '#1F356A',
  surface: 'rgba(126, 175, 255, 0.14)',
  accent: '#7EB0FF',
  textPrimary: '#F7FAFF',
  textSecondary: '#B7C7EA',
  glowPrimary: 'rgba(126, 175, 255, 0.14)',
  glowSecondary: 'rgba(71, 104, 184, 0.18)',
  avatarBorder: 'rgba(126, 175, 255, 0.36)',
};

export default function DashboardScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const coursesQuery = useCoursesQuery();
  const assignmentsQuery = useAssignmentsQuery();
  const attendanceQuery = useAttendanceSessionsQuery();

  const courses = coursesQuery.data ?? [];
  const assignments = assignmentsQuery.data ?? [];
  const attendances = attendanceQuery.data ?? [];
  const assignmentsReady = areAssignmentStatusesResolved(assignments);
  // Only show non-submitted tasks in "Deadline Terdekat" — submitted tasks
  // should not appear as pending work on the dashboard.
  const pendingAssignments = assignmentsReady
    ? assignments.filter((item) => item.status !== 'submitted')
    : [];
  const upcoming = pendingAssignments.slice(0, 4);
  const attendanceHighlights = attendances
    .filter((item) => item.status !== 'closed')
    .slice(0, 3);
  const openAttendanceCount = attendances.filter((item) => item.status === 'open').length;
  const closingSoonAttendanceCount = attendances.filter(
    (item) => item.status === 'closing_soon'
  ).length;
  const pendingCount = assignmentsReady ? countPendingAssignments(assignments) : '...';
  const overdueCount = assignmentsReady ? assignments.filter((item) => item.status === 'overdue').length : '...';
  const submittedCount = assignmentsReady ? assignments.filter((item) => item.status === 'submitted').length : '...';
  const displayName = getDisplayFirstName({
    fullname: user?.fullname,
    firstname: user?.firstname,
    lastname: user?.lastname,
    nim: user?.nim,
    username: user?.username,
  });
  const contentBottomPadding = getDockContentPadding(insets.bottom);
  const dashboardError = coursesQuery.error ?? assignmentsQuery.error ?? attendanceQuery.error;
  const [now, setNow] = useState(() => new Date());
  const greeting = getTimeBasedGreeting(now);
  const dateLabel = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(now);

  // Perbarui sapaan bila aplikasi tetap terbuka melewati batas jam.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Self-heal sesi lama yang fullname-nya masih NIM: refresh sekali dari Moodle.
  useEffect(() => {
    if (displayName === 'Mahasiswa' && user) {
      void useAuthStore.getState().refreshProfile?.();
    }
  }, [displayName, user]);

  if (coursesQuery.isLoading || assignmentsQuery.isLoading || attendanceQuery.isLoading) {
    return <LoadingView text="Memuat dashboard..." />;
  }

  if (coursesQuery.isError || assignmentsQuery.isError || attendanceQuery.isError) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.bgBase }]}>
        <TabScreenHeader routeKey="index" />
        <ScrollView
          contentContainerStyle={[styles.errorContainer, { paddingBottom: contentBottomPadding }]}
          scrollIndicatorInsets={{ bottom: contentBottomPadding }}
          refreshControl={
            <RefreshControl
              refreshing={
                coursesQuery.isRefetching ||
                assignmentsQuery.isRefetching ||
                attendanceQuery.isRefetching
              }
              onRefresh={() => {
                coursesQuery.refetch();
                assignmentsQuery.refetch();
                attendanceQuery.refetch();
              }}
              tintColor={colors.accent}
            />
          }
        >
          <EmptyState
            title="Dashboard belum bisa ditampilkan"
            description={getReadableErrorMessage(dashboardError, 'dashboard')}
            icon="warning"
          />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.bgBase }]}>
      <TabScreenHeader routeKey="index" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: contentBottomPadding }]}
        scrollIndicatorInsets={{ bottom: contentBottomPadding }}
        refreshControl={
          <RefreshControl
            refreshing={
              coursesQuery.isRefetching ||
              assignmentsQuery.isRefetching ||
              attendanceQuery.isRefetching
            }
            onRefresh={() => {
              coursesQuery.refetch();
              assignmentsQuery.refetch();
              attendanceQuery.refetch();
            }}
            tintColor={colors.accent}
          />
        }
      >
        {/* Hero header */}
        <View
          style={[
            styles.hero,
            { backgroundColor: HERO_PALETTE.background, borderColor: HERO_PALETTE.border },
          ]}
        >
        <View
          style={[
            styles.heroGlow,
            styles.heroGlowPrimary,
            { backgroundColor: HERO_PALETTE.glowPrimary },
          ]}
        />
        <View
          style={[
            styles.heroGlow,
            styles.heroGlowSecondary,
            { backgroundColor: HERO_PALETTE.glowSecondary },
          ]}
        />
        <View style={styles.heroContent}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroTextStack}>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.6}
                ellipsizeMode="tail"
                style={[styles.heroGreeting, { color: HERO_PALETTE.textPrimary }]}
              >
                {greeting}, {displayName}
              </Text>
              <Text style={[styles.heroDate, { color: HERO_PALETTE.textSecondary }]}>
                {dateLabel}
              </Text>
            </View>
            {user?.pictureUrl ? (
              <Image
                source={{ uri: user.pictureUrl }}
                style={[styles.avatar, { borderColor: HERO_PALETTE.avatarBorder }]}
              />
            ) : (
              <View
                style={[
                  styles.avatarFallback,
                  {
                    backgroundColor: HERO_PALETTE.surface,
                    borderColor: HERO_PALETTE.avatarBorder,
                  },
                ]}
              >
                <Text style={[styles.avatarInitial, { color: HERO_PALETTE.accent }]}>
                  {getAvatarInitial({
                    fullname: user?.fullname,
                    firstname: user?.firstname,
                    lastname: user?.lastname,
                    nim: user?.nim,
                    username: user?.username,
                  })}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* KPI Grid */}
      <KpiGrid
        items={[
          {
            label: 'Matkul Aktif',
            value: courses.length,
            icon: 'book',
            iconColor: colors.accent,
            iconBackground: colors.accentDim,
          },
          {
            label: 'Belum Dikerjakan',
            value: pendingCount,
            icon: 'clipboard',
            iconColor: colors.success,
            iconBackground: colors.successDim,
            valueColor:
              assignmentsReady && typeof pendingCount === 'number' && pendingCount > 0
                ? colors.textPrimary
                : colors.textPrimary,
          },
          {
            label: 'Overdue',
            value: overdueCount,
            icon: 'clock-o',
            iconColor: colors.danger,
            iconBackground: colors.dangerDim,
            valueColor:
              assignmentsReady && typeof overdueCount === 'number' && overdueCount > 0
                ? colors.textPrimary
                : colors.textPrimary,
          },
          {
            label: 'Terkumpul',
            value: submittedCount,
            icon: 'check-circle',
            iconColor: colors.success,
            iconBackground: colors.successDim,
            valueColor:
              assignmentsReady && typeof submittedCount === 'number' && submittedCount > 0
                ? colors.textPrimary
                : colors.textPrimary,
          },
        ]}
      />

      {/* Absensi aktif */}
      <SectionCard
        title="Absensi Aktif"
        icon="check-square-o"
        subtitle={`Dibuka: ${openAttendanceCount} · Segera tutup: ${closingSoonAttendanceCount}`}
      >
        {attendanceHighlights.length === 0 ? (
          <EmptyState
            title="Belum ada absensi aktif"
            description="Belum ada absensi tersedia."
            icon="check-circle-o"
          />
        ) : (
          attendanceHighlights.map((attendance) => (
            <AttendanceCard key={attendance.eventId} attendance={attendance} />
          ))
        )}
      </SectionCard>

      {/* Deadline terdekat */}
        <SectionCard
          title="Deadline Terdekat"
          icon="graduation-cap"
          subtitle={assignmentsReady ? undefined : 'Memuat tugas…'}
        >
          {!assignmentsReady ? (
            <View style={styles.inlineLoading}>
              <ActivityIndicator accessibilityLabel="Memuat tugas" color={colors.accent} />
            </View>
          ) : upcoming.length === 0 ? (
            <EmptyState
              title="Belum ada tugas"
              description="Tidak ada tugas aktif."
              icon="inbox"
            />
          ) : (
            upcoming.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onPress={(selectedTask) => router.push(`/task/${selectedTask.id}`)}
                showPreview={false}
              />
            ))
          )}
        </SectionCard>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16, gap: 14 },
  errorContainer: { flex: 1, padding: 16, justifyContent: 'center' },
  hero: { position: 'relative', borderRadius: 24, borderWidth: 1, overflow: 'hidden' },
  heroContent: { paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  heroGlow: { position: 'absolute', borderRadius: 999 },
  heroGlowPrimary: { width: 176, height: 176, top: -92, right: -36 },
  heroGlowSecondary: { width: 128, height: 128, bottom: -54, left: -28 },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 16 },
  heroTextStack: { flex: 1, gap: 2 },
  heroGreeting: { fontSize: 24, fontWeight: '800' },
  heroDate: { fontSize: 12, fontWeight: '600' },
  inlineLoading: { alignItems: 'flex-start', paddingVertical: 8 },
  // Avatar
  avatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 2 },
  avatarFallback: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { fontSize: 18, fontWeight: '800' },
});
