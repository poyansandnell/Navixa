import React from 'react';
import { View } from 'react-native';

import { spacing } from '@/constants/theme';

interface SpacerProps {
  size?: keyof typeof spacing;
}

export function Spacer({ size = 'lg' }: SpacerProps) {
  return <View style={{ height: spacing[size] }} />;
}
