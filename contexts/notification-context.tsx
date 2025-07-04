import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAuth } from './auth-context';
import { notificationService } from '../lib/notifications/notification-service';
import { deviceTokenService } from '../services/deviceTokenService';
import { tokenManager } from '../lib/api/config';
import useNotifications from '../hooks/useNotifications';

interface NotificationContextType {
  notifications: any[];
  unreadCount: number;
  isConnected: boolean;
  markAsRead: (notificationId: string) => Promise<void>;
  clearAll: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  connectionStatus: {
    isConnected: boolean;
    reconnectAttempts: number;
  };
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotificationContext = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotificationContext must be used within a NotificationProvider');
  }
  return context;
};

interface NotificationProviderProps {
  children: React.ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const notificationHook = useNotifications();
  const { user } = useAuth();
  const [isInitialized, setIsInitialized] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Inicializar el servicio de notificaciones cuando el usuario esté autenticado
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let notificationCleanup: (() => void) | undefined;

    const initializeNotifications = async () => {
      if (user) {
        try {
          setIsConnecting(true);
          
          // Inicializar notificaciones push
          const pushInitialized = await deviceTokenService.initialize();
          if (pushInitialized) {
            await deviceTokenService.registerToken();
            // Configurar listeners de notificaciones
            notificationCleanup = deviceTokenService.setupNotificationListeners();
          }
          
          // La conexión WebSocket se maneja en useNotifications hook
          setConnectionError(null);
        } catch (error) {
          console.error('Error conectando notificaciones:', error);
          setConnectionError('Error de conexión');
        } finally {
          setIsConnecting(false);
        }
      } else {
        // Desconectar si no hay usuario
        notificationService.disconnect();
        deviceTokenService.unregisterToken();
      }
    };

    initializeNotifications();

    return () => {
      if (cleanup) cleanup();
      if (notificationCleanup) notificationCleanup();
    };
  }, [user]);

  // Manejar cambios en el estado de autenticación
  useEffect(() => {
    const checkAuthAndReconnect = async () => {
      const isAuthenticated = await tokenManager.isAuthenticated();
      if (!isAuthenticated && isInitialized) {
        // Usuario se deslogueó, desconectar notificaciones
        notificationService.disconnect();
        setIsInitialized(false);
      } else if (isAuthenticated && !isInitialized) {
        // Usuario se logueó, la conexión se maneja en useNotifications hook
        setIsInitialized(true);
      }
    };

    // Verificar cada 30 segundos
    const interval = setInterval(checkAuthAndReconnect, 30000);
    
    return () => clearInterval(interval);
  }, [isInitialized]);

  // Manejar cambios en el estado de la app
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        // App se activó, reconectar si es necesario
        const isAuthenticated = await tokenManager.isAuthenticated();
        if (isAuthenticated && !notificationService.getConnectionStatus().isConnected) {
          console.log('🔄 Reconexión se maneja en useNotifications hook');
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      if (isInitialized) {
        notificationService.disconnect();
      }
    };
  }, []);

  return (
    <NotificationContext.Provider value={notificationHook}>
      {children}
    </NotificationContext.Provider>
  );
};

export default NotificationProvider;