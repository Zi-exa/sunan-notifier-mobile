import React from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { StyleSheet, Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import { AttendanceItem } from '@/types/moodle';
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
  { label: string; variant: React.ComponentProps<typeof Badge>['variant']; strip: string }
> = {
  open: { label: 'Dibuka', variant: 'open', strip: '#2ECC71' },
  closing_soon: { label: 'Segera Tutup', variant: 'closing_soon', strip: '#FFB347' },
  upcoming: { label: 'Akan Dibuka', variant: 'upcoming', strip: '#4F8EF7' },
  available: { label: 'Tersedia', variant: 'available', strip: '#A78BFA' },
  closed: { label: 'Riwayat', variant: 'closed', strip: '#4A5A78' },
};

export function AttendanceCard({ attendance, highlight = false }: AttendanceCardProps) {
  const { colors } = useTheme();
  const config = STATUS_CONFIG[attendance.status];
  const markBadge = attendance.isMarked
    ? {
        label: attendance.attendanceMarkLabel ?? 'Sudah Absen',
        variant: attendance.attendanceMarkVariant ?? 'submitted',
      }
    : null;

  const metaTiles: React.ReactNode[] = [];

  if (attendance.quickLink) {
    metaTiles.push(
      <CardInfoTile
        key="link"
        icon="external-link"
        title="Buka di SUNAN"
        tone="accent"
        trailingChevron
        onPress={() => Linking.openURL(attendance.quickLink as string)}
      />
    );
  }

  if (attendance.startsAt) {
    metaTiles.push(
      <CardInfoTile
        key="start"
        icon="calendar-o"
        title="Mulai"
        value={formatDateTime(attendance.startsAt)}
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
        value={formatDateTime(attendance.closesAt)}
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
      <View style={[styles.accentStrip, { backgroundColor: config.strip }]} />
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
              <FontAwesome name="bell-o" size={12} color={colors.accent} />
              <Text style={[styles.highlightText, { color: colors.accent }]}>Notifikasi</Text>
            </View>
          ) : null}
        </View>

        <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={2}>
          {attendance.title}
        </Text>

        <View style={styles.badgeRow}>
          {markBadge ? <Badge variant={markBadge.variant} label={markBadge.label} showDot /> : null}
          <Badge variant={config.variant} label={config.label} showDot />
        </View>

        {metaTiles.length > 0 ? (
          <>
            <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />
            <View style={styles.tileGrid}>{metaTiles}</View>
          </>
        ) : null}
      </View>
    </View>
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
  accentStrip: {
    width: 8,
  },
  body: {
    flex: 1,
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 14,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  courseWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minWidth: 0,
  },
  course: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.35,
  },
  highlightPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  highlightText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  title: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '800',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  divider: {
    height: 1,
    opacity: 0.9,
  },
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
});
