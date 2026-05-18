import React from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { StyleSheet, Text, View } from 'react-native';
import { AttendanceItem } from '@/types/moodle';
import { openSunanLink } from '@/lib/moodle/openSunanLink';
import { useAuthStore } from '@/lib/stores/authStore';
import { formatDateTime } from '@/lib/utils/date';
import { Badge } from './Badge';
import { CardIconBubble, CardInfoTile } from './CardInfoTile';
import { Radius, Shadow } from './theme';
import { useTheme } from './ThemeContext';

type AttendanceCardProps = {
  attendance: AttendanceItem;
  highlight?: boolean;
};

const STATUS_CONFIG: Record<
  AttendanceItem['status'],
  { label: string; variant: React.ComponentProps<typeof Badge>['variant'] }
> = {
  open: { label: 'Dibuka', variant: 'open' },
  closing_soon: { label: 'Segera Tutup', variant: 'closing_soon' },
  upcoming: { label: 'Akan Dibuka', variant: 'upcoming' },
  available: { label: 'Tersedia', variant: 'available' },
  closed: { label: 'Riwayat', variant: 'closed' },
};

function formatReferenceMetaDateTime(timestamp: number) {
  const date = new Date(timestamp * 1000);
  const dateLabel = date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
  });
  const timeLabel = date.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${dateLabel} ${timeLabel}`;
}

export function AttendanceCard({ attendance, highlight = false }: AttendanceCardProps) {
  const { colors } = useTheme();
  const token = useAuthStore((state) => state.token);
  const privateToken = useAuthStore((state) => state.privateToken);
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const config = STATUS_CONFIG[attendance.status];
  const markBadge = attendance.isMarked
    ? {
        label: attendance.attendanceMarkLabel ?? 'Sudah Absen',
        variant: attendance.attendanceMarkVariant ?? 'submitted',
      }
    : null;
  const useThreeColumnTiles = Boolean(
    attendance.quickLink && attendance.startsAt && attendance.closesAt
  );

  const metaTiles: React.ReactElement<React.ComponentProps<typeof CardInfoTile>>[] = [];
  const handleOpenAttendanceLink = React.useCallback(() => {
    void openSunanLink({
      url: attendance.quickLink,
      token,
      userId,
      privateToken,
    });
  }, [attendance.quickLink, privateToken, token, userId]);

  if (attendance.quickLink) {
    metaTiles.push(
      <CardInfoTile
        key="link"
        icon="external-link"
        title="Buka"
        tone="accent"
        trailingChevron
        onPress={handleOpenAttendanceLink}
      />
    );
  }

  if (attendance.startsAt) {
    metaTiles.push(
      <CardInfoTile
        key="start"
        icon="calendar-o"
        title="Mulai"
        value={
          useThreeColumnTiles
            ? formatReferenceMetaDateTime(attendance.startsAt)
            : formatDateTime(attendance.startsAt)
        }
        tone="muted"
      />
    );
  }

  if (attendance.closesAt) {
    metaTiles.push(
      <CardInfoTile
        key="close"
        icon="clock-o"
        title="Tutup"
        value={
          useThreeColumnTiles
            ? formatReferenceMetaDateTime(attendance.closesAt)
            : formatDateTime(attendance.closesAt)
        }
        tone={attendance.status === 'closing_soon' ? 'warning' : 'muted'}
      />
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: highlight ? colors.accentDim : colors.bgCard,
          borderColor: highlight ? colors.borderAccent : colors.borderSubtle,
        },
      ]}
    >
      <View style={styles.body}>
        <View style={styles.topRow}>
          <View style={styles.courseWrap}>
            <CardIconBubble
              icon={attendance.isMarked ? 'check-square-o' : 'calendar-o'}
              tone={attendance.isMarked ? 'success' : 'accent'}
            />
            <Text style={[styles.course, { color: colors.textSecondary }]} numberOfLines={1}>
              {attendance.courseName}
            </Text>
          </View>
          {highlight ? (
            <View style={[styles.highlightPill, { backgroundColor: colors.accentDim }]}>
              <FontAwesome name="bell-o" size={11} color={colors.accent} />
              <Text style={[styles.highlightText, { color: colors.accent }]}>Notifikasi</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.heroRow}>
          <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={2}>
            {attendance.title}
          </Text>
          <View style={styles.heroBadges}>
            {markBadge ? <Badge variant={markBadge.variant} label={markBadge.label} showDot /> : null}
            <Badge variant={config.variant} label={config.label} showDot />
          </View>
        </View>

        {metaTiles.length > 0 ? (
          <>
            <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />
            <View style={[styles.tileGrid, useThreeColumnTiles && styles.tileGridThreeColumn]}>
              {metaTiles.map((tile, index) =>
                React.cloneElement(tile, {
                  compact: useThreeColumnTiles,
                  style: useThreeColumnTiles
                    ? index === 0
                      ? styles.tileColumnNarrow
                      : styles.tileColumnWide
                    : styles.tileColumnAuto,
                  key: tile.key ?? `attendance-meta-${index}`,
                })
              )}
            </View>
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
    ...Shadow.card,
  },
  body: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 8,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 6,
  },
  courseWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  course: {
    flex: 1,
    fontSize: 10.5,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  highlightPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  highlightText: {
    fontSize: 9.5,
    fontWeight: '700',
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
  },
  heroBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 0,
  },
  divider: {
    height: 1,
    opacity: 0.9,
  },
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tileGridThreeColumn: {
    gap: 4,
  },
  tileColumnAuto: {
    flexBasis: 'auto',
    maxWidth: '100%',
  },
  tileColumnNarrow: {
    flexBasis: '26.5%',
    maxWidth: '26.5%',
    flexGrow: 0,
  },
  tileColumnWide: {
    flexBasis: '34.5%',
    maxWidth: '34.5%',
    flexGrow: 0,
  },
});
