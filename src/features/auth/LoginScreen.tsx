import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Button } from '@/components/ui';
import { colors, radius, spacing } from '@/theme/theme';
import { useAuth } from '@/store/auth.store';

export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const login = useAuth((s) => s.login);
  const status = useAuth((s) => s.status);
  const error = useAuth((s) => s.error);
  const loading = status === 'authenticating';

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <View style={styles.inner}>
        <Text style={styles.eyebrow}>RUTA RD Driver</Text>
        <Text style={styles.title}>Tracking seguro para conductores</Text>

        <TextInput
          style={styles.input}
          placeholder="Correo"
          placeholderTextColor={colors.textDim}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Contraseña"
          placeholderTextColor={colors.textDim}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button
          label={loading ? 'Entrando...' : 'Entrar'}
          loading={loading}
          onPress={() => void login(email, password)}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  inner: { flex: 1, justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  eyebrow: {
    color: colors.primaryBright,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1.5,
    lineHeight: 40,
    marginBottom: spacing.lg,
  },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: 15,
  },
  error: { color: colors.dangerBright, fontSize: 13, fontWeight: '600' },
});
