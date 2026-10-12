import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme/theme';
import { useAuth } from '@/store/auth.store';
import { useTrip } from '@/store/trip.store';
import { haptic } from '@/utils/feedback';
import { LoginScreen } from '@/features/auth/LoginScreen';
import { TasksScreen } from '@/features/orders/TasksScreen';
import { OrderDetailScreen } from '@/features/orders/OrderDetailScreen';
import { NotificationsScreen } from '@/features/notifications/NotificationsScreen';
import { RouteScreen } from '@/features/map/RouteScreen';
import { EvidenceScreen } from '@/features/evidence/EvidenceScreen';
import { TripCompletedScreen } from '@/features/trip/TripCompletedScreen';
import { ProfileScreen } from '@/features/profile/ProfileScreen';
import { EditProfileScreen } from '@/features/profile/EditProfileScreen';
import { ChangePasswordScreen } from '@/features/profile/ChangePasswordScreen';
import { ChangeEmailScreen } from '@/features/profile/ChangeEmailScreen';
import { setMainReady } from './ref';
import type { InicioStackParamList, RootStackParamList, TabParamList } from './types';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const InicioStack = createNativeStackNavigator<InicioStackParamList>();
const Tabs = createBottomTabNavigator<TabParamList>();

const stackOptions = {
  headerStyle: { backgroundColor: colors.bg },
  headerTintColor: colors.text,
  headerTitleStyle: { fontWeight: '700' as const, fontSize: 17 },
  headerShadowVisible: false,
  headerBackButtonDisplayMode: 'minimal' as const,
  contentStyle: { backgroundColor: colors.bg },
};

function InicioNavigator() {
  return (
    <InicioStack.Navigator screenOptions={stackOptions}>
      <InicioStack.Screen name="Tasks" component={TasksScreen} options={{ headerShown: false }} />
      <InicioStack.Screen name="OrderDetail" component={OrderDetailScreen} options={{ title: 'Detalle de la orden' }} />
      <InicioStack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notificaciones' }} />
    </InicioStack.Navigator>
  );
}

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function tabIcon(active: IoniconName, idle: IoniconName) {
  return ({ color, focused }: { color: string; focused: boolean }) => (
    <Ionicons name={focused ? active : idle} size={24} color={color} />
  );
}

function RouteTabIcon({ color, focused }: { color: string; focused: boolean }) {
  const live = useTrip((s) => Boolean(s.order));
  return (
    <View>
      <Ionicons name={focused ? 'navigate' : 'navigate-outline'} size={24} color={color} />
      {live ? <View style={styles.liveDot} /> : null}
    </View>
  );
}

function MainTabs() {
  // Un push tocado en frio espera a que existan las pestañas.
  useEffect(() => {
    setMainReady(true);
    return () => setMainReady(false);
  }, []);

  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: undefined,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textDim,
      }}
      screenListeners={{ tabPress: () => haptic.tap() }}
    >
      <Tabs.Screen name="Inicio" component={InicioNavigator} options={{ tabBarIcon: tabIcon('home', 'home-outline') }} />
      <Tabs.Screen name="Ruta" component={RouteScreen} options={{ tabBarIcon: RouteTabIcon }} />
      <Tabs.Screen name="Perfil" component={ProfileScreen} options={{ tabBarIcon: tabIcon('person', 'person-outline') }} />
    </Tabs.Navigator>
  );
}

export function RootNavigator() {
  const status = useAuth((s) => s.status);
  const authenticated = status === 'authenticated';

  return (
    <RootStack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      {authenticated ? (
        <>
          <RootStack.Screen name="Main" component={MainTabs} />
          <RootStack.Screen
            name="Evidence"
            component={EvidenceScreen}
            options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom', gestureEnabled: false }}
          />
          <RootStack.Screen
            name="TripCompleted"
            component={TripCompletedScreen}
            options={{ presentation: 'fullScreenModal', animation: 'fade', gestureEnabled: false }}
          />
          <RootStack.Group screenOptions={{ ...stackOptions, headerShown: true }}>
            <RootStack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: 'Editar perfil' }} />
            <RootStack.Screen name="ChangePassword" component={ChangePasswordScreen} options={{ title: 'Cambiar contraseña' }} />
            <RootStack.Screen name="ChangeEmail" component={ChangeEmailScreen} options={{ title: 'Cambiar correo' }} />
          </RootStack.Group>
        </>
      ) : (
        <RootStack.Screen name="Login" component={LoginScreen} />
      )}
    </RootStack.Navigator>
  );
}

const styles = StyleSheet.create({
  liveDot: {
    position: 'absolute',
    top: -1,
    right: -3,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.surface,
  },
});
