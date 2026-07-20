import React, { useEffect } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, Muted } from '@/components/ui';
import { colors, spacing } from '@/theme/theme';
import { useNotifications } from '@/store/notifications.store';
import { notificationsApi } from '@/api/notifications.api';

export function NotificationsScreen() {
  const { items, load, markRead } = useNotifications();
  const [refreshing, setRefreshing] = React.useState(false);

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
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primaryBright} />
        }
      >
        <Button
          label="Enviar notificación de prueba"
          tone="neutral"
          onPress={() => {
            void notificationsApi.sendTest().then(() => load());
          }}
        />

        {items.map((n) => (
          <Pressable key={n.id} onPress={() => void markRead(n.id)}>
            <Card style={[styles.item, !n.readAt && styles.unread]}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemTitle}>{n.title}</Text>
                {!n.readAt && <View style={styles.dot} />}
              </View>
              <Muted>{n.message}</Muted>
              <Text style={styles.time}>
                {new Date(n.createdAt).toLocaleString()}
              </Text>
            </Card>
          </Pressable>
        ))}
        {!items.length && <Muted>No tienes notificaciones.</Muted>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.md },
  item: { gap: 6 },
  unread: { borderColor: colors.borderStrong },
  itemHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  itemTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primaryBright },
  time: { color: colors.textDim, fontSize: 11 },
});
