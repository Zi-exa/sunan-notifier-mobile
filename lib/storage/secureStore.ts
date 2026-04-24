import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const useAsyncFallback = Platform.OS === 'web';

export async function setSecureItem(key: string, value: string): Promise<void> {
  if (useAsyncFallback) {
    await AsyncStorage.setItem(key, value);
    return;
  }

  await SecureStore.setItemAsync(key, value);
}

export async function getSecureItem(key: string): Promise<string | null> {
  if (useAsyncFallback) {
    return AsyncStorage.getItem(key);
  }

  return SecureStore.getItemAsync(key);
}

export async function removeSecureItem(key: string): Promise<void> {
  if (useAsyncFallback) {
    await AsyncStorage.removeItem(key);
    return;
  }

  await SecureStore.deleteItemAsync(key);
}
