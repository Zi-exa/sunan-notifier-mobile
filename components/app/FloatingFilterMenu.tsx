import FontAwesome from '@expo/vector-icons/FontAwesome';
import type { ComponentProps } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Radius, Shadow, Spacing, useTheme } from '@/components/Redesign';
import { getFloatingFilterBottomOffset } from '@/components/app/floatingLayout';

type FontAwesomeName = ComponentProps<typeof FontAwesome>['name'];

export type FloatingFilterOption<T extends string> = {
  key: T;
  label: string;
  icon?: FontAwesomeName;
};

type FloatingFilterMenuProps<T extends string> = {
  title: string;
  options: FloatingFilterOption<T>[];
  selected: T;
  onSelect: (value: T) => void;
  allKey: T;
};

export function FloatingFilterMenu<T extends string>({
  title,
  options,
  selected,
  onSelect,
  allKey,
}: FloatingFilterMenuProps<T>) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [renderMenu, setRenderMenu] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const isFiltered = selected !== allKey;
  const selectedOption = useMemo(
    () => options.find((option) => option.key === selected),
    [options, selected],
  );
  const selectedLabel = selectedOption?.label ?? 'Semua';
  const bottomOffset = getFloatingFilterBottomOffset(insets.bottom);
  const fabActive = open || isFiltered;
  const backdropOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const menuTranslateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [12, 0],
  });
  const menuTranslateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [18, 0],
  });
  const menuScale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.88, 1],
  });
  const fabScale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.04],
  });
  const fabRotation = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-12deg'],
  });
  const headerOpacity = progress.interpolate({
    inputRange: [0, 0.35, 1],
    outputRange: [0, 0.2, 1],
  });
  const headerTranslateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [8, 0],
  });

  useEffect(() => {
    if (open) {
      setRenderMenu(true);
    }
  }, [open]);

  useEffect(() => {
    if (!renderMenu) {
      return;
    }

    Animated.timing(progress, {
      toValue: open ? 1 : 0,
      duration: open ? 190 : 150,
      easing: open ? Easing.out(Easing.cubic) : Easing.inOut(Easing.quad),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !open) {
        setRenderMenu(false);
      }
    });
  }, [open, progress, renderMenu]);

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {renderMenu ? (
        <Animated.View style={[styles.overlayLayer, { opacity: backdropOpacity }]}>
          <Pressable
            style={styles.overlay}
            accessibilityRole="button"
            accessibilityLabel="Tutup popup filter"
            onPress={() => setOpen(false)}
          />
        </Animated.View>
      ) : null}

      <View pointerEvents="box-none" style={[styles.anchor, { right: 20, bottom: bottomOffset }]}>
        {renderMenu ? (
          <Animated.View
            style={[
              styles.menu,
              Shadow.card,
              {
                backgroundColor: colors.bgSurface,
                borderColor: colors.borderSubtle,
                opacity: progress,
                transform: [
                  { translateX: menuTranslateX },
                  { translateY: menuTranslateY },
                  { scale: menuScale },
                ],
              },
            ]}
          >
            <Animated.View
              style={[
                styles.menuHeader,
                {
                  borderBottomColor: colors.borderSubtle,
                  opacity: headerOpacity,
                  transform: [{ translateY: headerTranslateY }],
                },
              ]}
            >
              <Text style={[styles.menuTitle, { color: colors.textPrimary }]}>{title}</Text>
              <Text style={[styles.menuSubtitle, { color: colors.textSecondary }]}>
                Aktif: {selectedLabel}
              </Text>
            </Animated.View>

            <View style={styles.optionList}>
              {options.map((option, index) => {
                const active = option.key === selected;
                const optionStart = Math.min(0.2 + index * 0.1, 0.72);
                const optionOpacity = progress.interpolate({
                  inputRange: [0, optionStart, 1],
                  outputRange: [0, 0, 1],
                });
                const optionTranslateX = progress.interpolate({
                  inputRange: [0, optionStart, 1],
                  outputRange: [18, 18, 0],
                });
                const optionTranslateY = progress.interpolate({
                  inputRange: [0, optionStart, 1],
                  outputRange: [6, 6, 0],
                });

                return (
                  <Animated.View
                    key={option.key}
                    style={{
                      opacity: optionOpacity,
                      transform: [{ translateX: optionTranslateX }, { translateY: optionTranslateY }],
                    }}
                  >
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={active ? { selected: true } : {}}
                      onPress={() => {
                        onSelect(option.key);
                        setOpen(false);
                      }}
                      style={[
                        styles.option,
                        {
                          backgroundColor: active ? colors.accentDim : colors.bgCardHover,
                          borderColor: active ? colors.borderAccent : colors.borderSubtle,
                        },
                      ]}
                    >
                      <View style={styles.optionMain}>
                        <FontAwesome
                          name={option.icon ?? 'tag'}
                          size={15}
                          color={active ? colors.accent : colors.textSecondary}
                          style={styles.optionIcon}
                        />
                        <Text
                          style={[
                            styles.optionLabel,
                            { color: active ? colors.accent : colors.textPrimary },
                          ]}
                        >
                          {option.label}
                        </Text>
                      </View>
                      <FontAwesome
                        name={active ? 'check-circle' : 'circle-thin'}
                        size={active ? 18 : 14}
                        color={active ? colors.accent : colors.textMuted}
                      />
                    </Pressable>
                  </Animated.View>
                );
              })}
            </View>
          </Animated.View>
        ) : null}

        <Animated.View style={{ transform: [{ scale: fabScale }] }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${title}. Filter aktif ${selectedLabel}`}
            onPress={() => setOpen((value) => !value)}
            style={[
              styles.fab,
              Shadow.card,
              {
                backgroundColor: fabActive ? colors.accent : colors.bgSurface,
                borderColor: fabActive ? colors.accent : colors.tabBorder,
              },
            ]}
          >
            <Animated.View style={{ transform: [{ rotate: fabRotation }] }}>
              <FontAwesome
                name="sliders"
                size={20}
                color={fabActive ? colors.textInverse : colors.accent}
              />
            </Animated.View>
            {isFiltered ? (
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: fabActive ? colors.bgSurface : colors.accent,
                    borderColor: fabActive ? colors.accent : colors.bgSurface,
                  },
                ]}
              />
            ) : null}
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlayLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  anchor: {
    position: 'absolute',
    alignItems: 'flex-end',
    zIndex: 40,
  },
  menu: {
    position: 'absolute',
    right: 0,
    bottom: 72,
    width: 232,
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.sm,
    gap: Spacing.sm,
  },
  menuHeader: {
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    gap: 4,
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  menuSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  optionList: {
    gap: 8,
  },
  option: {
    minHeight: 48,
    borderRadius: Radius.lg,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  optionLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  optionMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionIcon: {
    width: 18,
    textAlign: 'center',
  },
  fab: {
    width: 58,
    height: 58,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 20,
    elevation: 12,
  },
  badge: {
    position: 'absolute',
    top: 11,
    right: 11,
    width: 10,
    height: 10,
    borderRadius: Radius.full,
    borderWidth: 2,
  },
});
