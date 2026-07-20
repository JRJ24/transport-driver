import React from 'react';
import { Text } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { colors } from '@/theme/theme';
import { useAuth } from '@/store/auth.store';
import { LoginScreen } from '@/features/auth/LoginScreen';
import { TasksScreen } from '@/features/orders/TasksScreen';
import { OrderDetailScreen } from '@/features/orders/OrderDetailScreen';
import { NotificationsScreen } from '@/features/notifications/NotificationsScreen';
import { RouteScreen } from '@/features/map/RouteScreen';
import { EvidenceScreen } from '@/features/evidence/EvidenceScreen';
import { ProfileScreen } from '@/features/profile/ProfileScreen';
import type {
  InicioStackParamList,
  RootStackParamList,
  TabParamList,
} from './types';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const InicioStack = createNativeStackNavigator<InicioStackParamList>();
const Tabs = createBottomTabNavigator<TabParamList>();

const headerStyle = {
  headerStyle: { backgroundColor: colors.bg },
  headerTintColor: colors.text,
  headerTitleStyle: { fontWeight: '800' as const },
  contentStyle: { backgroundColor: colors.bg },
};

function InicioNavigator() {
  return (
    <InicioStack.Navigator screenOptions={headerStyle}>
      <InicioStack.Screen
        name="Tasks"
        component={TasksScreen}
        options={{ headerShown: false }}
      />
      <InicioStack.Screen
        name="OrderDetail"
        component={OrderDetailScreen}
        options={{ title: 'Detalle de orden' }}
      />
      <InicioStack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ title: 'Notificaciones' }}
      />
    </InicioStack.Navigator>
  );
}

function tabIcon(icon: string) {
  return ({ color }: { color: string }) => (
    <Text style={{ fontSize: 18, color }}>{icon}</Text>
  );
}

function MainTabs() {
  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarActiveTintColor: colors.primaryBright,
        tabBarInactiveTintColor: colors.textDim,
      }}
    >
      <Tabs.Screen
        name="Inicio"
        component={InicioNavigator}
        options={{ tabBarIcon: tabIcon('🏠') }}
      />
      <Tabs.Screen
        name="Ruta"
        component={RouteScreen}
        options={{ tabBarIcon: tabIcon('🧭') }}
      />
      <Tabs.Screen
        name="Evid"
        component={EvidenceScreen}
        options={{ title: 'Evid.', tabBarIcon: tabIcon('📷') }}
      />
      <Tabs.Screen
        name="Perfil"
        component={ProfileScreen}
        options={{ tabBarIcon: tabIcon('👤') }}
      />
    </Tabs.Navigator>
  );
}

export function RootNavigator() {
  const status = useAuth((s) => s.status);
  const authenticated = status === 'authenticated';

  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      {authenticated ? (
        <RootStack.Screen name="Main" component={MainTabs} />
      ) : (
        <RootStack.Screen name="Login" component={LoginScreen} />
      )}
    </RootStack.Navigator>
  );
}
