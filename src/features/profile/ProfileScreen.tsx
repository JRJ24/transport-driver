import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { goToNotifications } from '@/navigation/ref';
import { Avatar, Badge, Card, Divider, KeyValue, ListRow, Muted, Overline, Stat } from '@/components/ui';
import { ActiveTripBanner } from '@/components/OrderCard';
import { ConfirmSheet } from '@/components/Sheet';
import { spacing } from '@/theme/theme';
import { makeStyles, themeModeLabels, useTheme, useThemeMode, type ThemeMode } from '@/theme/ThemeProvider';
import { SegmentedControl } from '@/components/SegmentedControl';
import { useAuth } from '@/store/auth.store';
import { useOrders } from '@/store/order.store';
import { useTrip } from '@/store/trip.store';
import { toast } from '@/store/toast.store';
import { driversApi } from '@/api/drivers.api';
import { usersApi } from '@/api/users.api';
import type { Vehicle } from '@/types/api';
import { driverStatusLabels } from '@/constants/status.constants';
import { friendlyError } from '@/utils/errors';
import { haptic } from '@/utils/feedback';
import { formatDate } from '@/utils/format';
import { groupAssignments } from '@/utils/orders';
import { useAvatarPicker } from './useAvatarPicker';

const VERIFICATION: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' }> = {
  APPROVED: { label: 'Verificado', tone: 'success' },
  VERIFIED: { label: 'Verificado', tone: 'success' },
  PENDING: { label: 'En revisión', tone: 'warning' },
  REJECTED: { label: 'Rechazado', tone: 'danger' },
};

