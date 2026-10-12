import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Button, Muted, TextField } from '@/components/ui';
import { colors, spacing } from '@/theme/theme';
import { usersApi } from '@/api/users.api';
import { toast } from '@/store/toast.store';
import { friendlyError } from '@/utils/errors';

/** La API exige 8+ caracteres con letras y numeros. */
function passwordIssue(value: string): string | null {
  if (value.length < 8) return 'Mínimo 8 caracteres.';
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) return 'Combina letras y números.';
  return null;
}

export function ChangePasswordScreen() {
  const navigation = useNavigation();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  const nextError = touched ? passwordIssue(next) : null;
  const repeatError = touched && repeat !== next ? 'No coincide con la nueva contraseña.' : null;

  async function save() {
    setTouched(true);
    if (!current || passwordIssue(next) || repeat !== next) return;
    setSaving(true);
    try {
      await usersApi.changePassword(current, next);
      toast.success('Contraseña actualizada', 'Cerramos tus otras sesiones por seguridad.');
      navigation.goBack();
    } catch (e) {
      toast.error('No se pudo cambiar', friendlyError(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Muted>Usa al menos 8 caracteres combinando letras y números.</Muted>
          <TextField label="Contraseña actual" icon="lock-closed-outline" value={current} onChangeText={setCurrent} secure autoCapitalize="none" />
          <TextField label="Nueva contraseña" icon="key-outline" value={next} onChangeText={setNext} secure autoCapitalize="none" error={nextError} />
          <TextField label="Repite la nueva contraseña" icon="key-outline" value={repeat} onChangeText={setRepeat} secure autoCapitalize="none" error={repeatError} />
        </ScrollView>
        <View style={styles.footer}>
          <Button label="Actualizar contraseña" icon="checkmark" loading={saving} disabled={!current || !next} onPress={() => void save()} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.lg },
  footer: { padding: spacing.lg },
});
