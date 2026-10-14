import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Button, Muted, TextField } from '@/components/ui';
import { spacing } from '@/theme/theme';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { usersApi } from '@/api/users.api';
import { useAuth } from '@/store/auth.store';
import { toast } from '@/store/toast.store';
import { friendlyError } from '@/utils/errors';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Dos pasos: correo nuevo + contraseña → codigo de 6 digitos. */
export function ChangeEmailScreen() {
  const styles = useStyles();
  const { typography } = useTheme();
  const navigation = useNavigation();
  const user = useAuth((s) => s.user);
  const refreshProfile = useAuth((s) => s.refreshProfile);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);

  const emailError = touched && !EMAIL.test(email.trim()) ? 'Escribe un correo válido.' : null;

  async function done() {
    await refreshProfile();
    toast.success('Correo actualizado', 'Usa el nuevo correo para iniciar sesión.');
    navigation.goBack();
  }

  async function request() {
    setTouched(true);
    if (!EMAIL.test(email.trim()) || !password) return;
    setBusy(true);
    try {
      const res = await usersApi.requestEmailChange(email.trim().toLowerCase(), password);
      if (res.status === 'CHANGED') {
        await done();
        return;
      }
      setSentTo(typeof res.sentTo === 'string' ? res.sentTo : email.trim());
      toast.info('Te enviamos un código', 'Revisa tu bandeja de entrada.');
    } catch (e) {
      toast.error('No se pudo solicitar', friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!/^\d{6}$/.test(code)) {
      toast.warning('Código incompleto', 'Escribe los 6 dígitos que recibiste.');
      return;
    }
    setBusy(true);
    try {
      await usersApi.confirmEmailChange(code);
      await done();
    } catch (e) {
      toast.error('Código no válido', friendlyError(e, 'Revisa el código o solicita uno nuevo.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {!sentTo ? (
            <>
              <Muted>Correo actual: {user?.email}</Muted>
              <TextField
                label="Correo nuevo"
                icon="mail-outline"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                error={emailError}
              />
              <TextField
                label="Tu contraseña"
                icon="lock-closed-outline"
                value={password}
                onChangeText={setPassword}
                secure
                autoCapitalize="none"
                hint="La pedimos para confirmar que eres tú."
              />
            </>
          ) : (
            <>
              <Text style={typography.heading}>Revisa tu correo</Text>
              <Muted>Enviamos un código de 6 dígitos a {sentTo}.</Muted>
              <TextField
                label="Código"
                icon="keypad-outline"
                value={code}
                onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                maxLength={6}
                placeholder="000000"
              />
              <Button label="Usar otro correo" variant="ghost" size="md" onPress={() => setSentTo(null)} />
            </>
          )}
        </ScrollView>
        <View style={styles.footer}>
          {!sentTo ? (
            <Button label="Enviar código" icon="send" loading={busy} disabled={!email || !password} onPress={() => void request()} />
          ) : (
            <Button label="Confirmar correo" icon="checkmark" loading={busy} disabled={code.length < 6} onPress={() => void confirm()} />
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles(({ colors, typography, elevation }) =>
  StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.lg },
  footer: { padding: spacing.lg },
}),
);
