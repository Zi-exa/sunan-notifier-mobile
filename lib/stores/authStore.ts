import { create } from 'zustand';
import { SECURE_KEYS } from '@/lib/config';
import { CONFIG } from '@/lib/config';
import { getReadableErrorMessage } from '@/lib/moodle/errors';
import { getAuthenticatedMoodleFileUrl, requestMoodleTokenPayload, getSiteInfo } from '@/lib/moodle/client';
import { cancelAllScheduledSunanNotifications } from '@/lib/notifications';
import { resolveFullname } from '@/lib/utils/displayName';
import { getSecureItem, removeSecureItem, setSecureItem } from '@/lib/storage/secureStore';
import { useNotificationDedupeStore } from '@/lib/stores/notificationDedupeStore';
import { deactivateDevicePushToken, syncUserProfile } from '@/lib/supabase/repositories';

export type AuthUser = {
  id: number;
  nim: string;
  username: string;
  fullname: string;
  firstname?: string | null;
  lastname?: string | null;
  siteUrl: string;
  pictureUrl?: string;
  appUserId?: string | null;
};

type AuthSession = {
  token: string;
  privateToken?: string;
  user: AuthUser;
};

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

type AuthState = {
  hydrated: boolean;
  status: AuthStatus;
  token: string | null;
  privateToken: string | null;
  user: AuthUser | null;
  error: string | null;
  logoutNotice: string | null;
  hydrateSession: () => Promise<void>;
  login: (
    nim: string,
    password: string,
    options?: { rememberCredentials?: boolean }
  ) => Promise<void>;
  setAppUserId: (appUserId: string | null) => Promise<void>;
  refreshProfile: () => Promise<void>;
  expireSession: (reason?: string) => Promise<void>;
  clearError: () => void;
  clearLogoutNotice: () => void;
  logout: () => Promise<void>;
};

function safeParseSession(payload: string | null): AuthSession | null {
  if (!payload) {
    return null;
  }

  try {
    return JSON.parse(payload) as AuthSession;
  } catch {
    return null;
  }
}

function normalizeAuthUser(token: string, user: AuthUser): AuthUser {
  const normalizedPictureUrl = getAuthenticatedMoodleFileUrl(token, user.pictureUrl, user.siteUrl);

  if (normalizedPictureUrl === user.pictureUrl) {
    return user;
  }

  return {
    ...user,
    pictureUrl: normalizedPictureUrl,
  };
}

