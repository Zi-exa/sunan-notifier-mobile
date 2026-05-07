import { Platform } from 'react-native';
import { POLLING_INTERVAL_OPTIONS } from '@/lib/config';
import type { PollingInterval } from '@/lib/config';
import { supabase } from '@/lib/supabase/client';

export type SessionProfileInput = {
  moodleUserId: number;
  nim: string;
  fullname: string;
  moodleToken: string;
};

export type UserSettingsInput = {
  notifyNewTask: boolean;
  notifyDeadlineH1: boolean;
  notifyDeadlineToday: boolean;
  notifyTaskOpen: boolean;
  notifyAttendance: boolean;
  pollIntervalMinutes: PollingInterval;
  dndStart: string;
  dndEnd: string;
  monitoredCourseIds: number[];
};

export type RemoteUserSettings = Omit<UserSettingsInput, 'notifyTaskOpen'> & {
  notifyTaskOpen?: boolean;
};

export type SaveUserSettingsResult = 'full' | 'legacy-notify-task-open' | 'skipped';

type MobileDataAuthPayload = {
  moodleToken: string;
  moodleUserId: number;
  nim?: string;
  fullname?: string;
};

type MobileDataAction =
  | 'sync-profile'
  | 'load-settings'
  | 'save-settings'
  | 'upsert-device';

type MobileDataResponseMap = {
  'sync-profile': {
    appUserId: string | null;
  };
  'load-settings': {
    settings: RemoteUserSettings | null;
    appUserId: string | null;
  };
  'save-settings': {
    result: SaveUserSettingsResult;
    appUserId: string | null;
  };
  'upsert-device': {
    ok: boolean;
    appUserId: string | null;
  };
};

function coerceRemoteSettings(data: Record<string, unknown>): RemoteUserSettings {
  const pollIntervalMinutes = Number(data.pollIntervalMinutes);

  return {
    notifyNewTask: Boolean(data.notifyNewTask),
    notifyDeadlineH1: Boolean(data.notifyDeadlineH1),
    notifyDeadlineToday: Boolean(data.notifyDeadlineToday),
    notifyTaskOpen:
      typeof data.notifyTaskOpen === 'boolean' ? data.notifyTaskOpen : undefined,
    notifyAttendance: Boolean(data.notifyAttendance),
    pollIntervalMinutes: POLLING_INTERVAL_OPTIONS.includes(pollIntervalMinutes as PollingInterval)
      ? (pollIntervalMinutes as PollingInterval)
      : 15,
    dndStart: typeof data.dndStart === 'string' ? data.dndStart : '22:00',
    dndEnd: typeof data.dndEnd === 'string' ? data.dndEnd : '07:00',
    monitoredCourseIds: Array.isArray(data.monitoredCourseIds)
      ? data.monitoredCourseIds
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value))
      : [],
  };
}

async function invokeMobileData<Action extends MobileDataAction>(
  action: Action,
  payload: MobileDataAuthPayload & Record<string, unknown>
): Promise<MobileDataResponseMap[Action]> {
  if (!supabase) {
    throw new Error('Supabase belum dikonfigurasi.');
  }

  const { data, error } = await supabase.functions.invoke('mobile-data', {
    body: {
      action,
      ...payload,
    },
  });

  if (error) {
    throw new Error(error.message || 'Gagal memanggil layanan data aman.');
  }

  return data as MobileDataResponseMap[Action];
}

export async function syncUserProfile(input: SessionProfileInput): Promise<string | null> {
  if (!supabase) {
    return null;
  }

  const response = await invokeMobileData('sync-profile', {
    moodleToken: input.moodleToken,
    moodleUserId: input.moodleUserId,
    nim: input.nim,
    fullname: input.fullname,
  });

  return response.appUserId ?? null;
}

export async function upsertDevicePushToken(input: {
  moodleToken: string;
  moodleUserId: number;
  nim: string;
  fullname: string;
  pushToken: string;
}): Promise<string | null> {
  if (!supabase || !input.pushToken) {
    return null;
  }

  const response = await invokeMobileData('upsert-device', {
    moodleToken: input.moodleToken,
    moodleUserId: input.moodleUserId,
    nim: input.nim,
    fullname: input.fullname,
    pushToken: input.pushToken,
    platform: Platform.OS,
  });

  return response.appUserId ?? null;
}

export async function saveUserSettings(input: {
  moodleToken: string;
  moodleUserId: number;
  nim: string;
  fullname: string;
  settings: UserSettingsInput;
}): Promise<{ result: SaveUserSettingsResult; appUserId: string | null }> {
  if (!supabase) {
    return {
      result: 'skipped',
      appUserId: null,
    };
  }

  const response = await invokeMobileData('save-settings', {
    moodleToken: input.moodleToken,
    moodleUserId: input.moodleUserId,
    nim: input.nim,
    fullname: input.fullname,
    settings: input.settings,
  });

  return {
    result: response.result,
    appUserId: response.appUserId ?? null,
  };
}

export async function loadUserSettings(input: {
  moodleToken: string;
  moodleUserId: number;
  nim: string;
  fullname: string;
}): Promise<{ settings: RemoteUserSettings | null; appUserId: string | null }> {
  if (!supabase) {
    return {
      settings: null,
      appUserId: null,
    };
  }

  const response = await invokeMobileData('load-settings', {
    moodleToken: input.moodleToken,
    moodleUserId: input.moodleUserId,
    nim: input.nim,
    fullname: input.fullname,
  });

  return {
    settings:
      response.settings && typeof response.settings === 'object'
        ? coerceRemoteSettings(response.settings as Record<string, unknown>)
        : null,
    appUserId: response.appUserId ?? null,
  };
}
