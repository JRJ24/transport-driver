import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Avatar, Button, Muted, TextField } from '@/components/ui';
import { spacing } from '@/theme/theme';
import { makeStyles } from '@/theme/ThemeProvider';
import { usersApi } from '@/api/users.api';
import { useAuth } from '@/store/auth.store';
import { toast } from '@/store/toast.store';
import { friendlyError } from '@/utils/errors';
import { useAvatarPicker } from './useAvatarPicker';

const PHONE = /^\+?[0-9]{10,15}$/;

export function EditProfileScreen() {
  const styles = useStyles();
  const navigation = useNavigation();
  const user = useAuth((s) => s.user);
  const applyProfile = useAuth((s) => s.applyProfile);
  const { pickAvatar, busy: avatarBusy } = useAvatarPicker();
  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  const cleanPhone = phone.replace(/[\s()-]/g, '');
  const nameError = touched && fullName.trim().length < 3 ? 'Mínimo 3 caracteres.' : null;
  const phoneError = touched && cleanPhone && !PHONE.test(cleanPhone) ? 'Usa 10 a 15 dígitos, ej. 8095551234.' : null;
  const dirty = fullName.trim() !== (user?.fullName ?? '') || cleanPhone !== (user?.phone ?? '');

  async function save() {
    setTouched(true);
    if (fullName.trim().length < 3 || (cleanPhone && !PHONE.test(cleanPhone))) return;
    setSaving(true);
    try {
      const profile = await usersApi.update({
        fullName: fullName.trim(),
        ...(cleanPhone ? { phone: cleanPhone } : {}),
      });
      applyProfile(profile);
      toast.success('Perfil actualizado');
      navigation.goBack();
    } catch (e) {
      toast.error('No se pudo guardar', friendlyError(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.avatar}>
            <Avatar name={fullName} uri={user?.avatarUrl} size={96} editable onPress={avatarBusy ? undefined : pickAvatar} />
            <Muted>{avatarBusy ? 'Subiendo foto…' : 'Toca la foto para cambiarla'}</Muted>
          </View>
          <TextField
            label="Nombre completo"
            icon="person-outline"
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
            error={nameError}
          />
          <TextField
            label="Teléfono"
            icon="call-outline"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="8095551234"
            error={phoneError}
            hint="Operaciones y tus clientes te contactan a este número."
          />
          <TextField label="Correo" icon="mail-outline" value={user?.email ?? ''} editable={false} hint="Cámbialo desde «Cambiar correo»." />
        </ScrollView>
        <View style={styles.footer}>
          <Button label="Guardar cambios" icon="checkmark" loading={saving} disabled={!dirty} onPress={() => void save()} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles(({ colors, typography, elevation }) =>
  StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.lg },
  avatar: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  footer: { padding: spacing.lg },
}),
);
