import React, { useCallback, useEffect, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { File, Paths } from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, SlideInRight } from 'react-native-reanimated';
import { Button, Card, IconButton, KeyValue, Muted, TextField } from '@/components/ui';
import { SwipeButton } from '@/components/SwipeButton';
import { StepIndicator } from '@/components/OrderCard';
import { colors, radius, spacing, typography } from '@/theme/theme';
import { attachmentsApi } from '@/api/attachments.api';
import { deliveryProofsApi } from '@/api/delivery-proofs.api';
import { useEvidence, type Stroke } from '@/store/evidence.store';
import { useTrip } from '@/store/trip.store';
import { useTracking } from '@/store/tracking.store';
import { toast } from '@/store/toast.store';
import type { RootStackParamList } from '@/navigation/types';
import type { LatLng } from '@/types/api';
import { friendlyError } from '@/utils/errors';
import { evidenceStatus } from '@/utils/evidence';
import { haptic } from '@/utils/feedback';
import { stopPoint } from '@/utils/geo';
import { dropoffStop, stopAddress } from '@/utils/orders';
import { buildSignatureSvg, SignaturePad } from './SignaturePad';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Evidence'>;

const STEPS = ['Receptor', 'Foto', 'Firma', 'Confirmar'];

/**
 * Paso obligatorio para cerrar la entrega: receptor → foto → firma →
 * confirmar. «Completar entrega» solo existe al final de este flujo.
 */
