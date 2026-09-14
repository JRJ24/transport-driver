import { http, unwrap } from './client';
import { attachmentsApi } from './attachments.api';
import type {
  ApiResponse,
  Attachment,
  DeliveryProof,
  ProofType,
  Signature,
} from '@/types/api';

export interface EvidenceBundleItem {
  proof: DeliveryProof;
  attachments: Attachment[];
}

export interface CreateDeliveryProofInput {
  orderId: string;
  proofType: ProofType;
  recipientName: string;
  recipientDocument: string;
  notes?: string;
  latitude: number;
  longitude: number;
}

export interface CreateSignatureInput {
  signatureUrl: string;
  signerName: string;
}

export const deliveryProofsApi = {
  async list(orderId: string): Promise<DeliveryProof[]> {
    const res = await http.get<ApiResponse<DeliveryProof[]>>(
      '/delivery-proofs',
      { params: { orderId } },
    );
    return unwrap(res.data);
  },

  async create(input: CreateDeliveryProofInput): Promise<DeliveryProof> {
    const res = await http.post<ApiResponse<DeliveryProof>>(
      '/delivery-proofs',
      input,
    );
    return unwrap(res.data);
  },

  async addSignature(
    proofId: string,
    input: CreateSignatureInput,
  ): Promise<Signature> {
    const res = await http.post<ApiResponse<Signature>>(
      `/delivery-proofs/${proofId}/signatures`,
      input,
    );
    return unwrap(res.data);
  },

  /** Pruebas con sus adjuntos, que es lo que valida el backend al entregar. */
  async bundle(orderId: string): Promise<EvidenceBundleItem[]> {
    const proofs = await deliveryProofsApi.list(orderId);
    const attachments = await Promise.all(
      proofs.map((proof) => attachmentsApi.list('DeliveryProof', proof.id)),
    );

    return proofs.map((proof, index) => ({
      proof,
      attachments: attachments[index] ?? [],
    }));
  },
};
