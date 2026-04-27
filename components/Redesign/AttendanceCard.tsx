import React from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import * as Linking from 'expo-linking';
import { AttendanceItem } from '@/types/moodle';
import { formatDateTime } from '@/lib/utils/date';
import { Badge } from './Badge';
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
  open:         { label: 'Dibuka',        variant: 'open',          strip: '#2ECC71' },
  closing_soon: { label: 'Segera tutup',  variant: 'closing_soon',  strip: '#FFB347' },
  upcoming:     { label: 'Akan dibuka',   variant: 'upcoming',      strip: '#4F8EF7' },
  available:    { label: 'Tersedia',      variant: 'available',     strip: '#A78BFA' },
  closed:       { label: 'Ditutup',       variant: 'closed',        strip: '#4A5A78' },
};

export function AttendanceCard({ attendance, highlight = false }: AttendanceCardProps) {
  const { colors } = useTheme();
  const config = STATUS_CONFIG[attendance.status];
  const markBadge =
    attendance.isMarked
      ? {
          label: attendance.attendanceMarkLabel ?? 'Sudah Absen',
          variant: attendance.attendanceMarkVariant ?? 'submitted',
        }
      : null;
  const compactMetaItems: {
    key: string;
    icon: React.ComponentProps<typeof FontAwesome>['name'];
    label: string;
    warning?: boolean;
  }[] = [
    ...(attendance.startsAt
      ? [
          {
            key: 'start',
            icon: 'clock-o' as const,
            label: `Mulai ${formatDateTime(attendance.startsAt)}`,
          },
        ]
      : []),
    ...(attendance.closesAt
      ? [
          {
            key: 'close',
            icon: 'hourglass-end' as const,
            label: `Tutup ${formatDateTime(attendance.closesAt)}`,
            warning: attendance.status === 'closing_soon',
          },
        ]
      : []),
  ];

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.bgCard, borderColor: colors.borderSubtle },
        highlight && { borderColor: colors.borderAccent, backgroundColor: colors.accentDim },
      ]}
    >
      <View style={[styles.accentStrip, { backgroundColor: config.strip }]} />

      <View style={styles.body}>
        {highlight && (
          <View style={[styles.highlightBanner, { backgroundColor: colors.accentDim }]}>
            <View style={styles.highlightBannerRow}>
              <FontAwesome name="bell-o" size={11} color={colors.accent} />
              <Text style={[styles.highlightBannerText, { color: colors.accent }]}>Dari notifikasi</Text>
            </View>
          </View>
        )}

        <View style={styles.headerRow}>
          <Text style={[styles.course, { color: colors.textSecondary }]} numberOfLines={1}>
            {attendance.courseName}
          </Text>
          <View style={styles.badgeRow}>
            {markBadge ? <Badge variant={markBadge.variant} label={markBadge.label} /> : null}
            <Badge variant={config.variant} label={config.label} />
          </View>
        </View>

        <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={2}>
          {attendance.title}
        </Text>

        {!!attendance.description && (
          <Text style={[styles.description, { color: colors.textSecondary }]} numberOfLines={1}>
            {attendance.description}
          </Text>
        )}

        {compactMetaItems.length > 0 && (
          <View style={[styles.metaRow, { borderTopColor: colors.borderSubtle }]}>
            {compactMetaItems.map((item) => (
              <View
                key={item.key}
                style={[
                  styles.metaChip,
                  {
                    backgroundColor: item.warning ? colors.warningDim : colors.bgCardHover,
                    borderColor: item.warning ? colors.warningDim : colors.borderSubtle,
                  },
                ]}
              >
                <FontAwesome
                  name={item.icon}
                  size={11}
                  color={item.warning ? colors.warning : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.metaChipText,
                    { color: item.warning ? colors.warning : colors.textSecondary },
                  ]}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
              </View>
            ))}
          </View>
        )}

        {attendance.quickLink ? (
          <Pressable
            style={[styles.linkButton, { backgroundColor: colors.accentDim, borderColor: colors.borderAccent }]}
            onPress={() => Linking.openURL(attendance.quickLink as string)}
          >
            <View style={styles.linkButtonContent}>
              <FontAwesome name="external-link" size={12} color={colors.accent} />
              <Text style={[styles.linkButtonText, { color: colors.accent }]}>Buka di SUNAN</Text>
            </View>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: Radius.md,
    borderWidth: 1,
    overflow: 'hidden',
    ...Shadow.card,
  },
  accentStrip: { width: 4 },
  body: { flex: 1, padding: 12, gap: 6 },
  highlightBanner: {
    alignSelf: 'flex-start',
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  highlightBannerRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  highlightBannerText: { fontSize: 11, fontWeight: '700' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' },
  course: { fontSize: 11, fontWeight: '600', flex: 1, textTransform: 'uppercase', letterSpacing: 0.3 },
  title: { fontSize: 15, fontWeight: '700', lineHeight: 21 },
  description: { fontSize: 12, lineHeight: 18 },
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
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
    maxWidth: '100%',
  },
  metaChipText: {
    fontSize: 11,
    fontWeight: '700',
    flexShrink: 1,
  },
  linkButton: { marginTop: 4, borderRadius: Radius.sm, paddingVertical: 9, alignItems: 'center', borderWidth: 1 },
  linkButtonContent: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  linkButtonText: { fontSize: 12, fontWeight: '700' },
});
