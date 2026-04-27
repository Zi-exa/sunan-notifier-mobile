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
  detailLabel?: string;
};

const STATUS_BADGE_VARIANT: Record<AssignmentItem['status'], React.ComponentProps<typeof Badge>['variant']> = {
  pending: 'pending',
  submitted: 'submitted',
  overdue: 'overdue',
  unknown: 'unknown',
};

const STATUS_BADGE_LABEL: Record<AssignmentItem['status'], string> = {
  pending: 'Belum Dikerjakan',
  submitted: 'Dikumpulkan',
  overdue: 'Terlambat',
  unknown: 'Dicek',
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
  if (now >= openDate) return { label: 'Dibuka', variant: 'accent' };
  return { label: 'Akan Dibuka', variant: 'available' };
}

export function TaskCard({ task, onPress, detailLabel }: TaskCardProps) {
  const { colors } = useTheme();
  const statusVariant = STATUS_BADGE_VARIANT[task.status];
  const statusLabel = STATUS_BADGE_LABEL[task.status];
  const accentColor = STATUS_ACCENT[task.status];
  const activityLabel = task.activityType === 'quiz' ? 'Kuis' : 'Tugas';
  const openBadge = getOpenBadge(task.openDate);
  const showDetailAction = Boolean(detailLabel);
  const compactMetaItems: {
    key: string;
    icon: React.ComponentProps<typeof FontAwesome>['name'];
    label: string;
    accent?: boolean;
    danger?: boolean;
  }[] = [
    {
      key: 'activity',
      icon: task.activityType === 'quiz' ? 'question-circle-o' : 'file-text-o',
      label: activityLabel,
      accent: true,
    },
    ...(task.openDate != null && task.openDate > 0
      ? [
          {
            key: 'open',
            icon: 'calendar-o' as const,
            label: `Buka ${formatDateTime(task.openDate)}`,
          },
        ]
      : []),
    {
      key: 'deadline',
      icon: 'clock-o' as const,
      label: `Deadline ${formatDateTime(task.dueDate)}`,
      danger: task.status === 'overdue',
    },
  ];

  return (
    <Pressable
      onPress={() => onPress?.(task)}
      android_ripple={{ color: colors.borderMuted, borderless: false }}
      style={({ pressed }) => [
        styles.container,
        { backgroundColor: colors.bgCard, borderColor: colors.borderSubtle },
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.accentStrip, { backgroundColor: accentColor }]} />
      <View style={styles.body}>
        <View style={styles.headerRow}>
          <Text style={[styles.course, { color: colors.textSecondary }]} numberOfLines={1}>{task.courseName}</Text>
          <View style={styles.headerMeta}>
            {showDetailAction && (
              <View style={styles.detailLinkRow}>
                <Text style={[styles.detailLinkText, { color: colors.accent }]}>{detailLabel}</Text>
                <FontAwesome name="angle-right" size={13} color={colors.accent} />
              </View>
            )}
            <View style={styles.badgeRow}>
              {openBadge && <Badge variant={openBadge.variant} label={openBadge.label} />}
              <Badge variant={statusVariant} label={statusLabel} />
            </View>
          </View>
        </View>
        <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={2}>{task.name}</Text>
        {!!task.intro && (
          <Text style={[styles.intro, { color: colors.textSecondary }]} numberOfLines={1}>{task.intro}</Text>
        )}
        <View style={[styles.metaRow, { borderTopColor: colors.borderSubtle }]}>
          {compactMetaItems.map((item) => (
            <View
              key={item.key}
              style={[
                styles.metaChip,
                {
                  backgroundColor: item.accent ? colors.accentDim : colors.bgCardHover,
                  borderColor: item.accent
                    ? colors.borderAccent
                    : item.danger
                      ? colors.dangerDim
                      : colors.borderSubtle,
                },
              ]}
            >
              <FontAwesome
                name={item.icon}
                size={11}
                color={item.danger ? colors.danger : item.accent ? colors.accent : colors.textSecondary}
              />
              <Text
                style={[
                  styles.metaChipText,
                  {
                    color: item.danger
                      ? colors.danger
                      : item.accent
                        ? colors.accent
                        : colors.textSecondary,
                  },
                ]}
                numberOfLines={1}
              >
                {item.label}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', borderRadius: Radius.md, borderWidth: 1, overflow: 'hidden', ...Shadow.card },
  pressed: { opacity: 0.85 },
  accentStrip: { width: 4, borderTopLeftRadius: Radius.md, borderBottomLeftRadius: Radius.md },
  body: { flex: 1, padding: 12, gap: 7 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 },
  headerMeta: { alignItems: 'flex-end', gap: 6, flexShrink: 0 },
  badgeRow: { flexDirection: 'row', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end', flexShrink: 0 },
  course: { fontSize: 11, fontWeight: '600', flexShrink: 1, textTransform: 'uppercase', letterSpacing: 0.3 },
  detailLinkRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  detailLinkText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },
  title: { fontSize: 15, fontWeight: '700', lineHeight: 21 },
  intro: { fontSize: 12, lineHeight: 18 },
  metaRow: {
    marginTop: 2,
    paddingTop: 8,
    borderTopWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 5,
    maxWidth: '100%',
  },
  metaChipText: {
    fontSize: 11,
    fontWeight: '700',
    flexShrink: 1,
  },
});
