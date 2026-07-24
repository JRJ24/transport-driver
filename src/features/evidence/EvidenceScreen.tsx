import React, { useMemo, useState } from 'react';
import {
  Alert,
  Image,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { File, Paths } from 'expo-file-system';
import { Button, Card, Eyebrow, Muted, Pill } from '@/components/ui';
import { attachmentsApi, type UploadableFile } from '@/api/attachments.api';
import { deliveryProofsApi } from '@/api/delivery-proofs.api';
import { toErrorMessage } from '@/api/client';
import { colors, radius, spacing } from '@/theme/theme';
import { useOrders } from '@/store/order.store';
import { useTracking } from '@/store/tracking.store';
import type { LatLng, OrderStop } from '@/types/api';

type Point = { x: number; y: number };
type Stroke = Point[];

interface CapturedPhoto extends UploadableFile {
  width?: number;
  height?: number;
}

const SIGNATURE_WIDTH = 620;
const SIGNATURE_HEIGHT = 260;

export function EvidenceScreen() {
  const activeOrder = useOrders((s) => s.activeOrder);
  const refreshOrder = useOrders((s) => s.selectOrder);
  const lastFix = useTracking((s) => s.lastFix);
  const [recipientName, setRecipientName] = useState('');
  const [recipientDocument, setRecipientDocument] = useState('');
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState<CapturedPhoto | null>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [signatureSize, setSignatureSize] = useState({
    width: SIGNATURE_WIDTH,
    height: SIGNATURE_HEIGHT,
  });
  const [busy, setBusy] = useState(false);
  const [sentProofId, setSentProofId] = useState<string | null>(null);

  const hasSignature = strokes.some((stroke) => stroke.length > 1);

  async function capturePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permiso requerido', 'Activa la cámara para capturar evidencia.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.82,
      allowsEditing: false,
    });

    if (result.canceled) {
      return;
    }

    const asset = result.assets[0];
    setPhoto({
      uri: asset.uri,
      name: asset.fileName ?? `evidence-${Date.now()}.jpg`,
      type: asset.mimeType ?? 'image/jpeg',
      width: asset.width,
      height: asset.height,
    });
  }

  async function submitEvidence() {
    if (!activeOrder) {
      Alert.alert('Sin orden activa', 'Selecciona una orden antes de enviar evidencia.');
      return;
    }
    if (!recipientName.trim() || !recipientDocument.trim()) {
      Alert.alert('Datos requeridos', 'Completa receptor y documento.');
      return;
    }
    if (!photo) {
      Alert.alert('Foto requerida', 'Captura una foto de entrega.');
      return;
    }
    if (!hasSignature) {
      Alert.alert('Firma requerida', 'Solicita la firma del receptor.');
      return;
    }

    setBusy(true);
    try {
      const location = await resolveEvidenceLocation(activeOrder.orderStops ?? [], lastFix);
      const proof = await deliveryProofsApi.create({
        orderId: activeOrder.id,
        proofType: 'MIXED',
        recipientName: recipientName.trim(),
        recipientDocument: recipientDocument.trim(),
        notes: notes.trim() || undefined,
        latitude: location.latitude,
        longitude: location.longitude,
      });

      const signatureFile = createSignatureFile(strokes, signatureSize);
      const uploads = await attachmentsApi.upload({
        entityType: 'DeliveryProof',
        entityId: proof.id,
        files: [photo, signatureFile],
      });
      const signatureUpload =
        uploads.find((item) =>
          item.file.originalName.toLowerCase().includes('signature'),
        ) ?? uploads[1];

      if (signatureUpload) {
        await deliveryProofsApi.addSignature(proof.id, {
          signatureUrl: signatureUpload.file.url,
          signerName: recipientName.trim(),
        });
      }

      setSentProofId(proof.id);
      await refreshOrder(activeOrder.id).catch(() => undefined);
      Alert.alert('Evidencia enviada', 'La prueba de entrega fue guardada correctamente.');
    } catch (error) {
      Alert.alert('No se pudo enviar', toErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Evidencia</Text>
            <Muted>Foto, receptor, firma y ubicación para cerrar la entrega.</Muted>
          </View>
          {sentProofId ? <Pill tone="success">Enviada</Pill> : null}
        </View>

        {activeOrder ? (
          <Card>
            <Eyebrow>Orden {activeOrder.orderCode}</Eyebrow>
            <Muted>{lastStopAddress(activeOrder.orderStops ?? [])}</Muted>
          </Card>
        ) : (
          <Card>
            <Eyebrow>Sin servicio activo</Eyebrow>
            <Muted>Inicia un servicio para capturar su evidencia.</Muted>
          </Card>
        )}

        <Card>
          <Eyebrow>Receptor</Eyebrow>
          <TextInput
            style={styles.input}
            placeholder="Nombre de quien recibe"
            placeholderTextColor={colors.textDim}
            value={recipientName}
            onChangeText={setRecipientName}
          />
          <TextInput
            style={styles.input}
            placeholder="Documento / cédula / RNC"
            placeholderTextColor={colors.textDim}
            value={recipientDocument}
            onChangeText={setRecipientDocument}
          />
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Notas opcionales"
            placeholderTextColor={colors.textDim}
            value={notes}
            onChangeText={setNotes}
            multiline
          />
        </Card>

        <Card>
          <Eyebrow>Foto de entrega</Eyebrow>
          {photo ? (
            <Image source={{ uri: photo.uri }} style={styles.photo} />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Text style={styles.photoIcon}>📷</Text>
              <Muted>Captura el paquete, guía o punto de entrega.</Muted>
            </View>
          )}
          <Button
            label={photo ? 'Repetir foto' : 'Tomar foto'}
            tone="neutral"
            onPress={() => void capturePhoto()}
            disabled={!activeOrder || busy}
          />
        </Card>

        <Card>
          <View style={styles.sectionHeader}>
            <Eyebrow>Firma del receptor</Eyebrow>
            <Button
              label="Limpiar"
              tone="neutral"
              onPress={() => setStrokes([])}
              disabled={busy || strokes.length === 0}
              style={styles.clearButton}
            />
          </View>
          <SignaturePad
            strokes={strokes}
            onChange={setStrokes}
            onSizeChange={setSignatureSize}
          />
          {!hasSignature ? <Muted>Dibuja la firma dentro del recuadro.</Muted> : null}
        </Card>

        <Button
          label={busy ? 'Enviando evidencia...' : 'Enviar evidencia'}
          loading={busy}
          disabled={!activeOrder}
          onPress={() => void submitEvidence()}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function lastStopAddress(stops: OrderStop[]) {
  const ordered = [...stops].sort((left, right) => left.sequence - right.sequence);
  const stop = ordered.find((item) => item.stopType === 'DROPOFF') ?? ordered[ordered.length - 1];
  return stop?.addressLine ?? 'Destino activo';
}

function SignaturePad({
  strokes,
  onChange,
  onSizeChange,
}: {
  strokes: Stroke[];
  onChange: React.Dispatch<React.SetStateAction<Stroke[]>>;
  onSizeChange: (size: { width: number; height: number }) => void;
}) {
  const [size, setSize] = useState({ width: SIGNATURE_WIDTH, height: SIGNATURE_HEIGHT });
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          const point = clampPoint(event.nativeEvent.locationX, event.nativeEvent.locationY, size);
          onChange((current) => [...current, [point]]);
        },
        onPanResponderMove: (event) => {
          const point = clampPoint(event.nativeEvent.locationX, event.nativeEvent.locationY, size);
          onChange((current) => {
            if (current.length === 0) return [[point]];
            const next = [...current];
            next[next.length - 1] = [...next[next.length - 1], point];
            return next;
          });
        },
      }),
    [onChange, size],
  );

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    const next = { width, height };
    setSize(next);
    onSizeChange(next);
  };

  return (
    <View style={styles.signaturePad} onLayout={onLayout} {...responder.panHandlers}>
      {strokes.flatMap((stroke, strokeIndex) =>
        stroke.slice(1).map((point, index) => (
          <View
            key={`${strokeIndex}-${index}`}
            style={[styles.signatureSegment, segmentStyle(stroke[index], point)]}
          />
        )),
      )}
    </View>
  );
}

