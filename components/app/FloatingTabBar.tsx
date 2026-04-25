import React from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import type { MaterialTopTabBarProps } from '@react-navigation/material-top-tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Radius, useTheme } from '@/components/Redesign';
import { getAppTabMeta } from '@/lib/navigation/tabMeta';

type FontAwesomeName = React.ComponentProps<typeof FontAwesome>['name'];

function resolveTabLabel(
  options: MaterialTopTabBarProps['descriptors'][string]['options'],
  fallbackLabel: string,
) {
  if (typeof options.tabBarLabel === 'string') {
    return options.tabBarLabel;
  }

  if (typeof options.title === 'string') {
    return options.title;
  }

  return fallbackLabel;
}

export function FloatingTabBar({ state, descriptors, navigation }: MaterialTopTabBarProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const isDark = colors.bgBase === '#0B1120';

  return (
    <View pointerEvents="box-none" style={[styles.shell, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View
        style={[
          styles.dock,
          {
            backgroundColor: colors.tabBg,
            borderColor: colors.tabBorder,
            shadowColor: isDark ? '#000000' : '#123B8B',
            shadowOpacity: isDark ? 0.22 : 0.14,
          },
        ]}
      >
        {state.routes.map((route, index) => {
          const descriptor = descriptors[route.key];
          const { options } = descriptor;
          const focused = state.index === index;
          const meta = getAppTabMeta(route.name);
          const color = focused ? colors.tabActive : colors.tabInactive;
          const label = resolveTabLabel(options, meta?.tabLabel ?? route.name);
          const iconName = (meta?.tabIcon ?? 'circle-o') as FontAwesomeName;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              testID={options.tabBarButtonTestID}
              onPress={onPress}
              onLongPress={onLongPress}
              style={styles.tabSlot}
            >
              <View
                style={[
                  styles.tabItem,
                  focused ? styles.tabItemFocused : styles.tabItemIdle,
                  focused
                    ? {
                        backgroundColor: colors.bgSurface,
                        borderColor: colors.borderSubtle,
                        shadowColor: isDark ? '#000000' : '#1B4FC1',
                        shadowOpacity: isDark ? 0.2 : 0.12,
                      }
                    : null,
                ]}
              >
                <FontAwesome name={iconName} size={20} color={color} />
                <Text
                  numberOfLines={1}
                  ellipsizeMode="clip"
                  style={[
                    styles.tabLabel,
                    {
                      color,
                      fontWeight: focused ? '800' : '600',
                    },
                  ]}
                >
                  {label}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 22,
    paddingTop: 6,
    zIndex: 20,
  },
  dock: {
    minHeight: 76,
    borderRadius: 30,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 24,
    elevation: 16,
  },
  tabSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  tabItemIdle: {
    width: '100%',
    minHeight: 48,
    paddingHorizontal: 3,
    paddingVertical: 6,
  },
  tabItemFocused: {
    minWidth: 58,
    minHeight: 56,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: Radius.lg,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 7 },
    shadowRadius: 16,
    elevation: 9,
  },
  tabLabel: {
    fontSize: 10,
    lineHeight: 10,
    textAlign: 'center',
    letterSpacing: -0.2,
    includeFontPadding: false,
  },
});
