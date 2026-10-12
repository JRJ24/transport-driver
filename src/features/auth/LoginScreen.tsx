import React, { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Button, ErrorBanner, Muted, TextField } from '@/components/ui';
import { colors, radius, spacing, typography } from '@/theme/theme';
import { useAuth } from '@/store/auth.store';

export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const login = useAuth((s) => s.login);
  const status = useAuth((s) => s.status);
  const error = useAuth((s) => s.error);
  const loading = status === 'authenticating';
  const canSubmit = email.trim().length > 3 && password.length > 0;

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
          <Animated.View entering={FadeInDown.springify().damping(16)} style={styles.brand}>
            <Image source={require('../../assets/icon.png')} style={styles.logo} />
            <Text style={styles.eyebrow}>RUTA RD Driver</Text>
            <Text style={typography.display}>¡Hola de nuevo!</Text>
            <Muted>Entra para ver tus órdenes y empezar a rodar.</Muted>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(120).springify().damping(16)} style={styles.form}>
            <TextField
              label="Correo"
              icon="mail-outline"
              placeholder="tu@correo.com"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              returnKeyType="next"
            />
            <TextField
              label="Contraseña"
              icon="lock-closed-outline"
              placeholder="Tu contraseña"
              secure
              autoCapitalize="none"
              autoComplete="password"
              value={password}
              onChangeText={setPassword}
              returnKeyType="go"
              onSubmitEditing={() => canSubmit && void login(email, password)}
            />
            {error ? <ErrorBanner message={error} /> : null}
            <Button
              label={loading ? 'Entrando…' : 'Entrar'}
              icon="arrow-forward"
              loading={loading}
              disabled={!canSubmit}
              onPress={() => void login(email, password)}
            />
            <Muted style={{ textAlign: 'center' }}>¿Olvidaste tu contraseña? Escríbele a operaciones.</Muted>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  inner: { flexGrow: 1, justifyContent: 'center', gap: spacing.xxl, padding: spacing.xl },
  brand: { gap: spacing.sm },
  logo: { width: 64, height: 64, borderRadius: radius.lg, marginBottom: spacing.sm },
  eyebrow: { color: colors.primary, fontSize: 13, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  form: { gap: spacing.lg },
});
