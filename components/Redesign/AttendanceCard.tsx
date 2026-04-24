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
  open:         { label: 'Sedang Dibuka', variant: 'open',         strip: '#2ECC71' },
  closing_soon: { label: 'Segera Ditutup', variant: 'closing_soon', strip: '#FFB347' },
  upcoming:     { label: 'Akan Dibuka',   variant: 'upcoming',     strip: '#4F8EF7' },
  available:    { label: 'Tersedia',       variant: 'available',    strip: '#A78BFA' },
  closed:       { label: 'Sudah Ditutup', variant: 'closed',       strip: '#4A5A78' },
};

export function AttendanceCard({ attendance, highlight = false }: AttendanceCardProps) {
  const { colors } = useTheme();
  const config = STATUS_CONFIG[attendance.status];

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
          <Badge variant={config.variant} label={config.label} />
        </View>

        <Text style={[styles.title, { color: colors.textPrimary }]}>{attendance.title}</Text>

        {!!attendance.description && (
          <Text style={[styles.description, { color: colors.textSecondary }]} numberOfLines={2}>
            {attendance.description}
          </Text>
        )}

        {(attendance.startsAt || attendance.closesAt) && (
          <View style={[styles.timeBlock, { borderTopColor: colors.borderSubtle }]}>
            {attendance.startsAt ? (
              <AttendanceMetaRow
                icon="clock-o"
                label="Mulai"
                value={formatDateTime(attendance.startsAt)}
                valueColor={colors.textPrimary}
              />
            ) : null}
            {attendance.closesAt ? (
              <AttendanceMetaRow
                icon="hourglass-end"
                label="Tutup"
                value={formatDateTime(attendance.closesAt)}
                valueColor={attendance.status === 'closing_soon' ? colors.warning : colors.textPrimary}
              />
            ) : null}
          </View>
        )}

        {attendance.quickLink ? (
          <Pressable
            style={[styles.linkButton, { backgroundColor: colors.accentDim, borderColor: colors.borderAccent }]}
            onPress={() => Linking.openURL(attendance.quickLink as string)}
          >
            <View style={styles.linkButtonContent}>
              <FontAwesome name="external-link" size={12} color={colors.accent} />
              <Text style={[styles.linkButtonText, { color: colors.accent }]}>Buka Absensi di SUNAN</Text>
            </View>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

type AttendanceMetaRowProps = {
  icon: React.ComponentProps<typeof FontAwesome>['name'];
  label: string;
  value: string;
  valueColor: string;
};

function AttendanceMetaRow({ icon, label, value, valueColor }: AttendanceMetaRowProps) {
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
  course: { fontSize: 11, fontWeight: '600', flex: 1, textTransform: 'uppercase', letterSpacing: 0.3 },
  title: { fontSize: 15, fontWeight: '700', lineHeight: 21 },
  description: { fontSize: 12, lineHeight: 18 },
  timeBlock: { marginTop: 4, gap: 3, paddingTop: 8, borderTopWidth: 1 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timeLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  timeLabel: { fontSize: 11, fontWeight: '500' },
  timeValue: { fontSize: 11, fontWeight: '700' },
  linkButton: { marginTop: 4, borderRadius: Radius.sm, paddingVertical: 9, alignItems: 'center', borderWidth: 1 },
  linkButtonContent: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  linkButtonText: { fontSize: 12, fontWeight: '700' },
});
