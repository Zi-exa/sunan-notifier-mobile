import { useCallback, useMemo } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { EmptyState, LoadingView, useTheme, Radius, Shadow } from '@/components/Redesign';
import { useAssignmentsQuery } from '@/lib/queries/useMoodleQueries';
import { formatDateTime } from '@/lib/utils/date';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Belum Dikerjakan',
  submitted: 'Sudah Submit',
  overdue: 'Terlambat',
  unknown: 'Belum Terverifikasi',
};

export default function TaskDetailScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ id?: string; from?: string }>();
  const assignmentsQuery = useAssignmentsQuery();
  const shouldReturnToTasks = params.from === 'tasks';

  const STATUS_COLOR: Record<string, string> = {
    pending: colors.warning,
    submitted: colors.success,
    overdue: colors.danger,
    unknown: colors.accent,
  };

  const handleClose = useCallback(() => {
    if (shouldReturnToTasks) {
      router.dismissTo('/(tabs)/tasks');
      return true;
    }

    if (router.canGoBack()) {
      router.back();
      return true;
    }

    router.replace('/(tabs)/tasks');
    return true;
  }, [shouldReturnToTasks]);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', handleClose);
      return () => subscription.remove();
    }, [handleClose])
  );

  const task = useMemo(() => {
    const taskId = Number(params.id);
    if (!Number.isFinite(taskId)) return null;
    return (assignmentsQuery.data ?? []).find((item) => item.id === taskId) ?? null;
  }, [assignmentsQuery.data, params.id]);

  if (assignmentsQuery.isLoading) {
    return <LoadingView text="Memuat detail tugas..." />;
  }

  if (!task) {
    return (
      <View style={[styles.errorWrap, { backgroundColor: colors.bgBase }]}>
        <EmptyState
          title="Tugas tidak ditemukan"
          description="Kemungkinan data sudah berubah. Kembali ke tab Tugas lalu refresh data."
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
    <View style={[styles.screen, { backgroundColor: colors.bgBase }]}>
      <Stack.Screen
        options={{
          headerLeft: () => (
            <Pressable
              accessibilityRole="button"
              onPress={handleClose}
              style={({ pressed }) => [styles.headerBackButton, pressed && styles.headerBackButtonPressed]}
            >
              <FontAwesome name="arrow-left" size={20} color={colors.textPrimary} />
            </Pressable>
          ),
        }}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { backgroundColor: colors.bgBase }]}
      >
      {/* Header card */}
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

      {/* Deskripsi */}
      <View style={[styles.bodyCard, { backgroundColor: colors.bgCard, borderColor: colors.borderSubtle }]}>
        <View style={styles.sectionLabelRow}>
          <FontAwesome name="align-left" size={12} color={colors.textMuted} />
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>DESKRIPSI</Text>
        </View>
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          {task.intro ?? 'Tidak ada deskripsi tambahan dari dosen.'}
        </Text>
      </View>

      {/* Status */}
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
            Terakhir update: {formatDateTime(task.submissionModifiedAt)}
          </Text>
        )}
      </View>

      {/* CTA */}
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
  screen: { flex: 1 },
  scroll: { flex: 1 },
  content: { flexGrow: 1, padding: 16, gap: 12, paddingBottom: 32 },
  errorWrap: { flex: 1, justifyContent: 'center', padding: 16 },
  headerBackButton: { paddingVertical: 6, paddingRight: 14 },
  headerBackButtonPressed: { opacity: 0.72 },
  // ─ Header card ─────────────────────────────────────────────
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
  // ─ Body cards ─────────────────────────────────────────────
  bodyCard: { borderRadius: Radius.md, borderWidth: 1, padding: 14, gap: 8, ...Shadow.subtle },
  sectionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase' },
  description: { fontSize: 14, lineHeight: 22 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { fontSize: 15, fontWeight: '700' },
  metaMuted: { fontSize: 12 },
  // ─ CTA ───────────────────────────────────────────────────
  primaryButton: { borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center', ...Shadow.subtle },
  primaryButtonContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14, letterSpacing: 0.2 },
});
