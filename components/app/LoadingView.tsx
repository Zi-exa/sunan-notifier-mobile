import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

type LoadingViewProps = {
  text?: string;
};

export function LoadingView({ text = 'Memuat data SUNAN...' }: LoadingViewProps) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#2B7FFF" />
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 24,
  },
  text: {
    color: '#3D4C66',
    fontSize: 14,
    textAlign: 'center',
  },
});
