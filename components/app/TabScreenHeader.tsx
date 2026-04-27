import FontAwesome from '@expo/vector-icons/FontAwesome';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/components/Redesign';
import { APP_TAB_META, AppTabRouteKey } from '@/lib/navigation/tabMeta';

type Props = {
  routeKey: AppTabRouteKey;
};

export function TabScreenHeader({ routeKey }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const meta = APP_TAB_META[routeKey];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.bgSurface,
          borderBottomColor: colors.borderSubtle,
          paddingTop: insets.top + 10,
        },
      ]}
    >
      <View style={styles.content}>
        <FontAwesome
          name={meta.headerIcon as React.ComponentProps<typeof FontAwesome>['name']}
          size={17}
          color={colors.accent}
        />
        <Text style={[styles.title, { color: colors.textPrimary }]}>{meta.title}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
  },
});
