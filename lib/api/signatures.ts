import { apiRequest } from './config';

// Tipos para firmas digitales
export interface SignatureRequest {
  id: number;
  documentId: string;
  requesterId: number;
  signerId: number;
  status: 'pending' | 'signed' | 'rejected';
  requestedAt: string;
  signedAt?: string;
  rejectedAt?: string;
  expiresAt?: string;
  documentTitle: string;
  documentType: string;
  signatureData?: string;
  rejectionReason?: string;
  metadata?: Record<string, any>;
  
  // Relaciones populadas
  requester?: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
  };
  signer?: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export interface CreateSignatureRequestData {
  documentId: string;
  signerId: number;
  documentTitle: string;
  documentType: string;
  expiresAt?: string;
  metadata?: Record<string, any>;
}

export interface SignDocumentData {
  signatureData: string;
  password: string;
  metadata?: Record<string, any>;
}

export interface RejectSignatureData {
  rejectionReason: string;
}

// Tipos para configurar firmas múltiples
export interface MultipleSignatureData {
  documentId: number;
  signers: Array<{
    userId: number;
    email: string;
    role: string;
    order: number;
  }>;
  requiresAllSignatures: boolean;
  expirationHours: number;
  notificationMessage: string;
  completedSignatures?: Array<{
    userId: number;
    signatureData: string;
    signedAt: string;
    ipAddress: string;
    geolocation?: {
      latitude: number;
      longitude: number;
      accuracy?: number;
    };
    deviceInfo: {
      platform: string;
      version: string;
      model?: string;
      fingerprint?: string;
    };
    visualSignature?: string;
    userAgent?: string;
    acceptanceText?: string;
  }>;
}

// API functions para firmas digitales
export const signaturesApi = {
  // Crear solicitud de firma múltiple
  createMultipleSignatures: async (data: MultipleSignatureData): Promise<any> => {
    console.log('🚀 signaturesApi.createMultipleSignatures called with:', data);
    
    return apiRequest<any>('/api/v1/digital-signatures/multiple', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },


  // Crear solicitud de firma individual (legacy support - ahora usa endpoint simple)


  // Obtener solicitudes de firma pendientes para el usuario actual
  getPendingSignatures: async (): Promise<SignatureRequest[]> => {
    return apiRequest<SignatureRequest[]>('/api/v1/pending-signatures');
  },

  // Obtener todas las solicitudes de firma del usuario actual
  getMySignatureRequests: async (params?: {
    status?: SignatureRequest['status'];
    asRequester?: boolean;
    asSigner?: boolean;
  }): Promise<SignatureRequest[]> => {
    const queryParams = new URLSearchParams();
    
    if (params?.status) {
      queryParams.append('status', params.status);
    }
    if (params?.asRequester) {
      queryParams.append('asRequester', 'true');
    }
    if (params?.asSigner) {
      queryParams.append('asSigner', 'true');
    }

    const queryString = queryParams.toString();
    const endpoint = queryString ? `/api/v1/signatures/my-requests?${queryString}` : '/api/v1/signatures/my-requests';
    
    return apiRequest<SignatureRequest[]>(endpoint);
  },

  // Firmar documento
  signDocument: async (requestId: number, data: SignDocumentData): Promise<SignatureRequest> => {
    return apiRequest<SignatureRequest>(`/api/v1/signatures/requests/${requestId}/sign`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Rechazar firma
  rejectSignature: async (requestId: number, data: RejectSignatureData): Promise<SignatureRequest> => {
    return apiRequest<SignatureRequest>(`/api/v1/signatures/requests/${requestId}/reject`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Obtener detalles de solicitud de firma
  getSignatureRequest: async (requestId: number): Promise<SignatureRequest> => {
    return apiRequest<SignatureRequest>(`/api/v1/signatures/requests/${requestId}`);
  },

  // Cancelar solicitud de firma (solo el solicitante)
  cancelSignatureRequest: async (requestId: number): Promise<void> => {
    return apiRequest<void>(`/api/v1/signatures/requests/${requestId}/cancel`, {
      method: 'DELETE',
    });
  },

  // Actualizar firmas con documentId
  updateSignaturesWithDocumentId: async (data: {
    signatureIds: number[];
    documentId: number;
  }): Promise<any> => {
    return apiRequest<any>('/api/v1/digital-signatures/update-document-id', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
};