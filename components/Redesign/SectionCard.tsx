import React, { ReactNode } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { View, Text, StyleSheet } from 'react-native';
import { Radius, Shadow } from './theme';
import { useTheme } from './ThemeContext';

type SectionCardProps = {
  title: string;
  icon?: React.ComponentProps<typeof FontAwesome>['name'];
  subtitle?: string;
  children: ReactNode;
  headerRight?: ReactNode;
};

export function SectionCard({ title, icon, subtitle, children, headerRight }: SectionCardProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.borderSubtle }]}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <View style={styles.titleRow}>
            {icon ? (
              <View style={[styles.iconWrap, { backgroundColor: colors.accentDim }]}>
                <FontAwesome name={icon} size={13} color={colors.accent} />
              </View>
            ) : null}
            <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
          </View>
          {subtitle ? <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text> : null}
        </View>
        {headerRight ?? null}
      </View>
      <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.lg, borderWidth: 1, overflow: 'hidden', ...Shadow.card },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 16, paddingVertical: 14, gap: 8 },
  headerText: { flex: 1, gap: 3 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconWrap: { width: 24, height: 24, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '700' },
  subtitle: { fontSize: 12 },
  divider: { height: 1 },
  content: { padding: 14, gap: 10 },
});
