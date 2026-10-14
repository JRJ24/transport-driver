import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  Extrapolation,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { radius } from '@/theme/theme';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { haptic } from '@/utils/feedback';
import type { IconName } from './ui';

const KNOB = 56;
const PAD = 4;

type SwipeTone = 'primary' | 'success' | 'warning';


/**
 * «Desliza para…»: confirma acciones importantes con un gesto deliberado,
 * imposible de disparar por accidente con el telefono en el soporte.
 */
export function SwipeButton({
  label,
  onConfirm,
  tone = 'primary',
  icon = 'arrow-forward',
  loading,
  disabled,
}: {
  label: string;
  onConfirm: () => void;
  tone?: SwipeTone;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
}) {
  const styles = useStyles();
  const { colors, elevation } = useTheme();
  const [width, setWidth] = useState(0);
  const x = useSharedValue(0);
  const max = Math.max(0, width - KNOB - PAD * 2);

  // Al terminar (o fallar) la accion, el boton vuelve a su sitio.
  useEffect(() => {
    if (!loading) x.value = withSpring(0, { damping: 18 });
  }, [loading, x]);

  const confirm = () => {
    haptic.success();
    onConfirm();
  };

  const pan = Gesture.Pan()
    .enabled(!disabled && !loading && max > 0)
    .activeOffsetX([-8, 8])
    .onBegin(() => {
      runOnJS(haptic.tap)();
    })
    .onUpdate((e) => {
      x.value = Math.min(max, Math.max(0, e.translationX));
    })
    .onEnd(() => {
      if (x.value > max * 0.82) {
        x.value = withTiming(max, { duration: 120 });
        runOnJS(confirm)();
      } else {
        x.value = withSpring(0, { damping: 18 });
      }
    });

  const knobStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const labelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, [0, max * 0.6 || 1], [1, 0], Extrapolation.CLAMP),
  }));
  const fillStyle = useAnimatedStyle(() => ({ width: x.value + KNOB + PAD }));

  const bg = { primary: colors.primary, success: colors.success, warning: colors.warning }[tone];

  return (
    <View
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Desliza a la derecha para confirmar"
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={() => !disabled && !loading && confirm()}
      style={[styles.track, { backgroundColor: `${bg}1F`, opacity: disabled ? 0.5 : 1 }]}
    >
      <Animated.View style={[styles.fill, { backgroundColor: `${bg}33` }, fillStyle]} />
      <Animated.Text style={[styles.label, { color: bg }, labelStyle]} numberOfLines={1}>
        {label}
      </Animated.Text>
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.knob, { backgroundColor: bg }, elevation.raised, knobStyle]}>
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Ionicons name={icon} size={24} color={colors.white} />
          )}
        </Animated.View>
      </GestureDetector>
      <View pointerEvents="none" style={styles.chevrons}>
        <Text style={[styles.chevronText, { color: `${bg}88` }]}>›››</Text>
      </View>
    </View>
  );
}

const useStyles = makeStyles(({ colors, typography, elevation }) =>
  StyleSheet.create({
  track: {
    height: KNOB + PAD * 2,
    borderRadius: radius.pill,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: radius.pill },
  label: {
    position: 'absolute',
    left: KNOB + PAD * 3,
    right: 36,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
  },
  knob: {
    position: 'absolute',
    left: PAD,
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevrons: { position: 'absolute', right: 16 },
  chevronText: { fontSize: 22, fontWeight: '700', letterSpacing: -2 },
}),
);
