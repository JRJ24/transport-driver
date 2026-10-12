import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { usersApi } from '@/api/users.api';
import { useAuth } from '@/store/auth.store';
import { toast } from '@/store/toast.store';
import { friendlyError } from '@/utils/errors';

/** Elige una foto de la galeria, la recorta cuadrada y la sube (<= 2 MB). */
export function useAvatarPicker() {
  const applyProfile = useAuth((s) => s.applyProfile);
  const [busy, setBusy] = useState(false);

  async function pickAvatar() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      toast.error('Permiso de fotos', 'Permite el acceso a tus fotos para elegir una.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });
    if (result.canceled) return;
    setBusy(true);
    try {
      const ctx = ImageManipulator.manipulate(result.assets[0].uri);
      ctx.resize({ width: 512, height: 512 });
      const image = await ctx.renderAsync();
      const saved = await image.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
      const { avatarUrl } = await usersApi.uploadAvatar({
        uri: saved.uri,
        name: `avatar-${Date.now()}.jpg`,
        type: 'image/jpeg',
      });
      applyProfile({ avatarUrl });
      toast.success('Foto actualizada', 'Así te verán operaciones y tus clientes.');
    } catch (e) {
      toast.error('No se pudo subir la foto', friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  return { pickAvatar, busy };
}
