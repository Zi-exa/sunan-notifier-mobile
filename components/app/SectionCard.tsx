import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

type SectionCardProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

export function SectionCard({ title, subtitle, children }: SectionCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DEE4F1',
    padding: 16,
    gap: 6,
    shadowColor: '#0A1225',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 14,
    elevation: 3,
  },
  title: {
    color: '#101A2A',
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    color: '#546179',
    fontSize: 13,
  },
  content: {
    marginTop: 8,
  },
});
