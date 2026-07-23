import React, { useCallback, useRef, useState } from 'react';
import {
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button, Spacer, Text } from '@/components/ui';
import { Checkbox } from '@/features/auth';
import { useColors } from '@/hooks/useColors';
import { useOnboarding } from '@/hooks/useOnboarding';
import { iconSize, radii, spacing } from '@/constants/theme';

type PageKey = 'welcome' | 'ranking' | 'modes';

interface SlideDef {
  key: PageKey;
  icon: keyof typeof Feather.glyphMap;
}

const SLIDES: SlideDef[] = [
  { key: 'welcome', icon: 'crosshair' },
  { key: 'ranking', icon: 'trending-up' },
  { key: 'modes', icon: 'grid' },
];

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { complete } = useOnboarding();

  const [page, setPage] = useState(0);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const { width } = Dimensions.get('window');
  const totalPages = SLIDES.length + 1; // + the final action page

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = Math.round(event.nativeEvent.contentOffset.x / width);
      if (next !== page) setPage(next);
    },
    [page, width],
  );

  const goToPage = useCallback(
    (index: number) => {
      scrollRef.current?.scrollTo({ x: index * width, animated: true });
      setPage(index);
    },
    [width],
  );

  const finishThen = useCallback(
    async (destination: string) => {
      await complete();
      router.replace(destination as never);
    },
    [complete],
  );

  const isLastPage = page === totalPages - 1;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={[colors.background, colors.card, colors.background]}
        style={StyleSheet.absoluteFill}
      />

      {/* Skip */}
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        {!isLastPage ? (
          <Pressable
            onPress={() => goToPage(totalPages - 1)}
            accessibilityRole="button"
            hitSlop={spacing.md}
          >
            <Text variant="callout" color="muted">
              {t('onboarding.skip')}
            </Text>
          </Pressable>
        ) : (
          <View />
        )}
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={styles.flex}
      >
        {SLIDES.map((slide) => (
          <View key={slide.key} style={[styles.slide, { width }]}>
            <View
              style={[
                styles.iconCircle,
                { backgroundColor: colors.secondary },
              ]}
            >
              <Feather
                name={slide.icon}
                size={iconSize.xxl}
                color={colors.accent}
              />
            </View>
            <Spacer size="huge" />
            <Text variant="h1" center>
              {t(`onboarding.slides.${slide.key}.title`)}
            </Text>
            <Spacer size="md" />
            <Text variant="body" color="muted" center>
              {t(`onboarding.slides.${slide.key}.subtitle`)}
            </Text>
          </View>
        ))}

        {/* Final action page */}
        <View style={[styles.slide, { width }]}>
          <View
            style={[styles.iconCircle, { backgroundColor: colors.primary }]}
          >
            <Feather
              name="anchor"
              size={iconSize.xxl}
              color={colors.primaryForeground}
            />
          </View>
          <Spacer size="xl" />
          <Text variant="h2" center>
            {t('onboarding.getStarted.title')}
          </Text>
          <Spacer size="sm" />
          <Text variant="subhead" color="muted" center>
            {t('onboarding.getStarted.subtitle')}
          </Text>
        </View>
      </ScrollView>

      {/* Page indicators */}
      <View style={styles.dots}>
        {Array.from({ length: totalPages }).map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              {
                backgroundColor:
                  index === page ? colors.accent : colors.border,
                width: index === page ? 24 : 8,
              },
            ]}
          />
        ))}
      </View>

      {/* Footer actions */}
      <View
        style={[
          styles.footer,
          { paddingBottom: insets.bottom + spacing.lg },
        ]}
      >
        {isLastPage ? (
          <>
            <Checkbox
              testID="onboarding-terms"
              checked={termsAccepted}
              onToggle={() => setTermsAccepted((v) => !v)}
              label={t('onboarding.getStarted.terms')}
            />
            <Spacer size="lg" />
            <Button
              testID="onboarding-create-account"
              label={t('onboarding.getStarted.createAccount')}
              fullWidth
              disabled={!termsAccepted}
              onPress={() => void finishThen('/(auth)/sign-up')}
            />
            <Spacer size="md" />
            <Button
              testID="onboarding-login"
              label={t('onboarding.getStarted.logIn')}
              variant="secondary"
              fullWidth
              disabled={!termsAccepted}
              onPress={() => void finishThen('/(auth)/sign-in')}
            />
          </>
        ) : (
          <Button
            testID="onboarding-next"
            label={t('onboarding.next')}
            fullWidth
            onPress={() => goToPage(page + 1)}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    minHeight: 24 + spacing.sm,
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? {} : {}),
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  dot: {
    height: 8,
    borderRadius: radii.pill,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
  },
});
