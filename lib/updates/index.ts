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
      notes?: string | null;
    };

export type PostUpdateNotice = {
  kind: 'apk' | 'eas';
  title: string;
  message: string;
  preparedAt: number;
  sourceVersion?: string;
  sourceUpdateId?: string;
  sourceCreatedAt?: string;
  targetVersion?: string;
  targetUpdateId?: string;
  targetCreatedAt?: string;
};

type RemoteApkUpdateEnvelope =
  | RemoteApkUpdateManifest
  | {
      android?: RemoteApkUpdateManifest;
    };

export function getCurrentAppVersion(): string {
  return Constants.expoConfig?.version ?? '0.0.0';
}

function readNestedString(
  source: unknown,
  path: readonly string[]
): string | null {
  let current: unknown = source;

  for (const segment of path) {
    if (!current || typeof current !== 'object' || !(segment in current)) {
      return null;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return typeof current === 'string' && current.trim() ? current.trim() : null;
}

export function extractUpdateNotesFromManifest(manifest: unknown): string | null {
  if (!manifest || typeof manifest !== 'object') {
    return null;
  }

  const candidate =
    readNestedString(manifest, ['metadata', 'updateMessage']) ??
    readNestedString(manifest, ['metadata', 'message']) ??
    readNestedString(manifest, ['metadata', 'notes']) ??
    readNestedString(manifest, ['extra', 'updateMessage']) ??
    readNestedString(manifest, ['extra', 'message']) ??
    readNestedString(manifest, ['extra', 'notes']) ??
    readNestedString(manifest, ['extra', 'eas', 'message']) ??
    readNestedString(manifest, ['extra', 'expoClient', 'message']) ??
    readNestedString(manifest, ['description']);

  return candidate?.trim() || null;
}

function buildPostUpdateMessage(intro: string, notes?: string | null): string {
  const normalizedNotes = notes?.trim();

  if (!normalizedNotes) {
    return `${intro}\n\nCatatan update:\nPerubahan terbaru sudah aktif di aplikasi ini.`;
  }

  return `${intro}\n\nCatatan update:\n${normalizedNotes}`;
}

export function buildPostUpdateNoticeForApk(
  manifest: RemoteApkUpdateManifest,
  currentVersion: string
): PostUpdateNotice {
  return {
    kind: 'apk',
    title: 'Update selesai',
    message: buildPostUpdateMessage(
      `Versi ${manifest.version} sudah dipakai.`,
      manifest.notes
    ),
    preparedAt: Date.now(),
    sourceVersion: currentVersion,
    targetVersion: manifest.version,
  };
}

export function buildPostUpdateNoticeForEas(options: {
  sourceUpdateId?: string;
  sourceCreatedAt?: string;
  targetUpdateId?: string;
  targetCreatedAt?: string;
  notes?: string | null;
}): PostUpdateNotice {
  return {
    kind: 'eas',
    title: 'Update selesai',
    message: buildPostUpdateMessage('Versi baru sudah dipakai.', options.notes),
    preparedAt: Date.now(),
    sourceUpdateId: options.sourceUpdateId,
    sourceCreatedAt: options.sourceCreatedAt,
    targetUpdateId: options.targetUpdateId,
    targetCreatedAt: options.targetCreatedAt,
  };
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

export async function fetchAvailableEasUpdateAsync(): Promise<AvailableAppUpdate | null> {
  if (__DEV__ || Platform.OS === 'web' || isExpoGoRuntime() || !Updates.isEnabled) {
    return null;
  }

  const update = await Updates.checkForUpdateAsync();
  if (!update.isAvailable) {
    return null;
  }

  await Updates.fetchUpdateAsync();

  return {
    kind: 'eas',
    notes: extractUpdateNotesFromManifest(update.manifest),
  };
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
    const easUpdate = await fetchAvailableEasUpdateAsync();
    easCheckSucceeded = true;
    if (easUpdate) {
      return easUpdate;
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
