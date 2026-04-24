import { router } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { ActivityIndicator, Image, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  AttendanceCard,
  EmptyState,
  KpiGrid,
  LoadingView,
  SectionCard,
  TaskCard,
  useTheme,
} from '@/components/Redesign';
import {
  useAssignmentsQuery,
  useAttendanceSessionsQuery,
  useCoursesQuery,
} from '@/lib/queries/useMoodleQueries';
import { useAuthStore } from '@/lib/stores/authStore';
import { getReadableErrorMessage } from '@/lib/moodle/errors';
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
  const user = useAuthStore((state) => state.user);
  const coursesQuery = useCoursesQuery();
  const assignmentsQuery = useAssignmentsQuery();
  const attendanceQuery = useAttendanceSessionsQuery();

  const courses = coursesQuery.data ?? [];
  const assignments = assignmentsQuery.data ?? [];
  const attendances = attendanceQuery.data ?? [];
  const assignmentsReady = areAssignmentStatusesResolved(assignments);
  const upcoming = assignmentsReady ? assignments.slice(0, 4) : [];
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
  const displayName = user?.fullname?.trim()?.split(/\s+/)[0] ?? 'Mahasiswa';

  if (coursesQuery.isLoading || assignmentsQuery.isLoading || attendanceQuery.isLoading) {
    return <LoadingView text="Memuat dashboard SUNAN..." />;
  }

  if (coursesQuery.isError || assignmentsQuery.isError || attendanceQuery.isError) {
    const dashboardError = coursesQuery.error ?? assignmentsQuery.error ?? attendanceQuery.error;
    return (
      <View style={[styles.errorContainer, { backgroundColor: colors.bgBase }]}>
        <EmptyState
          title="Gagal memuat dashboard"
          description={getReadableErrorMessage(dashboardError, 'dashboard')}
          icon="warning"
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.bgBase }]}
      contentContainerStyle={styles.content}
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
            <View style={styles.heroMetaStack}>
              <View
                style={[
                  styles.heroBadge,
                  { backgroundColor: HERO_PALETTE.surface, borderColor: HERO_PALETTE.border },
                ]}
              >
                <View style={styles.heroBadgeRow}>
                  <FontAwesome name="bell-o" size={11} color={HERO_PALETTE.accent} />
                  <Text style={[styles.heroBadgeText, { color: HERO_PALETTE.accent }]}>AKTIF</Text>
                </View>
              </View>
              <Text style={[styles.heroEyebrow, { color: HERO_PALETTE.textSecondary }]}>
                Dashboard akademik UMK
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
                  {user?.fullname?.charAt(0)?.toUpperCase() ?? '?'}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.heroTextStack}>
            <Text style={[styles.heroTitle, { color: HERO_PALETTE.textPrimary }]}>
              SUNAN Notifier
            </Text>
            <Text style={[styles.heroGreeting, { color: HERO_PALETTE.textSecondary }]}>
              Halo, {displayName}
            </Text>
            <Text style={[styles.heroSubtitle, { color: HERO_PALETTE.textSecondary }]}>
              Pantau deadline tugas dan sesi absensi SUNAN dari satu layar.
            </Text>
          </View>
        </View>
      </View>

      {/* KPI Grid */}
      <KpiGrid
        items={[
          { label: 'Matkul Aktif', value: courses.length, icon: 'book', accent: colors.accent },
          {
            label: 'Belum Dikerjakan',
            value: pendingCount,
            icon: 'clock-o',
            accent: assignmentsReady && typeof pendingCount === 'number' && pendingCount > 0 ? colors.warning : colors.textPrimary,
          },
          {
            label: 'Overdue',
            value: overdueCount,
            icon: 'exclamation-circle',
            accent: assignmentsReady && typeof overdueCount === 'number' && overdueCount > 0 ? colors.danger : colors.textPrimary,
          },
          {
            label: 'Sudah Submit',
            value: submittedCount,
            icon: 'check-circle-o',
            accent: assignmentsReady && typeof submittedCount === 'number' && submittedCount > 0 ? colors.success : colors.textPrimary,
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
            description="Tidak ada sesi absensi yang dibuka atau akan dibuka."
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
        subtitle={assignmentsReady ? '4 tugas dengan deadline paling dekat' : 'Menyelaraskan status tugas...'}
      >
        {!assignmentsReady ? (
          <View style={styles.inlineLoading}>
            <ActivityIndicator color={colors.accent} />
            <Text style={[styles.inlineLoadingText, { color: colors.textSecondary }]}>
              Menyiapkan ringkasan tugas yang akurat...
            </Text>
          </View>
        ) : upcoming.length === 0 ? (
          <EmptyState
            title="Belum ada tugas"
            description="Tidak ada tugas aktif saat ini."
            icon="inbox"
          />
        ) : (
          upcoming.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onPress={(selectedTask) => router.push(`/task/${selectedTask.id}`)}
            />
          ))
        )}
      </SectionCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16, gap: 14, paddingBottom: 32 },
  errorContainer: { flex: 1, padding: 16, justifyContent: 'center' },
  hero: { position: 'relative', borderRadius: 24, borderWidth: 1, overflow: 'hidden' },
  heroContent: { padding: 20, gap: 14 },
  heroGlow: { position: 'absolute', borderRadius: 999 },
  heroGlowPrimary: { width: 176, height: 176, top: -92, right: -36 },
  heroGlowSecondary: { width: 128, height: 128, bottom: -54, left: -28 },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 },
  heroMetaStack: { flex: 1, gap: 10 },
  heroBadge: { alignSelf: 'flex-start', borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 5 },
  heroBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  heroEyebrow: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  heroTextStack: { gap: 4 },
  heroTitle: { fontSize: 28, fontWeight: '800', letterSpacing: -0.6 },
  heroGreeting: { fontSize: 15, fontWeight: '600' },
  heroSubtitle: { fontSize: 13, lineHeight: 20, maxWidth: '88%' },
  inlineLoading: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  inlineLoadingText: { fontSize: 13, lineHeight: 18 },
  // Avatar
  avatar: { width: 52, height: 52, borderRadius: 26, borderWidth: 2 },
  avatarFallback: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { fontSize: 20, fontWeight: '800' },
});
