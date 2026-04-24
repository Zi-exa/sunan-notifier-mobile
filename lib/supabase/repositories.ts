import { Platform } from 'react-native';
import { AssignmentItem } from '@/types/moodle';
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
  notifyAttendance: boolean;
  pollIntervalMinutes: number;
  dndStart: string;
  dndEnd: string;
  monitoredCourseIds: number[];
};

export async function syncUserProfile(input: SessionProfileInput): Promise<string | null> {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from('app_users')
    .upsert(
      {
        moodle_user_id: input.moodleUserId,
        nim: input.nim,
        fullname: input.fullname,
        moodle_token: input.moodleToken,
      },
      {
        onConflict: 'moodle_user_id',
      }
    )
    .select('id')
    .single();

  if (error) {
    throw new Error(`Gagal sinkron profil Supabase: ${error.message}`);
  }

  const appUserId = data?.id as string | undefined;

  if (!appUserId) {
    return null;
  }

  await supabase.from('user_settings').upsert(
    {
      app_user_id: appUserId,
    },
    {
      onConflict: 'app_user_id',
      ignoreDuplicates: false,
    }
  );

  return appUserId;
}

export async function upsertDevicePushToken(
  appUserId: string,
  pushToken: string
): Promise<void> {
  if (!supabase || !appUserId || !pushToken) {
    return;
  }

  const { error } = await supabase.from('user_devices').upsert(
    {
      app_user_id: appUserId,
      expo_push_token: pushToken,
      platform: Platform.OS,
      active: true,
      last_seen_at: new Date().toISOString(),
    },
    {
      onConflict: 'expo_push_token',
    }
  );

  if (error) {
    throw new Error(`Gagal simpan push token: ${error.message}`);
  }
}

export async function saveUserSettings(
  appUserId: string,
  input: UserSettingsInput
): Promise<void> {
  if (!supabase || !appUserId) {
    return;
  }

  const { error } = await supabase.from('user_settings').upsert(
    {
      app_user_id: appUserId,
      notify_new_task: input.notifyNewTask,
      notify_deadline_h1: input.notifyDeadlineH1,
      notify_deadline_today: input.notifyDeadlineToday,
      notify_attendance: input.notifyAttendance,
      poll_interval_minutes: input.pollIntervalMinutes,
      dnd_start: input.dndStart,
      dnd_end: input.dndEnd,
      monitored_course_ids: input.monitoredCourseIds,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: 'app_user_id',
    }
  );

  if (error) {
    throw new Error(`Gagal sinkron settings: ${error.message}`);
  }
}

export async function upsertTaskSnapshots(
  appUserId: string,
  assignments: AssignmentItem[]
): Promise<void> {
  if (!supabase || !appUserId) {
    return;
  }

  const rows = assignments.map((assignment) => ({
    app_user_id: appUserId,
    assignment_id: assignment.id,
    due_at: assignment.dueDate ? new Date(assignment.dueDate * 1000).toISOString() : null,
    status: assignment.status,
    payload: assignment,
    payload_hash: `${assignment.id}-${assignment.status}-${assignment.dueDate}`,
  }));

  const { error } = await supabase.from('task_snapshots').upsert(rows, {
    onConflict: 'app_user_id,assignment_id',
  });

  if (error) {
    throw new Error(`Gagal sinkron snapshot tugas: ${error.message}`);
  }
}
