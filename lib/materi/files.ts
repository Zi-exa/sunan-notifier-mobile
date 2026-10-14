import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { getAuthenticatedMoodleFileUrl } from '@/lib/moodle/client';

export type MateriDownloadProgress = {
  written: number;
  total: number;
};

function sanitizeFileName(name: string, fallback = 'materi-sunan'): string {
  const cleaned = name.replace(/[^\w.\-() ]+/g, '').trim().replace(/\s+/g, '_');
  return cleaned.length > 0 ? cleaned.slice(0, 120) : fallback;
}

/**
 * Unduh berkas materi SUNAN lalu buka lewat aplikasi yang cocok di HP
 * (PDF/gambar/Office: PowerPoint, WPS, dsb). Semua di dalam alur aplikasi.
 */
export async function downloadAndOpenMateriFileAsync(options: {
  fileUrl: string | null;
  fileName: string;
  mimetype?: string | null;
  token?: string | null;
  siteUrl?: string;
  onProgress?: (progress: MateriDownloadProgress) => void;
}): Promise<void> {
  if (Platform.OS !== 'android') {
    throw new Error('Unduh berkas hanya didukung di Android.');
  }

  if (!options.fileUrl) {
    throw new Error('Tautan berkas tidak tersedia.');
  }

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Perangkat ini tidak mendukung buka berkas.');
  }

  const authedUrl = options.token
    ? (getAuthenticatedMoodleFileUrl(options.token, options.fileUrl, options.siteUrl) ?? options.fileUrl)
    : options.fileUrl;

  const cacheDir = FileSystem.cacheDirectory;
  if (!cacheDir) {
    throw new Error('Penyimpanan unduhan tidak tersedia.');
  }

  const fileUri = `${cacheDir}${Date.now()}-${sanitizeFileName(options.fileName)}`;
  const task = FileSystem.createDownloadResumable(authedUrl, fileUri, {}, (data) => {
    options.onProgress?.({
      written: data.totalBytesWritten,
      total: data.totalBytesExpectedToWrite,
    });
  });

  const result = await task.downloadAsync();
  if (!result || result.status !== 200) {
    throw new Error(`Unduhan gagal (status ${result?.status ?? 'unknown'}).`);
  }

  await Sharing.shareAsync(result.uri, {
    mimeType: options.mimetype ?? undefined,
    dialogTitle: `Buka ${options.fileName}`,
  });
}
