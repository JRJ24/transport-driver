import React, { type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { radius, spacing } from '@/theme/theme';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { haptic } from '@/utils/feedback';
import { Button, type IconName } from './ui';

/**
 * Hoja inferior modal. Se cierra tocando fuera, con el boton atras de Android
 * o con «Cancelar»: el Alert de 3 botones de antes no se podia cerrar.
 */
export function Sheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Cerrar" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={styles.grabber} />
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          {children}
        </View>
      </View>
    </Modal>
  );
}

export interface SheetOption {
  key: string;
  label: string;
  description?: string;
  icon: IconName;
  tone?: 'neutral' | 'danger' | 'warning';
}

export function ActionSheet({
  visible,
  onClose,
  title,
  subtitle,
  options,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  options: SheetOption[];
  onSelect: (key: string) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Sheet visible={visible} onClose={onClose} title={title} subtitle={subtitle}>
      <View style={{ gap: spacing.sm }}>
        {options.map((o) => {
          const color = o.tone === 'danger' ? colors.danger : o.tone === 'warning' ? colors.warning : colors.primary;
          return (
            <Pressable
              key={o.key}
              accessibilityRole="button"
              onPress={() => {
                haptic.tap();
                onClose();
                onSelect(o.key);
              }}
              style={({ pressed }) => [styles.option, pressed && { backgroundColor: colors.surfaceAlt }]}
            >
              <View style={[styles.optionIcon, { backgroundColor: `${color}1A` }]}>
                <Ionicons name={o.icon} size={20} color={color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.optionLabel}>{o.label}</Text>
                {o.description ? <Text style={styles.optionDesc}>{o.description}</Text> : null}
              </View>
            </Pressable>
          );
        })}
        <Button label="Cancelar" variant="secondary" onPress={onClose} />
      </View>
    </Sheet>
  );
}

export function ConfirmSheet({
  visible,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  danger,
  icon = 'help-circle-outline',
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  icon?: IconName;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={{ alignItems: 'center', gap: spacing.sm }}>
        <View style={[styles.confirmIcon, { backgroundColor: danger ? colors.dangerSoft : colors.primarySoft }]}>
          <Ionicons name={icon} size={30} color={danger ? colors.danger : colors.primary} />
        </View>
        <Text style={[styles.title, { textAlign: 'center' }]}>{title}</Text>
        <Text style={[styles.subtitle, { textAlign: 'center' }]}>{message}</Text>
      </View>
      <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
        <Button
          label={confirmLabel}
          variant={danger ? 'danger' : 'primary'}
          onPress={() => {
            onClose();
            onConfirm();
          }}
        />
        <Button label="Cancelar" variant="secondary" onPress={onClose} />
      </View>
    </Sheet>
  );
}

const useStyles = makeStyles(({ colors, typography, elevation }) =>
  StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.borderStrong,
    marginBottom: spacing.sm,
  },
  title: { fontSize: 19, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textMuted, lineHeight: 20, marginBottom: spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  optionLabel: { fontSize: 15, fontWeight: '600', color: colors.text },
  optionDesc: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  confirmIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
}),
);
