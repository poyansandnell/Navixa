import React from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors } from '@/hooks/useColors';
import { spacing } from '@/constants/theme';

interface ScreenProps {
  children: React.ReactNode;
  scroll?: boolean;
  /** Extra bottom padding to clear an absolute tab bar (web needs it). */
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Base screen wrapper. Provides the themed background and applies web-only
 * insets (67px top / 84px tab bar bottom) per the Expo skill. On native the
 * header/tab bar handle safe areas automatically.
 */
export function Screen({ children, scroll = true, contentStyle, testID }: ScreenProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';

  const padding: ViewStyle = {
    paddingHorizontal: spacing.lg,
    paddingTop: isWeb ? 67 + spacing.lg : spacing.lg,
    paddingBottom: isWeb ? 84 + spacing.xl : insets.bottom + spacing.xxxl,
  };

  if (scroll) {
    return (
      <ScrollView
        testID={testID}
        style={[styles.flex, { backgroundColor: colors.background }]}
        contentContainerStyle={[padding, contentStyle]}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    );
  }

  return (
    <View
      testID={testID}
      style={[styles.flex, { backgroundColor: colors.background }, padding, contentStyle]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
});
