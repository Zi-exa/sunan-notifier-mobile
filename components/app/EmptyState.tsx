import { StyleSheet, Text, View } from 'react-native';

type EmptyStateProps = {
  title: string;
  description: string;
};

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 18,
    backgroundColor: '#F6F8FF',
    borderWidth: 1,
    borderColor: '#D7E1FF',
    gap: 6,
  },
  title: {
    color: '#132240',
    fontSize: 15,
    fontWeight: '700',
  },
  description: {
    color: '#4C5E80',
    fontSize: 13,
    lineHeight: 19,
  },
});
