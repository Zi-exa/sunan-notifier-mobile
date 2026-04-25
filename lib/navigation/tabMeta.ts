export type AppTabRouteKey = 'index' | 'tasks' | 'attendance' | 'calendar' | 'settings';

type AppTabMeta = {
  title: string;
  tabLabel: string;
  headerIcon: string;
  tabIcon: string;
};

export const APP_TAB_ORDER: AppTabRouteKey[] = ['index', 'tasks', 'attendance', 'calendar', 'settings'];

export const APP_TAB_META: Record<AppTabRouteKey, AppTabMeta> = {
  index: {
    title: 'Dashboard',
    tabLabel: 'Dashboard',
    headerIcon: 'home',
    tabIcon: 'home',
  },
  tasks: {
    title: 'Tugas',
    tabLabel: 'Tugas',
    headerIcon: 'tasks',
    tabIcon: 'list-alt',
  },
  attendance: {
    title: 'Absensi',
    tabLabel: 'Absensi',
    headerIcon: 'check-square-o',
    tabIcon: 'check-square-o',
  },
  calendar: {
    title: 'Kalender',
    tabLabel: 'Kalender',
    headerIcon: 'calendar',
    tabIcon: 'calendar-o',
  },
  settings: {
    title: 'Pengaturan',
    tabLabel: 'Settings',
    headerIcon: 'sliders',
    tabIcon: 'gear',
  },
};

export function isAppTabRouteKey(value: string): value is AppTabRouteKey {
  return value in APP_TAB_META;
}

export function getAppTabMeta(routeName: string) {
  if (!isAppTabRouteKey(routeName)) {
    return null;
  }

  return APP_TAB_META[routeName];
}

export function getAppTabRouteKeyFromPathname(pathname: string | null | undefined): AppTabRouteKey {
  if (!pathname || pathname === '/' || pathname === '/(tabs)') {
    return 'index';
  }

  if (pathname.includes('/tasks')) {
    return 'tasks';
  }

  if (pathname.includes('/attendance')) {
    return 'attendance';
  }

  if (pathname.includes('/calendar')) {
    return 'calendar';
  }

  if (pathname.includes('/settings')) {
    return 'settings';
  }

  return 'index';
}
