import FontAwesome from '@expo/vector-icons/FontAwesome';
import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Radius } from './theme';
import { useTheme } from './ThemeContext';

type CardIconBubbleProps = {
  icon: React.ComponentProps<typeof FontAwesome>['name'];
  tone?: 'accent' | 'warning' | 'success' | 'muted';
  size?: 'xs' | 'sm' | 'md';
};

type CardInfoTileProps = {
  icon: React.ComponentProps<typeof FontAwesome>['name'];
  title: string;
  value?: string;
  tone?: CardIconBubbleProps['tone'];
  trailingChevron?: boolean;
  onPress?: () => void;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
};

function resolveToneColors(
  tone: NonNullable<CardIconBubbleProps['tone']>,
  colors: ReturnType<typeof useTheme>['colors']
) {
  if (tone === 'warning') {
    return { bubble: colors.warningDim, icon: colors.warning };
  }

  if (tone === 'success') {
    return { bubble: colors.successDim, icon: colors.success };
  }

  if (tone === 'muted') {
    return { bubble: colors.bgCardHover, icon: colors.textSecondary };
  }

  return { bubble: colors.accentDim, icon: colors.accent };
}

export function CardIconBubble({
  icon,
  tone = 'accent',
  size = 'md',
}: CardIconBubbleProps) {
  const { colors } = useTheme();
  const palette = resolveToneColors(tone, colors);
  const shellSize = size === 'xs' ? 30 : size === 'sm' ? 38 : 42;
  const iconSize = size === 'xs' ? 13 : size === 'sm' ? 16 : 18;

  return (
    <View
      style={[
        styles.iconShell,
        {
          width: shellSize,
          height: shellSize,
          borderRadius: shellSize / 2,
          backgroundColor: palette.bubble,
          borderColor: colors.borderAccent,
        },
      ]}
    >
      <FontAwesome name={icon} size={iconSize} color={palette.icon} />
    </View>
  );
}

export function CardInfoTile({
  icon,
  title,
  value,
  tone = 'accent',
  trailingChevron = false,
  onPress,
  compact = false,
  style,
}: CardInfoTileProps) {
  const { colors } = useTheme();
  const tileStyle = {
    backgroundColor: colors.bgCardHover,
    borderColor: colors.borderSubtle,
  };
  const valueLines = compact ? 1 : 2;

  const content = (
    <>
      <View style={[styles.tileBody, compact && styles.tileBodyCompact]}>
        <CardIconBubble icon={icon} tone={tone} size={compact ? 'xs' : 'sm'} />
        <View style={[styles.tileCopy, compact && styles.tileCopyCompact]}>
          <Text
            style={[
              styles.tileTitle,
              compact && styles.tileTitleCompact,
              { color: tone === 'accent' ? colors.accentBright : colors.textPrimary },
            ]}
            numberOfLines={1}
          >
            {title}
          </Text>
          {value ? (
            <Text
              style={[styles.tileValue, compact && styles.tileValueCompact, { color: colors.textSecondary }]}
              numberOfLines={valueLines}
            >
              {value}
            </Text>
          ) : null}
        </View>
      </View>
      {trailingChevron ? (
        <FontAwesome name="angle-right" size={compact ? 16 : 20} color={colors.textMuted} />
      ) : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.tile,
          tileStyle,
          compact && styles.tileCompact,
          style,
          pressed && styles.tilePressed,
        ]}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={[styles.tile, tileStyle, compact && styles.tileCompact, style]}>{content}</View>;
}

const styles = StyleSheet.create({
  iconShell: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  tile: {
    flex: 1,
    minWidth: 122,
    borderRadius: Radius.lg,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  tileCompact: {
    minWidth: 0,
    paddingHorizontal: 6,
    paddingVertical: 6,
    gap: 4,
  },
  tilePressed: {
    opacity: 0.88,
  },
  tileBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flex: 1,
  },
  tileBodyCompact: {
    gap: 5,
  },
  tileCopy: {
    flex: 1,
    gap: 2,
  },
  tileCopyCompact: {
    gap: 1,
  },
  tileTitle: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  tileTitleCompact: {
    fontSize: 9.75,
  },
  tileValue: {
    fontSize: 9.25,
    lineHeight: 12,
    fontWeight: '600',
  },
  tileValueCompact: {
    fontSize: 8.4,
    lineHeight: 10,
  },
});