export const useAuthStore = create<AuthState>((set, get) => ({
  hydrated: false,
  status: 'loading',
  token: null,
  privateToken: null,
  user: null,
  error: null,
  logoutNotice: null,
  hydrateSession: async () => {
    const stored = await getSecureItem(SECURE_KEYS.authSession);
    const session = safeParseSession(stored);

    if (!session?.token || !session.user) {
      set({
        hydrated: true,
        status: 'unauthenticated',
        token: null,
        privateToken: null,
        user: null,
        logoutNotice: null,
      });
      return;
    }

    // Guard against stale mock session when app is switched back to real SUNAN mode.
    // Only invalidate if the stored token is literally the mock-token string used in dev/demo mode.
    const isLegacyMockSession = !CONFIG.useMockData && session.token === 'mock-token';

    if (isLegacyMockSession) {
      await removeSecureItem(SECURE_KEYS.authSession);
      set({
        hydrated: true,
        status: 'unauthenticated',
        token: null,
        privateToken: null,
        user: null,
        error: null,
        logoutNotice: null,
      });
      return;
    }

    const normalizedUser = normalizeAuthUser(session.token, session.user);

    if (normalizedUser.pictureUrl !== session.user.pictureUrl) {
      await setSecureItem(
        SECURE_KEYS.authSession,
        JSON.stringify({
          ...session,
          user: normalizedUser,
        })
      );
    }

    set({
      hydrated: true,
      status: 'authenticated',
      token: session.token,
      privateToken: session.privateToken ?? null,
      user: normalizedUser,
      error: null,
      logoutNotice: null,
    });
  },
  login: async (nim: string, password: string, options) => {
    const normalizedNim = nim.trim();
    const rememberCredentials = options?.rememberCredentials ?? false;

    if (!normalizedNim || !password) {
      set({ error: 'NIM dan password wajib diisi.' });
      return;
    }

    try {
      set({ status: 'loading', error: null, logoutNotice: null });

      const tokenPayload = await requestMoodleTokenPayload(normalizedNim, password);
      const token = tokenPayload.token;
      const siteInfo = await getSiteInfo(token);

      const baseUser: AuthUser = {
        id: siteInfo.userid,
        nim: normalizedNim,
        username: siteInfo.username,
        fullname: resolveFullname({
          fullname: siteInfo.fullname,
          firstname: siteInfo.firstname,
          lastname: siteInfo.lastname,
          nim: normalizedNim,
          username: siteInfo.username,
        }) || siteInfo.fullname,
        firstname: siteInfo.firstname ?? null,
        lastname: siteInfo.lastname ?? null,
        siteUrl: siteInfo.siteurl,
        pictureUrl: getAuthenticatedMoodleFileUrl(token, siteInfo.userpictureurl, siteInfo.siteurl),
      };

      let appUserId: string | null = null;
      try {
        appUserId = await syncUserProfile({
          moodleUserId: siteInfo.userid,
          nim: normalizedNim,
          fullname: baseUser.fullname,
          moodleToken: token,
        });
      } catch {
        appUserId = null;
      }

      const user = {
        ...baseUser,
        appUserId,
      };

      const session: AuthSession = { token, privateToken: tokenPayload.privateToken, user };
      await setSecureItem(SECURE_KEYS.authSession, JSON.stringify(session));

      if (rememberCredentials) {
        await setSecureItem(
          SECURE_KEYS.savedCredentials,
          JSON.stringify({ nim: normalizedNim, password })
        );
      } else {
        await removeSecureItem(SECURE_KEYS.savedCredentials);
      }

      set({
        status: 'authenticated',
        token,
        privateToken: tokenPayload.privateToken ?? null,
        user,
        error: null,
        logoutNotice: null,
      });
    } catch (error) {
      const message = getReadableErrorMessage(error, 'login');

      set({
        status: 'unauthenticated',
        token: null,
        privateToken: null,
        user: null,
        error: message,
        logoutNotice: null,
      });
    }
  },
  setAppUserId: async (appUserId) => {
    const { token, privateToken, user } = get();

    if (!token || !user) {
      return;
    }

    if (user.appUserId === appUserId) {
      return;
    }

    const nextUser = {
      ...user,
      appUserId,
    };

    await setSecureItem(
      SECURE_KEYS.authSession,
      JSON.stringify({
        token,
        privateToken: privateToken ?? undefined,
        user: nextUser,
      })
    );

    set({ user: nextUser });
  },
  refreshProfile: async () => {
    const { token, privateToken, user } = get();

    if (!token || !user) {
      return;
    }

    try {
      const siteInfo = await getSiteInfo(token);
      const resolved = resolveFullname({
        fullname: siteInfo.fullname,
        firstname: siteInfo.firstname,
        lastname: siteInfo.lastname,
        nim: user.nim,
        username: siteInfo.username,
      });

      const nextUser: AuthUser = {
        ...user,
        username: siteInfo.username || user.username,
        fullname: resolved || user.fullname,
        firstname: siteInfo.firstname ?? user.firstname ?? null,
        lastname: siteInfo.lastname ?? user.lastname ?? null,
        pictureUrl: getAuthenticatedMoodleFileUrl(
          token,
          siteInfo.userpictureurl,
          siteInfo.siteurl
        ),
      };

      await setSecureItem(
        SECURE_KEYS.authSession,
        JSON.stringify({
          token,
          privateToken: privateToken ?? undefined,
          user: nextUser,
        })
      );

      set({ user: nextUser });
    } catch {
      // Silent: display layer already falls back to "Mahasiswa" instead of NIM.
    }
  },
  expireSession: async (reason = 'Silakan login lagi untuk melanjutkan.') => {
    await cancelAllScheduledSunanNotifications();
    useNotificationDedupeStore.getState().reset();
    await removeSecureItem(SECURE_KEYS.authSession);

    set({
      status: 'unauthenticated',
      token: null,
      privateToken: null,
      user: null,
      error: reason,
      logoutNotice: null,
    });
  },
  clearError: () => {
    set({ error: null });
  },
  clearLogoutNotice: () => {
    set({ logoutNotice: null });
  },
  logout: async () => {
    const { token, user } = get();

    if (token && user) {
      try {
        await deactivateDevicePushToken({
          moodleToken: token,
          moodleUserId: user.id,
          nim: user.nim,
          fullname: user.fullname,
        });
      } catch {
        // Logout must still work even if the cleanup endpoint is unreachable.
      }
    }

    await cancelAllScheduledSunanNotifications();
    useNotificationDedupeStore.getState().reset();
    await removeSecureItem(SECURE_KEYS.authSession);
    set({
      status: 'unauthenticated',
      token: null,
      privateToken: null,
      user: null,
      error: null,
      logoutNotice: 'Anda berhasil keluar dari akun SUNAN.',
    });
  },
}));
