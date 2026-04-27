export const ExpoKeepAwakeTag = 'expo-keep-awake-shim';

export function useKeepAwake() {
  // Expo Go dev wrapper may try to enable keep-awake even when the runtime
  // cannot activate it on this device. The app does not rely on this feature.
}

export async function activateKeepAwakeAsync() {}

export async function deactivateKeepAwake() {}

export async function activateKeepAwake() {}
