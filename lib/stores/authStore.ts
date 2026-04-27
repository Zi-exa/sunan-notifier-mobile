import { create } from 'zustand';
import { SECURE_KEYS } from '@/lib/config';
import { CONFIG } from '@/lib/config';
import { getReadableErrorMessage } from '@/lib/moodle/errors';
import { getAuthenticatedMoodleFileUrl, requestMoodleToken, getSiteInfo } from '@/lib/moodle/client';
import { getSecureItem, removeSecureItem, setSecureItem } from '@/lib/storage/secureStore';
import { syncUserProfile } from '@/lib/supabase/repositories';

export type AuthUser = {
  id: number;
  nim: string;
  username: string;
  fullname: string;
  siteUrl: string;
  pictureUrl?: string;
  appUserId?: string | null;
};

type AuthSession = {
  token: string;
  user: AuthUser;
};

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

type AuthState = {
  hydrated: boolean;
  status: AuthStatus;
  token: string | null;
  user: AuthUser | null;
  error: string | null;
  logoutNotice: string | null;
  hydrateSession: () => Promise<void>;
  login: (nim: string, password: string) => Promise<void>;
  setAppUserId: (appUserId: string | null) => Promise<void>;
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
  user: null,
  error: null,
  logoutNotice: null,
  hydrateSession: async () => {
    const stored = await getSecureItem(SECURE_KEYS.authSession);
    const session = safeParseSession(stored);

    if (!session?.token || !session.user) {
      set({ hydrated: true, status: 'unauthenticated', token: null, user: null, logoutNotice: null });
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
      user: normalizedUser,
      error: null,
      logoutNotice: null,
    });
  },
  login: async (nim: string, password: string) => {
    const normalizedNim = nim.trim();

    if (!normalizedNim || !password) {
      set({ error: 'NIM dan password wajib diisi.' });
      return;
    }

    try {
      set({ status: 'loading', error: null, logoutNotice: null });

      const token = await requestMoodleToken(normalizedNim, password);
      const siteInfo = await getSiteInfo(token);

      const baseUser: AuthUser = {
        id: siteInfo.userid,
        nim: normalizedNim,
        username: siteInfo.username,
        fullname: siteInfo.fullname,
        siteUrl: siteInfo.siteurl,
        pictureUrl: getAuthenticatedMoodleFileUrl(token, siteInfo.userpictureurl, siteInfo.siteurl),
      };

      let appUserId: string | null = null;
      try {
        appUserId = await syncUserProfile({
          moodleUserId: siteInfo.userid,
          nim: normalizedNim,
          fullname: siteInfo.fullname,
          moodleToken: token,
        });
      } catch {
        appUserId = null;
      }

      const user = {
        ...baseUser,
        appUserId,
      };

      const session: AuthSession = { token, user };
      await setSecureItem(SECURE_KEYS.authSession, JSON.stringify(session));

      // Save credentials for next login suggestion (stored securely on-device)
      await setSecureItem(
        SECURE_KEYS.savedCredentials,
        JSON.stringify({ nim: normalizedNim, password })
      );

      set({
        status: 'authenticated',
        token,
        user,
        error: null,
        logoutNotice: null,
      });
    } catch (error) {
      const message = getReadableErrorMessage(error, 'login');

      set({
        status: 'unauthenticated',
        token: null,
        user: null,
        error: message,
        logoutNotice: null,
      });
    }
  },
  setAppUserId: async (appUserId) => {
    const { token, user } = get();

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
        user: nextUser,
      })
    );

    set({ user: nextUser });
  },
  expireSession: async (reason = 'Sesi SUNAN berakhir. Silakan login ulang.') => {
    await removeSecureItem(SECURE_KEYS.authSession);

    set({
      status: 'unauthenticated',
      token: null,
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
    await removeSecureItem(SECURE_KEYS.authSession);
    set({
      status: 'unauthenticated',
      token: null,
      user: null,
      error: null,
      logoutNotice: 'Anda berhasil keluar dari akun SUNAN.',
    });
  },
}));
