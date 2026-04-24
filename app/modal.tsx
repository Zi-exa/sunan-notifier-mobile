import { StatusBar } from 'expo-status-bar';
import { Platform, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';

export default function ModalScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tentang SUNAN Notifier</Text>
      <Text style={styles.body}>
        Aplikasi ini membantu mahasiswa menerima notifikasi tugas baru, reminder deadline, dan update
        absensi dari SUNAN UMK.
      </Text>
      <View style={styles.separator} lightColor="#E4E9F7" darkColor="rgba(255,255,255,0.2)" />
      <Text style={styles.list}>Sprint 1: Login, token Moodle, dan daftar matkul</Text>
      <Text style={styles.list}>Sprint 2: Daftar tugas, status submit, dan dashboard</Text>
      <Text style={styles.list}>Sprint 3: Kalender deadline dan fondasi reminder</Text>
      <Text style={styles.list}>Sprint 4: Settings notifikasi, polling, jam diam</Text>

      {/* Use a light status bar on iOS to account for the black space above the modal */}
      <StatusBar style={Platform.OS === 'ios' ? 'light' : 'auto'} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 10,
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
  },
  list: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 3,
  },
  separator: {
    marginVertical: 18,
    height: 1,
    width: '100%',
  },
});
