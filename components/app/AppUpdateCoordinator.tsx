import { useEffect, useMemo, useRef, useState } from 'react';
import { AppAlertDialog } from '@/components/Redesign';
import {
  applyAvailableAppUpdateAsync,
  checkForAvailableAppUpdateAsync,
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
  const base = `Versi ${manifest.version} sudah tersedia. Aplikasi akan membuka halaman update.`;
  const notes = manifest.notes?.trim();

  return notes ? `${base}\n\n${notes}` : base;
}

export function AppUpdateCoordinator() {
  const authHydrated = useAuthStore((state) => state.hydrated);
  const authStatus = useAuthStore((state) => state.status);
  const tabsBootStatus = useTabsBootStore((state) => state.status);
  const availableUpdate = useAppUpdateStore((state) => state.availableUpdate);
  const dialogVisible = useAppUpdateStore((state) => state.dialogVisible);
  const setAvailableUpdate = useAppUpdateStore((state) => state.setAvailableUpdate);
  const hideDialog = useAppUpdateStore((state) => state.hideDialog);
  const hasCheckedRef = useRef(false);
  const [errorDialog, setErrorDialog] = useState<UpdateDialogErrorState | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

    if (!dialogVisible || !availableUpdate) {
      return null;
    }

    if (availableUpdate.kind === 'apk') {
      const title = availableUpdate.manifest.title?.trim() || 'Versi baru tersedia';

      return {
        tone: 'info' as const,
        title,
        message: buildRemoteApkMessage(availableUpdate.manifest),
        confirmLabel: 'Buka update',
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
  }, [availableUpdate, dialogVisible, errorDialog]);

  async function handleConfirm() {
    if (errorDialog) {
      setErrorDialog(null);
      return;
    }

    if (!availableUpdate) {
      return;
    }

    setSubmitting(true);

    try {
      await applyAvailableAppUpdateAsync(availableUpdate);
      hideDialog();
    } catch {
      setErrorDialog({
        kind: 'error',
        title: 'Belum bisa dibuka',
        message:
          availableUpdate.kind === 'apk'
            ? 'Halaman update belum bisa dibuka sekarang. Coba lagi beberapa saat.'
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
      confirmDisabled={submitting}
      onConfirm={handleConfirm}
      onClose={() => {
        if (!submitting) {
          if (errorDialog) {
            setErrorDialog(null);
            return;
          }

          hideDialog();
        }
      }}
    />
  );
}
