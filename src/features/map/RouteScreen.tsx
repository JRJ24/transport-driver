import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { Button, Card, Muted } from '@/components/ui';
import { colors, radius, spacing } from '@/theme/theme';
import { useOrders } from '@/store/order.store';
import { useTracking } from '@/store/tracking.store';
import { useConnectivity } from '@/store/connectivity.store';
import { decodePolyline } from '@/utils/polyline';
import type { LatLng, OrderStop } from '@/types/api';

function toLatLng(s: OrderStop): LatLng {
  return { latitude: Number(s.latitude), longitude: Number(s.longitude) };
}

export function RouteScreen() {
  const mapRef = useRef<MapView>(null);
  const { activeOrder, route } = useOrders();
  const updateStatus = useOrders((s) => s.updateStatus);
  const clearActive = useOrders((s) => s.clearActive);
  const { isTracking, lastFix, lastFixAt, pendingCount, stop, flush } = useTracking();
  const online = useConnectivity((s) => s.online);
  const lastSyncAt = useConnectivity((s) => s.lastSyncAt);
  const [busy, setBusy] = useState(false);

  const stops = useMemo(
    () =>
      [...(activeOrder?.orderStops ?? [])].sort((a, b) => a.sequence - b.sequence),
    [activeOrder],
  );
  const polyline = useMemo(
    () => (route?.polyline ? decodePolyline(route.polyline) : []),
    [route],
  );

  const fitToRoute = () => {
    const points: LatLng[] = polyline.length ? polyline : stops.map(toLatLng);
    if (lastFix) {
      points.push(lastFix);
    }
    if (points.length >= 2) {
      mapRef.current?.fitToCoordinates(points, {
        edgePadding: { top: 80, right: 60, bottom: 220, left: 60 },
        animated: true,
      });
    }
  };

  useEffect(() => {
    const t = setTimeout(fitToRoute, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, activeOrder]);

  if (!activeOrder) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <StatusBar style="light" />
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>Sin ruta activa</Text>
          <Muted>Selecciona una orden en Inicio para ver su ruta.</Muted>
        </View>
      </SafeAreaView>
    );
  }

  const pickup = stops.find((s) => s.stopType === 'PICKUP') ?? stops[0];
  const dropoff = stops.find((s) => s.stopType === 'DROPOFF') ?? stops[stops.length - 1];
  const initialRegion = {
    ...toLatLng(pickup ?? stops[0]),
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  const openExternalNav = () => {
    const dest = dropoff ? toLatLng(dropoff) : lastFix;
    if (!dest) {
      return;
    }
    const url = Platform.select({
      ios: `maps://?daddr=${dest.latitude},${dest.longitude}`,
      android: `google.navigation:q=${dest.latitude},${dest.longitude}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${dest.latitude},${dest.longitude}`,
    });
    void Linking.openURL(url);
  };

  const onComplete = async () => {
    setBusy(true);
    try {
      await updateStatus(activeOrder.id, 'DELIVERED');
      await stop();
      await clearActive();
      Alert.alert('Servicio completado', 'La entrega fue registrada.');
    } catch {
      Alert.alert('Error', 'No se pudo completar. Se reintentará al sincronizar.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <StatusBar style="light" />
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Ruta activa</Text>
          <Muted>{`Próxima parada · ${dropoff?.city ?? '—'}`}</Muted>
        </View>
        <View style={[styles.conn, { backgroundColor: online ? `${colors.success}22` : `${colors.danger}22` }]}>
          <View style={[styles.dot, { backgroundColor: online ? colors.success : colors.danger }]} />
          <Text style={[styles.connText, { color: online ? colors.success : colors.danger }]}>
            {online ? 'En línea' : 'Sin conexión'}
          </Text>
        </View>
      </View>

      <View style={styles.mapWrap}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={StyleSheet.absoluteFill}
          initialRegion={initialRegion}
          showsUserLocation={false}
        >
          {polyline.length > 1 && (
            <Polyline coordinates={polyline} strokeColor={colors.primaryBright} strokeWidth={5} />
          )}
          {stops.map((s) => (
            <Marker key={s.id} coordinate={toLatLng(s)} title={s.addressLine}>
              <View
                style={[
                  styles.marker,
                  {
                    backgroundColor:
                      s.stopType === 'PICKUP'
                        ? colors.pickup
                        : s.stopType === 'DROPOFF'
                          ? colors.delivery
                          : colors.textMuted,
                  },
                ]}
              />
            </Marker>
          ))}
          {lastFix && (
            <Marker coordinate={lastFix} title="Mi ubicación" anchor={{ x: 0.5, y: 0.5 }}>
              <View style={styles.vehicle}>
                <View style={styles.vehicleInner} />
              </View>
            </Marker>
          )}
        </MapView>

        <Pressable style={[styles.fab, styles.fabCenter]} onPress={fitToRoute}>
          <Text style={styles.fabIcon}>◎</Text>
        </Pressable>
        <Pressable style={[styles.fab, styles.fabNav]} onPress={openExternalNav}>
          <Text style={styles.fabIcon}>➤</Text>
        </Pressable>
      </View>

      <Card style={styles.summary}>
        <View style={styles.summaryRow}>
          <Text style={styles.bigMetric}>
            {route?.durationMin ?? activeOrder.estimatedDurationMin} min
          </Text>
          <Muted>
            {`${route ? route.distanceKm : Number(activeOrder.distanceKm)} km`}
            {isTracking ? ' · GPS activo' : ' · GPS en pausa'}
            {pendingCount > 0 ? ` · ${pendingCount} por sincronizar` : ''}
          </Muted>
        </View>
        <Muted>
          {lastFixAt
            ? `Última ubicación: ${new Date(lastFixAt).toLocaleTimeString()}`
            : 'Esperando señal GPS...'}
          {lastSyncAt ? ` · Sync: ${new Date(lastSyncAt).toLocaleTimeString()}` : ''}
        </Muted>

        <View style={styles.actions}>
          <Button
            label="Llegué"
            tone="primary"
            style={styles.flex}
            onPress={() => void flush()}
          />
          <Button
            label="Reportar"
            tone="danger"
            style={styles.flex}
            onPress={() => Alert.alert('Reportar incidencia', 'Cliente ausente · Daño · Tráfico')}
          />
        </View>
        <Button label="Completar entrega" tone="success" loading={busy} onPress={onComplete} />
      </Card>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: spacing.xl },
  emptyTitle: { color: colors.text, fontSize: 20, fontWeight: '800' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: { color: colors.text, fontSize: 24, fontWeight: '900' },
  conn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  connText: { fontSize: 12, fontWeight: '800' },
  mapWrap: { flex: 1, margin: spacing.lg, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  marker: { width: 18, height: 18, borderRadius: 9, borderWidth: 3, borderColor: '#fff' },
  vehicle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: `${colors.primaryBright}55`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleInner: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.primaryBright, borderWidth: 2, borderColor: '#fff' },
  fab: {
    position: 'absolute',
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabCenter: { right: 12, bottom: 70 },
  fabNav: { right: 12, bottom: 12 },
  fabIcon: { color: colors.text, fontSize: 18 },
  summary: { margin: spacing.lg, marginTop: 0, gap: spacing.sm },
  summaryRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  bigMetric: { color: colors.text, fontSize: 26, fontWeight: '900' },
  actions: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
});
