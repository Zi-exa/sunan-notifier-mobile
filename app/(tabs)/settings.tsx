import FontAwesome from '@expo/vector-icons/FontAwesome';
import Constants from 'expo-constants';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  LayoutAnimation,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  UIManager,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppAlertDialog, Radius, Spacing, ThemeMode, useTheme } from '@/components/Redesign';
import { getDockContentPadding } from '@/components/app/floatingLayout';
import { TabScreenHeader } from '@/components/app/TabScreenHeader';
import { POLLING_INTERVAL_OPTIONS } from '@/lib/config';
import { useCoursesQuery } from '@/lib/queries/useMoodleQueries';
import { useAuthStore } from '@/lib/stores/authStore';
import { useAppUpdateStore } from '@/lib/stores/appUpdateStore';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import { saveUserSettings, syncUserProfile } from '@/lib/supabase/repositories';
import { checkForAvailableAppUpdateAsync } from '@/lib/updates';

const THEME_OPTIONS: {
  value: ThemeMode;
  label: string;
  icon: React.ComponentProps<typeof FontAwesome>['name'];
}[] = [
  { value: 'system', label: 'Sistem', icon: 'mobile' },
  { value: 'dark', label: 'Gelap', icon: 'moon-o' },
  { value: 'light', label: 'Terang', icon: 'sun-o' },
];

const NOTIFICATION_OPTIONS: {
  key: keyof ReturnType<typeof useSettingsStore.getState>['notifications'];
  label: string;
  icon: React.ComponentProps<typeof FontAwesome>['name'];
}[] = [
  {
    key: 'notifyNewTask',
    label: 'Tugas baru',
    icon: 'file-text-o',
  },
  {
    key: 'notifyDeadlineH1',
    label: 'Pengingat H-1',
    icon: 'calendar-o',
  },
  {
    key: 'notifyDeadlineToday',
    label: 'Pengingat hari H',
    icon: 'clock-o',
  },
  {
    key: 'notifyTaskOpen',
    label: 'Tugas dibuka',
    icon: 'folder-open-o',
  },
  {
    key: 'notifyAttendance',
    label: 'Absensi',
    icon: 'check-square-o',
  },
];

type SettingsSectionKey = 'theme' | 'sync' | 'notifications' | 'courses' | 'about';

const ACCORDION_LAYOUT_ANIMATION = {
  duration: 220,
  create: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
  },
  update: {
    type: LayoutAnimation.Types.easeInEaseOut,
  },
  delete: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
  },
};

const ACCOUNT_CARD_PALETTE = {
  background: '#0F1731',
  border: '#1F356A',
  surface: 'rgba(126, 175, 255, 0.14)',
  accent: '#7EB0FF',
  textPrimary: '#F7FAFF',
  textSecondary: '#B7C7EA',
  glowPrimary: 'rgba(126, 175, 255, 0.14)',
  glowSecondary: 'rgba(71, 104, 184, 0.18)',
  avatarBorder: 'rgba(126, 175, 255, 0.36)',
};

const APP_MARK = 'ZxiruL';
const APP_MARK_URL = 'https://github.com/Zi-exa';
const SETTINGS_SAVED_TITLE = 'Tersimpan';
const SETTINGS_SAVED_MESSAGE = 'Pengaturan berhasil disimpan.';

