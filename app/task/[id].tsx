import { useEffect, useMemo } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState, useTheme, Radius, Shadow } from '@/components/Redesign';
import { getReadableErrorMessage } from '@/lib/moodle/errors';
import { useAssignmentsQuery } from '@/lib/queries/useMoodleQueries';
import { useAuthStore } from '@/lib/stores/authStore';
import { formatDateTime } from '@/lib/utils/date';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Belum Dikerjakan',
  submitted: 'Sudah Submit',
  overdue: 'Terlambat',
  unknown: 'Belum Terverifikasi',
};

export default function TaskDetailScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const authHydrated = useAuthStore((state) => state.hydrated);
  const authStatus = useAuthStore((state) => state.status);
  const assignmentsQuery = useAssignmentsQuery();

  const STATUS_COLOR: Record<string, string> = {
    pending: colors.warning,
    submitted: colors.success,
    overdue: colors.danger,
    unknown: colors.accent,
  };

  const task = useMemo(() => {
    const taskId = Number(params.id);
    if (!Number.isFinite(taskId)) return null;
    return (assignmentsQuery.data ?? []).find((item) => item.id === taskId) ?? null;
  }, [assignmentsQuery.data, params.id]);

  const cardMaxHeight = Math.max(420, windowHeight - insets.top - insets.bottom - 48);

  useEffect(() => {
    if (authHydrated && authStatus !== 'authenticated') {
      router.replace('/login');
    }
  }, [authHydrated, authStatus, router]);

  const renderBody = () => {
    if (assignmentsQuery.isLoading) {
      return (
        <View style={styles.stateWrap}>
          <FontAwesome name="circle-o-notch" size={28} color={colors.accent} />
          <Text style={[styles.stateTitle, { color: colors.textPrimary }]}>Memuat detail tugas...</Text>
          <Text style={[styles.stateText, { color: colors.textSecondary }]}>
            Menyiapkan detail tugas Anda.
          </Text>
        </View>
      );
    }

    if (assignmentsQuery.isError) {
      return (
        <View style={styles.stateWrap}>
          <EmptyState
            title="Detail tugas belum bisa ditampilkan"
            description={getReadableErrorMessage(assignmentsQuery.error, 'tasks')}
            icon="warning"
          />
          <Pressable
            style={({ pressed }) => [
              styles.retryButton,
              { backgroundColor: colors.accent },
              pressed && { opacity: 0.82 },
            ]}
            onPress={() => assignmentsQuery.refetch()}
          >
            <Text style={styles.retryButtonText}>Coba Lagi</Text>
          </Pressable>
        </View>
      );
    }

    if (!task) {
      return (
        <View style={styles.stateWrap}>
          <EmptyState
            title="Tugas tidak ditemukan"
            description="Data tugas mungkin sudah berubah. Tutup halaman ini lalu buka lagi daftar tugas."
            icon="search"
          />
        </View>
      );
    }

    const isQuizTask = task.activityType === 'quiz';
    const activityLabel = isQuizTask ? 'Quiz' : 'Tugas';
    const statusColor = STATUS_COLOR[task.status] ?? colors.accent;
    const statusLabel = STATUS_LABEL[task.status] ?? task.status;

    return (
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.headerCard, { backgroundColor: colors.bgCard, borderColor: colors.borderSubtle }]}>
          <View style={[styles.accentBar, { backgroundColor: statusColor }]} />
          <View style={styles.headerBody}>
            <Text style={[styles.course, { color: colors.textSecondary }]}>{task.courseName}</Text>
            <View style={[styles.activityBadge, { backgroundColor: isQuizTask ? colors.purpleDim : colors.accentDim }]}>
              <View style={styles.activityBadgeRow}>
                <FontAwesome
                  name={isQuizTask ? 'question-circle-o' : 'file-text-o'}
                  size={12}
                  color={isQuizTask ? colors.purple : colors.accent}
                />
                <Text style={[styles.activityBadgeText, { color: isQuizTask ? colors.purple : colors.accent }]}>
                  {activityLabel}
                </Text>
              </View>
            </View>
            <Text style={[styles.title, { color: colors.textPrimary }]}>{task.name}</Text>
            {task.openDate != null && task.openDate > 0 && (
              <DetailMetaRow icon="calendar-o" label="Dibuka" value={formatDateTime(task.openDate)} />
            )}
            <DetailMetaRow icon="clock-o" label="Deadline" value={formatDateTime(task.dueDate)} />
          </View>
        </View>

        <View style={[styles.bodyCard, { backgroundColor: colors.bgCard, borderColor: colors.borderSubtle }]}>
          <View style={styles.sectionLabelRow}>
            <FontAwesome name="align-left" size={12} color={colors.textMuted} />
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>DESKRIPSI</Text>
          </View>
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            {task.intro ?? 'Belum ada deskripsi tambahan.'}
          </Text>
        </View>

        <View style={[styles.bodyCard, { backgroundColor: colors.bgCard, borderColor: colors.borderSubtle }]}>
          <View style={styles.sectionLabelRow}>
            <FontAwesome name="check-circle-o" size={12} color={colors.textMuted} />
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>STATUS PENGERJAAN</Text>
          </View>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
          {!isQuizTask && !!task.submissionModifiedAt && (
            <Text style={[styles.metaMuted, { color: colors.textMuted }]}>
              Terakhir diperbarui: {formatDateTime(task.submissionModifiedAt)}
            </Text>
          )}
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: colors.accent },
            pressed && { opacity: 0.82 },
          ]}
          onPress={() => Linking.openURL(task.quickLink)}
        >
          <View style={styles.primaryButtonContent}>
            <FontAwesome name="external-link" size={14} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>
              {isQuizTask ? 'Buka Quiz di SUNAN' : 'Buka Tugas di SUNAN'}
            </Text>
          </View>
        </Pressable>
      </ScrollView>
    );
  };

  if (!authHydrated || authStatus === 'loading' || authStatus !== 'authenticated') {
    return null;
  }

  return (
    <View style={styles.overlayRoot}>
      <Pressable style={styles.backdrop} onPress={() => router.back()} />
      <View
        style={[
          styles.modalCard,
          {
            backgroundColor: colors.bgSurface,
            borderColor: colors.borderSubtle,
            marginTop: insets.top + 24,
            marginBottom: Math.max(insets.bottom + 24, 32),
            maxHeight: cardMaxHeight,
          },
        ]}
      >
        <View style={[styles.modalHeader, { borderBottomColor: colors.borderSubtle }]}>
          <View style={styles.headerCopy}>
            <Text style={[styles.modalEyebrow, { color: colors.textMuted }]}>RINGKASAN</Text>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Detail Tugas</Text>
          </View>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.closeButton,
              { backgroundColor: colors.bgCard, borderColor: colors.borderSubtle },
              pressed && { opacity: 0.82 },
            ]}
          >
            <FontAwesome name="close" size={16} color={colors.textPrimary} />
          </Pressable>
        </View>

        {renderBody()}
      </View>
    </View>
  );
}

