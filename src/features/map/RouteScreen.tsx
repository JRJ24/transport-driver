import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useKeepAwake } from 'expo-keep-awake';
import Animated, { FadeInDown, FadeInUp, LinearTransition } from 'react-native-reanimated';
import { Badge, Button, EmptyState, IconButton, Muted } from '@/components/ui';
import { SwipeButton } from '@/components/SwipeButton';
import { ActionSheet } from '@/components/Sheet';
import { StepIndicator } from '@/components/OrderCard';
import { radius, spacing } from '@/theme/theme';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { incidentsApi } from '@/api/incidents.api';
import { useTrip } from '@/store/trip.store';
import { useTracking } from '@/store/tracking.store';
import { useConnectivity } from '@/store/connectivity.store';
import { toast } from '@/store/toast.store';
import type { IncidentSeverity, IncidentType, LatLng } from '@/types/api';
import { friendlyError } from '@/utils/errors';
import { haptic } from '@/utils/feedback';
import { formatMeters, formatMinutes, formatTime } from '@/utils/format';
import { stopPoint } from '@/utils/geo';
import { googleMapsNavigationUrl, wazeNavigationUrl } from '@/utils/navigation';
import { dropoffStop, phaseCopy, pickupStop, sortedStops, stopAddress, targetStopFor } from '@/utils/orders';
import { useLiveLocation } from './useLiveLocation';
import { useTripNavigation } from './useTripNavigation';
import { darkMapStyle, lightMapStyle } from './mapStyle';
import { goToTab, openEvidence } from '@/navigation/ref';

const DEFAULT_REGION = { latitude: 18.4861, longitude: -69.9312, latitudeDelta: 0.08, longitudeDelta: 0.08 };

const INCIDENTS: Array<{ key: IncidentType; label: string; description: string; severity: IncidentSeverity; icon: React.ComponentProps<typeof Ionicons>['name'] }> = [
  { key: 'CUSTOMER_ABSENT', label: 'Cliente ausente', description: 'Nadie recibe en el punto.', severity: 'MEDIUM', icon: 'person-remove-outline' },
  { key: 'DELAY', label: 'Tráfico o retraso', description: 'Llegaré más tarde de lo previsto.', severity: 'LOW', icon: 'time-outline' },
  { key: 'WRONG_ADDRESS', label: 'Dirección incorrecta', description: 'No encuentro el lugar indicado.', severity: 'MEDIUM', icon: 'location-outline' },
  { key: 'DAMAGE', label: 'Daño en la carga', description: 'La mercancía tiene un problema.', severity: 'HIGH', icon: 'cube-outline' },
  { key: 'VEHICLE_PROBLEM', label: 'Problema con el vehículo', description: 'Avería, goma, combustible…', severity: 'HIGH', icon: 'car-sport-outline' },
];

function KeepAwake() {
  useKeepAwake();
  return null;
}

