import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import { Button, Muted } from '@/components/ui';
import { radius, spacing } from '@/theme/theme';
import { makeStyles, useTheme } from '@/theme/ThemeProvider';
import { haptic } from '@/utils/feedback';
import { formatMoney, formatTime } from '@/utils/format';
import type { RootStackParamList } from '@/navigation/types';

/** Cierre con celebracion: el conductor sabe sin dudas que termino bien. */
export function TripCompletedScreen() {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const navigation = useNavigation();
  const { orderCode, amount, recipient } = useRoute<RouteProp<RootStackParamList, 'TripCompleted'>>().params;
  const scale = useSharedValue(0);

  useEffect(() => {
    haptic.success();
    scale.value = withDelay(120, withSequence(withSpring(1.15, { damping: 8 }), withSpring(1)));
  }, [scale]);

  const badge = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const goHome = () =>
    navigation.reset({ index: 0, routes: [{ name: 'Main' as never, params: { screen: 'Inicio' } as never }] });

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.center}>
        <Animated.View style={[styles.ring, badge]}>
          <View style={styles.check}>
            <Ionicons name="checkmark" size={56} color={colors.white} />
          </View>
        </Animated.View>
        <Animated.Text entering={FadeInDown.delay(300)} style={[typography.display, styles.text]}>
          ¡Entrega completada!
        </Animated.Text>
        <Animated.View entering={FadeInDown.delay(420)} style={{ alignItems: 'center', gap: 4 }}>
          <Muted style={styles.text}>
            {orderCode} · {formatTime(new Date())}
          </Muted>
          {recipient ? <Muted style={styles.text}>Recibió: {recipient}</Muted> : null}
        </Animated.View>
        {amount != null ? (
          <Animated.View entering={FadeInDown.delay(540)} style={styles.amount}>
            <Text style={styles.amountLabel}>Tarifa del servicio</Text>
            <Text style={styles.amountValue}>{formatMoney(amount)}</Text>
          </Animated.View>
        ) : null}
      </View>
      <Animated.View entering={FadeInDown.delay(650)} style={styles.footer}>
        <Button label="Volver a mis órdenes" icon="home" onPress={goHome} />
        <Muted style={styles.text}>Gracias por tu trabajo. ¡Buen camino!</Muted>
      </Animated.View>
    </SafeAreaView>
  );
}

const useStyles = makeStyles(({ colors, typography, elevation }) =>
  StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.xl },
  ring: {
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: colors.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { textAlign: 'center' },
  amount: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  amountLabel: { fontSize: 13, color: colors.textMuted },
  amountValue: { fontSize: 24, fontWeight: '700', color: colors.text },
  footer: { padding: spacing.lg, gap: spacing.md },
}),
);
