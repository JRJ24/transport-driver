import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useNavigation } from '@react-navigation/native';
import { Button, Card, Muted } from '@/components/ui';
import { deliveryProofsApi } from '@/api/delivery-proofs.api';
import { orderEventsApi } from '@/api/order-events.api';
import { incidentsApi } from '@/api/incidents.api';
import { evidenceStatus, missingEvidenceMessage } from '@/utils/evidence';
import { toErrorMessage } from '@/api/client';
import { colors, radius, spacing } from '@/theme/theme';
import { useOrders } from '@/store/order.store';
import { useTracking } from '@/store/tracking.store';
import { useConnectivity } from '@/store/connectivity.store';
import { decodePolyline } from '@/utils/polyline';
import {
  googleMapsNavigationUrl,
  nextStopForDriver,
  wazeNavigationUrl,
} from '@/utils/navigation';
import type { IncidentSeverity, IncidentType, LatLng, OrderStop } from '@/types/api';
import type { TabParamList } from '@/navigation/types';

const DEFAULT_REGION = {
  latitude: 18.4861,
  longitude: -69.9312,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

function toLatLng(s: OrderStop | undefined): LatLng | null {
  if (!s || s.latitude === null || s.longitude === null) return null;
  const latitude = Number(s.latitude);
  const longitude = Number(s.longitude);

  return Number.isFinite(latitude) && Number.isFinite(longitude)
    ? { latitude, longitude }
    : null;
}

export function RouteScreen() {
  const mapRef = useRef<MapView>(null);
  const navigation = useNavigation<TabNav>();
  const { activeOrder, route, approach } = useOrders();
  const updateStatus = useOrders((s) => s.updateStatus);
  const clearActive = useOrders((s) => s.clearActive);
  const refreshApproach = useOrders((s) => s.refreshApproach);
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
  const stopPoints = useMemo(
    () => stops.map(toLatLng).filter((point): point is LatLng => Boolean(point)),
    [stops],
  );
  // Tramo desde donde esta el conductor hasta la parada que le toca. Antes su
  // marcador quedaba suelto, sin nada que lo uniera a la ruta.
  const approachLine = useMemo(
    () => (approach?.route?.polyline ? decodePolyline(approach.route.polyline) : []),
    [approach],
  );

  const fitToRoute = () => {
    const points: LatLng[] = polyline.length ? [...polyline] : [...stopPoints];
    points.push(...approachLine);
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
  }, [route, activeOrder, approach]);

  /*
   * El tramo caduca a medida que el conductor avanza, asi que se refresca
   * mientras la pantalla esta abierta. 20 s no cuesta: el backend solo llama a
   * Google cuando el conductor se alejo mas de 200 m del ultimo calculo.
   */
  useEffect(() => {
    if (!activeOrder) {
      return undefined;
    }

    const timer = setInterval(() => void refreshApproach(), 20_000);
    return () => clearInterval(timer);
  }, [activeOrder, refreshApproach]);

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
  const initialPoint = toLatLng(pickup) ?? stopPoints[0] ?? lastFix;
  const initialRegion = {
    ...(initialPoint ?? DEFAULT_REGION),
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  };

  const nextStop = nextStopForDriver(activeOrder);

  /**
   * «Como llegar»: apunta a la siguiente parada del viaje, no al destino final.
   * Al empezar hay que ir a recoger, no a entregar.
   */
  const openExternalNav = () => {
    const dest = toLatLng(nextStop ?? undefined) ?? lastFix;
    if (!dest) {
      Alert.alert('Sin coordenadas', 'Esa parada no tiene ubicacion registrada.');
      return;
    }

    const target = nextStop?.stopType === 'PICKUP' ? 'la recogida' : 'la entrega';

    Alert.alert('Como llegar', `Navegar hasta ${target}.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Google Maps', onPress: () => void Linking.openURL(googleMapsNavigationUrl(dest)) },
      { text: 'Waze', onPress: () => void Linking.openURL(wazeNavigationUrl(dest)) },
    ]);
  };

  const reportIncident = (
    incidentType: IncidentType,
    severity: IncidentSeverity,
    title: string,
    description: string,
  ) => {
    const location = currentOrFallback(lastFix, dropoff ?? pickup);
    if (!location) {
      Alert.alert('Ubicación requerida', 'No hay ubicación disponible para reportar.');
      return;
    }

    setBusy(true);
    incidentsApi
      .create({
        orderId: activeOrder.id,
        incidentType,
        severity,
        title,
        description,
        latitude: location.latitude,
        longitude: location.longitude,
      })
      .then(() => Alert.alert('Incidencia enviada', 'La torre de control fue notificada.'))
      .catch((error) => Alert.alert('No se pudo reportar', toErrorMessage(error)))
      .finally(() => setBusy(false));
  };

  const openIncidentMenu = () => {
    Alert.alert('Reportar incidencia', 'Selecciona el tipo de novedad.', [
      {
        text: 'Cliente ausente',
        onPress: () =>
          reportIncident(
            'CUSTOMER_ABSENT',
            'MEDIUM',
            'Cliente ausente',
            'El receptor no se encuentra disponible en el punto de entrega.',
          ),
      },
      {
        text: 'Tráfico / retraso',
        onPress: () =>
          reportIncident(
            'DELAY',
            'LOW',
            'Retraso en ruta',
            'El conductor reporta retraso por tráfico o condiciones de vía.',
          ),
      },
      {
        text: 'Daño',
        onPress: () =>
          reportIncident(
            'DAMAGE',
            'HIGH',
            'Daño reportado',
            'El conductor reporta posible daño o novedad con la carga.',
          ),
      },
    ]);
  };

  const onComplete = async () => {
    setBusy(true);
    try {
      const evidence = evidenceStatus(await deliveryProofsApi.bundle(activeOrder.id));
      if (!evidence.ready) {
        Alert.alert('Evidencia incompleta', missingEvidenceMessage(evidence), [
          { text: 'Luego', style: 'cancel' },
          { text: 'Capturar', onPress: () => navigation.navigate('Evid') },
        ]);
        return;
      }
      // Antes de DELIVERED: despues la asignacion queda COMPLETED y el servidor
      // responde 403 a los puntos que seguian en la cola. Si DELIVERED falla,
      // el GPS sigue activo.
      await flush();
      await updateStatus(activeOrder.id, 'DELIVERED');
      await stop();
      await clearActive();
      Alert.alert('Servicio completado', 'La entrega fue registrada.');
    } catch (error) {
      Alert.alert('No se pudo completar', toErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  /**
   * D3: «Llegué» solo vaciaba la cola de GPS y no registraba nada.
   * Ahora deja constancia en la bitacora de la orden, ademas de sincronizar.
   */
  const onArrived = async () => {
    setBusy(true);
    try {
      const where = currentOrFallback(lastFix, dropoff ?? pickup);
      await orderEventsApi.create({
        orderId: activeOrder.id,
        eventType: 'ARRIVED',
        description: 'El conductor llego al punto de entrega.',
        latitude: where?.latitude,
        longitude: where?.longitude,
      });
      await flush();
      Alert.alert('Llegada registrada', 'La torre de control fue notificada.');
    } catch (error) {
      Alert.alert('No se pudo registrar la llegada', toErrorMessage(error));
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
          {approachLine.length > 1 && (
            <Polyline
              coordinates={approachLine}
              strokeColor={colors.textMuted}
              strokeWidth={4}
              lineDashPattern={[10, 8]}
            />
          )}
          {polyline.length > 1 && (
            <Polyline coordinates={polyline} strokeColor={colors.primaryBright} strokeWidth={5} />
          )}
          {stops.map((s) => {
            const coordinate = toLatLng(s);
            if (!coordinate) return null;

            return (
              <Marker key={s.id} coordinate={coordinate} title={s.addressLine}>
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
            );
          })}
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
        {approach?.route ? (
          <Muted>
            {`${approach.route.durationMin} min · ${approach.route.distanceKm} km hasta ${
              approach.targetStopType === 'PICKUP' ? 'la recogida' : 'la entrega'
            }`}
          </Muted>
        ) : null}
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
            onPress={() => void onArrived()}
          />
          <Button
            label="Reportar"
            tone="danger"
            style={styles.flex}
            onPress={openIncidentMenu}
          />
        </View>
        <Button label="Completar entrega" tone="success" loading={busy} onPress={onComplete} />
      </Card>
    </SafeAreaView>
  );
}

type TabNav = { navigate: (screen: keyof TabParamList) => void };

function currentOrFallback(
  lastFix: LatLng | null,
  stop: OrderStop | undefined,
): LatLng | null {
  if (lastFix) return lastFix;
  if (!stop || stop.latitude === null || stop.longitude === null) return null;
  const latitude = Number(stop?.latitude);
  const longitude = Number(stop?.longitude);

  return Number.isFinite(latitude) && Number.isFinite(longitude)
    ? { latitude, longitude }
    : null;
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
