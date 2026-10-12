import { useState } from 'react';
import { Linking } from 'react-native';
import { locationPermissions } from '@/services/location/location-permissions.service';
import { useTrip } from '@/store/trip.store';
import { TripInProgressError } from '@/store/tracking.store';
import { useToast, toast } from '@/store/toast.store';
import { goToRouteTab } from '@/navigation/ref';
import { friendlyError, isActiveTripConflict } from '@/utils/errors';

/**
 * Inicia un servicio con todas las comprobaciones y le dice al conductor que
 * paso: GPS apagado, permiso negado, otro servicio en curso o exito (y lo
 * lleva a la ruta).
 */
export function useStartTrip() {
  const start = useTrip((s) => s.start);
  const [busy, setBusy] = useState(false);

  async function startTrip(orderId: string): Promise<boolean> {
    const active = useTrip.getState().order;
    if (active && active.id !== orderId) {
      useToast.getState().show({
        tone: 'warning',
        title: 'Ya tienes un servicio en curso',
        message: `Termina la entrega de ${active.orderCode} antes de iniciar otra.`,
        action: { label: 'Ver ruta', onPress: goToRouteTab },
      });
      return false;
    }
    setBusy(true);
    try {
      const perms = await locationPermissions.request();
      if (!perms.servicesEnabled) {
        toast.error('Activa la ubicación', 'Enciende el GPS del teléfono para iniciar el servicio.');
        return false;
      }
      if (!perms.foreground) {
        useToast.getState().show({
          tone: 'danger',
          title: 'Necesitamos tu ubicación',
          message: 'Sin permiso de ubicación no podemos guiarte ni compartir el viaje.',
          action: { label: 'Ajustes', onPress: () => void Linking.openSettings() },
        });
        return false;
      }
      const order = await start(orderId);
      useToast.getState().show({
        tone: 'success',
        title: '¡Servicio iniciado!',
        message: `${order.orderCode} · Dirígete a la recogida.`,
      });
      if (!perms.background) {
        setTimeout(
          () =>
            toast.warning(
              'Ubicación en segundo plano desactivada',
              'Mantén la app abierta para que el cliente vea tu avance.',
            ),
          1500,
        );
      }
      goToRouteTab();
      return true;
    } catch (error) {
      if (error instanceof TripInProgressError || isActiveTripConflict(error)) {
        useToast.getState().show({
          tone: 'warning',
          title: 'Ya tienes un servicio en curso',
          message: 'Termina la entrega actual antes de iniciar otra.',
          action: { label: 'Ver ruta', onPress: goToRouteTab },
        });
        void useTrip.getState().reconcile();
      } else {
        toast.error('No se pudo iniciar', friendlyError(error));
      }
      return false;
    } finally {
      setBusy(false);
    }
  }

  return { startTrip, busy };
}
