import { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AttendanceItem } from '@/types/moodle';
import { openSunanLink } from '@/lib/moodle/openSunanLink';
import { useAuthStore } from '@/lib/stores/authStore';
import { formatDateTime } from '@/lib/utils/date';

type AttendanceCardProps = {
  attendance: AttendanceItem;
  highlight?: boolean;
};

const STATUS_THEME = {
  upcoming: {
    label: 'Akan Dibuka',
    badgeBackground: '#EAF2FF',
    badgeText: '#1F4FA7',
    border: '#CFE0FF',
  },
  open: {
    label: 'Sedang Dibuka',
    badgeBackground: '#DCF8E9',
    badgeText: '#11623A',
    border: '#9BE6BE',
  },
  closing_soon: {
    label: 'Segera Ditutup',
    badgeBackground: '#FFE8CC',
    badgeText: '#8E5600',
    border: '#F4CB8B',
  },
  closed: {
    label: 'Sudah Ditutup',
    badgeBackground: '#F0F2F6',
    badgeText: '#4D5A73',
    border: '#D9DFEA',
  },
  available: {
    label: 'Tersedia',
    badgeBackground: '#E9E6FF',
    badgeText: '#4C3D99',
    border: '#CBC2FF',
  },
} as const;

export function AttendanceCard({ attendance, highlight = false }: AttendanceCardProps) {
  const theme = STATUS_THEME[attendance.status];
  const token = useAuthStore((state) => state.token);
  const privateToken = useAuthStore((state) => state.privateToken);
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const handleOpenAttendanceLink = useCallback(() => {
    void openSunanLink({
      url: attendance.quickLink,
      token,
      userId,
      privateToken,
    });
  }, [attendance.quickLink, privateToken, token, userId]);

  return (
    <View style={[styles.container, { borderColor: theme.border }, highlight && styles.containerHighlight]}>
      {highlight ? (
        <View style={styles.highlightBadge}>
          <Text style={styles.highlightBadgeText}>Dari notifikasi</Text>
        </View>
      ) : null}

      <View style={styles.headerRow}>
        <Text style={styles.course} numberOfLines={1}>
          {attendance.courseName}
        </Text>
        <View style={[styles.badge, { backgroundColor: theme.badgeBackground }]}>
          <Text style={[styles.badgeText, { color: theme.badgeText }]}>{theme.label}</Text>
        </View>
      </View>

      <Text style={styles.title}>{attendance.title}</Text>
      {!!attendance.description && (
        <Text style={styles.description} numberOfLines={2}>
          {attendance.description}
        </Text>
      )}

      {attendance.startsAt ? (
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Mulai</Text>
          <Text style={styles.metaValue}>{formatDateTime(attendance.startsAt)}</Text>
        </View>
      ) : null}

      {attendance.closesAt ? (
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Tutup</Text>
          <Text style={styles.metaValue}>{formatDateTime(attendance.closesAt)}</Text>
        </View>
      ) : null}

      {attendance.quickLink ? (
        <Pressable style={styles.linkButton} onPress={handleOpenAttendanceLink}>
          <Text style={styles.linkButtonText}>Buka Absensi di SUNAN</Text>
        </Pressable>
      ) : null}
    </View>
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
  containerHighlight: {
    borderWidth: 2,
    borderColor: '#1E3F86',
    backgroundColor: '#F7FAFF',
  },
  highlightBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: '#1E3F86',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  highlightBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  course: {
    color: '#3A4560',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
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
  description: {
    color: '#4B5872',
    fontSize: 13,
    lineHeight: 19,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaLabel: {
    color: '#607089',
    fontSize: 12,
    fontWeight: '500',
  },
  metaValue: {
    color: '#0D1B35',
    fontSize: 12,
    fontWeight: '700',
  },
  linkButton: {
    marginTop: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#C8D8FB',
    backgroundColor: '#F7FAFF',
    paddingVertical: 9,
    alignItems: 'center',
  },
  linkButtonText: {
    color: '#1C3C81',
    fontSize: 12,
    fontWeight: '700',
  },
});
