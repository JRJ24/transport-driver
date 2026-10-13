import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Avatar, Badge, EmptyState, ErrorBanner, IconButton, Muted, Skeleton, type IconName } from '@/components/ui';
import { goToTab } from '@/navigation/ref';
import { SegmentedControl } from '@/components/SegmentedControl';
import { ActiveTripBanner, OrderCard } from '@/components/OrderCard';
import { colors, spacing, typography } from '@/theme/theme';
import { useOrders } from '@/store/order.store';
import { useNotifications } from '@/store/notifications.store';
import { useAuth } from '@/store/auth.store';
import { useTrip } from '@/store/trip.store';
import { driverStatusLabels } from '@/constants/status.constants';
import { bucketLabels, groupAssignments, type OrderBucket } from '@/utils/orders';
import { firstName, greeting } from '@/utils/format';
import type { InicioStackParamList } from '@/navigation/types';
import type { Assignment } from '@/types/api';

type Nav = NativeStackNavigationProp<InicioStackParamList, 'Tasks'>;

const EMPTY: Record<OrderBucket, { icon: IconName; title: string; message: string }> = {
  assigned: {
    icon: 'file-tray-outline',
    title: 'Sin órdenes asignadas',
    message: 'Cuando operaciones te asigne un viaje aparecerá aquí. Mantente disponible para recibir ofertas.',
  },
  inRoute: {
    icon: 'navigate-outline',
    title: 'Nada en ruta',
    message: 'Inicia una orden asignada y la verás aquí mientras la entregas.',
  },
  delivered: {
    icon: 'checkmark-done-outline',
    title: 'Aún no hay entregas',
    message: 'Tus entregas completadas quedarán guardadas aquí.',
  },
};

export function TasksScreen() {
  const navigation = useNavigation<Nav>();
  const assignments = useOrders((s) => s.assignments);
  const loaded = useOrders((s) => s.loaded);
  const refreshing = useOrders((s) => s.refreshing);
  const error = useOrders((s) => s.error);
  const loadAssignments = useOrders((s) => s.loadAssignments);
  const unread = useNotifications((s) => s.unreadCount);
  const loadNotifications = useNotifications((s) => s.load);
  const user = useAuth((s) => s.user);
  const driver = useAuth((s) => s.driver);
  const tripOrderId = useTrip((s) => s.order?.id);

  const groups = useMemo(() => groupAssignments(assignments), [assignments]);
  const [tab, setTab] = useState<OrderBucket>('assigned');

  // Con un servicio en curso, la lista abre en «En ruta».
  useEffect(() => {
    if (tripOrderId) setTab('inRoute');
  }, [tripOrderId]);

  useFocusEffect(
    useCallback(() => {
      void loadAssignments();
      void loadNotifications();
    }, [loadAssignments, loadNotifications]),
  );

  const refresh = useCallback(() => {
    void loadAssignments({ visible: true });
    void loadNotifications();
  }, [loadAssignments, loadNotifications]);

  const data = groups[tab];
  const available = driver?.availabilityStatus === 'AVAILABLE';
  const statusTone = available ? 'success' : driver?.availabilityStatus === 'BUSY' ? 'primary' : 'neutral';

  const header = (
    <View style={styles.headerBlock}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.hello} numberOfLines={1}>
            {greeting()}, {firstName(user?.fullName) || 'conductor'}
          </Text>
          <View style={styles.statusRow}>
            <Badge
              label={driver ? driverStatusLabels[driver.availabilityStatus] : 'Sin perfil'}
              tone={statusTone}
              pulse={available}
            />
            {groups.assigned.length ? <Muted>{groups.assigned.length} por hacer</Muted> : null}
          </View>
        </View>
        <IconButton
          icon="notifications-outline"
          accessibilityLabel="Notificaciones"
          badge={unread}
          onPress={() => navigation.navigate('Notifications')}
        />
        <Avatar name={user?.fullName} uri={user?.avatarUrl} size={44} onPress={() => goToTab('Perfil')} />
      </View>
      <ActiveTripBanner />
      <SegmentedControl
        value={tab}
        onChange={setTab}
        segments={(['assigned', 'inRoute', 'delivered'] as OrderBucket[]).map((key) => ({
          key,
          label: bucketLabels[key],
          count: groups[key].length,
        }))}
      />
      {error ? <ErrorBanner message={error} onRetry={refresh} /> : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <StatusBar style="dark" />
      <FlatList<Assignment>
        data={loaded ? data : []}
        keyExtractor={(a) => a.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={header}
        ItemSeparatorComponent={Separator}
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(Math.min(index, 6) * 50).springify().damping(18)}>
            <OrderCard
              assignment={item}
              onPress={() => navigation.navigate('OrderDetail', { orderId: item.orderId })}
            />
          </Animated.View>
        )}
        ListEmptyComponent={
          !loaded ? (
            <View style={{ gap: spacing.md }}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={styles.skeletonCard}>
                  <Skeleton width={110} height={20} />
                  <Skeleton height={16} />
                  <Skeleton width="70%" height={16} />
                </View>
              ))}
            </View>
          ) : (
            <EmptyState {...EMPTY[tab]} />
          )
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
      />
    </SafeAreaView>
  );
}

function Separator() {
  return <View style={{ height: spacing.md }} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  headerBlock: { gap: spacing.lg, marginBottom: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  hello: { ...typography.display },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 6 },
  skeletonCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: spacing.lg,
    gap: spacing.md,
  },
});
