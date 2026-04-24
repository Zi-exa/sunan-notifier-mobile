import React from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { AssignmentItem } from '@/types/moodle';
import { formatDateTime } from '@/lib/utils/date';
import { Badge } from './Badge';
import { Radius, Shadow } from './theme';
import { useTheme } from './ThemeContext';

type TaskCardProps = {
  task: AssignmentItem;
  onPress?: (task: AssignmentItem) => void;
};

const STATUS_BADGE_VARIANT: Record<AssignmentItem['status'], React.ComponentProps<typeof Badge>['variant']> = {
  pending: 'pending',
  submitted: 'submitted',
  overdue: 'overdue',
  unknown: 'unknown',
};

const STATUS_BADGE_LABEL: Record<AssignmentItem['status'], string> = {
  pending: 'Belum Dikerjakan',
  submitted: 'Sudah Submit',
  overdue: 'Terlambat',
  unknown: 'Belum Terverifikasi',
};

const STATUS_ACCENT: Record<AssignmentItem['status'], string> = {
  pending: '#FFB347',
  submitted: '#2ECC71',
  overdue: '#FF5C5C',
  unknown: '#4F8EF7',
};

function getOpenBadge(openDate: number | undefined): { label: string; variant: React.ComponentProps<typeof Badge>['variant'] } | null {
  if (!openDate || openDate <= 0) return null;
  const now = Math.floor(Date.now() / 1000);
  if (now >= openDate) return { label: 'Sudah Dibuka', variant: 'accent' };
  return { label: 'Belum Dibuka', variant: 'available' };
}

export function TaskCard({ task, onPress }: TaskCardProps) {
  const { colors } = useTheme();
  const statusVariant = STATUS_BADGE_VARIANT[task.status];
  const statusLabel = STATUS_BADGE_LABEL[task.status];
  const accentColor = STATUS_ACCENT[task.status];
  const activityLabel = task.activityType === 'quiz' ? 'Quiz' : 'Tugas';
  const openBadge = getOpenBadge(task.openDate);

  return (
    <Pressable
      onPress={() => onPress?.(task)}
      android_ripple={{ color: colors.borderMuted, borderless: false }}
      style={({ pressed }) => [
        styles.container,
        { backgroundColor: colors.bgCard, borderColor: colors.borderSubtle },
        pressed && { opacity: 0.85 },
      ]}
    >
      <View style={[styles.accentStrip, { backgroundColor: accentColor }]} />
      <View style={styles.body}>
        <View style={styles.headerRow}>
          <Text style={[styles.course, { color: colors.textSecondary }]} numberOfLines={1}>{task.courseName}</Text>
          <View style={styles.badgeRow}>
            {openBadge && <Badge variant={openBadge.variant} label={openBadge.label} />}
            <Badge variant={statusVariant} label={statusLabel} />
          </View>
        </View>
        <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={2}>{task.name}</Text>
        <View style={styles.activityRow}>
          <FontAwesome
            name={task.activityType === 'quiz' ? 'question-circle-o' : 'file-text-o'}
            size={12}
            color={colors.accent}
          />
          <Text style={[styles.activityType, { color: colors.accent }]}>{activityLabel}</Text>
        </View>
        {!!task.intro && (
          <Text style={[styles.intro, { color: colors.textSecondary }]} numberOfLines={2}>{task.intro}</Text>
        )}
        <View style={[styles.timeBlock, { borderTopColor: colors.borderSubtle }]}>
          {task.openDate != null && task.openDate > 0 && (
            <TaskMetaRow
              icon="calendar-o"
              label="Dibuka"
              value={formatDateTime(task.openDate)}
              valueColor={colors.textPrimary}
            />
          )}
          <TaskMetaRow
            icon="clock-o"
            label="Deadline"
            value={formatDateTime(task.dueDate)}
            valueColor={task.status === 'overdue' ? colors.danger : colors.textPrimary}
          />
        </View>
      </View>
    </Pressable>
  );
}

type TaskMetaRowProps = {
  icon: React.ComponentProps<typeof FontAwesome>['name'];
  label: string;
  value: string;
  valueColor: string;
};

function TaskMetaRow({ icon, label, value, valueColor }: TaskMetaRowProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.timeRow}>
      <View style={styles.timeLabelRow}>
        <FontAwesome name={icon} size={11} color={colors.textMuted} />
        <Text style={[styles.timeLabel, { color: colors.textMuted }]}>{label}</Text>
      </View>
      <Text style={[styles.timeValue, { color: valueColor }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', borderRadius: Radius.md, borderWidth: 1, overflow: 'hidden', ...Shadow.card },
  pressed: { opacity: 0.82 },
  accentStrip: { width: 4, borderTopLeftRadius: Radius.md, borderBottomLeftRadius: Radius.md },
  body: { flex: 1, padding: 12, gap: 6 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 },
  badgeRow: { flexDirection: 'row', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end', flexShrink: 0 },
  course: { fontSize: 11, fontWeight: '600', flexShrink: 1, textTransform: 'uppercase', letterSpacing: 0.3 },
  title: { fontSize: 15, fontWeight: '700', lineHeight: 21 },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  activityType: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  intro: { fontSize: 12, lineHeight: 18 },
  timeBlock: { marginTop: 4, gap: 3, paddingTop: 8, borderTopWidth: 1 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timeLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  timeLabel: { fontSize: 11, fontWeight: '500' },
  timeValue: { fontSize: 11, fontWeight: '700' },
});