export default function SettingsScreen() {
  const { colors, mode } = useTheme();
  const insets = useSafeAreaInsets();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const setAppUserId = useAuthStore((state) => state.setAppUserId);
  const logout = useAuthStore((state) => state.logout);
  const availableUpdate = useAppUpdateStore((state) => state.availableUpdate);
  const setAvailableUpdate = useAppUpdateStore((state) => state.setAvailableUpdate);
  const showUpdateDialog = useAppUpdateStore((state) => state.showDialog);
  const appName = Constants.expoConfig?.name ?? 'SUNAN Notifier';
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  const notifications = useSettingsStore((state) => state.notifications);
  const pollingInterval = useSettingsStore((state) => state.pollingInterval);
  const dndStart = useSettingsStore((state) => state.dndStart);
  const dndEnd = useSettingsStore((state) => state.dndEnd);
  const monitoredCourseIds = useSettingsStore((state) => state.monitoredCourseIds);
  const themeMode = useSettingsStore((state) => state.themeMode);
  const setNotification = useSettingsStore((state) => state.setNotification);
  const setPollingInterval = useSettingsStore((state) => state.setPollingInterval);
  const setDndWindow = useSettingsStore((state) => state.setDndWindow);
  const setMonitoredCourseIds = useSettingsStore((state) => state.setMonitoredCourseIds);
  const setThemeMode = useSettingsStore((state) => state.setThemeMode);

  const [draftNotifications, setDraftNotifications] = useState(notifications);
  const [draftPollingInterval, setDraftPollingInterval] = useState(pollingInterval);
  const [draftThemeMode, setDraftThemeMode] = useState(themeMode);
  const [startInput, setStartInput] = useState(dndStart);
  const [endInput, setEndInput] = useState(dndEnd);
  const [draftMonitoredCourseIds, setDraftMonitoredCourseIds] = useState(monitoredCourseIds);
  const [syncState, setSyncState] = useState<'idle' | 'syncing'>('idle');
  const [dialogState, setDialogState] = useState<{
    tone: 'success' | 'info' | 'warning';
    title: string;
    message: string;
  } | null>(null);
  const [expandedSection, setExpandedSection] = useState<SettingsSectionKey | null>(null);
  const [updateActionState, setUpdateActionState] = useState<'idle' | 'checking'>('idle');

  const coursesQuery = useCoursesQuery();
  const isDark = mode === 'dark';
  const themeSummary =
    draftThemeMode === 'system'
      ? `Ikuti sistem (${isDark ? 'gelap' : 'terang'})`
      : `Mode ${draftThemeMode === 'dark' ? 'gelap' : 'terang'}`;
  const syncSummary = `Cek tiap ${draftPollingInterval} menit | DND ${startInput}-${endInput}`;
  const enabledNotificationCount = NOTIFICATION_OPTIONS.reduce(
    (count, option) => count + (draftNotifications[option.key] ? 1 : 0),
    0
  );
  const notificationSummary =
    enabledNotificationCount === 0
      ? 'Semua notifikasi nonaktif'
      : `${enabledNotificationCount} notifikasi aktif`;
  const monitoredLabel =
    draftMonitoredCourseIds.length === 0
      ? 'Semua mata kuliah dipantau'
      : `${draftMonitoredCourseIds.length} mata kuliah dipantau`;
  const aboutSummary = `v${appVersion} • ${APP_MARK}`;
  const updateSummary =
    availableUpdate?.kind === 'apk'
      ? `Versi ${availableUpdate.manifest.version} siap diunduh`
      : availableUpdate?.kind === 'eas'
        ? 'Versi baru siap dipakai'
        : 'Cek versi aplikasi';
  const accountName = user?.fullname ?? 'Belum ada sesi login';
  const contentBottomPadding = getDockContentPadding(insets.bottom);

  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  useEffect(() => {
    setDraftNotifications(notifications);
    setDraftPollingInterval(pollingInterval);
    setDraftThemeMode(themeMode);
    setStartInput(dndStart);
    setEndInput(dndEnd);
    setDraftMonitoredCourseIds(monitoredCourseIds);
  }, [notifications, pollingInterval, themeMode, dndStart, dndEnd, monitoredCourseIds]);

  const hasChanges = useMemo(() => {
    const notificationsChanged =
      draftNotifications.notifyNewTask !== notifications.notifyNewTask ||
      draftNotifications.notifyDeadlineH1 !== notifications.notifyDeadlineH1 ||
      draftNotifications.notifyDeadlineToday !== notifications.notifyDeadlineToday ||
      draftNotifications.notifyTaskOpen !== notifications.notifyTaskOpen ||
      draftNotifications.notifyAttendance !== notifications.notifyAttendance;

    const sortedDraftCourses = [...draftMonitoredCourseIds].sort((a, b) => a - b);
    const sortedSavedCourses = [...monitoredCourseIds].sort((a, b) => a - b);
    const monitoredCoursesChanged =
      sortedDraftCourses.length !== sortedSavedCourses.length ||
      sortedDraftCourses.some((courseId, index) => courseId !== sortedSavedCourses[index]);

    return (
      notificationsChanged ||
      draftPollingInterval !== pollingInterval ||
      draftThemeMode !== themeMode ||
      startInput !== dndStart ||
      endInput !== dndEnd ||
      monitoredCoursesChanged
    );
  }, [
    draftNotifications,
    notifications,
    draftPollingInterval,
    pollingInterval,
    draftThemeMode,
    themeMode,
    startInput,
    dndStart,
    endInput,
    dndEnd,
    draftMonitoredCourseIds,
    monitoredCourseIds,
  ]);

  const toggleDraftCourse = (courseId: number) => {
    setDraftMonitoredCourseIds((current) => {
      const exists = current.includes(courseId);
      if (exists) {
        return current.filter((item) => item !== courseId);
      }

      return [...current, courseId];
    });
    setSyncState('idle');
  };

  const updateDraftNotification = (
    key: keyof typeof draftNotifications,
    value: boolean
  ) => {
    setDraftNotifications((current) => ({
      ...current,
      [key]: value,
    }));
    setSyncState('idle');
  };

  const openDialog = (payload: {
    tone: 'success' | 'info' | 'warning';
    title: string;
    message: string;
  }) => {
    setDialogState(payload);
  };

  const toggleSection = (section: SettingsSectionKey) => {
    LayoutAnimation.configureNext(ACCORDION_LAYOUT_ANIMATION);
    setExpandedSection((current) => (current === section ? null : section));
  };

  const handleOpenAppMark = async () => {
    try {
      await Linking.openURL(APP_MARK_URL);
    } catch {
      openDialog({
        tone: 'warning',
        title: 'Link tidak bisa dibuka',
        message: 'Halaman belum bisa dibuka di perangkat ini.',
      });
    }
  };

  const handleCheckUpdate = async () => {
    if (updateActionState === 'checking') {
      return;
    }

    if (availableUpdate) {
      showUpdateDialog();
      return;
    }

    setUpdateActionState('checking');

    try {
      const update = await checkForAvailableAppUpdateAsync();

      if (!update) {
        setAvailableUpdate(null);
        openDialog({
          tone: 'info',
          title: 'Sudah terbaru',
          message: 'Aplikasi ini sudah memakai versi terbaru.',
        });
        return;
      }

      setAvailableUpdate(update);
    } catch {
      openDialog({
        tone: 'warning',
        title: 'Belum bisa cek update',
        message: 'Coba lagi beberapa saat.',
      });
    } finally {
      setUpdateActionState('idle');
    }
  };

  const handleOpenUpdateDialog = () => {
    showUpdateDialog();
  };

  const handleSync = async () => {
    if (!hasChanges) {
      setSyncState('idle');
      openDialog({
        tone: 'info',
        title: 'Tidak ada perubahan',
        message: 'Belum ada pengaturan yang berubah untuk disimpan.',
      });
      return;
    }

    try {
      setSyncState('syncing');
      setNotification('notifyNewTask', draftNotifications.notifyNewTask);
      setNotification('notifyDeadlineH1', draftNotifications.notifyDeadlineH1);
      setNotification('notifyDeadlineToday', draftNotifications.notifyDeadlineToday);
      setNotification('notifyTaskOpen', draftNotifications.notifyTaskOpen);
      setNotification('notifyAttendance', draftNotifications.notifyAttendance);
      setPollingInterval(draftPollingInterval);
      setThemeMode(draftThemeMode);
      setDndWindow(startInput, endInput);
      setMonitoredCourseIds(draftMonitoredCourseIds);

      const settingsPayload = {
        notifyNewTask: draftNotifications.notifyNewTask,
        notifyDeadlineH1: draftNotifications.notifyDeadlineH1,
        notifyDeadlineToday: draftNotifications.notifyDeadlineToday,
        notifyTaskOpen: draftNotifications.notifyTaskOpen,
        notifyAttendance: draftNotifications.notifyAttendance,
        pollIntervalMinutes: draftPollingInterval,
        dndStart: startInput,
        dndEnd: endInput,
        monitoredCourseIds: draftMonitoredCourseIds,
      };

      let resolvedAppUserId = user?.appUserId ?? null;

      if (!resolvedAppUserId && token && user) {
        try {
          const syncedAppUserId = await syncUserProfile({
            moodleUserId: user.id,
            nim: user.nim,
            fullname: user.fullname,
            moodleToken: token,
          });

          if (syncedAppUserId) {
            resolvedAppUserId = syncedAppUserId;
            await setAppUserId(syncedAppUserId);
          }
        } catch {
          resolvedAppUserId = null;
        }
      }

      if (!resolvedAppUserId) {
        setSyncState('idle');
        openDialog({
          tone: 'success',
          title: SETTINGS_SAVED_TITLE,
          message: SETTINGS_SAVED_MESSAGE,
        });
        return;
      }

      const saveResult = await saveUserSettings(resolvedAppUserId, settingsPayload);

      if (saveResult === 'skipped') {
        setSyncState('idle');
        openDialog({
          tone: 'success',
          title: SETTINGS_SAVED_TITLE,
          message: SETTINGS_SAVED_MESSAGE,
        });
        return;
      }

      if (saveResult === 'legacy-notify-task-open') {
        setSyncState('idle');
        openDialog({
          tone: 'success',
          title: SETTINGS_SAVED_TITLE,
          message: SETTINGS_SAVED_MESSAGE,
        });
        return;
      }

      setSyncState('idle');
      openDialog({
        tone: 'success',
        title: SETTINGS_SAVED_TITLE,
        message: SETTINGS_SAVED_MESSAGE,
      });
    } catch {
      setSyncState('idle');
      openDialog({
        tone: 'success',
        title: SETTINGS_SAVED_TITLE,
        message: SETTINGS_SAVED_MESSAGE,
      });
    }
  };

  return (
    <>
      <View style={[styles.screen, { backgroundColor: colors.bgBase }]}>
        <TabScreenHeader routeKey="settings" />
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: contentBottomPadding }]}
          scrollIndicatorInsets={{ bottom: contentBottomPadding }}
          showsVerticalScrollIndicator={false}
        >
        <View
          style={[
            styles.accountCard,
            {
              backgroundColor: ACCOUNT_CARD_PALETTE.background,
              borderColor: ACCOUNT_CARD_PALETTE.border,
            },
          ]}
        >
          <View
            style={[
              styles.accountGlow,
              styles.accountGlowPrimary,
              { backgroundColor: ACCOUNT_CARD_PALETTE.glowPrimary },
            ]}
          />
          <View
            style={[
              styles.accountGlow,
              styles.accountGlowSecondary,
              { backgroundColor: ACCOUNT_CARD_PALETTE.glowSecondary },
            ]}
          />
          <View style={styles.accountContent}>
            <View style={styles.accountTopRow}>
              <View style={styles.accountMetaStack}>
                <View
                  style={[
                    styles.accountStatusBadge,
                    {
                      backgroundColor: ACCOUNT_CARD_PALETTE.surface,
                      borderColor: ACCOUNT_CARD_PALETTE.border,
                    },
                  ]}
                >
                  <View style={styles.accountStatusBadgeContent}>
                    <FontAwesome
                      name="user-circle-o"
                      size={12}
                      color={ACCOUNT_CARD_PALETTE.accent}
                    />
                    <Text
                      style={[
                        styles.accountStatusBadgeText,
                        { color: ACCOUNT_CARD_PALETTE.accent },
                      ]}
                    >
                      AKUN SUNAN
                    </Text>
                  </View>
                </View>
                <Text
                  style={[
                    styles.accountEyebrow,
                    { color: ACCOUNT_CARD_PALETTE.textSecondary },
                  ]}
                >
                  Portal akademik UMK
                </Text>
              </View>
              {user?.pictureUrl ? (
                <Image
                  source={{ uri: user.pictureUrl }}
                  style={[
                    styles.avatar,
                    { borderColor: ACCOUNT_CARD_PALETTE.avatarBorder },
                  ]}
                />
              ) : (
                <View
                  style={[
                    styles.avatarFallback,
                    {
                      backgroundColor: ACCOUNT_CARD_PALETTE.surface,
                      borderColor: ACCOUNT_CARD_PALETTE.avatarBorder,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.avatarInitial,
                      { color: ACCOUNT_CARD_PALETTE.accent },
                    ]}
                  >
                    {user?.fullname?.charAt(0)?.toUpperCase() ?? '?'}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.accountBody}>
              <Text
                style={[
                  styles.accountName,
                  { color: ACCOUNT_CARD_PALETTE.textPrimary },
                ]}
              >
                {accountName}
              </Text>
              <View style={styles.accountMetaRow}>
                <View
                  style={[
                    styles.accountMetaBadge,
                    {
                      backgroundColor: ACCOUNT_CARD_PALETTE.surface,
                      borderColor: ACCOUNT_CARD_PALETTE.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.accountMetaBadgeText,
                      { color: ACCOUNT_CARD_PALETTE.accent },
                    ]}
                  >
                    NIM
                  </Text>
                </View>
                <Text
                  style={[
                    styles.accountMetaValue,
                    { color: ACCOUNT_CARD_PALETTE.textSecondary },
                  ]}
                >
                  {user?.nim ?? '-'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <SectionCard
          title="Tampilan"
          icon="paint-brush"
          collapsible
          expanded={expandedSection === 'theme'}
          onToggle={() => toggleSection('theme')}
          summary={themeSummary}
        >
          <View style={styles.themeRow}>
            {THEME_OPTIONS.map((option) => {
              const selected = draftThemeMode === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => {
                    setDraftThemeMode(option.value);
                    setSyncState('idle');
                  }}
                  style={[
                    styles.segmentButton,
                    {
                      backgroundColor: selected ? colors.accentDim : colors.bgCardHover,
                      borderColor: selected ? colors.accent : colors.borderMuted,
                    },
                  ]}
                >
                  <View style={styles.segmentButtonContent}>
                    <FontAwesome
                      name={option.icon}
                      size={13}
                      color={selected ? colors.accentBright : colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.segmentButtonText,
                        { color: selected ? colors.accentBright : colors.textPrimary },
                      ]}
                    >
                      {option.label}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </SectionCard>

        <SectionCard
          title="Sinkronisasi"
          icon="refresh"
          collapsible
          expanded={expandedSection === 'sync'}
          onToggle={() => toggleSection('sync')}
          summary={syncSummary}
        >
          <View style={styles.inlineBlock}>
            <InlineLabel icon="repeat" text="Frekuensi cek" />
            <View style={styles.chipsRow}>
              {POLLING_INTERVAL_OPTIONS.map((option) => {
                const selected = option === draftPollingInterval;
                return (
                  <Pressable
                    key={option}
                    onPress={() => {
                      setDraftPollingInterval(option);
                      setSyncState('idle');
                    }}
                    style={[
                      styles.choiceChip,
                      {
                        backgroundColor: selected ? colors.accentDim : colors.bgCardHover,
                        borderColor: selected ? colors.accent : colors.borderMuted,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.choiceChipText,
                        { color: selected ? colors.accentBright : colors.textPrimary },
                      ]}
                    >
                      {option} menit
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />

          <View style={styles.inlineBlock}>
            <InlineLabel icon="moon-o" text="Jam tidak ganggu" />
            <View style={styles.timeRow}>
              <View style={styles.timeInputGroup}>
                <Text style={[styles.timeFieldLabel, { color: colors.textSecondary }]}>Mulai</Text>
                <TextInput
                  value={startInput}
                  onChangeText={(value) => {
                    setStartInput(value);
                    setSyncState('idle');
                  }}
                  style={[
                    styles.timeInput,
                    {
                      backgroundColor: colors.bgCardHover,
                      borderColor: colors.borderMuted,
                      color: colors.textPrimary,
                    },
                  ]}
                  placeholder="22:00"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                />
              </View>
              <View style={styles.timeInputGroup}>
                <Text style={[styles.timeFieldLabel, { color: colors.textSecondary }]}>Selesai</Text>
                <TextInput
                  value={endInput}
                  onChangeText={(value) => {
                    setEndInput(value);
                    setSyncState('idle');
                  }}
                  style={[
                    styles.timeInput,
                    {
                      backgroundColor: colors.bgCardHover,
                      borderColor: colors.borderMuted,
                      color: colors.textPrimary,
                    },
                  ]}
                  placeholder="07:00"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                />
              </View>
            </View>
          </View>
        </SectionCard>

        <SectionCard
          title="Notifikasi"
          icon="bell-o"
          collapsible
          expanded={expandedSection === 'notifications'}
          onToggle={() => toggleSection('notifications')}
          summary={notificationSummary}
        >
          {NOTIFICATION_OPTIONS.map((option, index) => (
            <View key={option.key}>
              {index > 0 && <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />}
              <SettingSwitchRow
                icon={option.icon}
                label={option.label}
                value={draftNotifications[option.key]}
                onValueChange={(value) => updateDraftNotification(option.key, value)}
              />
            </View>
          ))}
        </SectionCard>

        <SectionCard
          title="Mata Kuliah Dipantau"
          icon="book"
          collapsible
          expanded={expandedSection === 'courses'}
          onToggle={() => toggleSection('courses')}
          summary={monitoredLabel}
          titleAccessory={
            <Pressable
              hitSlop={8}
              onPress={() => {
                  openDialog({
                    tone: 'info',
                    title: 'Mata Kuliah Dipantau',
                    message:
                      'Pilih mata kuliah yang ingin dipantau untuk pengingat. Halaman utama tetap menampilkan semua mata kuliah aktif.',
                  });
                }}
              style={[
                styles.sectionInfoButton,
                {
                  borderColor: colors.borderAccent,
                  backgroundColor: colors.accentDim,
                },
              ]}
            >
              <FontAwesome name="question-circle-o" size={13} color={colors.accent} />
            </Pressable>
          }
        >
          {coursesQuery.isLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={colors.accent} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Memuat daftar mata kuliah...</Text>
            </View>
          ) : (
            <View style={styles.courseList}>
              {(coursesQuery.data ?? []).map((course) => {
                const selected = draftMonitoredCourseIds.includes(course.id);
                return (
                  <Pressable
                    key={course.id}
                    onPress={() => toggleDraftCourse(course.id)}
                    style={[
                      styles.courseRow,
                      {
                        backgroundColor: selected ? colors.accentDim : colors.bgCardHover,
                        borderColor: selected ? colors.accent : colors.borderMuted,
                      },
                    ]}
                  >
                    <View style={styles.courseTextWrap}>
                      <Text
                        style={[
                          styles.courseTitle,
                          { color: selected ? colors.accentBright : colors.textPrimary },
                        ]}
                      >
                        {course.fullname}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.courseCheck,
                        {
                          backgroundColor: selected ? colors.accent : 'transparent',
                          borderColor: selected ? colors.accent : colors.borderMuted,
                        },
                      ]}
                    >
                      {selected ? <FontAwesome name="check" size={11} color={colors.textInverse} /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </SectionCard>

        <SectionCard
          title="About"
          icon="info-circle"
          collapsible
          expanded={expandedSection === 'about'}
          onToggle={() => toggleSection('about')}
          summary={availableUpdate ? updateSummary : aboutSummary}
        >
          <View
            style={[
              styles.aboutHero,
              {
                backgroundColor: colors.bgCardHover,
                borderColor: colors.borderSubtle,
              },
            ]}
          >
            <View
              style={[
                styles.aboutLogoShell,
                {
                  backgroundColor: colors.accentDim,
                  borderColor: colors.borderAccent,
                },
              ]}
            >
              <Image
                source={require('@/assets/images/sunan-notifier-mark.png')}
                style={styles.aboutLogo}
                resizeMode="contain"
              />
            </View>
            <View style={styles.aboutHeroBody}>
              <Text style={[styles.aboutAppName, { color: colors.textPrimary }]}>{appName}</Text>
              <Text style={[styles.aboutAppMeta, { color: colors.textSecondary }]}>
                Versi {appVersion}
              </Text>
              <Text style={[styles.aboutDescription, { color: colors.textSecondary }]}>
                Pendamping akademik SUNAN untuk tugas, absensi, kalender, dan pengingat dalam satu aplikasi.
              </Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />

          <View style={styles.aboutStack}>
            <View
              style={[
                styles.aboutUpdateCard,
                {
                  backgroundColor: colors.bgCardHover,
                  borderColor: colors.borderSubtle,
                },
              ]}
            >
              <View style={styles.aboutUpdateCopy}>
                <Text style={[styles.aboutUpdateTitle, { color: colors.textPrimary }]}>
                  Update aplikasi
                </Text>
                <Text style={[styles.aboutUpdateText, { color: colors.textSecondary }]}>
                  {availableUpdate?.kind === 'apk'
                    ? `Versi ${availableUpdate.manifest.version} sudah siap. Anda bisa lanjutkan update kapan saja dari sini.`
                    : availableUpdate?.kind === 'eas'
                      ? 'Versi baru sudah siap dipakai. Anda bisa lanjutkan update kapan saja dari sini.'
                      : 'Cek pembaruan kapan saja dari sini.'}
                </Text>
              </View>

              <View style={styles.aboutUpdateActions}>
                {availableUpdate ? (
                  <Pressable
                    onPress={handleOpenUpdateDialog}
                    disabled={updateActionState === 'checking'}
                    style={[
                      styles.aboutUpdatePrimaryButton,
                      {
                        backgroundColor: colors.accent,
                      },
                      updateActionState === 'checking' && styles.primaryButtonDisabled,
                    ]}
                  >
                    <View style={styles.buttonContent}>
                      <FontAwesome name="download" size={13} color={colors.textInverse} />
                      <Text
                        style={[
                          styles.aboutUpdatePrimaryButtonText,
                          { color: colors.textInverse },
                        ]}
                      >
                        Update Sekarang
                      </Text>
                    </View>
                  </Pressable>
                ) : null}

                <Pressable
                  onPress={handleCheckUpdate}
                  disabled={updateActionState === 'checking'}
                  style={[
                    styles.aboutUpdateSecondaryButton,
                    {
                      backgroundColor: colors.bgCard,
                      borderColor: colors.borderSubtle,
                    },
                    updateActionState === 'checking' && styles.primaryButtonDisabled,
                  ]}
                >
                  {updateActionState === 'checking' ? (
                    <ActivityIndicator size="small" color={colors.accent} />
                  ) : (
                    <View style={styles.buttonContent}>
                      <FontAwesome name="refresh" size={13} color={colors.textPrimary} />
                      <Text
                        style={[
                          styles.aboutUpdateSecondaryButtonText,
                          { color: colors.textPrimary },
                        ]}
                      >
                        {availableUpdate ? 'Buka Lagi' : 'Cek Update'}
                      </Text>
                    </View>
                  )}
                </Pressable>
              </View>
            </View>

            <View style={styles.aboutInfoRow}>
              <View
                style={[
                  styles.aboutInfoIcon,
                  { backgroundColor: colors.accentDim },
                ]}
              >
                <FontAwesome name="shield" size={13} color={colors.accent} />
              </View>
              <Text style={[styles.aboutInfoText, { color: colors.textSecondary }]}>
                Data akademik utama tetap bersumber dari SUNAN UMK dan ditampilkan dalam tampilan yang lebih ringkas.
              </Text>
            </View>

            <View style={styles.aboutMarkRow}>
              <View style={styles.aboutMarkCopy}>
                <Text style={[styles.aboutMarkLabel, { color: colors.textSecondary }]}>Mark proyek</Text>
                <Text style={[styles.aboutMarkHint, { color: colors.textMuted }]}>
                  Buka GitHub creator
                </Text>
              </View>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel="Buka GitHub ZxiruL"
                onPress={handleOpenAppMark}
                style={({ pressed }) => [
                  styles.aboutMarkBadge,
                  {
                    backgroundColor: colors.accentDim,
                    borderColor: colors.borderAccent,
                    opacity: pressed ? 0.86 : 1,
                  },
                ]}
              >
                <FontAwesome name="star-o" size={12} color={colors.accent} />
                <Text style={[styles.aboutMarkBadgeText, { color: colors.accentBright }]}>
                  {APP_MARK}
                </Text>
                <FontAwesome name="external-link" size={11} color={colors.accent} />
              </Pressable>
            </View>
          </View>
        </SectionCard>

        <View
          style={[
            styles.actionCard,
            {
              backgroundColor: colors.bgCard,
              borderColor: colors.borderSubtle,
            },
          ]}
        >
          <Pressable
            style={[
              styles.primaryButton,
              { backgroundColor: colors.accent },
              syncState === 'syncing' && styles.primaryButtonDisabled,
            ]}
            onPress={handleSync}
            disabled={syncState === 'syncing'}
          >
            {syncState === 'syncing' ? (
              <ActivityIndicator color={colors.textInverse} />
            ) : (
              <View style={styles.buttonContent}>
                <FontAwesome name="save" size={14} color={colors.textInverse} />
                <Text style={[styles.primaryButtonText, { color: colors.textInverse }]}>Simpan Pengaturan</Text>
              </View>
            )}
          </Pressable>

          <Pressable
            style={[
              styles.secondaryButton,
              {
                borderColor: colors.dangerDim,
                backgroundColor: colors.dangerDim,
              },
            ]}
            onPress={logout}
          >
            <View style={styles.buttonContent}>
              <FontAwesome name="sign-out" size={15} color={colors.danger} />
              <Text style={[styles.secondaryButtonText, { color: colors.danger }]}>Keluar dari Akun</Text>
            </View>
          </Pressable>
        </View>
        </ScrollView>
      </View>

      <AppAlertDialog
        visible={dialogState !== null}
        tone={dialogState?.tone}
        title={dialogState?.title ?? ''}
        message={dialogState?.message ?? ''}
        onClose={() => setDialogState(null)}
      />
    </>
  );
}

type SectionCardProps = {
  title: string;
  icon?: React.ComponentProps<typeof FontAwesome>['name'];
  description?: string;
  summary?: string;
  collapsible?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  titleAccessory?: React.ReactNode;
  children: React.ReactNode;
};

function SectionCard({
  title,
  icon,
  description,
  summary,
  collapsible = false,
  expanded = true,
  onToggle,
  titleAccessory,
  children,
}: SectionCardProps) {
  const { colors } = useTheme();
  const shouldShowChildren = !collapsible || expanded;
  const chevronProgress = useRef(new Animated.Value(expanded ? 1 : 0)).current;
  const contentProgress = useRef(new Animated.Value(expanded ? 1 : 0)).current;

  useEffect(() => {
    if (!collapsible) {
      return;
    }

    Animated.timing(chevronProgress, {
      toValue: expanded ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();

    if (expanded) {
      contentProgress.setValue(0);
      Animated.timing(contentProgress, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start();
    }
  }, [chevronProgress, collapsible, contentProgress, expanded]);

  const chevronRotation = chevronProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });
  const contentTranslateY = contentProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [-6, 0],
  });
  const titleBlock = (
    <View style={styles.sectionHeaderMain}>
      <View style={styles.sectionTitleRow}>
        {icon ? (
          <View style={[styles.sectionIconWrap, { backgroundColor: colors.accentDim }]}>
            <FontAwesome name={icon} size={14} color={colors.accent} />
          </View>
        ) : null}
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{title}</Text>
      </View>
      {description ? (
        <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>{description}</Text>
      ) : null}
    </View>
  );

  return (
    <View
      style={[
        styles.sectionCard,
        {
          backgroundColor: colors.bgCard,
          borderColor: colors.borderSubtle,
        },
      ]}
    >
      {collapsible ? (
        <View style={styles.sectionHeader}>
          <Pressable onPress={onToggle} style={styles.sectionHeaderButtonMain}>
            {titleBlock}
          </Pressable>
          <View style={styles.sectionHeaderMeta}>
            {summary ? (
              <Pressable onPress={onToggle} style={styles.sectionSummaryPressable}>
                <Text
                  numberOfLines={2}
                  style={[styles.sectionSummary, { color: colors.textSecondary }]}
                >
                  {summary}
                </Text>
              </Pressable>
            ) : null}
            <View style={styles.sectionHeaderActions}>
              {titleAccessory ? (
                <View style={styles.sectionHeaderAccessorySlot}>{titleAccessory}</View>
              ) : null}
              <Pressable onPress={onToggle} hitSlop={8} style={styles.sectionChevronButton}>
                <Animated.View style={{ transform: [{ rotate: chevronRotation }] }}>
                  <FontAwesome name="chevron-down" size={14} color={colors.textSecondary} />
                </Animated.View>
              </Pressable>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.sectionHeader}>
          {titleBlock}
          {titleAccessory ? <View style={styles.sectionHeaderAccessorySlot}>{titleAccessory}</View> : null}
        </View>
      )}
      {shouldShowChildren ? (
        <Animated.View
          style={[
            styles.sectionContent,
            collapsible
              ? {
                  opacity: contentProgress,
                  transform: [{ translateY: contentTranslateY }],
                }
              : null,
          ]}
        >
          {children}
        </Animated.View>
      ) : null}
    </View>
  );
}

type SettingSwitchRowProps = {
  icon: React.ComponentProps<typeof FontAwesome>['name'];
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
};

function SettingSwitchRow({ icon, label, value, onValueChange }: SettingSwitchRowProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.switchRow}>
      <View style={styles.switchLabelRow}>
        <FontAwesome name={icon} size={14} color={colors.textSecondary} />
        <Text style={[styles.switchLabel, { color: colors.textPrimary }]}>{label}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.bgCardHover, true: colors.accentDim }}
        thumbColor={value ? colors.accent : colors.textMuted}
      />
    </View>
  );
}

type InlineLabelProps = {
  icon: React.ComponentProps<typeof FontAwesome>['name'];
  text: string;
};

function InlineLabel({ icon, text }: InlineLabelProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.inlineLabelRow}>
      <FontAwesome name={icon} size={14} color={colors.textSecondary} />
      <Text style={[styles.inlineLabel, { color: colors.textPrimary }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: 32,
    gap: Spacing.md,
  },
  accountCard: {
    position: 'relative',
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
  },
  accountGlow: {
    position: 'absolute',
    borderRadius: Radius.full,
  },
  accountGlowPrimary: {
    width: 164,
    height: 164,
    top: -82,
    right: -34,
  },
  accountGlowSecondary: {
    width: 120,
    height: 120,
    bottom: -52,
    left: -22,
  },
  accountContent: {
    padding: Spacing.lg,
    gap: 14,
  },
  accountTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14,
  },
  accountMetaStack: {
    flex: 1,
    gap: 10,
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
  },
  avatarFallback: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 28,
    fontWeight: '800',
  },
  accountBody: {
    flex: 1,
    gap: 6,
  },
  accountStatusBadge: {
    alignSelf: 'flex-start',
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  accountStatusBadgeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  accountStatusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  accountEyebrow: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  accountName: {
    fontSize: 21,
    fontWeight: '800',
    lineHeight: 27,
  },
  accountMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  accountMetaBadge: {
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  accountMetaBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  accountMetaValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  sectionCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionHeaderButtonMain: {
    flex: 1,
  },
  sectionHeaderMain: {
    flex: 1,
    gap: 4,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionIconWrap: {
    width: 28,
    height: 28,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    flexShrink: 1,
  },
  sectionInfoButton: {
    width: 22,
    height: 22,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionDescription: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  sectionHeaderMeta: {
    maxWidth: 140,
    alignItems: 'flex-end',
    gap: 8,
  },
  sectionSummaryPressable: {
    alignItems: 'flex-end',
  },
  sectionSummary: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    textAlign: 'right',
  },
  sectionHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionHeaderAccessorySlot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionChevronButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 18,
    minHeight: 18,
  },
  sectionContent: {
    gap: 14,
  },
  themeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  segmentButton: {
    flex: 1,
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingVertical: 11,
    alignItems: 'center',
  },
  segmentButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  segmentButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 4,
  },
  switchLabelRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingRight: 8,
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  divider: {
    height: 1,
  },
  inlineBlock: {
    gap: 10,
  },
  inlineLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inlineLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  choiceChip: {
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  choiceChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  timeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  timeInputGroup: {
    flex: 1,
    gap: 6,
  },
  timeFieldLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  timeInput: {
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    fontWeight: '600',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  loadingText: {
    fontSize: 13,
  },
  courseList: {
    gap: 8,
  },
  courseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  courseTextWrap: {
    flex: 1,
  },
  courseTitle: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  courseCheck: {
    width: 22,
    height: 22,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aboutHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  aboutLogoShell: {
    width: 60,
    height: 60,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  aboutLogo: {
    width: 40,
    height: 40,
  },
  aboutHeroBody: {
    flex: 1,
    gap: 3,
  },
  aboutAppName: {
    fontSize: 17,
    fontWeight: '800',
  },
  aboutAppMeta: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  aboutDescription: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  aboutStack: {
    gap: 12,
  },
  aboutUpdateCard: {
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  aboutUpdateCopy: {
    gap: 4,
  },
  aboutUpdateTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  aboutUpdateText: {
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: '600',
  },
  aboutUpdateActions: {
    flexDirection: 'row',
    gap: 10,
  },
  aboutUpdatePrimaryButton: {
    flex: 1,
    borderRadius: Radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  aboutUpdatePrimaryButtonText: {
    fontSize: 13.5,
    fontWeight: '800',
  },
  aboutUpdateSecondaryButton: {
    flex: 1,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aboutUpdateSecondaryButtonText: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  aboutInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  aboutInfoIcon: {
    width: 26,
    height: 26,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  aboutInfoText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: '600',
  },
  aboutMarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  aboutMarkCopy: {
    flex: 1,
    gap: 2,
  },
  aboutMarkLabel: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  aboutMarkHint: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  aboutMarkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  aboutMarkBadgeText: {
    fontSize: 12.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  actionCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: 12,
  },
  primaryButton: {
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primaryButtonDisabled: {
    opacity: 0.65,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryButton: {
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingVertical: 13,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
