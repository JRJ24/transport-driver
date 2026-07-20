import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Button, Card, Divider, Eyebrow, Muted, Pill, StatCard } from '@/components/ui';
import { colors, radius, spacing } from '@/theme/theme';
import { useAuth } from '@/store/auth.store';
import { useTracking } from '@/store/tracking.store';
import { driversApi } from '@/api/drivers.api';

function initials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function ProfileScreen() {
  const { user, driver, logout, setDriver } = useAuth();
  const { isTracking, stop } = useTracking();
  const [busy, setBusy] = useState(false);

  const available = driver?.availabilityStatus === 'AVAILABLE';

  async function toggleAvailability() {
    if (!driver) {
      return;
    }
    setBusy(true);
    try {
      const next = await driversApi.updateStatus(
        driver.id,
        available ? 'OFFLINE' : 'AVAILABLE',
      );
      setDriver({ ...driver, availabilityStatus: next.availabilityStatus });
    } finally {
      setBusy(false);
    }
  }

  async function closeShift() {
    if (isTracking) {
      await stop();
    }
    await logout();
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.identity}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(user?.fullName ?? 'RD')}</Text>
          </View>
          <View style={styles.identityInfo}>
            <Text style={styles.name}>{user?.fullName ?? 'Conductor'}</Text>
            <Muted>Conductor · RUTA RD</Muted>
            <View style={styles.availRow}>
              <Pill tone={available ? 'success' : 'neutral'}>
                {available ? 'Disponible' : (driver?.availabilityStatus ?? 'Offline')}
              </Pill>
              <Text style={styles.rating}>
                ⭐ {Number(driver?.ratingAVG ?? 0).toFixed(1)}
              </Text>
            </View>
          </View>
        </Card>

        <View style={styles.stats}>
          <StatCard value={driver ? '✓' : '—'} label="Perfil" />
          <StatCard value={driver?.verificationStatus ?? '—'} label="Verificación" />
          <StatCard value={isTracking ? 'On' : 'Off'} label="Tracking" />
        </View>

        <Card>
          <Eyebrow>Documentos y vehículo</Eyebrow>
          <Muted>
            {driver
              ? `Licencia ${driver.licenseNumber} · vence ${new Date(driver.licenseExpiration).toLocaleDateString()}`
              : 'Sin datos de licencia'}
          </Muted>
        </Card>

        <Card>
          <Eyebrow>Modo offline básico</Eyebrow>
          <Muted>
            Ruta, paradas y ubicación se guardan localmente y se sincronizan al
            recuperar conexión.
          </Muted>
        </Card>

        <Button
          label={available ? 'Ponerme offline' : 'Ponerme disponible'}
          tone="neutral"
          loading={busy}
          onPress={toggleAvailability}
        />
        <Divider />
        <Button label="Cerrar turno" tone="danger" onPress={closeShift} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: '900' },
  identityInfo: { flex: 1, gap: 4 },
  name: { color: colors.text, fontSize: 20, fontWeight: '900' },
  availRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 4 },
  rating: { color: colors.warning, fontSize: 13, fontWeight: '800' },
  stats: { flexDirection: 'row', gap: spacing.sm },
});
