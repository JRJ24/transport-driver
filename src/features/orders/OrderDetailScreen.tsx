import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { Button, Card, Eyebrow, Muted, Pill } from '@/components/ui';
import { colors, radius, spacing } from '@/theme/theme';
import { useOrders } from '@/store/order.store';
import { useTracking } from '@/store/tracking.store';
import { locationPermissions } from '@/services/location/location-permissions.service';
import type { InicioStackParamList, TabParamList } from '@/navigation/types';
import type { OrderStop } from '@/types/api';
import { orderStatusLabels } from '@/constants/status.constants';
import {
  googleMapsNavigationUrl,
  nextStopForDriver,
  wazeNavigationUrl,
} from '@/utils/navigation';

const stopLabel: Record<OrderStop['stopType'], string> = {
  PICKUP: 'Recogida',
  DROPOFF: 'Entrega',
  INTERMEDIATE: 'Parada',
};

export function OrderDetailScreen() {
  const route = useRoute<RouteProp<InicioStackParamList, 'OrderDetail'>>();
  const navigation = useNavigation();
  const { orderId } = route.params;

  const { activeOrder, route: computedRoute, loadingOrder, selectOrder, accept } =
    useOrders();
  const assignments = useOrders((s) => s.assignments);
  const startTracking = useTracking((s) => s.start);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void selectOrder(orderId);
  }, [orderId, selectOrder]);

  const assignment = useMemo(
    () => assignments.find((a) => a.orderId === orderId),
    [assignments, orderId],
  );
  const stops = [...(activeOrder?.orderStops ?? [])].sort(
    (a, b) => a.sequence - b.sequence,
  );
  const nextStop = nextStopForDriver(activeOrder);

  /** Abre la navegacion del telefono hacia una parada concreta. */
  const navigateToStop = (stop: OrderStop) => {
    if (stop.latitude === null || stop.longitude === null) {
      Alert.alert('Sin coordenadas', 'Esa parada no tiene ubicacion registrada.');
      return;
    }

    const dest = { latitude: Number(stop.latitude), longitude: Number(stop.longitude) };

    Alert.alert('Como llegar', stop.addressLine, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Google Maps', onPress: () => void Linking.openURL(googleMapsNavigationUrl(dest)) },
      { text: 'Waze', onPress: () => void Linking.openURL(wazeNavigationUrl(dest)) },
    ]);
  };
  const items = activeOrder?.orderItems ?? [];

  async function onStart() {
    setBusy(true);
    try {
      const perms = await locationPermissions.request();
      if (!perms.foreground) {
        return;
      }
      const ok = await startTracking(orderId);
      if (ok) {
        navigation.getParent<TabNav>()?.navigate('Ruta');
      }
    } finally {
      setBusy(false);
    }
  }

  async function onAccept() {
    setBusy(true);
    try {
      await accept(orderId);
    } finally {
      setBusy(false);
    }
  }

  if (loadingOrder && !activeOrder) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primaryBright} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>{activeOrder?.orderCode ?? orderId}</Text>
          <Pill tone="primary">
            {activeOrder ? orderStatusLabels[activeOrder.status] : '—'}
          </Pill>
        </View>

        <Card>
          <Eyebrow>Ruta</Eyebrow>
          <View style={styles.metrics}>
            <Text style={styles.metric}>
              {computedRoute
                ? `${computedRoute.distanceKm} km`
                : `${Number(activeOrder?.distanceKm ?? 0)} km`}
            </Text>
            <Text style={styles.metricDim}>·</Text>
            <Text style={styles.metric}>
              {computedRoute?.durationMin ?? activeOrder?.estimatedDurationMin ?? '--'} min
            </Text>
            {computedRoute && (
              <Muted>{`  (${computedRoute.provider})`}</Muted>
            )}
          </View>
        </Card>

        <Eyebrow>Paradas</Eyebrow>
        {stops.map((s) => (
          <Card key={s.id} style={styles.stop}>
            <Pill
              tone={
                s.stopType === 'PICKUP'
                  ? 'warning'
                  : s.stopType === 'DROPOFF'
                    ? 'success'
                    : 'neutral'
              }
            >
              {stopLabel[s.stopType]}
            </Pill>
            <Text style={styles.addr}>{s.addressLine}</Text>
            <Muted>{`${s.city}, ${s.province}`}</Muted>
            <Muted>{`Contacto: ${s.contactName} · ${s.contactPhone}`}</Muted>
            {s.instructions ? <Muted>{s.instructions}</Muted> : null}
            <Button
              label={s.id === nextStop?.id ? 'Como llegar (siguiente)' : 'Como llegar'}
              tone={s.id === nextStop?.id ? 'primary' : 'neutral'}
              onPress={() => navigateToStop(s)}
            />
          </Card>
        ))}

        {items.length > 0 && (
          <>
            <Eyebrow>Carga</Eyebrow>
            <Card style={styles.cargo}>
              {items.map((it) => (
                <Text key={it.id} style={styles.cargoLine}>
                  {`${it.quantity}× ${it.description} · ${Number(it.weightKg)} kg${it.fragile ? ' · frágil' : ''}`}
                </Text>
              ))}
            </Card>
          </>
        )}

        {assignment?.assignmentStatus === 'PENDING' ? (
          <Button label="Aceptar servicio" tone="success" loading={busy} onPress={onAccept} />
        ) : (
          <Button label="Iniciar servicio" loading={busy} onPress={onStart} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

type TabNav = { navigate: (screen: keyof TabParamList) => void };

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { color: colors.text, fontSize: 24, fontWeight: '900' },
  metrics: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metric: { color: colors.text, fontSize: 20, fontWeight: '900' },
  metricDim: { color: colors.textDim, fontSize: 20 },
  stop: { gap: 4, borderRadius: radius.md },
  addr: { color: colors.text, fontSize: 15, fontWeight: '700' },
  cargo: { gap: 6 },
  cargoLine: { color: colors.text, fontSize: 13, fontWeight: '600' },
});
