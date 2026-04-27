import FontAwesome from '@expo/vector-icons/FontAwesome';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Radius } from './theme';
import { useTheme } from './ThemeContext';

type CardIconBubbleProps = {
  icon: React.ComponentProps<typeof FontAwesome>['name'];
  tone?: 'accent' | 'warning' | 'success' | 'muted';
  size?: 'sm' | 'md';
};

type CardInfoTileProps = {
  icon: React.ComponentProps<typeof FontAwesome>['name'];
  title: string;
  value?: string;
  tone?: CardIconBubbleProps['tone'];
  trailingChevron?: boolean;
  onPress?: () => void;
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
  const shellSize = size === 'sm' ? 44 : 50;
  const iconSize = size === 'sm' ? 18 : 22;

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
}: CardInfoTileProps) {
  const { colors } = useTheme();
  const tileStyle = {
    backgroundColor: colors.bgCardHover,
    borderColor: colors.borderSubtle,
  };

  const content = (
    <>
      <View style={styles.tileBody}>
        <CardIconBubble icon={icon} tone={tone} size="sm" />
        <View style={styles.tileCopy}>
          <Text style={[styles.tileTitle, { color: tone === 'accent' ? colors.accentBright : colors.textPrimary }]} numberOfLines={1}>
            {title}
          </Text>
          {value ? (
            <Text style={[styles.tileValue, { color: colors.textSecondary }]} numberOfLines={2}>
              {value}
            </Text>
          ) : null}
        </View>
      </View>
      {trailingChevron ? (
        <FontAwesome name="angle-right" size={20} color={colors.textMuted} />
      ) : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.tile, tileStyle, pressed && styles.tilePressed]}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={[styles.tile, tileStyle]}>{content}</View>;
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
    paddingHorizontal: 11,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  tilePressed: {
    opacity: 0.88,
  },
  tileBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    flex: 1,
  },
  tileCopy: {
    flex: 1,
    gap: 2,
  },
  tileTitle: {
    fontSize: 12.5,
    fontWeight: '800',
  },
  tileValue: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '600',
  },
});
