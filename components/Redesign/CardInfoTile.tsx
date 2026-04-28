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
  const shellSize = size === 'xs' ? 32 : size === 'sm' ? 40 : 46;
  const iconSize = size === 'xs' ? 14 : size === 'sm' ? 17 : 20;

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
              numberOfLines={2}
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
    minWidth: 128,
    borderRadius: Radius.lg,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 7,
  },
  tileCompact: {
    minWidth: 0,
    paddingHorizontal: 7,
    paddingVertical: 7,
    gap: 5,
  },
  tilePressed: {
    opacity: 0.88,
  },
  tileBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  tileBodyCompact: {
    gap: 6,
  },
  tileCopy: {
    flex: 1,
    gap: 2,
  },
  tileCopyCompact: {
    gap: 1,
  },
  tileTitle: {
    fontSize: 12,
    fontWeight: '800',
  },
  tileTitleCompact: {
    fontSize: 10.5,
  },
  tileValue: {
    fontSize: 9.5,
    lineHeight: 13,
    fontWeight: '600',
  },
  tileValueCompact: {
    fontSize: 9.25,
    lineHeight: 12,
  },
});
