import React from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Redirect, Tabs } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AttendanceNotificationSync } from '@/components/app/AttendanceNotificationSync';
import { InitialDataGate } from '@/components/app/InitialDataGate';
import { TaskNotificationSync } from '@/components/app/TaskNotificationSync';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { NotificationBadgeSync } from '@/components/app/NotificationBadgeSync';
import { useAuthStore } from '@/lib/stores/authStore';
import { useTheme } from '@/components/Redesign';

// You can explore the built-in icon families and icons on the web at https://icons.expo.fyi/
function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={28} style={{ marginBottom: -3 }} {...props} />;
}

function HeaderTitle(props: {
  icon: React.ComponentProps<typeof FontAwesome>['name'];
  title: string;
  color: string;
  accent: string;
}) {
  return (
    <View style={styles.headerTitleWrap}>
      <FontAwesome name={props.icon} size={14} color={props.accent} />
      <Text style={[styles.headerTitleText, { color: props.color }]}>{props.title}</Text>
    </View>
  );
}

export default function TabLayout() {
  const headerShown = useClientOnlyValue(false, true);
  const hydrated = useAuthStore((state) => state.hydrated);
  const status = useAuthStore((state) => state.status);
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

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
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: colors.tabActive,
          tabBarInactiveTintColor: colors.tabInactive,
          tabBarStyle: {
            borderTopColor: colors.tabBorder,
            borderTopWidth: 1,
            backgroundColor: colors.tabBg,
            height: 60 + insets.bottom,
            paddingBottom: insets.bottom,
          },
          headerStyle: {
            backgroundColor: colors.bgSurface,
          },
          headerTitleStyle: {
            color: colors.textPrimary,
            fontWeight: '700',
          },
          headerShadowVisible: false,
          headerShown,
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Dashboard',
            tabBarIcon: ({ color }) => <TabBarIcon name="home" color={color} />,
            headerTitle: () => (
              <HeaderTitle icon="home" title="Dashboard" color={colors.textPrimary} accent={colors.accent} />
            ),
          }}
        />
        <Tabs.Screen
          name="tasks"
          options={{
            title: 'Tugas',
            tabBarIcon: ({ color }) => <TabBarIcon name="tasks" color={color} />,
            headerTitle: () => (
              <HeaderTitle icon="tasks" title="Tugas" color={colors.textPrimary} accent={colors.accent} />
            ),
          }}
        />
        <Tabs.Screen
          name="attendance"
          options={{
            title: 'Absensi',
            tabBarIcon: ({ color }) => <TabBarIcon name="check-square-o" color={color} />,
            headerTitle: () => (
              <HeaderTitle
                icon="check-square-o"
                title="Absensi"
                color={colors.textPrimary}
                accent={colors.accent}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="calendar"
          options={{
            title: 'Kalender',
            tabBarIcon: ({ color }) => <TabBarIcon name="calendar" color={color} />,
            headerTitle: () => (
              <HeaderTitle icon="calendar" title="Kalender" color={colors.textPrimary} accent={colors.accent} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Pengaturan',
            tabBarIcon: ({ color }) => <TabBarIcon name="sliders" color={color} />,
            headerTitle: () => (
              <HeaderTitle icon="sliders" title="Pengaturan" color={colors.textPrimary} accent={colors.accent} />
            ),
          }}
        />
      </Tabs>
    </InitialDataGate>
  );
}

const styles = StyleSheet.create({
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitleText: {
    fontSize: 17,
    fontWeight: '700',
  },
});
