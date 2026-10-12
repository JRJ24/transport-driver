import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { EmptyState } from '@/components/ui';
import { colors, elevation, radius, spacing } from '@/theme/theme';
import { useNotifications } from '@/store/notifications.store';
import { navigateToRoute } from '@/navigation/ref';
import { parseNotificationRoute } from '@/services/notifications/notification-routing.service';
import { formatRelativeDay } from '@/utils/format';
import { haptic } from '@/utils/feedback';

export function NotificationsScreen() {
  const { items, load, markRead } = useNotifications();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          <EmptyState icon="notifications-off-outline" title="Todo al día" message="Aquí verás avisos de órdenes, ofertas y operaciones." />
        }
        renderItem={({ item: n }) => {
          const unread = !n.readAt;
          return (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                haptic.tap();
                void markRead(n.id);
                const route = parseNotificationRoute(n.data);
                if (route) navigateToRoute(route);
              }}
              style={({ pressed }) => [styles.item, elevation.card, unread && styles.unread, pressed && { opacity: 0.85 }]}
            >
              <View style={[styles.icon, unread && { backgroundColor: colors.primarySoft }]}>
                <Ionicons name={unread ? 'notifications' : 'notifications-outline'} size={18} color={unread ? colors.primary : colors.textDim} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.title, unread && { fontWeight: '700' }]} numberOfLines={2}>
                  {n.title}
                </Text>
                <Text style={styles.message} numberOfLines={3}>
                  {n.message}
                </Text>
                <Text style={styles.time}>{formatRelativeDay(n.createdAt)}</Text>
              </View>
              {unread ? <View style={styles.dot} /> : null}
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, flexGrow: 1 },
  item: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  unread: { borderLeftWidth: 3, borderLeftColor: colors.primary },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: colors.text, fontSize: 15, fontWeight: '600' },
  message: { color: colors.textMuted, fontSize: 14, lineHeight: 19 },
  time: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.primary, marginTop: 6 },
});
