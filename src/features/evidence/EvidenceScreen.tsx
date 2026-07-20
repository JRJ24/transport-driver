import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Button, Card, Eyebrow, Muted } from '@/components/ui';
import { colors, spacing } from '@/theme/theme';
import { useOrders } from '@/store/order.store';

/**
 * Evidence capture (photo + signature + OTP) as required before closing a
 * delivery. The capture pipeline (camera/signature) is wired to the active
 * order; media upload endpoints already exist in transport-api (delivery-proofs).
 */
export function EvidenceScreen() {
  const activeOrder = useOrders((s) => s.activeOrder);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Evidencia</Text>

        {activeOrder ? (
          <Card>
            <Eyebrow>Orden {activeOrder.orderCode}</Eyebrow>
            <Muted>
              Foto del paquete, firma digital y código OTP requeridos antes de
              cerrar la entrega.
            </Muted>
          </Card>
        ) : (
          <Card>
            <Eyebrow>Sin servicio activo</Eyebrow>
            <Muted>Inicia un servicio para capturar su evidencia.</Muted>
          </Card>
        )}

        <Card style={styles.row}>
          <View style={styles.step}>
            <Text style={styles.stepIcon}>📷</Text>
            <Text style={styles.stepLabel}>Foto</Text>
          </View>
          <View style={styles.step}>
            <Text style={styles.stepIcon}>✍️</Text>
            <Text style={styles.stepLabel}>Firma</Text>
          </View>
          <View style={styles.step}>
            <Text style={styles.stepIcon}>🔢</Text>
            <Text style={styles.stepLabel}>OTP</Text>
          </View>
        </Card>

        <Button
          label="Capturar evidencia"
          onPress={() => undefined}
          disabled={!activeOrder}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.md },
  title: { color: colors.text, fontSize: 28, fontWeight: '900' },
  row: { flexDirection: 'row', justifyContent: 'space-around' },
  step: { alignItems: 'center', gap: 6 },
  stepIcon: { fontSize: 26 },
  stepLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
});
