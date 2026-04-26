import { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/components/Redesign';

type Props = {
  text?: string;
  subtext?: string;
};

export function AppSplashScreen({ text = 'SUNAN Notifier', subtext = 'Menyiapkan data...' }: Props) {
  const { colors } = useTheme();

  // Animasi logo: scale + fade in
  const logoScale = useRef(new Animated.Value(0.7)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  // Animasi dots loading
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;
  // Animasi teks
  const textOpacity = useRef(new Animated.Value(0)).current;
  const dotsCancelledRef = useRef(false);

  useEffect(() => {
    dotsCancelledRef.current = false;

    // Logo muncul
    Animated.parallel([
      Animated.spring(logoScale, {
        toValue: 1,
        tension: 60,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 800,
        delay: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Animasi dots berulang
    const animateDots = () => {
      if (dotsCancelledRef.current) {
        return;
      }

      Animated.sequence([
        Animated.timing(dot1, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(dot2, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(dot3, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.delay(200),
        Animated.parallel([
          Animated.timing(dot1, { toValue: 0.3, duration: 300, useNativeDriver: true }),
          Animated.timing(dot2, { toValue: 0.3, duration: 300, useNativeDriver: true }),
          Animated.timing(dot3, { toValue: 0.3, duration: 300, useNativeDriver: true }),
        ]),
      ]).start(({ finished }) => {
        if (finished && !dotsCancelledRef.current) {
          animateDots();
        }
      });
    };

    const dotsTimer = setTimeout(animateDots, 600);
    return () => {
      dotsCancelledRef.current = true;
      clearTimeout(dotsTimer);
      logoScale.stopAnimation();
      logoOpacity.stopAnimation();
      textOpacity.stopAnimation();
      dot1.stopAnimation();
      dot2.stopAnimation();
      dot3.stopAnimation();
    };
  }, [dot1, dot2, dot3, logoOpacity, logoScale, textOpacity]);

  return (
    <View style={[styles.container, { backgroundColor: colors.bgBase }]}>
      {/* Logo area */}
      <Animated.View
        style={[
          styles.logoWrapper,
          { transform: [{ scale: logoScale }], opacity: logoOpacity },
        ]}
      >
        <Image
          source={require('@/assets/images/sunan-notifier-mark.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>

      {/* App name */}
      <Animated.View style={[styles.textBlock, { opacity: textOpacity }]}>
        <Text style={[styles.appName, { color: colors.textPrimary }]}>{text}</Text>
        <Text style={[styles.tagline, { color: colors.textSecondary }]}>
          Notifikasi tugas & absensi otomatis
        </Text>
      </Animated.View>

      {/* Loading dots */}
      <Animated.View style={[styles.dotsRow, { opacity: textOpacity }]}>
        <Animated.Text style={[styles.dot, { color: colors.accent, opacity: dot1 }]}>●</Animated.Text>
        <Animated.Text style={[styles.dot, { color: colors.accent, opacity: dot2 }]}>●</Animated.Text>
        <Animated.Text style={[styles.dot, { color: colors.accent, opacity: dot3 }]}>●</Animated.Text>
      </Animated.View>

      {/* Status teks */}
      <Animated.Text style={[styles.statusText, { color: colors.textMuted, opacity: textOpacity }]}>
        {subtext}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
  },
  logoWrapper: {
    width: 156,
    height: 156,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  textBlock: {
    alignItems: 'center',
    gap: 6,
  },
  appName: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 13,
    fontWeight: '500',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  dot: {
    fontSize: 14,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: -8,
  },
});
