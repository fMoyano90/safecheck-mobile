import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { apiClient } from '../lib/api/config';

class DeviceTokenService {
  private token: string | null = null;
  private isRegistered = false;

  /**
   * Configura las notificaciones y obtiene permisos
   */
  async initialize(): Promise<boolean> {
    try {
      // Configurar el comportamiento de las notificaciones
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });

      // Verificar si es un dispositivo físico
      if (!Device.isDevice) {
        console.warn('⚠️ Las notificaciones push solo funcionan en dispositivos físicos');
        return false;
      }

      // Solicitar permisos
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('⚠️ Permisos de notificación denegados');
        return false;
      }

      // Obtener el token
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      
      if (!projectId || projectId === 'your-project-id-here') {
        console.error('❌ ProjectId no configurado. Por favor configura el projectId en app.json');
        return false;
      }
      
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: projectId,
      });

      this.token = tokenData.data;
      
      return true;
    } catch (error) {
      console.error('❌ Error inicializando notificaciones:', error);
      return false;
    }
  }

  /**
   * Registra el token en el backend
   */
  async registerToken(): Promise<boolean> {
    try {
      if (!this.token) {
        console.warn('⚠️ No hay token disponible para registrar');
        return false;
      }

      if (this.isRegistered) {
        return true;
      }

      const deviceInfo = {
        token: this.token,
        deviceId: Device.deviceName || 'unknown',
        platform: Platform.OS as 'ios' | 'android',
      };

      const response = await apiClient.post('/device-tokens/register', deviceInfo);
      
      if (response.data.success) {
        this.isRegistered = true;
        return true;
      } else {
        console.error('❌ Error registrando token:', response.data.message);
        return false;
      }
    } catch (error) {
      console.error('❌ Error en registerToken:', error);
      return false;
    }
  }

  /**
   * Desregistra el token del backend
   */
  async unregisterToken(): Promise<boolean> {
    try {
      if (!this.token) {
        console.warn('⚠️ No hay token para desregistrar');
        return true;
      }

      const response = await apiClient.delete('/device-tokens/unregister', {
        data: {
          token: this.token,
          deviceId: Device.deviceName || 'unknown',
        },
      });

      if (response.data.success) {
        this.isRegistered = false;
        return true;
      } else {
        console.error('❌ Error desregistrando token:', response.data.message);
        return false;
      }
    } catch (error) {
      console.error('❌ Error en unregisterToken:', error);
      return false;
    }
  }

  /**
   * Envía una notificación de prueba
   */
  async sendTestNotification(): Promise<boolean> {
    try {
      const response = await apiClient.post('/device-tokens/test');
      
      if (response.data.success) {
        return true;
      } else {
        console.error('❌ Error enviando notificación de prueba:', response.data.message);
        return false;
      }
    } catch (error) {
      console.error('❌ Error en sendTestNotification:', error);
      return false;
    }
  }

  /**
   * Obtiene el estado del token
   */
  async getTokenStatus() {
    try {
      const response = await apiClient.get('/device-tokens/status');
      return response.data;
    } catch (error) {
      console.error('❌ Error obteniendo estado del token:', error);
      return null;
    }
  }

  /**
   * Configura los listeners de notificaciones
   */
  setupNotificationListeners() {
    // Listener para notificaciones recibidas mientras la app está en primer plano
    const notificationListener = Notifications.addNotificationReceivedListener(notification => {
      // Aquí puedes manejar la notificación recibida
      // Por ejemplo, actualizar el estado de la aplicación
    });

    // Listener para cuando el usuario toca una notificación
    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      
      // Manejar la navegación basada en los datos de la notificación
      const data = response.notification.request.content.data;
      if (data?.actionUrl) {
        // Aquí puedes navegar a la pantalla correspondiente
      }
    });

    // Retornar función de limpieza
    return () => {
      Notifications.removeNotificationSubscription(notificationListener);
      Notifications.removeNotificationSubscription(responseListener);
    };
  }

  /**
   * Obtiene el token actual
   */
  getToken(): string | null {
    return this.token;
  }

  /**
   * Verifica si el token está registrado
   */
  isTokenRegistered(): boolean {
    return this.isRegistered;
  }

  /**
   * Reinicia el servicio (útil para logout)
   */
  reset() {
    this.token = null;
    this.isRegistered = false;
  }
}

// Exportar instancia singleton
export const deviceTokenService = new DeviceTokenService();
export default deviceTokenService;