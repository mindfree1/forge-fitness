import { PropsWithChildren } from 'react';
import { StyleSheet, Text, TextProps } from 'react-native';
import { colors } from '@/lib/theme';

export function Eyebrow({ children, style, ...props }: PropsWithChildren<TextProps>) {
  return <Text {...props} style={[styles.eyebrow, style]}>{children}</Text>;
}

export function Title({ children, style, ...props }: PropsWithChildren<TextProps>) {
  return <Text {...props} style={[styles.title, style]}>{children}</Text>;
}

export function SectionTitle({ children, style, ...props }: PropsWithChildren<TextProps>) {
  return <Text {...props} style={[styles.section, style]}>{children}</Text>;
}

export function Body({ children, style, ...props }: PropsWithChildren<TextProps>) {
  return <Text {...props} style={[styles.body, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  eyebrow: { color: colors.accent, fontSize: 11, fontWeight: '800', letterSpacing: 1.8, textTransform: 'uppercase' },
  title: { color: colors.text, fontSize: 34, lineHeight: 38, fontWeight: '900', letterSpacing: -1.2 },
  section: { color: colors.text, fontSize: 19, lineHeight: 24, fontWeight: '800', letterSpacing: -0.35 },
  body: { color: colors.muted, fontSize: 14, lineHeight: 20, fontWeight: '500' },
});