export function ProfileScreen() {
  const styles = useStyles();
  const { colors, typography, isDark } = useTheme();
  const themeMode = useThemeMode((s) => s.mode);
  const setThemeMode = useThemeMode((s) => s.setMode);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const user = useAuth((s) => s.user);
  const driver = useAuth((s) => s.driver);
  const setDriver = useAuth((s) => s.setDriver);
  const logout = useAuth((s) => s.logout);
  const refreshProfile = useAuth((s) => s.refreshProfile);
  const assignments = useOrders((s) => s.assignments);
  const trip = useTrip((s) => s.order);
  const { pickAvatar, busy: avatarBusy } = useAvatarPicker();
  const [toggling, setToggling] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);

  useFocusEffect(
    useCallback(() => {
      void refreshProfile();
      void usersApi
        .myVehicles()
        .then((list) => setVehicle(list[0] ?? null))
        .catch(() => undefined);
    }, [refreshProfile]),
  );

  const delivered = useMemo(() => groupAssignments(assignments).delivered.length, [assignments]);
  const available = driver?.availabilityStatus === 'AVAILABLE';
  const verification = VERIFICATION[driver?.verificationStatus ?? ''] ?? { label: driver?.verificationStatus ?? '—', tone: 'neutral' as const };
  const rating = Number(driver?.ratingAVG ?? 0);

  async function toggleAvailability(next: boolean) {
    if (!driver) return;
    if (trip) {
      toast.warning('Tienes un servicio en curso', 'Podrás cambiar tu disponibilidad al terminar la entrega.');
      return;
    }
    setToggling(true);
    try {
      const updated = await driversApi.updateStatus(driver.id, next ? 'AVAILABLE' : 'OFFLINE');
      setDriver({ ...driver, availabilityStatus: updated.availabilityStatus });
      haptic.success();
      toast.success(next ? 'Estás disponible' : 'Estás fuera de línea', next ? 'Te llegarán ofertas de viaje.' : 'No recibirás ofertas nuevas.');
    } catch (e) {
      toast.error('No se pudo cambiar', friendlyError(e));
    } finally {
      setToggling(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.identity}>
          <Avatar name={user?.fullName} uri={user?.avatarUrl} size={84} editable onPress={avatarBusy ? undefined : pickAvatar} />
          <View style={{ alignItems: 'center', gap: 4 }}>
            <Text style={typography.title} numberOfLines={1}>
              {user?.fullName ?? 'Conductor'}
            </Text>
            <Muted>{user?.email}</Muted>
            <View style={styles.badges}>
              <Badge label={verification.label} tone={verification.tone} icon="shield-checkmark-outline" />
              {driver ? (
                <Badge
                  label={driverStatusLabels[driver.availabilityStatus]}
                  tone={available ? 'success' : driver.availabilityStatus === 'BUSY' ? 'primary' : 'neutral'}
                  pulse={available}
                />
              ) : null}
            </View>
          </View>
        </View>

        <ActiveTripBanner />

        <View style={styles.stats}>
          <Stat icon="star" value={rating > 0 ? rating.toFixed(1) : '—'} label="Calificación" />
          <Stat icon="checkmark-done" value={String(delivered)} label="Entregas" />
          <Stat icon="car-outline" value={vehicle?.plateNumber ?? '—'} label="Placa" />
        </View>

        <Card style={styles.availability}>
          <View style={{ flex: 1 }}>
            <Text style={typography.bodyStrong}>Disponible para viajes</Text>
            <Muted>
              {trip
                ? 'En servicio: se ajusta solo al terminar.'
                : available
                  ? 'Recibes ofertas cerca de ti.'
                  : 'Actívalo para recibir ofertas.'}
            </Muted>
          </View>
          <Switch
            value={available}
            disabled={toggling || !driver || Boolean(trip)}
            onValueChange={(v) => void toggleAvailability(v)}
            trackColor={{ true: colors.success, false: colors.borderStrong }}
            thumbColor={colors.white}
          />
        </Card>

        <Overline>Apariencia</Overline>
        <Card>
          <SegmentedControl<ThemeMode>
            value={themeMode}
            onChange={setThemeMode}
            segments={(['system', 'light', 'dark'] as ThemeMode[]).map((key) => ({
              key,
              label: themeModeLabels[key],
            }))}
          />
          <Muted>
            {themeMode === 'system'
              ? `Sigue el tema del teléfono (ahora ${isDark ? 'oscuro' : 'claro'}).`
              : themeMode === 'dark'
                ? 'Más cómodo de noche y ahorra batería en pantallas OLED.'
                : 'Se lee mejor a pleno sol.'}
          </Muted>
        </Card>

        <Overline>Cuenta</Overline>
        <Card style={styles.group}>
          <ListRow icon="person-outline" title="Editar perfil" subtitle="Nombre, teléfono y foto" onPress={() => navigation.navigate('EditProfile')} />
          <Divider />
          <ListRow icon="mail-outline" title="Cambiar correo" subtitle={user?.email} onPress={() => navigation.navigate('ChangeEmail')} />
          <Divider />
          <ListRow icon="lock-closed-outline" title="Cambiar contraseña" onPress={() => navigation.navigate('ChangePassword')} />
          <Divider />
          <ListRow
            icon="notifications-outline"
            title="Notificaciones"
            onPress={goToNotifications}
          />
        </Card>

        <Overline>Licencia y vehículo</Overline>
        <Card>
          <KeyValue label="Licencia" value={driver?.licenseNumber ?? '—'} />
          <KeyValue label="Vence" value={formatDate(driver?.licenseExpiration)} />
          {vehicle ? (
            <>
              <Divider />
              <KeyValue label="Vehículo" value={[vehicle.brand, vehicle.model, vehicle.year].filter(Boolean).join(' ')} />
              <KeyValue label="Placa" value={vehicle.plateNumber} />
              {vehicle.color ? <KeyValue label="Color" value={vehicle.color} /> : null}
            </>
          ) : null}
          <Muted>Para cambiar estos datos, contacta a operaciones.</Muted>
        </Card>

        <Card style={styles.group}>
          <ListRow
            icon="log-out-outline"
            title="Cerrar sesión"
            tone="danger"
            onPress={() => {
              if (trip) {
                toast.warning('Tienes un servicio en curso', 'Completa la entrega antes de cerrar sesión.');
                return;
              }
              setConfirmLogout(true);
            }}
          />
        </Card>
        <Muted style={{ textAlign: 'center' }}>RUTA RD Driver</Muted>
      </ScrollView>

      <ConfirmSheet
        visible={confirmLogout}
        onClose={() => setConfirmLogout(false)}
        onConfirm={() => void logout()}
        title="¿Cerrar sesión?"
        message="Dejarás de recibir ofertas y notificaciones en este teléfono."
        confirmLabel="Cerrar sesión"
        danger
        icon="log-out-outline"
      />
    </SafeAreaView>
  );
}

const useStyles = makeStyles(({ colors, typography, elevation }) =>
  StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl },
  identity: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  badges: { flexDirection: 'row', gap: spacing.sm, marginTop: 4, flexWrap: 'wrap', justifyContent: 'center' },
  stats: { flexDirection: 'row', gap: spacing.sm },
  availability: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  group: { padding: 0, gap: 0, overflow: 'hidden' },
}),
);
