import React, { useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, elevation, radius, spacing, typography } from '@/theme/theme';
import { haptic } from '@/utils/feedback';
import { initials as toInitials } from '@/utils/format';

export type IconName = ComponentProps<typeof Ionicons>['name'];
export type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export const toneColors: Record<Tone, { bg: string; fg: string; solid: string }> = {
  primary: { bg: colors.primarySoft, fg: colors.primaryText, solid: colors.primary },
  success: { bg: colors.successSoft, fg: colors.successText, solid: colors.success },
  warning: { bg: colors.warningSoft, fg: colors.warningText, solid: colors.warning },
  danger: { bg: colors.dangerSoft, fg: colors.dangerText, solid: colors.danger },
  info: { bg: colors.infoSoft, fg: colors.infoText, solid: colors.info },
  neutral: { bg: colors.neutralSoft, fg: colors.neutralText, solid: colors.textDim },
};

// ── Texto ────────────────────────────────────────────────────────────────────
type Variant = keyof typeof typography;

export function AppText({
  variant = 'body',
  style,
  children,
  numberOfLines,
}: {
  variant?: Variant;
  style?: StyleProp<TextStyle>;
  children: ReactNode;
  numberOfLines?: number;
}) {
  return (
    <Text style={[typography[variant] as TextStyle, style]} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}

export function Muted({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <AppText variant="caption" style={style}>{children}</AppText>;
}

export function Overline({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <AppText variant="overline" style={style}>{children}</AppText>;
}

// ── Contenedores ─────────────────────────────────────────────────────────────
export function Card({
  children,
  style,
  onPress,
  accessibilityLabel,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  if (!onPress) {
    return <View style={[styles.card, style]}>{children}</View>;
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      style={({ pressed }) => [styles.card, style, pressed && styles.cardPressed]}
    >
      {children}
    </Pressable>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.divider, style]} />;
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <Overline>{title}</Overline>
      {action}
    </View>
  );
}

// ── Botones ──────────────────────────────────────────────────────────────────
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';

const buttonColors: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.primary, fg: colors.onPrimary, border: colors.primary },
  success: { bg: colors.success, fg: colors.white, border: colors.success },
  danger: { bg: colors.danger, fg: colors.white, border: colors.danger },
  secondary: { bg: colors.surface, fg: colors.text, border: colors.borderStrong },
  ghost: { bg: 'transparent', fg: colors.primaryText, border: 'transparent' },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  size = 'lg',
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  size?: 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
}) {
  const c = buttonColors[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      onPress={() => {
        haptic.light();
        onPress();
      }}
      disabled={inactive}
      style={({ pressed }) => [
        styles.button,
        size === 'md' && styles.buttonMd,
        { backgroundColor: c.bg, borderColor: c.border },
        variant !== 'ghost' && variant !== 'secondary' && !inactive && elevation.card,
        { opacity: disabled ? 0.45 : pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={c.fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={size === 'md' ? 18 : 20} color={c.fg} /> : null}
          <Text numberOfLines={1} style={[styles.buttonText, size === 'md' && styles.buttonTextMd, { color: c.fg }]}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  tone = 'neutral',
  badge,
  size = 44,
  style,
}: {
  icon: IconName;
  onPress: () => void;
  accessibilityLabel: string;
  tone?: 'neutral' | 'primary' | 'danger' | 'success';
  badge?: number;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const fg =
    tone === 'primary' ? colors.primary : tone === 'danger' ? colors.danger : tone === 'success' ? colors.success : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={6}
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      style={({ pressed }) => [
        styles.iconButton,
        { width: size, height: size, borderRadius: size / 2, opacity: pressed ? 0.7 : 1 },
        elevation.card,
        style,
      ]}
    >
      <Ionicons name={icon} size={Math.round(size * 0.48)} color={fg} />
      {badge ? (
        <View style={styles.badgeDot}>
          <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

// ── Etiquetas ────────────────────────────────────────────────────────────────
export function Badge({
  label,
  tone = 'neutral',
  icon,
  pulse,
}: {
  label: string;
  tone?: Tone;
  icon?: IconName;
  pulse?: boolean;
}) {
  const c = toneColors[tone];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      {icon ? <Ionicons name={icon} size={13} color={c.fg} /> : <PulseDot color={c.solid} active={pulse} />}
      <Text numberOfLines={1} style={[styles.badgeLabel, { color: c.fg }]}>
        {label}
      </Text>
    </View>
  );
}

/** Punto que «late»: el servicio esta vivo. */
export function PulseDot({ color, active, size = 7 }: { color: string; active?: boolean; size?: number }) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!active) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.8, duration: 700, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, scale]);
  return (
    <View style={{ width: size * 2, height: size * 2, alignItems: 'center', justifyContent: 'center' }}>
      {active ? (
        <Animated.View
          style={{
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: size,
            backgroundColor: color,
            opacity: 0.35,
            transform: [{ scale }],
          }}
        />
      ) : null}
      <View style={{ width: size, height: size, borderRadius: size, backgroundColor: color }} />
    </View>
  );
}

// ── Formularios ──────────────────────────────────────────────────────────────
export function TextField({
  label,
  error,
  hint,
  icon,
  secure,
  style,
  ...input
}: TextInputProps & {
  label: string;
  error?: string | null;
  hint?: string;
  icon?: IconName;
  secure?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View
        style={[
          styles.inputWrap,
          focused && styles.inputFocused,
          error ? styles.inputError : null,
          input.multiline && { alignItems: 'flex-start', paddingVertical: spacing.sm },
        ]}
      >
        {icon ? <Ionicons name={icon} size={18} color={focused ? colors.primary : colors.textDim} /> : null}
        <TextInput
          placeholderTextColor={colors.placeholder}
          {...input}
          secureTextEntry={secure ? hidden : input.secureTextEntry}
          onFocus={(e) => {
            setFocused(true);
            input.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            input.onBlur?.(e);
          }}
          style={[styles.input, input.multiline && styles.inputMultiline]}
        />
        {secure ? (
          <Pressable
            hitSlop={8}
            accessibilityLabel={hidden ? 'Mostrar contraseña' : 'Ocultar contraseña'}
            onPress={() => setHidden((h) => !h)}
          >
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={20} color={colors.textDim} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text style={styles.fieldError}>{error}</Text>
      ) : hint ? (
        <Text style={styles.fieldHint}>{hint}</Text>
      ) : null}
    </View>
  );
}

// ── Identidad ────────────────────────────────────────────────────────────────
export function Avatar({
  name,
  uri,
  size = 56,
  onPress,
  editable,
}: {
  name?: string | null;
  uri?: string | null;
  size?: number;
  onPress?: () => void;
  editable?: boolean;
}) {
  const content = (
    <View style={{ width: size, height: size }}>
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
      ) : (
        <View style={[styles.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
          <Text style={[styles.avatarText, { fontSize: size * 0.36 }]}>{toInitials(name)}</Text>
        </View>
      )}
      {editable ? (
        <View style={styles.avatarEdit}>
          <Ionicons name="camera" size={14} color={colors.white} />
        </View>
      ) : null}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Cambiar foto de perfil" onPress={onPress}>
      {content}
    </Pressable>
  );
}

// ── Listas ───────────────────────────────────────────────────────────────────
export function ListRow({
  icon,
  title,
  subtitle,
  onPress,
  right,
  tone = 'neutral',
}: {
  icon?: IconName;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  right?: ReactNode;
  tone?: 'neutral' | 'danger';
}) {
  const fg = tone === 'danger' ? colors.danger : colors.text;
  const body = (
    <>
      {icon ? (
        <View style={[styles.rowIcon, tone === 'danger' && { backgroundColor: colors.dangerSoft }]}>
          <Ionicons name={icon} size={18} color={tone === 'danger' ? colors.danger : colors.primary} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={[styles.rowTitle, { color: fg }]}>
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={2} style={styles.rowSubtitle}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={colors.textDim} /> : null)}
    </>
  );
  if (!onPress) return <View style={styles.row}>{body}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceAlt }]}
    >
      {body}
    </Pressable>
  );
}

