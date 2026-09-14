import type { EvidenceBundleItem } from '@/api/delivery-proofs.api';

export interface EvidenceStatus {
  hasPhoto: boolean;
  hasSignature: boolean;
  ready: boolean;
}

/**
 * Replica en el cliente la regla que aplica el backend antes de marcar una
 * orden como entregada (`assertDeliveryEvidenceReady`): hace falta una foto
 * `image/*` cuyo nombre NO contenga "signature" y ademas una firma.
 *
 * Sin esto el conductor subia la foto, no firmaba, el guard local pasaba y el
 * `PATCH /orders/:id/status` devolvia un 400 con un mensaje generico.
 */
export function evidenceStatus(items: EvidenceBundleItem[]): EvidenceStatus {
  const hasSignature = items.some((item) => (item.proof.signatures ?? []).length > 0);
  const hasPhoto = items.some((item) =>
    item.attachments.some(
      (attachment) =>
        attachment.mimeType.startsWith('image/') &&
        !attachment.fileName.toLowerCase().includes('signature'),
    ),
  );

  return { hasPhoto, hasSignature, ready: hasPhoto && hasSignature };
}

/** Que falta exactamente, para decirselo al conductor en vez de "error". */
export function missingEvidenceMessage({ hasPhoto, hasSignature }: EvidenceStatus) {
  if (!hasPhoto && !hasSignature) {
    return 'Captura la foto de entrega y la firma del receptor.';
  }

  if (!hasPhoto) {
    return 'Falta la foto de entrega. La firma ya esta registrada.';
  }

  return 'Falta la firma del receptor. La foto ya esta registrada.';
}
