import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { colors, elevation, radius } from '@/theme/theme';
import { haptic } from '@/utils/feedback';

export interface Segment<K extends string> {
  key: K;
  label: string;
  count?: number;
}

/** Pestañas con indicador deslizante y contador por grupo. */
export function SegmentedControl<K extends string>({
  segments,
  value,
  onChange,
}: {
  segments: Segment<K>[];
  value: K;
  onChange: (key: K) => void;
}) {
  const [width, setWidth] = useState(0);
  const index = Math.max(0, segments.findIndex((s) => s.key === value));
  const segWidth = width / Math.max(1, segments.length);
  const x = useSharedValue(0);

  useEffect(() => {
    x.value = withSpring(index * segWidth, { damping: 20, stiffness: 220 });
  }, [index, segWidth, x]);

  const indicator = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View style={styles.track} onLayout={(e) => setWidth(e.nativeEvent.layout.width - 8)} accessibilityRole="tablist">
      {width > 0 ? (
        <Animated.View style={[styles.indicator, elevation.card, { width: segWidth }, indicator]} />
      ) : null}
      {segments.map((s) => {
        const active = s.key === value;
        return (
          <Pressable
            key={s.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => {
              if (!active) haptic.tap();
              onChange(s.key);
            }}
            style={styles.segment}
          >
            <Text numberOfLines={1} style={[styles.label, active && styles.labelActive]}>
              {s.label}
            </Text>
            {s.count != null ? (
              <View style={[styles.count, active && styles.countActive]}>
                <Text style={[styles.countText, active && styles.countTextActive]}>{s.count}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: 4,
  },
  indicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
  },
  segment: {
    flex: 1,
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 4,
  },
  label: { fontSize: 14, fontWeight: '600', color: colors.textMuted, flexShrink: 1 },
  labelActive: { color: colors.text },
  count: {
    minWidth: 22,
    paddingHorizontal: 6,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countActive: { backgroundColor: colors.primary },
  countText: { fontSize: 11, fontWeight: '700', color: colors.textMuted },
  countTextActive: { color: colors.white },
});
