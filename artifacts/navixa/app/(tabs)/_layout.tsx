import React from 'react';
import { Platform, StyleSheet, useColorScheme, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { Tabs } from 'expo-router';
import { Icon, Label, NativeTabs } from 'expo-router/unstable-native-tabs';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';

type SymbolName = React.ComponentProps<typeof SymbolView>['name'];
type FeatherName = keyof typeof Feather.glyphMap;

interface TabDef {
  name: string;
  labelKey: string;
  sf: { default: SymbolName; selected: SymbolName };
  feather: FeatherName;
}

const TAB_DEFS: TabDef[] = [
  {
    name: 'index',
    labelKey: 'tabs.play',
    sf: { default: 'gamecontroller', selected: 'gamecontroller.fill' },
    feather: 'play',
  },
  {
    name: 'compete',
    labelKey: 'tabs.compete',
    sf: { default: 'trophy', selected: 'trophy.fill' },
    feather: 'award',
  },
  {
    name: 'friends',
    labelKey: 'tabs.friends',
    sf: { default: 'person.2', selected: 'person.2.fill' },
    feather: 'users',
  },
  {
    name: 'leaderboard',
    labelKey: 'tabs.leaderboard',
    sf: { default: 'chart.bar', selected: 'chart.bar.fill' },
    feather: 'bar-chart-2',
  },
  {
    name: 'profile',
    labelKey: 'tabs.profile',
    sf: { default: 'person.crop.circle', selected: 'person.crop.circle.fill' },
    feather: 'user',
  },
];

// iOS 26 uses NativeTabs for native tabs with liquid glass support.
// NativeTabs intentionally does NOT use custom design tokens — liquid glass
// is a system-level appearance provided by iOS and cannot be overridden.
function NativeTabLayout() {
  const { t } = useTranslation();
  return (
    <NativeTabs>
      {TAB_DEFS.map((tab) => (
        <NativeTabs.Trigger key={tab.name} name={tab.name}>
          <Icon sf={tab.sf} />
          <Label>{t(tab.labelKey)}</Label>
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const { t } = useTranslation();
  const isDark = colorScheme !== 'light';
  const isIOS = Platform.OS === 'ios';
  const isWeb = Platform.OS === 'web';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: isIOS ? 'transparent' : colors.background,
          borderTopWidth: isWeb ? 1 : 0,
          borderTopColor: colors.border,
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={100}
              tint={isDark ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View
              style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]}
            />
          ) : null,
      }}
    >
      {TAB_DEFS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: t(tab.labelKey),
            tabBarIcon: ({ color }) =>
              isIOS ? (
                <SymbolView name={tab.sf.default} tintColor={color} size={24} />
              ) : (
                <Feather name={tab.feather} size={22} color={color} />
              ),
          }}
        />
      ))}
    </Tabs>
  );
}

export default function TabLayout() {
  if (isLiquidGlassAvailable()) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}
