import React, { useMemo, useRef } from 'react';
import { PanResponder, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { radius } from '@/theme/theme';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import type { Point, Stroke } from '@/store/evidence.store';

export function strokesToPath(strokes: Stroke[]): string[] {
  return strokes
    .filter((s) => s.length > 0)
    .map((s) => {
      if (s.length === 1) {
        const p = s[0];
        return `M ${p.x.toFixed(1)} ${p.y.toFixed(1)} l 0.1 0.1`;
      }
      const [first, ...rest] = s;
      return `M ${first.x.toFixed(1)} ${first.y.toFixed(1)} ${rest.map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')}`;
    });
}

export function buildSignatureSvg(strokes: Stroke[], size: { width: number; height: number }): string {
  const w = Math.round(size.width);
  const h = Math.round(size.height);
  const paths = strokesToPath(strokes)
    .map(
      (d) =>
        `<path d="${d}" fill="none" stroke="#0f172a" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`,
    )
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="100%" height="100%" fill="#ffffff"/>${paths}</svg>`;
}

/**
 * Firma con trazo vectorial. No vive dentro de un ScrollView y no cede el
 * gesto: antes el scroll se robaba los trazos verticales.
 */
export function SignaturePad({
  strokes,
  onChange,
  onSize,
  height = 220,
}: {
  strokes: Stroke[];
  onChange: (next: Stroke[]) => void;
  onSize: (size: { width: number; height: number }) => void;
  height?: number;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const size = useRef({ width: 320, height });
  const live = useRef<Stroke[]>(strokes);
  live.current = strokes;

  const clamp = (x: number, y: number): Point => ({
    x: Math.max(0, Math.min(size.current.width, x)),
    y: Math.max(0, Math.min(size.current.height, y)),
  });

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: (e) => {
          onChange([...live.current, [clamp(e.nativeEvent.locationX, e.nativeEvent.locationY)]]);
        },
        onPanResponderMove: (e) => {
          const current = live.current;
          if (!current.length) return;
          const next = current.slice();
          next[next.length - 1] = [...next[next.length - 1], clamp(e.nativeEvent.locationX, e.nativeEvent.locationY)];
          onChange(next);
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onChange],
  );

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height: h } = e.nativeEvent.layout;
    size.current = { width, height: h };
    onSize({ width, height: h });
  };

  return (
    <View style={[styles.pad, { height }]} onLayout={onLayout} {...responder.panHandlers}>
      <View pointerEvents="none" style={styles.baseline} />
      <Svg width="100%" height="100%" pointerEvents="none">
        {strokesToPath(strokes).map((d, i) => (
          <Path key={i} d={d} stroke={colors.ink} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        ))}
      </Svg>
    </View>
  );
}

const useStyles = makeStyles(({ colors, typography, elevation }) =>
  StyleSheet.create({
  pad: {
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderStyle: 'dashed',
    backgroundColor: colors.white,
    overflow: 'hidden',
  },
  baseline: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 44,
    height: 1,
    backgroundColor: colors.border,
  },
}),
);
