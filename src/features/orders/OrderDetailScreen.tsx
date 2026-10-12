import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Button, Card, EmptyState, ErrorBanner, KeyValue, Muted, Overline, Skeleton } from '@/components/ui';
import { StopTimeline } from '@/components/StopTimeline';
import { SwipeButton } from '@/components/SwipeButton';
import { ActionSheet, ConfirmSheet } from '@/components/Sheet';
import { assignmentBadge } from '@/components/OrderCard';
import { colors, elevation, radius, spacing, typography } from '@/theme/theme';
import { ordersApi } from '@/api/orders.api';
import { driversApi } from '@/api/drivers.api';
import { useOrders } from '@/store/order.store';
import { useTrip } from '@/store/trip.store';
import { toast } from '@/store/toast.store';
import { goToRouteTab } from '@/navigation/ref';
import type { InicioStackParamList } from '@/navigation/types';
import type { OrderStop, TransportOrder } from '@/types/api';
import { friendlyError } from '@/utils/errors';
import { formatDate, formatKm, formatMinutes, formatMoney, formatRelativeDay } from '@/utils/format';
import { googleMapsNavigationUrl, wazeNavigationUrl } from '@/utils/navigation';
import { stopPoint } from '@/utils/geo';
import { sortedStops } from '@/utils/orders';
import { useStartTrip } from './useStartTrip';

/** Detalle de UNA orden. Verla no la convierte en el servicio activo. */
function useOrderDetail(orderId: string) {
  const [order, setOrder] = useState<TransportOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const next = await ordersApi.detail(orderId);
      setOrder(next);
      setError(next ? null : 'Esta orden ya no existe.');
    } catch (e) {
      setError(friendlyError(e, 'No pudimos cargar la orden.'));
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    setOrder(null);
    void load();
  }, [load]);

  return { order, loading, error, reload: load };
}

