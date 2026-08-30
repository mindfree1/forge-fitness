import { PropsWithChildren } from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';
import { colors, radii } from '@/lib/theme';

export function Card({ children, style, ...props }: PropsWithChildren<ViewProps>) {
  return <View {...props} style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.lg,
    padding: 18,
  },
});
