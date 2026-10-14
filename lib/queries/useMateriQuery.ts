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