/** Los marcadores con vista propia se pintan una vez y se congelan (Android). */
function useSettled(deps: unknown[]): boolean {
  const [tracks, setTracks] = useState(true);
  useEffect(() => {
    setTracks(true);
    const t = setTimeout(() => setTracks(false), 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return tracks;
}

export function RouteScreen() {
  const styles = useStyles();
  const { colors, elevation, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const mapRef = useRef<MapView>(null);

  const order = useTrip((s) => s.order);
  const markArrived = useTrip((s) => s.markArrived);
  const confirmPickup = useTrip((s) => s.confirmPickup);
  const isTracking = useTracking((s) => s.isTracking);
  const lastFixAt = useTracking((s) => s.lastFixAt);
  const pendingCount = useTracking((s) => s.pendingCount);
  const online = useConnectivity((s) => s.online);

  const fix = useLiveLocation(Boolean(order) && focused);
  const nav = useTripNavigation(order, fix);

  const [follow, setFollow] = useState(true);
  const [busy, setBusy] = useState<'arrive' | 'pickup' | 'incident' | null>(null);
  const [sheet, setSheet] = useState<'nav' | 'incident' | null>(null);
  const [expanded, setExpanded] = useState(false);
  const nearNotified = useRef<string | null>(null);

  const stops = useMemo(() => sortedStops(order), [order]);
  const pickup = pickupStop(order);
  const dropoff = dropoffStop(order);
  const phase = nav?.phase;
  const target = order && phase ? targetStopFor(order, phase) : undefined;
  const tracksMarkers = useSettled([order?.id, phase]);

  // Camara tipo Uber: sigue al vehiculo, orientada a su rumbo.
  useEffect(() => {
    if (!follow || !fix || !mapRef.current) return;
    mapRef.current.animateCamera(
      {
        center: { latitude: fix.latitude, longitude: fix.longitude },
        heading: fix.heading ?? 0,
        pitch: 45,
        zoom: 17,
      },
      { duration: 900 },
    );
  }, [fix, follow]);

  // Aviso al acercarse a la parada (una vez por fase).
  useEffect(() => {
    if (!nav?.nearTarget || !phase || !order) return;
    const key = `${order.id}:${phase}`;
    if ((phase === 'TO_PICKUP' || phase === 'TO_DROPOFF') && nearNotified.current !== key) {
      nearNotified.current = key;
      toast.info(
        phase === 'TO_PICKUP' ? 'Estás llegando a la recogida' : 'Estás llegando a la entrega',
        'Cuando estés en el lugar, toca «Llegué».',
      );
    }
  }, [nav?.nearTarget, phase, order]);

  const fitAll = () => {
    const points: LatLng[] = [];
    if (fix) points.push(fix);
    if (nav?.target) points.push(nav.target);
    if (points.length < 2) stops.forEach((s) => stopPoint(s) && points.push(stopPoint(s)!));
    if (points.length >= 2) {
      setFollow(false);
      mapRef.current?.fitToCoordinates(points, {
        edgePadding: { top: 220, right: 60, bottom: 360, left: 60 },
        animated: true,
      });
    }
  };

  if (!order || !nav || !phase) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <EmptyState
          icon="navigate-circle-outline"
          title="Sin servicio en curso"
          message="Cuando inicies una orden, aquí verás tu ruta en vivo: primero hacia la recogida y luego hacia la entrega."
          action={
            <Button
              label="Ver mis órdenes"
              icon="list-outline"
              variant="secondary"
              size="md"
              onPress={() => goToTab('Inicio')}
            />
          }
        />
      </View>
    );
  }

  const toPickup = phase === 'TO_PICKUP' || phase === 'AT_PICKUP';
  const stepIndex = toPickup ? 0 : phase === 'TO_DROPOFF' ? 1 : 2;
  const legColor = toPickup ? colors.pickup : colors.primary;

  async function onArrived() {
    setBusy('arrive');
    try {
      await markArrived(fix);
      haptic.success();
      toast.success(
        toPickup ? 'Llegada a la recogida registrada' : 'Llegada a la entrega registrada',
        toPickup ? 'Recoge la carga y confirma deslizando.' : 'Ahora registra la evidencia de entrega.',
      );
      if (!toPickup && order) {
        openEvidence(order.id);
      }
    } catch (e) {
      toast.error('No se pudo registrar la llegada', friendlyError(e));
    } finally {
      setBusy(null);
    }
  }

  async function onPickedUp() {
    setBusy('pickup');
    try {
      await confirmPickup(fix);
      setFollow(true);
      toast.success('¡Carga recogida!', 'Te llevamos ahora hacia la entrega.');
    } catch (e) {
      toast.error('No se pudo confirmar la recogida', friendlyError(e));
    } finally {
      setBusy(null);
    }
  }

  function report(key: string) {
    const incident = INCIDENTS.find((i) => i.key === key);
    const where = fix ?? stopPoint(target);
    if (!incident || !order) return;
    if (!where) {
      toast.warning('Ubicación requerida', 'No tenemos tu ubicación para reportar.');
      return;
    }
    setBusy('incident');
    incidentsApi
      .create({
        orderId: order.id,
        incidentType: incident.key,
        severity: incident.severity,
        title: incident.label,
        description: incident.description,
        latitude: where.latitude,
        longitude: where.longitude,
      })
      .then(() => toast.success('Incidencia enviada', 'Operaciones ya fue notificada.'))
      .catch((e) => toast.error('No se pudo reportar', friendlyError(e)))
      .finally(() => setBusy(null));
  }

  function openExternal(app: string) {
    const dest = stopPoint(target);
    if (!dest) {
      toast.warning('Sin coordenadas', 'Esa parada no tiene ubicación registrada.');
      return;
    }
    void Linking.openURL(app === 'waze' ? wazeNavigationUrl(dest) : googleMapsNavigationUrl(dest));
  }

  const initial = stopPoint(target) ?? fix ?? DEFAULT_REGION;
  const gpsStale = !lastFixAt || Date.now() - new Date(lastFixAt).getTime() > 60_000;

  return (
    <View style={styles.screen}>
      <KeepAwake />
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        customMapStyle={isDark ? darkMapStyle : lightMapStyle}
        initialRegion={{ ...initial, latitudeDelta: 0.04, longitudeDelta: 0.04 }}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
        showsTraffic={false}
        onPanDrag={() => follow && setFollow(false)}
        mapPadding={{ top: insets.top + 130, right: 0, bottom: expanded ? 360 : 260, left: 0 }}
      >
        {nav.path.length > 1 ? (
          <>
            <Polyline coordinates={nav.path} strokeColor={colors.white} strokeWidth={10} zIndex={1} />
            <Polyline
              coordinates={nav.path}
              strokeColor={legColor}
              strokeWidth={6}
              zIndex={2}
              lineDashPattern={nav.routed ? undefined : [12, 10]}
            />
          </>
        ) : null}

        {pickup && stopPoint(pickup) ? (
          <Marker coordinate={stopPoint(pickup)!} anchor={{ x: 0.5, y: 1 }} tracksViewChanges={tracksMarkers} zIndex={3}>
            <Pin color={colors.pickup} icon="cube" done={Boolean(pickup.completedAt || !toPickup)} />
          </Marker>
        ) : null}
        {dropoff && dropoff.id !== pickup?.id && stopPoint(dropoff) ? (
          <Marker coordinate={stopPoint(dropoff)!} anchor={{ x: 0.5, y: 1 }} tracksViewChanges={tracksMarkers} zIndex={3}>
            <Pin color={colors.delivery} icon="flag" />
          </Marker>
        ) : null}
        {fix ? (
          <Marker
            coordinate={fix}
            anchor={{ x: 0.5, y: 0.5 }}
            flat
            rotation={fix.heading ?? 0}
            tracksViewChanges={tracksMarkers}
            zIndex={5}
          >
            <View style={styles.vehicleHalo}>
              <View style={styles.vehicle}>
                <Ionicons name="navigate" size={18} color={colors.white} style={{ transform: [{ rotate: '-45deg' }] }} />
              </View>
            </View>
          </Marker>
        ) : null}
      </MapView>

      {/* Instruccion arriba: a donde, cuanto falta. */}
      <Animated.View
        entering={FadeInDown.springify().damping(16)}
        style={[styles.topCard, elevation.floating, { top: insets.top + spacing.sm }]}
      >
        <View style={[styles.topIcon, { backgroundColor: toPickup ? colors.warningSoft : colors.primarySoft }]}>
          <Ionicons name={toPickup ? 'cube-outline' : 'flag-outline'} size={22} color={toPickup ? colors.pickup : colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.topTitle} numberOfLines={1}>
            {phaseCopy[phase].title}
          </Text>
          <Text style={styles.topSub} numberOfLines={1}>
            {stopAddress(target)}
          </Text>
        </View>
        <View style={styles.eta}>
          <Text style={styles.etaValue}>{formatMinutes(nav.etaMinutes)}</Text>
          <Text style={styles.etaSub}>{formatMeters(nav.remainingMeters)}</Text>
        </View>
      </Animated.View>

      {!online || !isTracking || gpsStale ? (
        <Animated.View entering={FadeInDown} style={[styles.statusPill, { top: insets.top + 96 }]}>
          <Badge
            tone={!online ? 'danger' : 'warning'}
            icon={!online ? 'cloud-offline-outline' : 'locate-outline'}
            label={
              !online
                ? `Sin conexión${pendingCount ? ` · ${pendingCount} por enviar` : ''}`
                : !isTracking
                  ? 'GPS en pausa'
                  : 'Buscando señal GPS…'
            }
          />
        </Animated.View>
      ) : null}

      {/* Botones flotantes del mapa. */}
      <View style={[styles.fabs, { bottom: (expanded ? 370 : 270) + insets.bottom }]}>
        {!follow ? (
          <Animated.View entering={FadeInUp}>
            <Pressable
              onPress={() => {
                haptic.tap();
                setFollow(true);
              }}
              style={[styles.recenter, elevation.raised]}
              accessibilityLabel="Volver a seguirme"
            >
              <Ionicons name="locate" size={18} color={colors.white} />
              <Text style={styles.recenterText}>Recentrar</Text>
            </Pressable>
          </Animated.View>
        ) : null}
        <IconButton icon="scan-outline" accessibilityLabel="Ver ruta completa" onPress={fitAll} />
        <IconButton icon="arrow-redo-outline" tone="primary" accessibilityLabel="Abrir en Google Maps o Waze" onPress={() => setSheet('nav')} />
      </View>

      {/* Panel inferior: un solo paso claro a la vez. */}
      <Animated.View
        layout={LinearTransition.springify().damping(18)}
        style={[styles.panel, elevation.floating, { paddingBottom: spacing.lg }]}
      >
        <Pressable onPress={() => setExpanded((e) => !e)} hitSlop={10} style={styles.grabberZone} accessibilityLabel="Más detalles">
          <View style={styles.grabber} />
        </Pressable>

        <View style={styles.panelHead}>
          <View style={{ flex: 1 }}>
            <Text style={styles.orderCode}>{order.orderCode}</Text>
            <Muted>
              {target?.contactName ? `${target.contactName} · ` : ''}
              {toPickup ? 'Recogida' : 'Entrega'}
            </Muted>
          </View>
          {target?.contactPhone ? (
            <IconButton
              icon="call"
              tone="success"
              accessibilityLabel="Llamar al contacto"
              onPress={() => void Linking.openURL(`tel:${target.contactPhone}`)}
            />
          ) : null}
          <IconButton icon="warning-outline" tone="danger" accessibilityLabel="Reportar incidencia" onPress={() => setSheet('incident')} />
        </View>

        {expanded ? (
          <Animated.View entering={FadeInDown} style={{ gap: spacing.md }}>
            <StepIndicator steps={['Recogida', 'Entrega', 'Evidencia']} current={stepIndex} />
            {target?.instructions ? (
              <View style={styles.instructions}>
                <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.textMuted} />
                <Text style={styles.instructionsText}>{target.instructions}</Text>
              </View>
            ) : null}
            <Muted>
              {isTracking ? 'Compartiendo ubicación' : 'Ubicación en pausa'}
              {lastFixAt ? ` · última señal ${formatTime(lastFixAt)}` : ''}
            </Muted>
          </Animated.View>
        ) : null}

        {phase === 'TO_PICKUP' || phase === 'TO_DROPOFF' ? (
          <Button
            label={phase === 'TO_PICKUP' ? 'Llegué a la recogida' : 'Llegué a la entrega'}
            icon="location"
            variant={nav.nearTarget ? 'primary' : 'secondary'}
            loading={busy === 'arrive'}
            onPress={() => void onArrived()}
          />
        ) : null}
        {phase === 'AT_PICKUP' ? (
          <SwipeButton
            label="Desliza: carga recogida"
            tone="warning"
            icon="cube"
            loading={busy === 'pickup'}
            onConfirm={() => void onPickedUp()}
          />
        ) : null}
        {phase === 'AT_DROPOFF' ? (
          <Button
            label="Registrar evidencia y completar"
            icon="camera"
            variant="success"
            onPress={() => openEvidence(order.id)}
          />
        ) : null}
      </Animated.View>

      <ActionSheet
        visible={sheet === 'nav'}
        onClose={() => setSheet(null)}
        title="Abrir navegación por voz"
        subtitle={`Hacia ${toPickup ? 'la recogida' : 'la entrega'}: ${stopAddress(target)}`}
        options={[
          { key: 'google', label: 'Google Maps', icon: 'map-outline' },
          { key: 'waze', label: 'Waze', icon: 'car-outline' },
        ]}
        onSelect={openExternal}
      />
      <ActionSheet
        visible={sheet === 'incident'}
        onClose={() => setSheet(null)}
        title="Reportar incidencia"
        subtitle="Operaciones recibe el aviso al instante con tu ubicación."
        options={INCIDENTS.map((i) => ({
          key: i.key,
          label: i.label,
          description: i.description,
          icon: i.icon,
          tone: i.severity === 'HIGH' ? 'danger' : 'warning',
        }))}
        onSelect={report}
      />
    </View>
  );
}

function Pin({ color, icon, done }: { color: string; icon: React.ComponentProps<typeof Ionicons>['name']; done?: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={[styles.pin, { backgroundColor: done ? colors.textDim : color }]}>
        <Ionicons name={done ? 'checkmark' : icon} size={16} color={colors.white} />
      </View>
      <View style={[styles.pinTip, { borderTopColor: done ? colors.textDim : color }]} />
    </View>
  );
}

const useStyles = makeStyles(({ colors, typography, elevation }) =>
  StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  topCard: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  topIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  topSub: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  eta: { alignItems: 'flex-end' },
  etaValue: { fontSize: 20, fontWeight: '700', color: colors.success },
  etaSub: { fontSize: 12, color: colors.textMuted },
  statusPill: { position: 'absolute', alignSelf: 'center' },
  fabs: { position: 'absolute', right: spacing.lg, alignItems: 'flex-end', gap: spacing.sm },
  recenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
  },
  recenterText: { color: colors.white, fontWeight: '700', fontSize: 14 },
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  grabberZone: { alignItems: 'center', paddingTop: spacing.sm },
  grabber: { width: 40, height: 5, borderRadius: 3, backgroundColor: colors.borderStrong },
  panelHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  orderCode: { fontSize: 18, fontWeight: '700', color: colors.text },
  instructions: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  instructionsText: { flex: 1, fontSize: 14, color: colors.textMuted },
  vehicleHalo: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(37, 99, 235, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pin: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 3,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinTip: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -2,
  },
}),
);
