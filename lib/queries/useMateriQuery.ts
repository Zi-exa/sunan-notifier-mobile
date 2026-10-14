import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/stores/authStore';
import { loadMateriList, type MateriItem } from '@/lib/supabase/repositories';

const STALE_TIME_MS = 5 * 60 * 1000;

export type { MateriItem };

export function isMateriRecent(updatedAt: string, nowMs = Date.now()): boolean {
  const time = new Date(updatedAt).getTime();
  if (!Number.isFinite(time)) return false;
  return nowMs - time < 7 * 24 * 60 * 60 * 1000;
}

/**
 * Tanggal tampil materi: pakai tanggal ubah berkas dari SUNAN bila ada,
 * fallback ke waktu snapshot. Ini tanggal upload yang sebenarnya,
 * bukan jadwal cron.
 */
export function getMateriDisplayIso(item: MateriItem): string {
  const fileTimes = (item.files ?? [])
    .map((file) => file.changedAt)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (fileTimes.length > 0) {
    return new Date(Math.max(...fileTimes) * 1000).toISOString();
  }
  return item.updatedAt;
}

export function isMateriDisplayRecent(item: MateriItem, nowMs = Date.now()): boolean {
  return isMateriRecent(getMateriDisplayIso(item), nowMs);
}

export function useMateriListQuery() {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);

  return useQuery({
    queryKey: ['materi-list', user?.id ?? 'anon'],
    enabled: Boolean(token && user?.id),
    staleTime: STALE_TIME_MS,
    retry: 2,
    queryFn: async () => {
      const response = await loadMateriList({
        moodleToken: token as string,
        moodleUserId: user?.id as number,
        nim: user?.nim ?? '',
        fullname: user?.fullname ?? '',
      });
      return response.items;
    },
  });
}
