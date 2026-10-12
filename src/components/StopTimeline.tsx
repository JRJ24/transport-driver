import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '@/theme/theme';
import type { OrderStop } from '@/types/api';
import { stopTypeLabels } from '@/constants/status.constants';
import { haptic } from '@/utils/feedback';

function stopColor(stop: OrderStop): string {
  return stop.stopType === 'PICKUP'
    ? colors.pickup
    : stop.stopType === 'DROPOFF'
      ? colors.delivery
      : colors.textDim;
}

/**
 * Recogida → entrega en vertical, con la linea que las une. `compact` es para
 * las tarjetas de la lista; el detalle muestra contacto e instrucciones.
 */
export function StopTimeline({
  stops,
  compact,
  onNavigate,
}: {
  stops: OrderStop[];
  compact?: boolean;
  onNavigate?: (stop: OrderStop) => void;
}) {
  return (
    <View>
      {stops.map((stop, i) => {
        const last = i === stops.length - 1;
        const done = Boolean(stop.completedAt);
        const color = stopColor(stop);
        return (
          <View key={stop.id} style={styles.row}>
            <View style={styles.rail}>
              <View style={[styles.node, { borderColor: color, backgroundColor: done ? color : colors.surface }]}>
                {done ? <Ionicons name="checkmark" size={10} color={colors.white} /> : null}
              </View>
              {!last ? <View style={styles.line} /> : null}
            </View>
            <View style={[styles.body, !last && { paddingBottom: compact ? spacing.sm : spacing.lg }]}>
              <Text style={[styles.type, { color }]}>{stopTypeLabels[stop.stopType]}</Text>
              <Text style={styles.address} numberOfLines={compact ? 1 : 3}>
                {stop.addressLine}
              </Text>
              {!compact ? (
                <>
                  <Text style={styles.meta} numberOfLines={1}>
                    {[stop.city, stop.province].filter(Boolean).join(', ')}
                  </Text>
                  {stop.instructions ? (
                    <View style={styles.note}>
                      <Ionicons name="chatbubble-ellipses-outline" size={14} color={colors.textMuted} />
                      <Text style={styles.noteText}>{stop.instructions}</Text>
                    </View>
                  ) : null}
                  <View style={styles.actions}>
                    {stop.contactPhone ? (
                      <Chip
                        icon="call-outline"
                        label={stop.contactName || 'Llamar'}
                        onPress={() => void Linking.openURL(`tel:${stop.contactPhone}`)}
                      />
                    ) : null}
                    {onNavigate ? (
                      <Chip icon="navigate-outline" label="Cómo llegar" onPress={() => onNavigate(stop)} />
                    ) : null}
                  </View>
                </>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function Chip({ icon, label, onPress }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      style={({ pressed }) => [styles.chip, pressed && { opacity: 0.7 }]}
    >
      <Ionicons name={icon} size={15} color={colors.primaryText} />
      <Text style={styles.chipText} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md },
  rail: { width: 16, alignItems: 'center' },
  node: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  line: { flex: 1, width: 2, backgroundColor: colors.border, marginVertical: 2 },
  body: { flex: 1, gap: 2 },
  type: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  address: { fontSize: 15, fontWeight: '600', color: colors.text },
  meta: { fontSize: 13, color: colors.textMuted },
  note: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
    padding: spacing.sm,
    borderRadius: 10,
    backgroundColor: colors.surfaceAlt,
  },
  noteText: { flex: 1, fontSize: 13, color: colors.textMuted },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
    maxWidth: '100%',
  },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.primaryText, flexShrink: 1 },
});
