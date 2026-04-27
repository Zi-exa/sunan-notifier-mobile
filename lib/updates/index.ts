import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import * as Updates from 'expo-updates';
import { Platform } from 'react-native';
import { CONFIG } from '@/lib/config';

export type RemoteApkUpdateManifest = {
  version: string;
  apkUrl: string;
  title?: string;
  notes?: string;
  mandatory?: boolean;
};

export type AvailableAppUpdate =
  | {
      kind: 'apk';
      manifest: RemoteApkUpdateManifest;
    }
  | {
      kind: 'eas';
    };

type RemoteApkUpdateEnvelope =
  | RemoteApkUpdateManifest
  | {
      android?: RemoteApkUpdateManifest;
    };

export function getCurrentAppVersion(): string {
  return Constants.expoConfig?.version ?? '0.0.0';
}

function normalizeVersionParts(version: string): number[] {
  return version
    .split('.')
    .map((part) => {
      const numeric = Number(part.replace(/[^\d].*$/, ''));
      return Number.isFinite(numeric) ? numeric : 0;
    });
}

export function compareVersions(left: string, right: string): number {
  const leftParts = normalizeVersionParts(left);
  const rightParts = normalizeVersionParts(right);
  const maxLength = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const leftPart = leftParts[index] ?? 0;
    const rightPart = rightParts[index] ?? 0;

    if (leftPart > rightPart) {
      return 1;
    }

    if (leftPart < rightPart) {
      return -1;
    }
  }

  return 0;
}

function resolveAndroidManifestPayload(
  payload: RemoteApkUpdateEnvelope
): RemoteApkUpdateManifest | null {
  if (
    payload &&
    typeof payload === 'object' &&
    'apkUrl' in payload &&
    typeof payload.apkUrl === 'string' &&
    typeof payload.version === 'string'
  ) {
    return payload as RemoteApkUpdateManifest;
  }

  if (
    payload &&
    typeof payload === 'object' &&
    'android' in payload &&
    payload.android &&
    typeof payload.android.apkUrl === 'string' &&
    typeof payload.android.version === 'string'
  ) {
    return payload.android;
  }

  return null;
}

export async function checkForRemoteApkUpdateAsync(): Promise<RemoteApkUpdateManifest | null> {
  if (Platform.OS !== 'android' || !CONFIG.updateManifestUrl.trim()) {
    return null;
  }

  const response = await fetch(CONFIG.updateManifestUrl, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Gagal mengambil manifest update (${response.status}).`);
  }

  const payload = (await response.json()) as RemoteApkUpdateEnvelope;
  const manifest = resolveAndroidManifestPayload(payload);
  if (!manifest) {
    throw new Error('Format manifest update APK tidak valid.');
  }

  return compareVersions(manifest.version, getCurrentAppVersion()) > 0 ? manifest : null;
}

export async function openRemoteApkUpdateUrl(apkUrl: string): Promise<void> {
  await Linking.openURL(apkUrl);
}

function isExpoGoRuntime(): boolean {
  return Constants.appOwnership === 'expo';
}

export async function fetchAvailableEasUpdateAsync(): Promise<boolean> {
  if (__DEV__ || Platform.OS === 'web' || isExpoGoRuntime() || !Updates.isEnabled) {
    return false;
  }

  const update = await Updates.checkForUpdateAsync();
  if (!update.isAvailable) {
    return false;
  }

  await Updates.fetchUpdateAsync();
  return true;
}

export async function checkForAvailableAppUpdateAsync(): Promise<AvailableAppUpdate | null> {
  let apkCheckSucceeded = false;
  let easCheckSucceeded = false;
  let apkError: unknown = null;
  let easError: unknown = null;

  try {
    const manifest = await checkForRemoteApkUpdateAsync();
    apkCheckSucceeded = true;
    if (manifest) {
      return { kind: 'apk', manifest };
    }
  } catch (error) {
    apkError = error;
  }

  try {
    const hasEasUpdate = await fetchAvailableEasUpdateAsync();
    easCheckSucceeded = true;
    if (hasEasUpdate) {
      return { kind: 'eas' };
    }
  } catch (error) {
    easError = error;
  }

  if (!apkCheckSucceeded && !easCheckSucceeded) {
    throw (easError ?? apkError ?? new Error('Pembaruan belum bisa dicek sekarang.'));
  }

  return null;
}

export async function applyAvailableAppUpdateAsync(update: AvailableAppUpdate): Promise<void> {
  if (update.kind === 'apk') {
    await openRemoteApkUpdateUrl(update.manifest.apkUrl);
    return;
  }

  await reloadToApplyEasUpdateAsync();
}

export async function reloadToApplyEasUpdateAsync(): Promise<void> {
  if (!Updates.isEnabled) {
    return;
  }

  await Updates.reloadAsync();
}
