import { apiRequest } from './config';

// Tipos para documentos
export interface DocumentFormData {
  activityId: number;
  activityType: 'scheduled' | 'recurring';
  formData: Record<string, any>;
  metadata?: Record<string, any>;
  startedAt?: string;
  locationData?: Record<string, any>;
}

export interface DocumentResponse {
  id: string;
  companyId: string;
  templateId: string;
  title: string;
  description?: string;
  status: 'draft' | 'pending' | 'approved' | 'rejected';
  createdById: string;
  approvedById?: string;
  rejectionReason?: string;
  fields: Record<string, any>;
  activityId?: string;
  activityType?: 'scheduled' | 'recurring';
  metadata?: Record<string, any>;
  startedAt?: Date;
  completedAt?: Date;
  locationData?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ActivityTemplate {
  id: number;
  name: string;
  description?: string;
  type: string;
  structure: TemplateField[];
  category?: {
    id: number;
    name: string;
    color?: string;
  };
}

export interface TemplateField {
  id: string;
  type: 'text' | 'number' | 'email' | 'phone' | 'textarea' | 'select' | 'multiselect' | 'radio' | 'checkbox' | 'date' | 'time' | 'datetime' | 'file' | 'photo' | 'signature' | 'location' | 'fileUpload' | 'rating' | 'slider' | 'qrCode';
  label: string;
  placeholder?: string;
  required: boolean;
  validation?: {
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: string;
    message?: string;
  };
  options?: Array<{
    value: string;
    label: string;
  }>;
  multiple?: boolean;
  accept?: string; // Para campos de archivo
  maxFiles?: number; // Para campos de foto
  defaultValue?: any;
  config?: {
    // Para location
    showMap?: boolean;
    accuracy?: number;
    
    // Para fileUpload
    maxFileSize?: number;
    allowedFileTypes?: string[];
    
    // Para rating
    maxRating?: number;
    allowHalf?: boolean;
    
    // Para slider
    min?: number;
    max?: number;
    step?: number;
    unit?: string;
    
    // Para qrCode
    codeTypes?: string[];
    validateFormat?: string;
  };
}

// API functions para documentos
export const documentsApi = {
  // Crear documento desde actividad (para trabajadores)
  createFromActivity: async (data: DocumentFormData): Promise<DocumentResponse> => {
    return apiRequest<DocumentResponse>('/api/v1/documents/worker', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Obtener template de actividad programada
  getActivityTemplate: async (activityId: number): Promise<ActivityTemplate> => {
    return apiRequest<ActivityTemplate>(`/api/v1/activities/${activityId}/template`);
  },

  // Obtener template de actividad recurrente
  getRecurringActivityTemplate: async (activityId: number): Promise<ActivityTemplate> => {
    return apiRequest<ActivityTemplate>(`/api/v1/recurring-activities/${activityId}/template`);
  },

  // Obtener template según tipo de actividad
  getTemplate: async (activityId: number, activityType: 'scheduled' | 'recurring'): Promise<ActivityTemplate> => {
    if (activityType === 'scheduled') {
      return documentsApi.getActivityTemplate(activityId);
    } else {
      return documentsApi.getRecurringActivityTemplate(activityId);
    }
  },

  // Subir archivo (foto, firma, etc.)
  uploadFile: async (file: FormData): Promise<{ url: string; filename: string }> => {
    return apiRequest<{ url: string; filename: string }>('/api/v1/documents/upload', {
      method: 'POST',
      body: file,
      // No incluir Content-Type header para FormData, el browser lo manejará
      headers: {},
    });
  },

  // Obtener documentos del usuario actual
  getMyDocuments: async (params?: {
    activityId?: number;
    activityType?: 'scheduled' | 'recurring';
    status?: DocumentResponse['status'];
  }): Promise<DocumentResponse[]> => {
    const queryParams = new URLSearchParams();
    
    if (params?.activityId) {
      queryParams.append('activityId', params.activityId.toString());
    }
    if (params?.activityType) {
      queryParams.append('activityType', params.activityType);
    }
    if (params?.status) {
      queryParams.append('status', params.status);
    }

    const queryString = queryParams.toString();
    const url = `/api/v1/documents/my${queryString ? `?${queryString}` : ''}`;
    
    return apiRequest<DocumentResponse[]>(url);
  },

  // Obtener documento específico
  getById: async (id: string): Promise<DocumentResponse> => {
    return apiRequest<DocumentResponse>(`/api/v1/documents/${id}`);
  },
}; 