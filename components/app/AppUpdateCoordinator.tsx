import { useEffect, useMemo, useRef, useState } from 'react';
import * as Updates from 'expo-updates';
import { AppAlertDialog } from '@/components/Redesign';
import {
  applyAvailableAppUpdateAsync,
  buildPostUpdateNoticeForApk,
  buildPostUpdateNoticeForEas,
  checkForAvailableAppUpdateAsync,
  downloadAndInstallApkUpdateAsync,
  extractUpdateNotesFromManifest,
  getCurrentAppVersion,
  openRemoteApkUpdateUrl,
  type RemoteApkUpdateManifest,
} from '@/lib/updates';
import { useAuthStore } from '@/lib/stores/authStore';
import { useAppUpdateStore } from '@/lib/stores/appUpdateStore';
import { useTabsBootStore } from '@/lib/stores/tabsBootStore';

type UpdateDialogErrorState = {
  kind: 'error';
  title: string;
  message: string;
};

function buildRemoteApkMessage(manifest: RemoteApkUpdateManifest): string {
  const base = `Versi ${manifest.version} sudah tersedia dan bisa dipasang langsung dari aplikasi.`;
  const notes = manifest.notes?.trim();

  return notes ? `${base}\n\n${notes}` : base;
}

export function AppUpdateCoordinator() {
  const {
    isUpdatePending,
    downloadedUpdate,
    availableUpdate: nativeAvailableUpdate,
    currentlyRunning,
  } = Updates.useUpdates();
  const authHydrated = useAuthStore((state) => state.hydrated);
  const authStatus = useAuthStore((state) => state.status);
  const tabsBootStatus = useTabsBootStore((state) => state.status);
  const availableUpdate = useAppUpdateStore((state) => state.availableUpdate);
  const dialogVisible = useAppUpdateStore((state) => state.dialogVisible);
  const pendingPostUpdateNotice = useAppUpdateStore((state) => state.pendingPostUpdateNotice);
  const activePostUpdateNotice = useAppUpdateStore((state) => state.activePostUpdateNotice);
  const setAvailableUpdate = useAppUpdateStore((state) => state.setAvailableUpdate);
  const hideDialog = useAppUpdateStore((state) => state.hideDialog);
  const queuePostUpdateNotice = useAppUpdateStore((state) => state.queuePostUpdateNotice);
  const clearPendingPostUpdateNotice = useAppUpdateStore(
    (state) => state.clearPendingPostUpdateNotice
  );
  const activatePendingPostUpdateNotice = useAppUpdateStore(
    (state) => state.activatePendingPostUpdateNotice
  );
  const dismissPostUpdateNotice = useAppUpdateStore((state) => state.dismissPostUpdateNotice);
  const hasCheckedRef = useRef(false);
  const hasMirroredPendingUpdateRef = useRef(false);
  const lastActivatedNoticeRef = useRef<number | null>(null);
  const [errorDialog, setErrorDialog] = useState<UpdateDialogErrorState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [apkDownloadPercent, setApkDownloadPercent] = useState<number | null>(null);
  const currentAppVersion = getCurrentAppVersion();

  const bootReady =
    authHydrated &&
    authStatus !== 'loading' &&
    (authStatus !== 'authenticated' || tabsBootStatus !== 'loading');

  useEffect(() => {
    if (!bootReady || hasCheckedRef.current) {
      return;
    }

    hasCheckedRef.current = true;
    let cancelled = false;

    async function checkUpdates() {
      try {
        const update = await checkForAvailableAppUpdateAsync();
        if (cancelled || !update) {
          return;
        }

        if (!cancelled) {
          setAvailableUpdate(update);
        }
      } catch {
        // Update checker should stay silent if both channels fail.
      }
    }

    void checkUpdates();

    return () => {
      cancelled = true;
    };
  }, [bootReady, setAvailableUpdate]);

  useEffect(() => {
    if (!isUpdatePending) {
      hasMirroredPendingUpdateRef.current = false;
      return;
    }

    if (hasMirroredPendingUpdateRef.current) {
      return;
    }

    hasMirroredPendingUpdateRef.current = true;
    setAvailableUpdate({
      kind: 'eas',
      notes:
        (availableUpdate?.kind === 'eas' ? availableUpdate.notes : null) ??
        extractUpdateNotesFromManifest(downloadedUpdate?.manifest) ??
        extractUpdateNotesFromManifest(nativeAvailableUpdate?.manifest),
    });
  }, [
    availableUpdate,
    downloadedUpdate?.manifest,
    isUpdatePending,
    nativeAvailableUpdate?.manifest,
    setAvailableUpdate,
  ]);

  useEffect(() => {
    if (!pendingPostUpdateNotice || activePostUpdateNotice) {
      return;
    }

    if (lastActivatedNoticeRef.current === pendingPostUpdateNotice.preparedAt) {
      return;
    }

    const matchesCurrentRuntime =
      pendingPostUpdateNotice.kind === 'apk'
        ? Boolean(
            pendingPostUpdateNotice.sourceVersion &&
              currentAppVersion !== pendingPostUpdateNotice.sourceVersion &&
              (!pendingPostUpdateNotice.targetVersion ||
                pendingPostUpdateNotice.targetVersion === currentAppVersion)
          )
        : Boolean(
            (pendingPostUpdateNotice.targetUpdateId &&
              currentlyRunning.updateId === pendingPostUpdateNotice.targetUpdateId) ||
              (pendingPostUpdateNotice.sourceUpdateId &&
                currentlyRunning.updateId &&
                currentlyRunning.updateId !== pendingPostUpdateNotice.sourceUpdateId) ||
              (pendingPostUpdateNotice.targetCreatedAt &&
                currentlyRunning.createdAt?.toISOString() ===
                  pendingPostUpdateNotice.targetCreatedAt) ||
              (pendingPostUpdateNotice.sourceCreatedAt &&
                currentlyRunning.createdAt?.toISOString() &&
                currentlyRunning.createdAt?.toISOString() !==
                  pendingPostUpdateNotice.sourceCreatedAt)
          );

    if (matchesCurrentRuntime) {
      lastActivatedNoticeRef.current = pendingPostUpdateNotice.preparedAt;
      activatePendingPostUpdateNotice();
    }
  }, [
    activatePendingPostUpdateNotice,
    activePostUpdateNotice,
    currentAppVersion,
    currentlyRunning.createdAt,
    currentlyRunning.updateId,
    pendingPostUpdateNotice,
  ]);

  const dialogCopy = useMemo(() => {
    if (errorDialog) {
      return {
        tone: 'warning' as const,
        title: errorDialog.title,
        message: errorDialog.message,
        confirmLabel: 'Tutup',
        cancelLabel: undefined,
        dismissDisabled: false,
      };
    }

    if (activePostUpdateNotice) {
      return {
        tone: 'success' as const,
        title: activePostUpdateNotice.title,
        message: activePostUpdateNotice.message,
        confirmLabel: 'Tutup',
        cancelLabel: undefined,
        dismissDisabled: false,
      };
    }

    if (!dialogVisible || !availableUpdate) {
      return null;
    }

    if (availableUpdate.kind === 'apk') {
      const title = availableUpdate.manifest.title?.trim() || 'Versi baru tersedia';

      if (apkDownloadPercent !== null) {
        return {
          tone: 'info' as const,
          title: 'Mengunduh update',
          message: `Mengunduh versi ${availableUpdate.manifest.version}... ${apkDownloadPercent}%. Tetap di halaman ini sampai unduhan selesai.`,
          confirmLabel: `Mengunduh... ${apkDownloadPercent}%`,
          cancelLabel: undefined,
          dismissDisabled: true,
        };
      }

      return {
        tone: 'info' as const,
        title,
        message: buildRemoteApkMessage(availableUpdate.manifest),
        confirmLabel: 'Update sekarang',
        cancelLabel: availableUpdate.manifest.mandatory ? undefined : 'Nanti',
        dismissDisabled: availableUpdate.manifest.mandatory ?? false,
      };
    }

    if (availableUpdate.kind === 'eas') {
      return {
        tone: 'info' as const,
        title: 'Versi baru siap dipakai',
        message:
          'Ada versi baru yang siap dipakai. Tekan update untuk memakai versi terbaru.',
        confirmLabel: 'Update sekarang',
        cancelLabel: 'Nanti',
        dismissDisabled: false,
      };
    }

    return null;
  }, [activePostUpdateNotice, apkDownloadPercent, availableUpdate, dialogVisible, errorDialog]);

  async function handleConfirm() {
    if (errorDialog) {
      setErrorDialog(null);
      return;
    }

    if (activePostUpdateNotice) {
      dismissPostUpdateNotice();
      return;
    }

    if (!availableUpdate || apkDownloadPercent !== null) {
      return;
    }

    setSubmitting(true);

    try {
      if (availableUpdate.kind === 'apk') {
        queuePostUpdateNotice(
          buildPostUpdateNoticeForApk(availableUpdate.manifest, currentAppVersion)
        );

        // Update besar langsung dari aplikasi: unduh + buka installer sistem.
        // Fallback ke browser bila unduhan/install langsung gagal.
        try {
          setApkDownloadPercent(0);
          await downloadAndInstallApkUpdateAsync(availableUpdate.manifest.apkUrl, (progress) => {
            setApkDownloadPercent(
              progress.total > 0 ? Math.min(99, Math.round((progress.written / progress.total) * 100)) : 0
            );
          });
          setApkDownloadPercent(null);
          hideDialog();
        } catch {
          setApkDownloadPercent(null);
          await openRemoteApkUpdateUrl(availableUpdate.manifest.apkUrl);
          hideDialog();
        }
        return;
      }

      queuePostUpdateNotice(
          buildPostUpdateNoticeForEas({
            sourceUpdateId: currentlyRunning.updateId,
            sourceCreatedAt: currentlyRunning.createdAt?.toISOString(),
            targetUpdateId: downloadedUpdate?.updateId ?? nativeAvailableUpdate?.updateId,
            targetCreatedAt:
              downloadedUpdate?.createdAt?.toISOString() ??
              nativeAvailableUpdate?.createdAt?.toISOString(),
            notes:
              availableUpdate.notes ??
              extractUpdateNotesFromManifest(downloadedUpdate?.manifest) ??
              extractUpdateNotesFromManifest(nativeAvailableUpdate?.manifest),
          })
        );

      await applyAvailableAppUpdateAsync(availableUpdate);
      hideDialog();
    } catch {
      clearPendingPostUpdateNotice();
      setErrorDialog({
        kind: 'error',
        title: 'Belum bisa dibuka',
        message:
          availableUpdate.kind === 'apk'
            ? 'Update belum bisa diunduh sekarang. Coba lagi beberapa saat.'
            : 'Pembaruan belum bisa dipasang sekarang. Tutup lalu buka lagi aplikasi ini, lalu coba lagi.',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppAlertDialog
      visible={Boolean(dialogCopy)}
      tone={dialogCopy?.tone}
      title={dialogCopy?.title ?? ''}
      message={dialogCopy?.message ?? ''}
      confirmLabel={dialogCopy?.confirmLabel}
      cancelLabel={dialogCopy?.cancelLabel}
      dismissDisabled={dialogCopy?.dismissDisabled}
      confirmDisabled={submitting || apkDownloadPercent !== null}
      onConfirm={handleConfirm}
      onClose={() => {
        if (!submitting) {
          if (errorDialog) {
            setErrorDialog(null);
            return;
          }

          if (activePostUpdateNotice) {
            dismissPostUpdateNotice();
            return;
          }

          hideDialog();
        }
      }}
    />
  );
}
