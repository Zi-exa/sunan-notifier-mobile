import React from 'react';
import { ParamListBase, TabNavigationState } from '@react-navigation/native';
import {
  createMaterialTopTabNavigator,
  MaterialTopTabNavigationEventMap,
  MaterialTopTabNavigationOptions,
} from '@react-navigation/material-top-tabs';
import { Redirect, withLayoutContext } from 'expo-router';

import { AttendanceNotificationSync } from '@/components/app/AttendanceNotificationSync';
import { FloatingTabBar } from '@/components/app/FloatingTabBar';
import { InitialDataGate } from '@/components/app/InitialDataGate';
import { NotificationBadgeSync } from '@/components/app/NotificationBadgeSync';
import { TaskNotificationSync } from '@/components/app/TaskNotificationSync';
import { useAuthStore } from '@/lib/stores/authStore';
import { APP_TAB_ORDER, APP_TAB_META } from '@/lib/navigation/tabMeta';
import { useTheme } from '@/components/Redesign';

const MaterialTopTabs = createMaterialTopTabNavigator();
const ExpoRouterMaterialTopTabs = withLayoutContext<
  MaterialTopTabNavigationOptions,
  typeof MaterialTopTabs.Navigator,
  TabNavigationState<ParamListBase>,
  MaterialTopTabNavigationEventMap
>(MaterialTopTabs.Navigator);

function AuthedTabsNavigator() {
  const { colors } = useTheme();

  return (
    <ExpoRouterMaterialTopTabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        swipeEnabled: true,
        animationEnabled: true,
        lazy: false,
        sceneStyle: {
          backgroundColor: colors.bgBase,
        },
      }}
    >
      {APP_TAB_ORDER.map((routeKey) => {
        const meta = APP_TAB_META[routeKey];

        return (
          <ExpoRouterMaterialTopTabs.Screen
            key={routeKey}
            name={routeKey}
            options={{
              title: meta.title,
              tabBarLabel: meta.tabLabel,
            }}
          />
        );
      })}
    </ExpoRouterMaterialTopTabs>
  );
}

export default function TabLayout() {
  const hydrated = useAuthStore((state) => state.hydrated);
  const status = useAuthStore((state) => state.status);

  if (!hydrated || status === 'loading') {
    return null;
  }

  if (status !== 'authenticated') {
    return <Redirect href="/login" />;
  }

  return (
    <InitialDataGate>
      <NotificationBadgeSync />
      <AttendanceNotificationSync />
      <TaskNotificationSync />
      <AuthedTabsNavigator />
    </InitialDataGate>
  );
}
