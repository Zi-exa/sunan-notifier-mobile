import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AssignmentItem } from '@/types/moodle';
import { formatDateTime } from '@/lib/utils/date';

type TaskCardProps = {
  task: AssignmentItem;
  onPress?: (task: AssignmentItem) => void;
};

const STATUS_THEME = {
  pending: {
    label: 'Belum Dikerjakan',
    badgeBackground: '#FFF5CC',
    badgeText: '#925E00',
    border: '#F2DD83',
  },
  submitted: {
    label: 'Sudah Dikumpulkan',
    badgeBackground: '#DCF8E9',
    badgeText: '#11623A',
    border: '#9BE6BE',
  },
  overdue: {
    label: 'Terlambat',
    badgeBackground: '#FFE0E0',
    badgeText: '#8C1F1F',
    border: '#FFBCBC',
  },
  unknown: {
    label: 'Masih Dicek',
    badgeBackground: '#E9EDFA',
    badgeText: '#2F4A8C',
    border: '#CCDAFF',
  },
} as const;

function getAvailabilityInfo(openDate?: number): {
  label: string;
  isOpen: boolean;
  bgColor: string;
  textColor: string;
} | null {
  if (!openDate || openDate <= 0) return null;

  const now = Math.floor(Date.now() / 1000);
  if (now >= openDate) {
    return {
      label: 'Sudah Dibuka',
      isOpen: true,
      bgColor: '#DCF1FC',
      textColor: '#0C5E8A',
    };
  }
  return {
    label: 'Belum Dibuka',
    isOpen: false,
    bgColor: '#F0E6FF',
    textColor: '#5B2E91',
  };
}

export function TaskCard({ task, onPress }: TaskCardProps) {
  const statusTheme = STATUS_THEME[task.status] ?? STATUS_THEME.unknown;
  const activityLabel = task.activityType === 'quiz' ? 'Kuis' : 'Tugas';
  const availability = getAvailabilityInfo(task.openDate);

  return (
    <Pressable
      onPress={() => onPress?.(task)}
      style={({ pressed }) => [
        styles.container,
        { borderColor: statusTheme.border },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.headerRow}>
        <Text style={styles.course}>{task.courseName}</Text>
        <View style={styles.badgeRow}>
          {availability && (
            <View style={[styles.badge, { backgroundColor: availability.bgColor }]}>
              <Text style={[styles.badgeText, { color: availability.textColor }]}>
                {availability.label}
              </Text>
            </View>
          )}
          <View style={[styles.badge, { backgroundColor: statusTheme.badgeBackground }]}>
            <Text style={[styles.badgeText, { color: statusTheme.badgeText }]}>{statusTheme.label}</Text>
          </View>
        </View>
      </View>

      <Text style={styles.title}>{task.name}</Text>
      <Text style={styles.activityType}>{activityLabel}</Text>
      {!!task.intro && <Text style={styles.intro} numberOfLines={2}>{task.intro}</Text>}

      <View style={styles.timeBlock}>
        {task.openDate != null && task.openDate > 0 && (
          <View style={styles.timeRow}>
            <Text style={styles.timeLabel}>Dibuka</Text>
            <Text style={styles.timeValue}>{formatDateTime(task.openDate)}</Text>
          </View>
        )}
        <View style={styles.timeRow}>
          <Text style={styles.timeLabel}>Deadline</Text>
          <Text style={styles.timeValue}>{formatDateTime(task.dueDate)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    padding: 14,
    gap: 8,
  },
  pressed: {
    opacity: 0.86,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 5,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  course: {
    color: '#3A4560',
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 1,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  title: {
    color: '#121D33',
    fontSize: 16,
    fontWeight: '700',
  },
  activityType: {
    color: '#35558F',
    fontSize: 12,
    fontWeight: '700',
  },
  intro: {
    color: '#4B5872',
    fontSize: 13,
    lineHeight: 19,
  },
  timeBlock: {
    marginTop: 2,
    gap: 4,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeLabel: {
    color: '#607089',
    fontSize: 12,
    fontWeight: '500',
  },
  timeValue: {
    color: '#0D1B35',
    fontSize: 12,
    fontWeight: '700',
  },
});