type DetailMetaRowProps = {
  icon: React.ComponentProps<typeof FontAwesome>['name'];
  label: string;
  value: string;
};

function DetailMetaRow({ icon, label, value }: DetailMetaRowProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.metaRow}>
      <View style={styles.metaLabelRow}>
        <FontAwesome name={icon} size={12} color={colors.textSecondary} />
        <Text style={[styles.metaText, { color: colors.textSecondary }]}>{label}:</Text>
      </View>
      <Text style={[styles.metaText, { color: colors.textSecondary }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlayRoot: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(3, 8, 20, 0.68)',
  },
  modalCard: {
    borderWidth: 1,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    ...Shadow.card,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerCopy: {
    gap: 2,
    flexShrink: 1,
  },
  modalEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.3,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    padding: 16,
    gap: 12,
    paddingBottom: 18,
  },
  stateWrap: {
    minHeight: 280,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  stateTitle: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  stateText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    borderRadius: Radius.md,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  headerCard: { borderRadius: Radius.lg, borderWidth: 1, overflow: 'hidden', ...Shadow.card },
  accentBar: { height: 4, width: '100%' },
  headerBody: { padding: 16, gap: 6 },
  course: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  activityBadge: { alignSelf: 'flex-start', borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 3 },
  activityBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  activityBadgeText: { fontSize: 11, fontWeight: '700' },
  title: { fontSize: 22, fontWeight: '800', lineHeight: 30 },
  metaText: { fontSize: 13 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  metaLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bodyCard: { borderRadius: Radius.md, borderWidth: 1, padding: 14, gap: 8, ...Shadow.subtle },
  sectionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase' },
  description: { fontSize: 14, lineHeight: 22 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { fontSize: 15, fontWeight: '700' },
  metaMuted: { fontSize: 12 },
  primaryButton: { borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center', ...Shadow.subtle },
  primaryButtonContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14, letterSpacing: 0.2 },
});
