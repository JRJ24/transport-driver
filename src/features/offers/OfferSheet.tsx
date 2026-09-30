import React, { useEffect, useMemo, useState } from 'react';
import { Alert, AppState, Modal, StyleSheet, Text, View } from 'react-native';
import { offersApi, type DriverOffer } from '@/api/offers.api';
import { Button, Eyebrow, Muted } from '@/components/ui';
import { navigationRef } from '@/navigation/ref';
import { useOffers } from '@/store/offers.store';
import { useOrders } from '@/store/order.store';
import { colors, radius, spacing, typography } from '@/theme/theme';

function secondsLeft(offer: DriverOffer, now: number): number {
  return offer.expiresAt
    ? Math.max(0, Math.ceil((new Date(offer.expiresAt).getTime() - now) / 1000))
    : 0;
}

function stop(offer: DriverOffer, type: 'PICKUP' | 'DROPOFF') {
  const stops = [...(offer.order?.orderStops ?? [])].sort(
    (a, b) => a.sequence - b.sequence,
  );
  return type === 'PICKUP'
    ? stops.find((s) => s.stopType === 'PICKUP')
    : [...stops].reverse().find((s) => s.stopType === 'DROPOFF');
}

function money(value?: number | string | null): string {
  const amount = Number(value);
  return Number.isFinite(amount) ? `RD$ ${amount.toFixed(2)}` : '—';
}

/**
 * Automatic trip offer. Shows over any screen when dispatch picks this driver,
 * with a countdown until it expires and moves to the next driver.
 */
export function OfferSheet() {
  const loadAssignments = useOrders((s) => s.loadAssignments);
  const offers = useOffers((s) => s.offers);
  const refreshOffers = useOffers((s) => s.refresh);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const refresh = () => void refreshOffers();

  // Socket events are wired in App.tsx once the socket exists; here we also
  // re-read on resume, so an offer made while backgrounded is not missed.
  useEffect(() => {
    void refreshOffers();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void refreshOffers();
      }
    });
    return () => sub.remove();
  }, [refreshOffers]);

  const offer = useMemo(
    () =>
      offers.find((o) => o.status === 'PENDING' && secondsLeft(o, now) > 0),
    [offers, now],
  );

  useEffect(() => {
    if (!offer) {
      return;
    }
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [offer]);

  if (!offer) {
    return null;
  }

  async function accept(target: DriverOffer) {
    setBusy(true);
    try {
      await offersApi.accept(target.id);
      await loadAssignments();
      if (navigationRef.isReady()) {
        navigationRef.navigate('Main', {
          screen: 'Inicio',
          params: { screen: 'OrderDetail', params: { orderId: target.orderId } },
        } as never);
      }
    } catch {
      Alert.alert('No se pudo aceptar', 'La oferta venció o ya fue asignada.');
    } finally {
      setBusy(false);
      refresh();
    }
  }

  async function reject(target: DriverOffer) {
    setBusy(true);
    try {
      await offersApi.reject(target.id);
    } catch {
      // Already expired or answered: the refresh below clears it.
    } finally {
      setBusy(false);
      refresh();
    }
  }

  const left = secondsLeft(offer, now);
  const total = offer.expiresAt
    ? Math.max(
        1,
        (new Date(offer.expiresAt).getTime() -
          new Date(offer.createdAt).getTime()) /
          1000,
      )
    : 30;
  const pickup = stop(offer, 'PICKUP');
  const dropoff = stop(offer, 'DROPOFF');

  return (
    <Modal transparent animationType="slide" visible onRequestClose={() => undefined}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.countdown}>
            <View
              style={[
                styles.countdownBar,
                { width: `${Math.min(100, (left / total) * 100)}%` },
              ]}
            />
            <Text style={styles.countdownText}>{left} s</Text>
          </View>

          <Eyebrow>Nueva oferta de viaje</Eyebrow>
          <Text style={styles.title}>{offer.order?.orderCode ?? 'Orden'}</Text>

          <View style={styles.facts}>
            <Fact
              label="Llegas en"
              value={
                offer.etaSeconds != null
                  ? `${Math.max(1, Math.round(offer.etaSeconds / 60))} min`
                  : '—'
              }
            />
            <Fact
              label="Recorrido"
              value={
                offer.order?.distanceKm != null
                  ? `${Number(offer.order.distanceKm).toFixed(1)} km`
                  : '—'
              }
            />
            <Fact label="Tarifa" value={money(offer.order?.totalAmount)} />
          </View>

          <Stop color={colors.pickup} label="Recogida" line={pickup?.addressLine} />
          <Stop color={colors.delivery} label="Entrega" line={dropoff?.addressLine} />

          <View style={styles.actions}>
            <Button
              label="Rechazar"
              tone="danger"
              disabled={busy}
              onPress={() => void reject(offer)}
              style={styles.reject}
            />
            <Button
              label="Aceptar viaje"
              tone="success"
              loading={busy}
              onPress={() => void accept(offer)}
              style={styles.accept}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Muted>{label}</Muted>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

function Stop({
  color,
  label,
  line,
}: {
  color: string;
  label: string;
  line?: string;
}) {
  return (
    <View style={styles.stop}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <View style={{ flex: 1 }}>
        <Muted>{label}</Muted>
        <Text style={styles.stopLine}>{line ?? 'Sin dirección'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(3, 8, 18, 0.72)',
  },
  sheet: {
    gap: spacing.md,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
    borderWidth: 1,
  },
  countdown: {
    height: 34,
    borderRadius: radius.pill,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countdownBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.primary,
  },
  countdownText: { color: colors.text, fontWeight: '800' },
  title: { ...typography.heading, color: colors.text },
  facts: { flexDirection: 'row', gap: spacing.sm },
  fact: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  factValue: { color: colors.text, fontWeight: '800', marginTop: 4 },
  stop: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  dot: { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
  stopLine: { color: colors.text, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  reject: { flex: 1 },
  accept: { flex: 2 },
});
