import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, AppState, Easing, Modal, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { offersApi, type DriverOffer } from '@/api/offers.api';
import { Button, Muted, Overline } from '@/components/ui';
import { StopTimeline } from '@/components/StopTimeline';
import { navigationRef } from '@/navigation/ref';
import { useOffers } from '@/store/offers.store';
import { useOrders } from '@/store/order.store';
import { toast } from '@/store/toast.store';
import { radius, spacing } from '@/theme/theme';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { haptic } from '@/utils/feedback';
import { formatKm, formatMinutes, formatMoney } from '@/utils/format';
import { sortedStops } from '@/utils/orders';

function secondsLeft(offer: DriverOffer, now: number): number {
  return offer.expiresAt
    ? Math.max(0, Math.ceil((new Date(offer.expiresAt).getTime() - now) / 1000))
    : 0;
}

/**
 * Oferta automatica de viaje. Aparece sobre cualquier pantalla con vibracion
 * y una barra que se vacia hasta que la oferta pasa al siguiente conductor.
 */
export function OfferSheet() {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const loadAssignments = useOrders((s) => s.loadAssignments);
  const offers = useOffers((s) => s.offers);
  const refreshOffers = useOffers((s) => s.refresh);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState<'accept' | 'reject' | null>(null);
  const progress = useRef(new Animated.Value(1)).current;
  const announced = useRef<string | null>(null);

  useEffect(() => {
    void refreshOffers();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshOffers();
    });
    return () => sub.remove();
  }, [refreshOffers]);

  const offer = useMemo(
    () => offers.find((o) => o.status === 'PENDING' && secondsLeft(o, now) > 0),
    [offers, now],
  );

  useEffect(() => {
    if (!offer) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [offer]);

  // Barra continua (no a saltos) y vibracion al llegar la oferta.
  useEffect(() => {
    if (!offer?.expiresAt) return;
    if (announced.current !== offer.id) {
      announced.current = offer.id;
      haptic.warning();
    }
    const total = Math.max(1, new Date(offer.expiresAt).getTime() - new Date(offer.createdAt).getTime());
    const left = Math.max(0, new Date(offer.expiresAt).getTime() - Date.now());
    progress.setValue(left / total);
    Animated.timing(progress, { toValue: 0, duration: left, easing: Easing.linear, useNativeDriver: false }).start();
  }, [offer?.id, offer?.expiresAt, offer?.createdAt, progress]);

  if (!offer) return null;

  async function accept(target: DriverOffer) {
    setBusy('accept');
    try {
      await offersApi.accept(target.id);
      await loadAssignments();
      toast.success('¡Viaje aceptado!', 'Revisa el detalle y desliza para iniciar cuando estés listo.');
      if (navigationRef.isReady()) {
        navigationRef.navigate('Main', {
          screen: 'Inicio',
          params: { screen: 'OrderDetail', params: { orderId: target.orderId } },
        } as never);
      }
    } catch {
      toast.error('No se pudo aceptar', 'La oferta venció o ya fue asignada.');
    } finally {
      setBusy(null);
      void refreshOffers();
    }
  }

  async function reject(target: DriverOffer) {
    setBusy('reject');
    try {
      await offersApi.reject(target.id);
    } catch {
      // Ya vencio o fue respondida: el refresh la quita.
    } finally {
      setBusy(null);
      void refreshOffers();
    }
  }

  const left = secondsLeft(offer, now);
  const urgent = left <= 10;
  const stops = sortedStops(offer.order);

  return (
    <Modal transparent animationType="slide" visible onRequestClose={() => undefined} statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={styles.head}>
            <View style={styles.bell}>
              <Ionicons name="flash" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Overline>Nueva oferta de viaje</Overline>
              <Text style={typography.title} numberOfLines={1}>
                {formatMoney(offer.order?.totalAmount)}
              </Text>
            </View>
            <View style={[styles.timer, urgent && { backgroundColor: colors.dangerSoft }]}>
              <Text style={[styles.timerText, urgent && { color: colors.dangerText }]}>{left}s</Text>
            </View>
          </View>

          <View style={styles.track}>
            <Animated.View
              style={[
                styles.bar,
                {
                  backgroundColor: urgent ? colors.danger : colors.primary,
                  width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                },
              ]}
            />
          </View>

          <View style={styles.facts}>
            <Fact icon="time-outline" label="Llegas en" value={offer.etaSeconds != null ? formatMinutes(offer.etaSeconds / 60) : '—'} />
            <Fact icon="speedometer-outline" label="Recorrido" value={formatKm(offer.order?.distanceKm)} />
            <Fact icon="pricetag-outline" label="Orden" value={offer.order?.orderCode ?? '—'} />
          </View>

          {stops.length ? <StopTimeline stops={stops} compact /> : <Muted>Sin paradas.</Muted>}

          <View style={styles.actions}>
            <Button
              label="Rechazar"
              variant="secondary"
              loading={busy === 'reject'}
              disabled={busy !== null}
              onPress={() => void reject(offer)}
              style={{ flex: 1 }}
            />
            <Button
              label="Aceptar viaje"
              variant="success"
              icon="checkmark"
              loading={busy === 'accept'}
              disabled={busy !== null}
              onPress={() => void accept(offer)}
              style={{ flex: 2 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Fact({ icon, label, value }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; value: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.fact}>
      <Ionicons name={icon} size={16} color={colors.textDim} />
      <Text style={styles.factValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.factLabel}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles(({ colors, typography, elevation }) =>
  StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  sheet: {
    gap: spacing.lg,
    padding: spacing.xl,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    backgroundColor: colors.surface,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  bell: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timer: {
    minWidth: 56,
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 12,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerText: { fontSize: 17, fontWeight: '700', color: colors.primaryText },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceMuted, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: 3 },
  facts: { flexDirection: 'row', gap: spacing.sm },
  fact: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    gap: 2,
  },
  factValue: { color: colors.text, fontWeight: '700', fontSize: 15, marginTop: 2 },
  factLabel: { color: colors.textDim, fontSize: 12 },
  actions: { flexDirection: 'row', gap: spacing.sm },
}),
);
