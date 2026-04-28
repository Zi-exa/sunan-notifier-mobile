import React from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AssignmentItem } from '@/types/moodle';
import { formatDateTime } from '@/lib/utils/date';
import { Badge } from './Badge';
import { CardIconBubble, CardInfoTile } from './CardInfoTile';
import { Radius, Shadow } from './theme';
import { useTheme } from './ThemeContext';

type TaskCardProps = {
  task: AssignmentItem;
  onPress?: (task: AssignmentItem) => void;
  detailLabel?: string;
};

const STATUS_BADGE_VARIANT: Record<
  AssignmentItem['status'],
  React.ComponentProps<typeof Badge>['variant']
> = {
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

function getOpenBadge(
  openDate: number | undefined
): { label: string; variant: React.ComponentProps<typeof Badge>['variant'] } | null {
  if (!openDate || openDate <= 0) return null;
  const now = Math.floor(Date.now() / 1000);
  if (now >= openDate) return { label: 'Dibuka', variant: 'accent' };
  return { label: 'Akan Dibuka', variant: 'available' };
}

function formatCompactMetaDateTime(timestamp: number) {
  const date = new Date(timestamp * 1000);
  const dateLabel = date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
  });
  const timeLabel = date.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${dateLabel}\n${timeLabel}`;
}

export function TaskCard({ task, onPress, detailLabel }: TaskCardProps) {
  const { colors } = useTheme();
  const statusVariant = STATUS_BADGE_VARIANT[task.status];
  const statusLabel = STATUS_BADGE_LABEL[task.status];
  const accentColor = STATUS_ACCENT[task.status];
  const activityLabel = task.activityType === 'quiz' ? 'Kuis' : 'Tugas';
  const activityIcon = task.activityType === 'quiz' ? 'question-circle-o' : 'file-text-o';
  const openBadge = getOpenBadge(task.openDate);
  const showDetailAction = Boolean(detailLabel);
  const useThreeColumnTiles = task.openDate != null && task.openDate > 0;
  const metaTiles: React.ReactElement<React.ComponentProps<typeof CardInfoTile>>[] = [
    <CardInfoTile
      key="activity"
      icon={activityIcon}
      title={activityLabel}
      tone="accent"
      trailingChevron={showDetailAction}
    />,
  ];

  if (task.openDate != null && task.openDate > 0) {
    metaTiles.push(
      <CardInfoTile
        key="open"
        icon="calendar-o"
        title="Buka"
        value={useThreeColumnTiles ? formatCompactMetaDateTime(task.openDate) : formatDateTime(task.openDate)}
        tone="accent"
      />
    );
  }

  metaTiles.push(
    <CardInfoTile
      key="deadline"
      icon="clock-o"
      title="Deadline"
      value={useThreeColumnTiles ? formatCompactMetaDateTime(task.dueDate) : formatDateTime(task.dueDate)}
      tone={task.status === 'overdue' ? 'warning' : 'muted'}
      />
  );
  return (
    <Pressable
      onPress={() => onPress?.(task)}
      android_ripple={{ color: colors.borderMuted, borderless: false }}
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: colors.bgCard,
          borderColor: colors.borderSubtle,
        },
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.accentStrip, { backgroundColor: accentColor }]} />
      <View style={styles.body}>
        <View style={styles.topRow}>
          <View style={styles.courseWrap}>
            <CardIconBubble icon="graduation-cap" tone="accent" />
            <Text style={[styles.course, { color: colors.textSecondary }]} numberOfLines={1}>
              {task.courseName}
            </Text>
          </View>
          {showDetailAction ? (
            <View style={styles.detailLinkRow}>
              <Text style={[styles.detailLinkText, { color: colors.accentBright }]}>
                {detailLabel}
              </Text>
              <FontAwesome name="angle-right" size={18} color={colors.accentBright} />
            </View>
          ) : null}
        </View>

        <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={2}>
          {task.name}
        </Text>

        <View style={styles.badgeRow}>
          {openBadge ? <Badge variant={openBadge.variant} label={openBadge.label} showDot /> : null}
          <Badge variant={statusVariant} label={statusLabel} showDot />
        </View>

        <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />

        <View style={[styles.tileGrid, useThreeColumnTiles && styles.tileGridThreeColumn]}>
          {metaTiles.map((tile, index) =>
            React.cloneElement(tile, {
              compact: useThreeColumnTiles,
              style: useThreeColumnTiles ? styles.tileColumnThird : styles.tileColumnAuto,
              key: tile.key ?? `meta-tile-${index}`,
            })
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: Radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
    ...Shadow.card,
  },
  pressed: {
    opacity: 0.9,
  },
  accentStrip: {
    width: 6,
    borderTopLeftRadius: Radius.xl,
    borderBottomLeftRadius: Radius.xl,
  },
  body: {
    flex: 1,
    paddingHorizontal: 15,
    paddingVertical: 14,
    gap: 11,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  courseWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
  },
  course: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.25,
  },
  detailLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  detailLinkText: {
    fontSize: 12,
    fontWeight: '700',
  },
  title: {
    fontSize: 18,
    lineHeight: 25,
    fontWeight: '800',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  divider: {
    height: 1,
    opacity: 0.9,
  },
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tileGridThreeColumn: {
    gap: 6,
  },
  tileColumnAuto: {
    flexBasis: 'auto',
    maxWidth: '100%',
  },
  tileColumnThird: {
    flexBasis: '31.2%',
    maxWidth: '31.2%',
    flexGrow: 0,
  },
});