function createSignatureFile(
  strokes: Stroke[],
  size: { width: number; height: number },
): UploadableFile {
  const svg = buildSignatureSvg(strokes, size);
  const file = new File(Paths.cache, `signature-${Date.now()}.svg`);
  file.create({ overwrite: true });
  file.write(svg);

  return { uri: file.uri, name: file.name, type: 'image/svg+xml' };
}

function buildSignatureSvg(strokes: Stroke[], size: { width: number; height: number }) {
  const paths = strokes
    .filter((stroke) => stroke.length > 1)
    .map((stroke) => {
      const [first, ...rest] = stroke;
      const d = [`M ${first.x.toFixed(1)} ${first.y.toFixed(1)}`]
        .concat(rest.map((point) => `L ${point.x.toFixed(1)} ${point.y.toFixed(1)}`))
        .join(' ');
      return `<path d="${d}" fill="none" stroke="#0f172a" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`;
    })
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size.width.toFixed(0)}" height="${size.height.toFixed(0)}" viewBox="0 0 ${size.width.toFixed(0)} ${size.height.toFixed(0)}"><rect width="100%" height="100%" fill="#ffffff"/>${paths}</svg>`;
}

function segmentStyle(start: Point, end: Point) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx);

  return {
    left: (start.x + end.x) / 2 - length / 2,
    top: (start.y + end.y) / 2 - 2,
    width: length,
    transform: [{ rotateZ: `${angle}rad` }],
  };
}

function clampPoint(x: number, y: number, size: { width: number; height: number }): Point {
  return {
    x: Math.max(0, Math.min(size.width, x)),
    y: Math.max(0, Math.min(size.height, y)),
  };
}

async function resolveEvidenceLocation(
  stops: OrderStop[],
  lastFix: LatLng | null,
): Promise<LatLng> {
  if (lastFix) return lastFix;

  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.granted) {
    const current = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return {
      latitude: current.coords.latitude,
      longitude: current.coords.longitude,
    };
  }

  const ordered = [...stops].sort((left, right) => left.sequence - right.sequence);
  const fallback =
    ordered.find((stop) => stop.stopType === 'DROPOFF') ?? ordered[ordered.length - 1];
  const latitude = Number(fallback?.latitude);
  const longitude = Number(fallback?.longitude);
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    return { latitude, longitude };
  }

  throw new Error('No hay ubicación disponible para la evidencia.');
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  title: { color: colors.text, fontSize: 28, fontWeight: '900' },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: 14,
  },
  textArea: { minHeight: 90, paddingTop: spacing.md, textAlignVertical: 'top' },
  photo: { width: '100%', height: 220, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  photoPlaceholder: {
    minHeight: 170,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  photoIcon: { fontSize: 34 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  clearButton: { minHeight: 34, paddingHorizontal: spacing.md },
  signaturePad: {
    height: 190,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    backgroundColor: '#fff',
  },
  signatureSegment: {
    position: 'absolute',
    height: 4,
    borderRadius: 2,
    backgroundColor: '#0f172a',
  },
});