export function OrderDetailScreen() {
  const route = useRoute<RouteProp<InicioStackParamList, 'OrderDetail'>>();
  const navigation = useNavigation();
  const { orderId } = route.params;
  const { order, loading, error, reload } = useOrderDetail(orderId);

  const assignment = useOrders((s) =>
    s.assignments
      .filter((a) => a.orderId === orderId)
      .sort((a, b) => new Date(b.assignedAt).getTime() - new Date(a.assignedAt).getTime())[0],
  );
  const accept = useOrders((s) => s.accept);
  const loadAssignments = useOrders((s) => s.loadAssignments);
  const trip = useTrip((s) => s.order);
  const { startTrip, busy: starting } = useStartTrip();
  const [busy, setBusy] = useState(false);
  const [navStop, setNavStop] = useState<OrderStop | null>(null);
  const [confirmReject, setConfirmReject] = useState(false);

  const stops = useMemo(() => sortedStops(order), [order]);
  const items = order?.orderItems ?? [];
  // Los datos de la lista sirven mientras llega el detalle completo.
  const shown = order ?? assignment?.order ?? null;

  async function onAccept() {
    setBusy(true);
    try {
      await accept(orderId);
      await reload();
      toast.success('Orden aceptada', 'Cuando estés listo, desliza para iniciar el servicio.');
    } catch (e) {
      toast.error('No se pudo aceptar', friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  async function onReject() {
    if (!assignment) return;
    setBusy(true);
    try {
      await driversApi.rejectAssignment(assignment.id);
      await loadAssignments();
      toast.info('Orden rechazada', 'Volvió al despacho para otro conductor.');
      navigation.goBack();
    } catch (e) {
      toast.error('No se pudo rechazar', friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  function openNav(stop: OrderStop, app: string) {
    const dest = stopPoint(stop);
    if (!dest) {
      toast.warning('Sin coordenadas', 'Esa parada no tiene ubicación registrada.');
      return;
    }
    void Linking.openURL(app === 'waze' ? wazeNavigationUrl(dest) : googleMapsNavigationUrl(dest));
  }

  if (!shown && loading) {
    return (
      <View style={[styles.screen, styles.content]}>
        <Skeleton height={28} width="50%" />
        <Skeleton height={140} />
        <Skeleton height={90} />
      </View>
    );
  }

  if (!shown) {
    return (
      <View style={styles.screen}>
        <EmptyState
          icon="alert-circle-outline"
          title="No pudimos abrir la orden"
          message={error ?? undefined}
          action={<Button label="Reintentar" variant="secondary" size="md" onPress={() => void reload()} />}
        />
      </View>
    );
  }

  const isTrip = trip?.id === orderId;
  const otherTrip = trip && !isTrip ? trip : null;
  const status = shown.status;
  const badge = assignment
    ? assignmentBadge({ ...assignment, order: { ...shown, ...(assignment.order ?? {}), status } })
    : { label: 'Orden', tone: 'neutral' as const };
  const canStart =
    assignment?.assignmentStatus === 'ACCEPTED' && (status === 'ACCEPTED' || status === 'ASSIGNED');
  const canResume = assignment?.assignmentStatus === 'ACCEPTED' && status === 'IN_PROGRESS' && !isTrip;

  let footer: React.ReactNode = null;
  if (isTrip) {
    footer = <Button label="Ir a la ruta" icon="navigate" onPress={goToRouteTab} />;
  } else if (assignment?.assignmentStatus === 'PENDING') {
    footer = (
      <View style={styles.footerRow}>
        <Button label="Rechazar" variant="secondary" onPress={() => setConfirmReject(true)} disabled={busy} style={{ flex: 1 }} />
        <Button label="Aceptar orden" variant="success" icon="checkmark" loading={busy} onPress={() => void onAccept()} style={{ flex: 2 }} />
      </View>
    );
  } else if ((canStart || canResume) && otherTrip) {
    footer = (
      <View style={styles.blocked}>
        <View style={styles.blockedRow}>
          <Ionicons name="lock-closed" size={18} color={colors.warningText} />
          <Text style={styles.blockedText}>
            Ya tienes un servicio en curso ({otherTrip.orderCode}). Termínalo para iniciar este.
          </Text>
        </View>
        <Button label="Ver servicio en curso" variant="secondary" size="md" icon="navigate-outline" onPress={goToRouteTab} />
      </View>
    );
  } else if (canStart) {
    footer = (
      <SwipeButton label="Desliza para iniciar" loading={starting} onConfirm={() => void startTrip(orderId)} />
    );
  } else if (canResume) {
    footer = (
      <SwipeButton label="Desliza para retomar" loading={starting} onConfirm={() => void startTrip(orderId)} />
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => void reload()} tintColor={colors.primary} />}
      >
        <View style={styles.header}>
          <Badge label={badge.label} tone={badge.tone} pulse={badge.pulse} />
          <Text style={styles.code} selectable>
            {shown.orderCode}
          </Text>
          {shown.scheduleAt ? <Muted>Programada · {formatRelativeDay(shown.scheduleAt)}</Muted> : null}
        </View>

        {error ? <ErrorBanner message={error} onRetry={() => void reload()} /> : null}

        <View style={styles.metrics}>
          <Metric icon="speedometer-outline" value={formatKm(shown.distanceKm)} label="Distancia" />
          <Metric icon="time-outline" value={formatMinutes(shown.estimatedDurationMin)} label="Estimado" />
          <Metric icon="cash-outline" value={formatMoney(shown.totalAmount)} label="Tarifa" />
        </View>

        <Card>
          <Overline>Recorrido</Overline>
          {stops.length ? (
            <StopTimeline stops={stops} onNavigate={(s) => setNavStop(s)} />
          ) : (
            <Muted>Sin paradas registradas.</Muted>
          )}
        </Card>

        {items.length > 0 ? (
          <Card>
            <Overline>Carga</Overline>
            {items.map((it) => (
              <View key={it.id} style={styles.item}>
                <View style={styles.qty}>
                  <Text style={styles.qtyText}>{it.quantity}×</Text>
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.itemTitle}>{it.description}</Text>
                  <View style={styles.itemTags}>
                    <Muted>{Number(it.weightKg)} kg</Muted>
                    {it.fragile ? <Badge label="Frágil" tone="danger" icon="warning-outline" /> : null}
                    {it.requireHelper ? <Badge label="Requiere ayudante" tone="info" icon="people-outline" /> : null}
                  </View>
                </View>
              </View>
            ))}
          </Card>
        ) : null}

        {shown.notes ? (
          <Card>
            <Overline>Notas</Overline>
            <Text style={typography.body}>{shown.notes}</Text>
          </Card>
        ) : null}

        {status === 'DELIVERED' ? (
          <Card>
            <KeyValue label="Recogida" value={formatDate(shown.pickupAt)} />
            <KeyValue label="Entregada" value={formatRelativeDay(shown.deliveredAt)} />
          </Card>
        ) : null}
      </ScrollView>

      {footer ? <View style={[styles.footer, elevation.floating]}>{footer}</View> : null}

      <ActionSheet
        visible={Boolean(navStop)}
        onClose={() => setNavStop(null)}
        title="Cómo llegar"
        subtitle={navStop?.addressLine}
        options={[
          { key: 'google', label: 'Google Maps', icon: 'map-outline' },
          { key: 'waze', label: 'Waze', icon: 'car-outline' },
        ]}
        onSelect={(key) => navStop && openNav(navStop, key)}
      />
      <ConfirmSheet
        visible={confirmReject}
        onClose={() => setConfirmReject(false)}
        onConfirm={() => void onReject()}
        title="¿Rechazar esta orden?"
        message="La orden volverá al despacho y se ofrecerá a otro conductor."
        confirmLabel="Sí, rechazar"
        danger
        icon="close-circle-outline"
      />
    </SafeAreaView>
  );
}

function Metric({ icon, value, label }: { icon: React.ComponentProps<typeof Ionicons>['name']; value: string; label: string }) {
  return (
    <View style={[styles.metric, elevation.card]}>
      <Ionicons name={icon} size={18} color={colors.primary} />
      <Text style={styles.metricValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: 140 },
  header: { gap: spacing.sm },
  code: { ...typography.display },
  metrics: { flexDirection: 'row', gap: spacing.sm },
  metric: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 4,
  },
  metricValue: { fontSize: 16, fontWeight: '700', color: colors.text },
  metricLabel: { fontSize: 12, color: colors.textDim },
  item: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  qty: {
    minWidth: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: { fontWeight: '700', color: colors.text },
  itemTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  itemTags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  footerRow: { flexDirection: 'row', gap: spacing.sm },
  blocked: { gap: spacing.md },
  blockedRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.warningSoft,
  },
  blockedText: { flex: 1, color: colors.warningText, fontSize: 14, fontWeight: '500' },
});
