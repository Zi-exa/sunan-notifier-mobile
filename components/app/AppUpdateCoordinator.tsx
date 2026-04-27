import { useEffect, useMemo, useRef, useState } from 'react';
import { AppAlertDialog } from '@/components/Redesign';
import {
  checkForRemoteApkUpdateAsync,
  fetchAvailableEasUpdateAsync,
  openRemoteApkUpdateUrl,
  type RemoteApkUpdateManifest,
  reloadToApplyEasUpdateAsync,
} from '@/lib/updates';
import { useAuthStore } from '@/lib/stores/authStore';
import { useTabsBootStore } from '@/lib/stores/tabsBootStore';

type UpdateDialogState =
  | {
      kind: 'apk';
      manifest: RemoteApkUpdateManifest;
    }
  | {
      kind: 'eas';
    }
  | {
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
  const hasCheckedRef = useRef(false);
  const [dialog, setDialog] = useState<UpdateDialogState | null>(null);
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
        const manifest = await checkForRemoteApkUpdateAsync();
        if (cancelled || !manifest) {
          if (!cancelled) {
            const hasEasUpdate = await fetchAvailableEasUpdateAsync();
            if (!cancelled && hasEasUpdate) {
              setDialog({ kind: 'eas' });
            }
          }
          return;
        }

        setDialog({ kind: 'apk', manifest });
      } catch {
        try {
          const hasEasUpdate = await fetchAvailableEasUpdateAsync();
          if (!cancelled && hasEasUpdate) {
            setDialog({ kind: 'eas' });
          }
        } catch {
          // Update checker should stay silent if both channels fail.
        }
      }
    }

    void checkUpdates();

    return () => {
      cancelled = true;
    };
  }, [bootReady]);

  const dialogCopy = useMemo(() => {
    if (!dialog) {
      return null;
    }

    if (dialog.kind === 'apk') {
      const title = dialog.manifest.title?.trim() || 'Versi baru tersedia';

      return {
        tone: 'info' as const,
        title,
        message: buildRemoteApkMessage(dialog.manifest),
        confirmLabel: 'Buka update',
        cancelLabel: dialog.manifest.mandatory ? undefined : 'Nanti',
        dismissDisabled: dialog.manifest.mandatory ?? false,
      };
    }

    if (dialog.kind === 'eas') {
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

    return {
      tone: 'warning' as const,
      title: dialog.title,
      message: dialog.message,
      confirmLabel: 'Tutup',
      cancelLabel: undefined,
      dismissDisabled: false,
    };
  }, [dialog]);

  async function handleConfirm() {
    if (!dialog) {
      return;
    }

    if (dialog.kind === 'error') {
      setDialog(null);
      return;
    }

    setSubmitting(true);

    try {
      if (dialog.kind === 'apk') {
        await openRemoteApkUpdateUrl(dialog.manifest.apkUrl);
        setDialog(null);
        return;
      }

      await reloadToApplyEasUpdateAsync();
    } catch {
      setDialog({
        kind: 'error',
        title: 'Belum bisa dibuka',
        message:
          dialog.kind === 'apk'
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
          setDialog(null);
        }
      }}
    />
  );
}
