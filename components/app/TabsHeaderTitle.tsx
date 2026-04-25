import React, { useEffect, useRef } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { usePathname } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/components/Redesign';
import { APP_TAB_META, AppTabRouteKey, getAppTabRouteKeyFromPathname } from '@/lib/navigation/tabMeta';

function isTaskDetailPath(pathname: string | null | undefined) {
  return Boolean(pathname?.startsWith('/task/'));
}

export function TabsHeaderTitle() {
  const pathname = usePathname();
  const { colors } = useTheme();
  const activeTabKey = getAppTabRouteKeyFromPathname(pathname);
  const lastResolvedTabRef = useRef<AppTabRouteKey>('index');

  useEffect(() => {
    if (!isTaskDetailPath(pathname)) {
      lastResolvedTabRef.current = activeTabKey;
    }
  }, [activeTabKey, pathname]);

  const displayTabKey = isTaskDetailPath(pathname) ? lastResolvedTabRef.current : activeTabKey;
  const meta = APP_TAB_META[displayTabKey];

  return (
    <View style={styles.headerTitleWrap}>
      <FontAwesome
        name={meta.headerIcon as React.ComponentProps<typeof FontAwesome>['name']}
        size={14}
        color={colors.accent}
      />
      <Text style={[styles.headerTitleText, { color: colors.textPrimary }]}>{meta.title}</Text>
    </View>
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
