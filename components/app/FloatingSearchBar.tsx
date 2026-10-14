import { useEffect, useMemo, useRef, useState } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Animated, Easing, Keyboard, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Radius, Shadow, useTheme } from '@/components/Redesign';
import { getFloatingFilterBottomOffset } from '@/components/app/floatingLayout';

const SEARCH_FAB_SIZE = 58;
const FAB_GAP = 12;

export function FloatingSearchBar({
  query,
  onQueryChange,
  placeholder = 'Cari...',
}: {
  query: string;
  onQueryChange: (value: string) => void;
  placeholder?: string;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [renderBar, setRenderBar] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const keyboardShiftRaw = useRef(new Animated.Value(0)).current;
  const inputRef = useRef<TextInput>(null);
  const bottomOffset = getFloatingFilterBottomOffset(insets.bottom);
  const hasQuery = query.trim().length > 0;

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (event) => {
      Animated.timing(keyboardShiftRaw, {
        toValue: event.endCoordinates.height,
        duration: 250,
        useNativeDriver: true,
      }).start();
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      Animated.timing(keyboardShiftRaw, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [keyboardShiftRaw]);

  // Angkat bar + tombol mengikuti keyboard, tapi buang clearance dock/tumpukan
  // tombol saat keyboard buka sehingga gap sisa 12px saja.
  const keyboardClearance = 12;
  const keyboardShift = useMemo(() => {
    const baseLift = bottomOffset + SEARCH_FAB_SIZE + FAB_GAP - keyboardClearance;
    return keyboardShiftRaw.interpolate({
      inputRange: [0, baseLift, 1200],
      outputRange: [0, 0, -(1200 - baseLift)],
      extrapolate: 'clamp',
    });
  }, [bottomOffset, keyboardShiftRaw]);

  useEffect(() => {
    if (open) {
      setRenderBar(true);
    }
  }, [open ]);

  useEffect(() => {
    if (!renderBar) {
      return;
    }

    Animated.timing(progress, {
      toValue: open ? 1 : 0,
      duration: open ? 210 : 160,
      easing: open ? Easing.out(Easing.cubic) : Easing.inOut(Easing.quad),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !open) {
        setRenderBar(false);
      }
    });
  }, [open, progress, renderBar]);

  const barOpacity = progress.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const barTranslateY = progress.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });
  const barScale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] });
  const fabScale = progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const fabOpacity = progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });

  const toggle = () => {
    if (open) {
      onQueryChange('');
      Keyboard.dismiss();
    }
    setOpen((value) => !value);
  };

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Animated.View
        pointerEvents="box-none"
        style={[StyleSheet.absoluteFill, { transform: [{ translateY: keyboardShift }] }]}
      >
      {renderBar ? (
        <Animated.View
          pointerEvents={open ? 'auto' : 'none'}
          style={[
            styles.bar,
            Shadow.card,
            {
              backgroundColor: colors.bgSurface,
              borderColor: colors.borderSubtle,
              left: 16,
              right: 16,
              bottom: bottomOffset + SEARCH_FAB_SIZE + FAB_GAP,
              opacity: barOpacity,
              transform: [{ translateY: barTranslateY }, { scale: barScale }],
            },
          ]}
        >
          <FontAwesome name="search" size={14} color={colors.textMuted} />
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={onQueryChange}
            placeholder={placeholder}
            placeholderTextColor={colors.textMuted}
            style={[styles.input, { color: colors.textPrimary }]}
            returnKeyType="search"
          />
          <Pressable onPress={toggle} hitSlop={8} accessibilityLabel="Tutup pencarian">
            <FontAwesome name="close" size={14} color={colors.textMuted} />
          </Pressable>
        </Animated.View>
      ) : null}

      <View
        pointerEvents="box-none"
        style={[styles.fabAnchor, { right: 20, bottom: bottomOffset + SEARCH_FAB_SIZE + FAB_GAP }]}
      >
        <Animated.View
          pointerEvents={open ? 'none' : 'auto'}
          style={{ opacity: fabOpacity, transform: [{ scale: fabScale }] }}
        >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={open ? 'Tutup pencarian' : 'Cari materi'}
          onPress={toggle}
          style={[
            styles.fab,
            Shadow.card,
            {
              backgroundColor: hasQuery ? colors.accent : colors.bgSurface,
              borderColor: hasQuery ? colors.accent : colors.tabBorder,
            },
          ]}
        >
          <FontAwesome
            name="search"
            size={20}
            color={hasQuery ? colors.textInverse : colors.accent}
          />
          {hasQuery ? (
            <View
              style={[
                styles.badge,
                { backgroundColor: colors.bgSurface, borderColor: colors.accent },
              ]}
            />
          ) : null}
        </Pressable>
        </Animated.View>
      </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  input: {
    flex: 1,
    fontSize: 14,
  },
  fabAnchor: {
    position: 'absolute',
    alignItems: 'flex-end',
    zIndex: 40,
  },
  fab: {
    width: SEARCH_FAB_SIZE,
    height: SEARCH_FAB_SIZE,
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
