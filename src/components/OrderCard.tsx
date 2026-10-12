import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, elevation, radius, spacing } from '@/theme/theme';
import type { Assignment } from '@/types/api';
import { useTrip, useTripPhase } from '@/store/trip.store';
import { bucketOf, phaseCopy, sortedStops } from '@/utils/orders';
import { formatKm, formatMinutes, formatMoney, formatRelativeDay } from '@/utils/format';
import { haptic } from '@/utils/feedback';
import { goToRouteTab } from '@/navigation/ref';
import { Badge, Card, PulseDot, type Tone } from './ui';
import { StopTimeline } from './StopTimeline';

export function assignmentBadge(a: Assignment): { label: string; tone: Tone; pulse?: boolean } {
  const bucket = bucketOf(a);
  if (bucket === 'delivered') return { label: 'Entregada', tone: 'success' };
  if (bucket === 'inRoute') return { label: 'En ruta', tone: 'primary', pulse: true };
  if (a.assignmentStatus === 'PENDING') return { label: 'Por aceptar', tone: 'warning' };
  return { label: 'Lista para iniciar', tone: 'info' };
}

export function OrderCard({ assignment, onPress }: { assignment: Assignment; onPress: () => void }) {
  const order = assignment.order;
  const badge = assignmentBadge(assignment);
  const stops = sortedStops(order);
  const delivered = badge.tone === 'success';
  return (
    <Card onPress={onPress} accessibilityLabel={`Orden ${order?.orderCode ?? ''}`}>
      <View style={styles.top}>
        <Badge label={badge.label} tone={badge.tone} pulse={badge.pulse} />
        <Text style={styles.code} numberOfLines={1}>
          {order?.orderCode ?? 'Orden'}
        </Text>
      </View>
      {stops.length ? <StopTimeline stops={stops} compact /> : null}
      <View style={styles.meta}>
        {delivered ? (
          <Meta icon="checkmark-done-outline" text={formatRelativeDay(order?.deliveredAt)} />
        ) : (
          <>
            <Meta icon="time-outline" text={formatMinutes(order?.estimatedDurationMin)} />
            <Meta icon="speedometer-outline" text={formatKm(order?.distanceKm)} />
          </>
        )}
        <Text style={styles.amount}>{formatMoney(order?.totalAmount)}</Text>
      </View>
    </Card>
  );
}

function Meta({ icon, text }: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string }) {
  return (
    <View style={styles.metaItem}>
      <Ionicons name={icon} size={14} color={colors.textDim} />
      <Text style={styles.metaText}>{text}</Text>
    </View>
  );
}

/**
 * Barra fija «Servicio en curso» en Inicio y Perfil: el conductor siempre
 * sabe que tiene un viaje vivo y llega a la ruta con un toque.
 */
export function ActiveTripBanner() {
  const order = useTrip((s) => s.order);
  const phase = useTripPhase();
  if (!order || !phase) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Ir al servicio en curso"
      onPress={() => {
        haptic.tap();
        goToRouteTab();
      }}
      style={({ pressed }) => [styles.banner, elevation.raised, pressed && { opacity: 0.9 }]}
    >
      <PulseDot color={colors.white} active size={8} />
      <View style={{ flex: 1 }}>
        <Text style={styles.bannerTitle} numberOfLines={1}>
          Servicio en curso · {order.orderCode}
        </Text>
        <Text style={styles.bannerSub} numberOfLines={1}>
          {phaseCopy[phase].title}
        </Text>
      </View>
      <View style={styles.bannerCta}>
        <Text style={styles.bannerCtaText}>Ver ruta</Text>
        <Ionicons name="arrow-forward" size={16} color={colors.primary} />
      </View>
    </Pressable>
  );
}

/** Pasos del servicio: Recogida → Entrega → Evidencia. */
export function StepIndicator({ steps, current }: { steps: string[]; current: number }) {
  return (
    <View style={styles.steps}>
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <React.Fragment key={label}>
            <View style={styles.step}>
              <View
                style={[
                  styles.stepDot,
                  done && { backgroundColor: colors.success, borderColor: colors.success },
                  active && { borderColor: colors.primary, backgroundColor: colors.primary },
                ]}
              >
                {done ? (
                  <Ionicons name="checkmark" size={12} color={colors.white} />
                ) : (
                  <Text style={[styles.stepNum, active && { color: colors.white }]}>{i + 1}</Text>
                )}
              </View>
              <Text
                numberOfLines={1}
                style={[styles.stepLabel, (active || done) && { color: colors.text, fontWeight: '600' }]}
              >
                {label}
              </Text>
            </View>
            {i < steps.length - 1 ? (
              <View style={[styles.stepLine, done && { backgroundColor: colors.success }]} />
            ) : null}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  code: { fontSize: 13, fontWeight: '600', color: colors.textDim, flexShrink: 1 },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 13, color: colors.textMuted },
  amount: { marginLeft: 'auto', fontSize: 15, fontWeight: '700', color: colors.text },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    paddingLeft: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
  },
  bannerTitle: { color: colors.white, fontSize: 15, fontWeight: '700' },
  bannerSub: { color: '#DBE6FD', fontSize: 13, marginTop: 1 },
  bannerCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  bannerCtaText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  steps: { flexDirection: 'row', alignItems: 'center' },
  step: { alignItems: 'center', gap: 4, width: 76 },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNum: { fontSize: 12, fontWeight: '700', color: colors.textDim },
  stepLabel: { fontSize: 12, color: colors.textDim },
  stepLine: { flex: 1, height: 2, backgroundColor: colors.border, marginBottom: 18 },
});
