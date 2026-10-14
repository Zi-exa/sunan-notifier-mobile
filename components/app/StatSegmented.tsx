import React, { useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import PagerView from 'react-native-pager-view';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/components/Redesign/ThemeContext';

export type StatSegment = {
  key: string;
  label: string;
  value: number | string;
  title: string;
  /** Route tujuan saat panel diketuk. Tanpa target = panel tidak bisa diketuk. */
  target?: string;
  /** Tandai segmen sebagai waspada bila nilainya > 0 (misal overdue). */
  alertWhenPositive?: boolean;
};

function useCountUp(target: number | string, duration = 450): string | number {
  const [display, setDisplay] = useState<number | string>(target);

  useEffect(() => {
    if (typeof target !== 'number') {
      setDisplay(target);
      return;
    }

    let raf = 0;
    const startedAt = Date.now();
    const tick = () => {
      const progress = Math.min(1, (Date.now() - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * target));
      if (progress < 1) {
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return display;
}

function AlertDot({ color }: { color: string }) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.3, { duration: 1200 }), -1, true);
  }, [opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[styles.alertDot, { backgroundColor: color }, style]} />;
}

function StatDetailPanel({
  segment,
  colors,
  onNavigate,
}: {
  segment: StatSegment;
  colors: { bgCard: string; borderSubtle: string; danger: string; textPrimary: string; textSecondary: string };
  onNavigate?: (target: string) => void;
}) {
  const displayValue = useCountUp(segment.value);
  const isAlert = Boolean(segment.alertWhenPositive && typeof segment.value === 'number' && segment.value > 0);

  return (
    <Pressable
      disabled={!segment.target}
      onPress={() => {
        if (segment.target && onNavigate) onNavigate(segment.target);
      }}
      style={({ pressed }) => [
        styles.detail,
        {
          backgroundColor: colors.bgCard,
          borderColor: isAlert ? colors.danger : colors.borderSubtle,
          opacity: !segment.target || pressed ? (pressed ? 0.82 : 1) : 1,
        },
      ]}
    >
      <Text style={[styles.value, { color: isAlert ? colors.danger : colors.textPrimary }]}>
        {displayValue}
      </Text>
      <Text style={[styles.title, { color: colors.textSecondary }]}>{segment.title}</Text>
    </Pressable>
  );
}

export function StatSegmented({
  segments,
  onNavigate,
}: {
  segments: StatSegment[];
  onNavigate?: (target: string) => void;
}) {
  const { colors } = useTheme();
  const [active, setActive] = useState(0);
  const pagerRef = useRef<PagerView>(null);
  const [layouts, setLayouts] = useState<Record<string, { x: number; width: number }>>({});
  const thumbX = useSharedValue(0);
  const thumbWidth = useSharedValue(0);

  const current = segments[Math.min(active, segments.length - 1)];
  const isAlert = Boolean(current?.alertWhenPositive && typeof current.value === 'number' && current.value > 0);

  const goToPage = (index: number) => {
    setActive(index);
    pagerRef.current?.setPage(index);
  };

  useEffect(() => {
    const layout = current ? layouts[current.key] : undefined;
    if (layout) {
      const timing = { duration: 260, easing: Easing.out(Easing.cubic) };
      thumbX.value = withTiming(layout.x, timing);
      thumbWidth.value = withTiming(layout.width, timing);
    }
  }, [active, current, layouts, thumbX, thumbWidth]);

  const thumbStyle = useAnimatedStyle(() => ({
    left: thumbX.value,
    width: thumbWidth.value,
    opacity: thumbWidth.value > 0 ? 1 : 0,
  }));

  const handleLayout = (key: string) => (event: LayoutChangeEvent) => {
    const { x, width } = event.nativeEvent.layout;
    setLayouts((prev) => (prev[key]?.x === x && prev[key]?.width === width ? prev : { ...prev, [key]: { x, width } }));
  };

  if (segments.length === 0 || !current) {
    return null;
  }

  return (
    <View>
      <Animated.View entering={FadeIn.duration(300)}>
        <View style={[styles.seg, { backgroundColor: colors.bgCard, borderColor: colors.borderSubtle }]}>
          <Animated.View
            style={[
              styles.thumb,
              isAlert
                ? { backgroundColor: colors.dangerDim, borderColor: colors.danger }
                : { backgroundColor: colors.accentDim, borderColor: colors.accent },
              thumbStyle,
            ]}
          />
          {segments.map((segment, index) => {
            const alert =
              segment.alertWhenPositive && typeof segment.value === 'number' && segment.value > 0;
            return (
              <Pressable
                key={segment.key}
                onPress={() => goToPage(index)}
                onLayout={handleLayout(segment.key)}
                style={styles.segment}
                accessibilityRole="tab"
                accessibilityState={{ selected: index === active }}
              >
                {alert ? <AlertDot color={colors.danger} /> : null}
                <Text
                  style={[styles.segmentLabel, { color: index === active ? colors.textPrimary : colors.textMuted }]}
                  numberOfLines={1}
                >
                  {segment.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Animated.View>

      <Animated.View entering={FadeIn.delay(60).duration(300)}>
        <PagerView
          ref={pagerRef}
          style={styles.pager}
          initialPage={0}
          onPageSelected={(event) => setActive(event.nativeEvent.position)}
        >
          {segments.map((segment) => (
            <View key={segment.key} style={styles.page} collapsable={false}>
              <StatDetailPanel segment={segment} colors={colors} onNavigate={onNavigate} />
            </View>
          ))}
        </PagerView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  seg: {
    position: 'relative',
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 16,
    padding: 4,
  },
  thumb: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  segment: {
    flex: 1,
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 12,
  },
  segmentLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    flexShrink: 1,
  },
  alertDot: {
    position: 'absolute',
    left: 10,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  detail: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pager: {
    height: 148,
    marginTop: 10,
  },
  page: {
    flex: 1,
  },
  value: {
    fontSize: 52,
    fontWeight: '800',
    letterSpacing: -1,
    lineHeight: 56,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  title: {
    fontSize: 12.5,
    fontWeight: '700',
    marginTop: 6,
    textAlign: 'center',
  },
});
