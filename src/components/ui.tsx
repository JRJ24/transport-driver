import React, { type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, radius, spacing } from '@/theme/theme';

export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <Text style={styles.eyebrow}>{children}</Text>;
}

export function Muted({ children }: { children: ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>;
}

type Tone = 'primary' | 'success' | 'danger' | 'warning' | 'neutral';

const toneColor: Record<Tone, string> = {
  primary: colors.primary,
  success: colors.success,
  danger: colors.danger,
  warning: colors.warning,
  neutral: colors.surfaceMuted,
};

export function Pill({ children, tone = 'primary' }: { children: ReactNode; tone?: Tone }) {
  return (
    <View style={[styles.pill, { backgroundColor: `${toneColor[tone]}22` }]}>
      <View style={[styles.dot, { backgroundColor: toneColor[tone] }]} />
      <Text style={[styles.pillText, { color: toneColor[tone] }]}>{children}</Text>
    </View>
  );
}

export function Button({
  label,
  onPress,
  tone = 'primary',
  loading,
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  tone?: Tone;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const bg = tone === 'neutral' ? colors.surfaceMuted : toneColor[tone];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.onPrimary} />
      ) : (
        <Text style={styles.buttonText}>{label}</Text>
      )}
    </Pressable>
  );
}

export function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  eyebrow: {
    color: colors.primaryBright,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  muted: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  pillText: { fontSize: 12, fontWeight: '800' },
  button: {
    minHeight: 50,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    gap: 8,
  },
  buttonText: { color: colors.onPrimary, fontSize: 14, fontWeight: '800' },
  statCard: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: 2,
  },
  statValue: { color: colors.text, fontSize: 18, fontWeight: '900' },
  statLabel: { color: colors.textDim, fontSize: 11, fontWeight: '600' },
  divider: { height: 1, backgroundColor: colors.border },
});
