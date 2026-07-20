import React, { useCallback, useEffect } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button, Card, Eyebrow, Muted, Pill } from '@/components/ui';
import { colors, radius, spacing } from '@/theme/theme';
import { useOrders } from '@/store/order.store';
import { useNotifications } from '@/store/notifications.store';
import type { Assignment } from '@/types/api';
import type { InicioStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<InicioStackParamList, 'Tasks'>;

function firstStop(a: Assignment): string {
  const stops = a.order?.orderStops ?? [];
  const pickup = stops.find((s) => s.stopType === 'PICKUP') ?? stops[0];
  return pickup ? `${pickup.addressLine}, ${pickup.city}` : 'Origen no disponible';
}

export function TasksScreen() {
  const navigation = useNavigation<Nav>();
  const { assignments, loadingList, loadAssignments } = useOrders();
  const unread = useNotifications((s) => s.unreadCount);
  const loadNotifications = useNotifications((s) => s.load);

  const refresh = useCallback(() => {
    void loadAssignments();
    void loadNotifications();
  }, [loadAssignments, loadNotifications]);

  useEffect(refresh, [refresh]);

  const active = assignments.filter(
    (a) => a.assignmentStatus === 'PENDING' || a.assignmentStatus === 'ACCEPTED',
  );
  const next = active[0];

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={loadingList}
            onRefresh={refresh}
            tintColor={colors.primaryBright}
          />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Siguiente tarea</Text>
            <Muted>{`Turno · ${active.length} parada${active.length === 1 ? '' : 's'}`}</Muted>
          </View>
          <Pressable
            style={styles.bell}
            onPress={() => navigation.navigate('Notifications')}
          >
            <Text style={styles.bellIcon}>🔔</Text>
            {unread > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unread}</Text>
              </View>
            )}
          </Pressable>
        </View>

        {next ? (
          <Card style={styles.nextCard}>
            <View style={styles.nextRow}>
              <Pill tone={next.assignmentStatus === 'PENDING' ? 'warning' : 'primary'}>
                {next.assignmentStatus === 'PENDING' ? 'Por aceptar' : 'Recoger ahora'}
              </Pill>
              <Text style={styles.eta}>{next.order?.estimatedDurationMin ?? '--'} min</Text>
            </View>
            <Text style={styles.orderCode}>{next.order?.orderCode ?? next.orderId}</Text>
            <Muted>{firstStop(next)}</Muted>
            <Button
              label={next.assignmentStatus === 'PENDING' ? 'Aceptar y ver' : 'Ver orden'}
              onPress={() =>
                navigation.navigate('OrderDetail', { orderId: next.orderId })
              }
            />
          </Card>
        ) : (
          <Card>
            <Eyebrow>Sin tareas</Eyebrow>
            <Muted>No tienes órdenes asignadas por ahora.</Muted>
          </Card>
        )}

        <Eyebrow>Asignaciones</Eyebrow>
        {assignments.map((a) => (
          <Pressable
            key={a.id}
            onPress={() => navigation.navigate('OrderDetail', { orderId: a.orderId })}
          >
            <Card style={styles.assignment}>
              <View style={styles.assignmentRow}>
                <Text style={styles.assignmentCode}>
                  {a.order?.orderCode ?? a.orderId}
                </Text>
                <Pill
                  tone={
                    a.assignmentStatus === 'ACCEPTED'
                      ? 'success'
                      : a.assignmentStatus === 'PENDING'
                        ? 'warning'
                        : 'neutral'
                  }
                >
                  {a.assignmentStatus}
                </Pill>
              </View>
              <Muted>{firstStop(a)}</Muted>
            </Card>
          </Pressable>
        ))}
        {!assignments.length && !loadingList && (
          <Muted>No hay asignaciones disponibles.</Muted>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { color: colors.text, fontSize: 28, fontWeight: '900', letterSpacing: -0.8 },
  bell: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellIcon: { fontSize: 18 },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  nextCard: { borderColor: colors.borderStrong },
  nextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eta: { color: colors.text, fontSize: 16, fontWeight: '900' },
  orderCode: { color: colors.text, fontSize: 22, fontWeight: '900' },
  assignment: { gap: 6, padding: spacing.md },
  assignmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  assignmentCode: { color: colors.text, fontSize: 14, fontWeight: '800' },
});