export function EvidenceScreen() {
  const navigation = useNavigation<Nav>();
  const { orderId } = useRoute<RouteProp<RootStackParamList, 'Evidence'>>().params;
  const order = useTrip((s) => (s.order?.id === orderId ? s.order : null));
  const complete = useTrip((s) => s.complete);
  const lastFix = useTracking((s) => s.lastFix);
  const draft = useEvidence((s) => s.draft);
  const load = useEvidence((s) => s.load);
  const update = useEvidence((s) => s.update);
  const clearDraft = useEvidence((s) => s.clear);

  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState<string | null>(null);
  const [serverReady, setServerReady] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    void load(orderId).then((d) => {
      // Retomar donde se quedo.
      if (d.recipientName && d.photo && d.strokes.length) setStep(3);
      else if (d.recipientName && d.photo) setStep(2);
      else if (d.recipientName) setStep(1);
    });
    // Si la evidencia ya esta en el servidor, solo falta confirmar.
    void deliveryProofsApi
      .bundle(orderId)
      .then((bundle) => {
        if (evidenceStatus(bundle).ready) {
          setServerReady(true);
          setStep(3);
        }
      })
      .catch(() => undefined);
  }, [orderId, load]);

  const setStrokes = useCallback((strokes: Stroke[]) => update({ strokes, signatureSaved: false }), [update]);

  if (!draft || draft.orderId !== orderId) {
    return <View style={styles.screen} />;
  }

  const nameError = touched && draft.recipientName.trim().length < 3 ? 'Escribe el nombre de quien recibe.' : null;
  const hasSignature = draft.strokes.some((s) => s.length > 2);

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      toast.error('Permiso de cámara', 'Activa la cámara para capturar la evidencia.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (result.canceled) return;
    const asset = result.assets[0];
    haptic.success();
    update({
      photo: {
        uri: asset.uri,
        name: `entrega-${Date.now()}.jpg`,
        type: asset.mimeType ?? 'image/jpeg',
        width: asset.width,
        height: asset.height,
      },
      photoUploaded: false,
    });
  }

  function next() {
    if (step === 0) {
      setTouched(true);
      if (draft!.recipientName.trim().length < 3) {
        haptic.warning();
        return;
      }
    }
    if (step === 1 && !draft!.photo) {
      toast.warning('Falta la foto', 'Toma una foto del paquete entregado.');
      return;
    }
    if (step === 2 && !hasSignature) {
      toast.warning('Falta la firma', 'Pide al receptor que firme en el recuadro.');
      return;
    }
    haptic.tap();
    setStep((s) => Math.min(3, s + 1));
  }

  async function submit() {
    if (!order) {
      toast.error('Servicio no disponible', 'Esta orden ya no es tu servicio en curso.');
      return;
    }
    const d = useEvidence.getState().draft!;
    try {
      if (!serverReady) {
        let proofId = d.proofId;
        if (!proofId) {
          setProgress('Guardando datos del receptor…');
          const where = await resolveLocation(lastFix, stopPoint(dropoffStop(order)));
          const proof = await deliveryProofsApi.create({
            orderId,
            proofType: 'MIXED',
            recipientName: d.recipientName.trim(),
            recipientDocument: d.recipientDocument.trim(),
            notes: d.notes.trim() || undefined,
            latitude: where.latitude,
            longitude: where.longitude,
          });
          proofId = proof.id;
          update({ proofId });
        }
        if (!d.photoUploaded && d.photo) {
          setProgress('Subiendo foto…');
          const photo = await compressPhoto(d.photo.uri);
          await attachmentsApi.upload({ entityType: 'DeliveryProof', entityId: proofId, files: [photo] });
          update({ photoUploaded: true });
        }
        if (!d.signatureSaved) {
          setProgress('Guardando firma…');
          const file = new File(Paths.cache, `signature-${Date.now()}.svg`);
          file.create({ overwrite: true });
          file.write(buildSignatureSvg(d.strokes, d.signatureSize));
          const [upload] = await attachmentsApi.upload({
            entityType: 'DeliveryProof',
            entityId: proofId,
            files: [{ uri: file.uri, name: file.name, type: 'image/svg+xml' }],
          });
          await deliveryProofsApi.addSignature(proofId, {
            signatureUrl: upload.file.url,
            signerName: d.recipientName.trim(),
          });
          update({ signatureSaved: true });
          try {
            file.delete();
          } catch {
            // El cache se limpia solo.
          }
        }
      }
      setProgress('Cerrando la entrega…');
      const delivered = await complete();
      await clearDraft();
      navigation.replace('TripCompleted', {
        orderCode: delivered.orderCode,
        amount: delivered.totalAmount ?? null,
        recipient: d.recipientName.trim() || undefined,
      });
    } catch (error) {
      toast.error('No se pudo completar', `${friendlyError(error)} Tu evidencia queda guardada; puedes reintentar.`);
    } finally {
      setProgress(null);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <IconButton icon="close" accessibilityLabel="Cerrar" onPress={() => navigation.goBack()} size={40} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Evidencia de entrega</Text>
          <Muted>{order ? `${order.orderCode} · ${stopAddress(dropoffStop(order))}` : 'Orden'}</Muted>
        </View>
      </View>
      <View style={styles.steps}>
        <StepIndicator steps={STEPS} current={step} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {step === 2 ? (
          // La firma va fuera del ScrollView: ningun scroll le roba el trazo.
          <Animated.View key="sign" entering={SlideInRight.springify().damping(20)} style={styles.body}>
            <StepTitle icon="create-outline" title="Firma del receptor" subtitle="Pásale el teléfono a quien recibe y pídele que firme." />
            <SignaturePad
              strokes={draft.strokes}
              onChange={setStrokes}
              onSize={(signatureSize) => update({ signatureSize })}
              height={260}
            />
            <View style={styles.signRow}>
              <Muted>{hasSignature ? `Firmado por ${draft.recipientName}` : 'Firma dentro del recuadro'}</Muted>
              <Pressable onPress={() => update({ strokes: [], signatureSaved: false })} hitSlop={10}>
                <Text style={styles.link}>Borrar</Text>
              </Pressable>
            </View>
          </Animated.View>
        ) : (
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            {step === 0 ? (
              <Animated.View key="who" entering={FadeIn} style={{ gap: spacing.lg }}>
                <StepTitle icon="person-outline" title="¿Quién recibe?" subtitle="Registra a la persona que firma la entrega." />
                <TextField
                  label="Nombre completo"
                  icon="person-outline"
                  value={draft.recipientName}
                  onChangeText={(recipientName) => update({ recipientName })}
                  placeholder="Ej. María Pérez"
                  autoCapitalize="words"
                  error={nameError}
                  returnKeyType="next"
                />
                <TextField
                  label="Cédula o documento (opcional)"
                  icon="card-outline"
                  value={draft.recipientDocument}
                  onChangeText={(recipientDocument) => update({ recipientDocument })}
                  placeholder="000-0000000-0"
                  keyboardType="default"
                />
                <TextField
                  label="Notas (opcional)"
                  icon="chatbubble-outline"
                  value={draft.notes}
                  onChangeText={(notes) => update({ notes })}
                  placeholder="Ej. Se dejó en recepción"
                  multiline
                />
              </Animated.View>
            ) : null}

            {step === 1 ? (
              <Animated.View key="photo" entering={SlideInRight.springify().damping(20)} style={{ gap: spacing.lg }}>
                <StepTitle icon="camera-outline" title="Foto de la entrega" subtitle="Que se vea el paquete en el lugar de entrega." />
                {draft.photo ? (
                  <View>
                    <Image source={{ uri: draft.photo.uri }} style={styles.photo} />
                    <View style={styles.photoOk}>
                      <Ionicons name="checkmark-circle" size={18} color={colors.white} />
                      <Text style={styles.photoOkText}>Foto lista</Text>
                    </View>
                  </View>
                ) : (
                  <Pressable onPress={() => void takePhoto()} style={styles.photoEmpty} accessibilityRole="button">
                    <View style={styles.cameraCircle}>
                      <Ionicons name="camera" size={34} color={colors.primary} />
                    </View>
                    <Text style={typography.bodyStrong}>Tocar para abrir la cámara</Text>
                    <Muted>Buena luz, paquete visible.</Muted>
                  </Pressable>
                )}
                {draft.photo ? (
                  <Button label="Repetir foto" icon="refresh" variant="secondary" size="md" onPress={() => void takePhoto()} />
                ) : null}
              </Animated.View>
            ) : null}

            {step === 3 ? (
              <Animated.View key="confirm" entering={SlideInRight.springify().damping(20)} style={{ gap: spacing.lg }}>
                <StepTitle
                  icon="shield-checkmark-outline"
                  title={serverReady ? 'Evidencia registrada' : 'Revisa y completa'}
                  subtitle={
                    serverReady
                      ? 'La evidencia ya está en el sistema. Solo falta cerrar la entrega.'
                      : 'Al completar enviamos la evidencia y cerramos la entrega.'
                  }
                />
                {!serverReady ? (
                  <Card>
                    <KeyValue label="Recibe" value={draft.recipientName || '—'} />
                    {draft.recipientDocument ? <KeyValue label="Documento" value={draft.recipientDocument} /> : null}
                    <View style={styles.summaryRow}>
                      {draft.photo ? <Image source={{ uri: draft.photo.uri }} style={styles.thumb} /> : null}
                      <View style={styles.checks}>
                        <Check ok={Boolean(draft.photo)} label="Foto de entrega" />
                        <Check ok={hasSignature} label="Firma del receptor" />
                        <Check ok label="Ubicación GPS" />
                      </View>
                    </View>
                    <Pressable onPress={() => setStep(0)} hitSlop={8}>
                      <Text style={styles.link}>Editar datos</Text>
                    </Pressable>
                  </Card>
                ) : null}
              </Animated.View>
            ) : null}
          </ScrollView>
        )}

        <View style={styles.footer}>
          {step < 3 ? (
            <View style={styles.footerRow}>
              {step > 0 ? (
                <Button label="Atrás" variant="secondary" onPress={() => setStep((s) => s - 1)} style={{ flex: 1 }} />
              ) : null}
              {step === 1 && !draft.photo ? (
                <Button label="Tomar foto" icon="camera" onPress={() => void takePhoto()} style={{ flex: 2 }} />
              ) : (
                <Button label="Continuar" icon="arrow-forward" onPress={next} style={{ flex: 2 }} />
              )}
            </View>
          ) : (
            <View style={{ gap: spacing.sm }}>
              {progress ? <Muted style={{ textAlign: 'center' }}>{progress}</Muted> : null}
              <SwipeButton
                label="Desliza para completar entrega"
                tone="success"
                icon="checkmark-done"
                loading={Boolean(progress)}
                disabled={!order}
                onConfirm={() => void submit()}
              />
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function StepTitle({ icon, title, subtitle }: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; subtitle: string }) {
  return (
    <View style={{ gap: 4 }}>
      <View style={styles.stepIcon}>
        <Ionicons name={icon} size={22} color={colors.primary} />
      </View>
      <Text style={typography.title}>{title}</Text>
      <Muted>{subtitle}</Muted>
    </View>
  );
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Ionicons name={ok ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={ok ? colors.success : colors.textDim} />
      <Text style={{ fontSize: 14, color: colors.text }}>{label}</Text>
    </View>
  );
}

/** Foto a 1600 px en JPEG: sube en segundos por datos moviles. */
async function compressPhoto(uri: string) {
  try {
    const ctx = ImageManipulator.manipulate(uri);
    ctx.resize({ width: 1600 });
    const image = await ctx.renderAsync();
    const saved = await image.saveAsync({ compress: 0.7, format: SaveFormat.JPEG });
    return { uri: saved.uri, name: `entrega-${Date.now()}.jpg`, type: 'image/jpeg' };
  } catch {
    return { uri, name: `entrega-${Date.now()}.jpg`, type: 'image/jpeg' };
  }
}

async function resolveLocation(lastFix: LatLng | null, fallback: LatLng | null): Promise<LatLng> {
  if (lastFix) return lastFix;
  const perm = await Location.getForegroundPermissionsAsync();
  if (perm.granted) {
    const current = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
    ]).catch(() => null);
    if (current) return { latitude: current.coords.latitude, longitude: current.coords.longitude };
  }
  if (fallback) return fallback;
  throw new Error('No hay ubicación disponible para la evidencia.');
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  steps: { paddingHorizontal: spacing.lg, paddingVertical: spacing.lg },
  body: { padding: spacing.lg, gap: spacing.lg, flexGrow: 1 },
  stepIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.lg, backgroundColor: colors.surfaceAlt },
  photoOk: {
    position: 'absolute',
    left: spacing.md,
    bottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.success,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  photoOkText: { color: colors.white, fontWeight: '700', fontSize: 13 },
  photoEmpty: {
    aspectRatio: 4 / 3,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  cameraCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  link: { color: colors.primaryText, fontWeight: '700', fontSize: 14 },
  summaryRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  thumb: { width: 72, height: 72, borderRadius: radius.sm },
  checks: { gap: 6, flex: 1 },
  footer: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  footerRow: { flexDirection: 'row', gap: spacing.sm },
});
