import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { apiRequest } from '@/lib/api/config';

export interface PushNotificationData {
  type: 'signature_request' | 'signature_reminder' | 'signature_completed';
  documentId: number;
  signatureId: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  documentTitle?: string;
  requestedBy?: string;
  signerName?: string;
  [key: string]: any;
}

export interface NotificationPreferences {
  pushEnabled: boolean;
  emailEnabled: boolean;
  signatureRequests: boolean;
  signatureReminders: boolean;
  signatureCompleted: boolean;
}

class PushNotificationService {
  private expoPushToken: string | null = null;
  private isInitialized = false;

  constructor() {
    this.setupNotificationHandler();
  }

  private setupNotificationHandler() {
    // Configurar cómo se muestran las notificaciones cuando la app está en primer plano
    Notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        const data = notification.request.content.data as PushNotificationData;
        
        return {
          shouldShowAlert: true,
          shouldPlaySound: data.priority === 'critical' || data.priority === 'high',
          shouldSetBadge: true,
        };
      },
    });
  }

  async initialize(): Promise<string | null> {
    try {
      if (this.isInitialized && this.expoPushToken) {
        return this.expoPushToken;
      }

      // Verificar si es un dispositivo físico
      if (!Device.isDevice) {
        console.warn('Las notificaciones push solo funcionan en dispositivos físicos');
        return null;
      }

      // Solicitar permisos
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('Permisos de notificación denegados');
        return null;
      }

      // Obtener token de Expo
      const token = await Notifications.getExpoPushTokenAsync({
        projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
      });

      this.expoPushToken = token.data;
      this.isInitialized = true;

      // Registrar token en el backend
      await this.registerDeviceToken(this.expoPushToken);

      console.log('✅ Notificaciones push inicializadas:', this.expoPushToken);
      return this.expoPushToken;
    } catch (error) {
      console.error('❌ Error inicializando notificaciones push:', error);
      return null;
    }
  }

  async registerDeviceToken(token: string): Promise<void> {
    try {
      const platform = Platform.OS as 'ios' | 'android';
      
      await apiRequest('/push-notifications/register-token', {
        method: 'POST',
        body: JSON.stringify({
          deviceToken: token,
          platform,
        }),
      });

      console.log('✅ Token de dispositivo registrado en el backend');
    } catch (error) {
      console.error('❌ Error registrando token de dispositivo:', error);
    }
  }

  async unregisterDeviceToken(): Promise<void> {
    try {
      if (!this.expoPushToken) return;

      await apiRequest('/push-notifications/unregister-token', {
        method: 'POST',
        body: JSON.stringify({
          deviceToken: this.expoPushToken,
        }),
      });

      console.log('✅ Token de dispositivo desregistrado del backend');
    } catch (error) {
      console.error('❌ Error desregistrando token de dispositivo:', error);
    }
  }

  async updateNotificationPreferences(preferences: NotificationPreferences): Promise<void> {
    try {
      await apiRequest('/push-notifications/preferences', {
        method: 'PUT',
        body: JSON.stringify(preferences),
      });

      console.log('✅ Preferencias de notificación actualizadas');
    } catch (error) {
      console.error('❌ Error actualizando preferencias:', error);
    }
  }

  async getNotificationPreferences(): Promise<NotificationPreferences | null> {
    try {
      const response = await apiRequest<{success: boolean; data: NotificationPreferences}>(
        '/push-notifications/preferences'
      );

      return response.success ? response.data : null;
    } catch (error) {
      console.error('❌ Error obteniendo preferencias:', error);
      return null;
    }
  }

  // Configurar listeners para notificaciones
  addNotificationReceivedListener(listener: (notification: Notifications.Notification) => void) {
    return Notifications.addNotificationReceivedListener(listener);
  }

  addNotificationResponseReceivedListener(
    listener: (response: Notifications.NotificationResponse) => void
  ) {
    return Notifications.addNotificationResponseReceivedListener(listener);
  }

  // Manejar navegación basada en notificaciones
  handleNotificationNavigation(data: PushNotificationData, router: any) {
    switch (data.type) {
      case 'signature_request':
      case 'signature_reminder':
        // Navegar a la pantalla de firmas pendientes
        router.push('/pending-signatures');
        break;
      
      case 'signature_completed':
        // Navegar al historial o detalles del documento
        router.push({
          pathname: '/modal',
          params: {
            documentId: data.documentId,
            mode: 'view'
          }
        });
        break;
      
      default:
        console.log('Tipo de notificación no manejado:', data.type);
    }
  }

  // Programar notificación local (para recordatorios)
  async scheduleLocalNotification(
    title: string,
    body: string,
    data: PushNotificationData,
    triggerDate: Date
  ): Promise<string> {
    try {
      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: data.priority === 'critical' ? 'default' : undefined,
        },
        trigger: {
          date: triggerDate,
        },
      });

      console.log('✅ Notificación local programada:', identifier);
      return identifier;
    } catch (error) {
      console.error('❌ Error programando notificación local:', error);
      throw error;
    }
  }

  // Cancelar notificación local
  async cancelLocalNotification(identifier: string): Promise<void> {
    try {
      await Notifications.cancelScheduledNotificationAsync(identifier);
      console.log('✅ Notificación local cancelada:', identifier);
    } catch (error) {
      console.error('❌ Error cancelando notificación local:', error);
    }
  }

  // Limpiar todas las notificaciones
  async clearAllNotifications(): Promise<void> {
    try {
      await Notifications.dismissAllNotificationsAsync();
      console.log('✅ Todas las notificaciones limpiadas');
    } catch (error) {
      console.error('❌ Error limpiando notificaciones:', error);
    }
  }

  // Obtener badge count
  async getBadgeCount(): Promise<number> {
    try {
      return await Notifications.getBadgeCountAsync();
    } catch (error) {
      console.error('❌ Error obteniendo badge count:', error);
      return 0;
    }
  }

  // Establecer badge count
  async setBadgeCount(count: number): Promise<void> {
    try {
      await Notifications.setBadgeCountAsync(count);
    } catch (error) {
      console.error('❌ Error estableciendo badge count:', error);
    }
  }

  getToken(): string | null {
    return this.expoPushToken;
  }

  isReady(): boolean {
    return this.isInitialized && this.expoPushToken !== null;
  }
}

export const pushNotificationService = new PushNotificationService();
export default pushNotificationService;