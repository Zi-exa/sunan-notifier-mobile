import { StatusBar } from 'expo-status-bar';
import { Platform, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';

export default function ModalScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tentang SUNAN Notifier</Text>
      <Text style={styles.body}>
        Aplikasi ini membantu mahasiswa melihat tugas, absensi, dan pengingat penting dari SUNAN
        UMK dengan lebih mudah.
      </Text>
      <View style={styles.separator} lightColor="#E4E9F7" darkColor="rgba(255,255,255,0.2)" />
      <Text style={styles.list}>• Login ke akun SUNAN</Text>
      <Text style={styles.list}>• Lihat tugas dan statusnya</Text>
      <Text style={styles.list}>• Lihat kalender tugas dan absensi</Text>
      <Text style={styles.list}>• Atur notifikasi sesuai kebutuhan</Text>

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