export function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.kv}>
      <Text style={styles.kvLabel}>{label}</Text>
      <Text style={styles.kvValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

export function Stat({ value, label, icon }: { value: string; label: string; icon?: IconName }) {
  return (
    <View style={styles.stat}>
      {icon ? <Ionicons name={icon} size={18} color={colors.primary} /> : null}
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

// ── Estados ──────────────────────────────────────────────────────────────────
export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon: IconName;
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={30} color={colors.primary} />
      </View>
      <AppText variant="heading" style={{ textAlign: 'center' }}>
        {title}
      </AppText>
      {message ? <Muted style={{ textAlign: 'center' }}>{message}</Muted> : null}
      {action}
    </View>
  );
}

export function Skeleton({ height = 16, width = '100%', style }: { height?: number; width?: number | `${number}%`; style?: StyleProp<ViewStyle> }) {
  const opacity = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 650, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return (
    <Animated.View
      style={[{ height, width, borderRadius: radius.sm, backgroundColor: colors.surfaceMuted, opacity }, style]}
    />
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.errorBanner}>
      <Ionicons name="cloud-offline-outline" size={18} color={colors.dangerText} />
      <Text style={styles.errorText}>{message}</Text>
      {onRetry ? (
        <Pressable onPress={onRetry} hitSlop={8}>
          <Text style={styles.errorRetry}>Reintentar</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    ...elevation.card,
  },
  cardPressed: { transform: [{ scale: 0.99 }], opacity: 0.94 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  button: {
    minHeight: 54,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  buttonMd: { minHeight: 44, borderRadius: radius.sm, paddingHorizontal: spacing.md },
  buttonText: { fontSize: 16, fontWeight: '700' },
  buttonTextMd: { fontSize: 14 },
  iconButton: {
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  badgeText: { color: colors.white, fontSize: 10, fontWeight: '700' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 6,
    paddingRight: 10,
    paddingVertical: 3,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  badgeLabel: { fontSize: 12, fontWeight: '700' },
  field: { gap: 6 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  inputWrap: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
  },
  inputFocused: { borderColor: colors.primary },
  inputError: { borderColor: colors.danger },
  input: { flex: 1, color: colors.text, fontSize: 16, paddingVertical: 12 },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
  fieldError: { fontSize: 12, color: colors.dangerText, fontWeight: '600' },
  fieldHint: { fontSize: 12, color: colors.textDim },
  avatarFallback: { backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.primaryText, fontWeight: '700' },
  avatarEdit: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 56,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { fontSize: 15, fontWeight: '600' },
  rowSubtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  kv: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, paddingVertical: 4 },
  kvLabel: { fontSize: 14, color: colors.textMuted },
  kvValue: { fontSize: 14, color: colors.text, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  stat: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    gap: 2,
    ...elevation.card,
  },
  statValue: { color: colors.text, fontSize: 18, fontWeight: '700' },
  statLabel: { color: colors.textDim, fontSize: 12, fontWeight: '500' },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl, paddingHorizontal: spacing.xl },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.dangerSoft,
  },
  errorText: { flex: 1, color: colors.dangerText, fontSize: 13, fontWeight: '500' },
  errorRetry: { color: colors.dangerText, fontWeight: '700', fontSize: 13 },
});
