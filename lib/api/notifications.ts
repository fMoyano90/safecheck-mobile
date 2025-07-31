import { apiRequest } from './config';

// Tipos para notificaciones
export interface PushNotification {
  id: number;
  userId: number;
  title: string;
  body: string;
  data?: Record<string, any>;
  type: 'signature_request' | 'activity_assigned' | 'document_approved' | 'general';
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  sentAt?: string;
  readAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SendNotificationData {
  userId: number;
  title: string;
  body: string;
  data?: Record<string, any>;
  type: PushNotification['type'];
}

export interface RegisterDeviceData {
  deviceToken: string;
  platform: 'ios' | 'android';
  deviceInfo?: {
    model?: string;
    osVersion?: string;
    appVersion?: string;
  };
}

// API functions para notificaciones
export const notificationsApi = {
  // Registrar dispositivo para notificaciones push
  registerDevice: async (data: RegisterDeviceData): Promise<void> => {
    return apiRequest<void>('/api/v1/notifications/register-device', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Enviar notificación push
  sendNotification: async (data: SendNotificationData): Promise<PushNotification> => {
    return apiRequest<PushNotification>('/api/v1/notifications/send', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Obtener notificaciones del usuario actual
  getMyNotifications: async (params?: {
    type?: PushNotification['type'];
    status?: PushNotification['status'];
    limit?: number;
    offset?: number;
  }): Promise<PushNotification[]> => {
    const queryParams = new URLSearchParams();
    
    if (params?.type) {
      queryParams.append('type', params.type);
    }
    if (params?.status) {
      queryParams.append('status', params.status);
    }
    if (params?.limit) {
      queryParams.append('limit', params.limit.toString());
    }
    if (params?.offset) {
      queryParams.append('offset', params.offset.toString());
    }

    const queryString = queryParams.toString();
    const endpoint = queryString ? `/api/v1/notifications/my-notifications?${queryString}` : '/api/v1/notifications/my-notifications';
    
    return apiRequest<PushNotification[]>(endpoint);
  },

  // Marcar notificación como leída
  markAsRead: async (notificationId: number): Promise<void> => {
    return apiRequest<void>(`/api/v1/notifications/${notificationId}/read`, {
      method: 'PUT',
    });
  },

  // Marcar todas las notificaciones como leídas
  markAllAsRead: async (): Promise<void> => {
    return apiRequest<void>('/api/v1/notifications/mark-all-read', {
      method: 'PUT',
    });
  },

  // Obtener contador de notificaciones no leídas
  getUnreadCount: async (): Promise<{ count: number }> => {
    return apiRequest<{ count: number }>('/api/v1/notifications/unread-count');
  },
};