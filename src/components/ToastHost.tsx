import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, elevation, radius, spacing } from '@/theme/theme';
import { useToast, type ToastTone } from '@/store/toast.store';
import type { IconName } from './ui';

const toneStyle: Record<ToastTone, { icon: IconName; color: string; bg: string }> = {
  success: { icon: 'checkmark-circle', color: colors.success, bg: colors.successSoft },
  info: { icon: 'information-circle', color: colors.primary, bg: colors.primarySoft },
  warning: { icon: 'alert-circle', color: colors.warning, bg: colors.warningSoft },
  danger: { icon: 'close-circle', color: colors.danger, bg: colors.dangerSoft },
};

/** Avisos flotantes arriba de todo: confirman cada accion sin bloquear. */
export function ToastHost() {
  const toasts = useToast((s) => s.toasts);
  const dismiss = useToast((s) => s.dismiss);
  const insets = useSafeAreaInsets();

  return (
    <View pointerEvents="box-none" style={[styles.host, { top: insets.top + spacing.sm }]}>
      {toasts.map((t) => {
        const s = toneStyle[t.tone];
        return (
          <Animated.View
            key={t.id}
            entering={FadeInUp.springify().damping(16)}
            exiting={FadeOutUp.duration(180)}
            layout={LinearTransition}
          >
            <Pressable
              accessibilityRole="alert"
              onPress={() => dismiss(t.id)}
              style={[styles.toast, elevation.floating]}
            >
              <View style={[styles.icon, { backgroundColor: s.bg }]}>
                <Ionicons name={s.icon} size={22} color={s.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title} numberOfLines={2}>
                  {t.title}
                </Text>
                {t.message ? (
                  <Text style={styles.message} numberOfLines={3}>
                    {t.message}
                  </Text>
                ) : null}
              </View>
              {t.action ? (
                <Pressable
                  hitSlop={8}
                  onPress={() => {
                    dismiss(t.id);
                    t.action?.onPress();
                  }}
                >
                  <Text style={[styles.action, { color: s.color }]}>{t.action.label}</Text>
                </Pressable>
              ) : null}
            </Pressable>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: spacing.lg, right: spacing.lg, gap: spacing.sm, zIndex: 1000 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.text, fontSize: 15, fontWeight: '700' },
  message: { color: colors.textMuted, fontSize: 13, marginTop: 2, lineHeight: 18 },
  action: { fontSize: 14, fontWeight: '700' },
});
