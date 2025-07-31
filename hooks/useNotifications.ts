import { useEffect, useState, useCallback } from "react";
import { AppState, AppStateStatus } from "react-native";
import * as Notifications from "expo-notifications";
import { notificationService } from "../lib/notifications/notification-service";
import { tokenManager } from "../lib/api/config";

interface NotificationData {
  id: string;
  title: string;
  message: string;
  type: "activity" | "review" | "warning" | "info" | "success" | "error";
  timestamp: Date;
  priority: "low" | "normal" | "high" | "urgent";
  actionUrl?: string;
  activityId?: number;
  activityName?: string;
  data?: any;
  read?: boolean;
}

interface UseNotificationsReturn {
  notifications: NotificationData[];
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

export const useNotifications = (): UseNotificationsReturn => {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState({
    isConnected: false,
    reconnectAttempts: 0,
  });

  // Cargar notificaciones locales
  const loadLocalNotifications = useCallback(async () => {
    try {
      const localNotifications =
        await notificationService.getLocalNotifications();
      
      // Asegurar que no hay duplicados en el estado
      const uniqueNotifications = localNotifications.filter((notification, index, self) => 
        index === self.findIndex(n => n.id === notification.id)
      );
      
      setNotifications(uniqueNotifications);
    } catch (error) {
      console.error("❌ Error cargando notificaciones locales:", error);
    }
  }, []);

  // Conectar al servicio de notificaciones
  const connectNotificationService = useCallback(async () => {
    try {
      const isAuthenticated = await tokenManager.isAuthenticated();
      if (isAuthenticated) {
        await notificationService.connect();
        const status = notificationService.getConnectionStatus();
        setConnectionStatus(status);
        setIsConnected(status.isConnected);
      }
    } catch (error) {
      console.error("❌ Error conectando servicio de notificaciones:", error);
    }
  }, []);

  // Manejar nueva notificación
  const handleNewNotification = useCallback(
    (notification: NotificationData) => {
      setNotifications((prev) => {
        // Verificar si la notificación ya existe para evitar duplicados
        const existingIndex = prev.findIndex(n => n.id === notification.id);
        if (existingIndex !== -1) {
          // Si ya existe, actualizar la notificación existente
          const updated = [...prev];
          updated[existingIndex] = notification;
          return updated;
        }
        // Si no existe, agregar al inicio
        return [notification, ...prev];
      });
    },
    []
  );

  // Manejar notificación leída
  const handleNotificationRead = useCallback((notificationId: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
    );
  }, []);

  // Manejar limpieza de notificaciones
  const handleNotificationsCleared = useCallback(() => {
    setNotifications([]);
  }, []);

  // Marcar notificación como leída
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await notificationService.markNotificationAsRead(notificationId);
    } catch (error) {
      console.error("❌ Error marcando notificación como leída:", error);
    }
  }, []);

  // Limpiar todas las notificaciones
  const clearAll = useCallback(async () => {
    try {
      await notificationService.clearLocalNotifications();
    } catch (error) {
      console.error("❌ Error limpiando notificaciones:", error);
    }
  }, []);

  // Refrescar notificaciones
  const refreshNotifications = useCallback(async () => {
    await loadLocalNotifications();
    const status = notificationService.getConnectionStatus();
    setConnectionStatus(status);
    setIsConnected(status.isConnected);
  }, [loadLocalNotifications]);

  // Manejar cambios en el estado de la app
  const handleAppStateChange = useCallback(
    async (nextAppState: AppStateStatus) => {
      if (nextAppState === "active") {
        // Cuando la app se activa, reconectar si es necesario
        const isAuthenticated = await tokenManager.isAuthenticated();
        if (isAuthenticated && !isConnected) {
          await connectNotificationService();
        }
        await refreshNotifications();
      }
    },
    [isConnected, connectNotificationService, refreshNotifications]
  );

  // Manejar notificaciones recibidas cuando la app está en primer plano
  const handleNotificationReceived = useCallback(
    (notification: Notifications.Notification) => {
      console.log("📱 Notificación recibida en primer plano:", notification);
      // La notificación ya se maneja en el servicio, aquí solo logueamos
    },
    []
  );

  // Manejar tap en notificación
  const handleNotificationResponse = useCallback(
    (response: Notifications.NotificationResponse) => {
      console.log("👆 Usuario tocó notificación:", response);

      const notificationData = response.notification.request.content.data;
      if (notificationData && typeof notificationData === 'object' && 'notificationId' in notificationData && typeof notificationData.notificationId === 'string') {
        markAsRead(notificationData.notificationId);
      }

      // Aquí podrías navegar a una pantalla específica basada en actionUrl
      if (notificationData?.actionUrl) {
        console.log("🔗 Navegar a:", notificationData.actionUrl);
        // Implementar navegación según tu router
      }
    },
    [markAsRead]
  );

  // Configurar listeners al montar el componente
  useEffect(() => {
    // Cargar notificaciones locales
    loadLocalNotifications();

    // Conectar al servicio
    connectNotificationService();

    // Configurar listeners del servicio de notificaciones
    notificationService.on("notification_received", handleNewNotification);
    notificationService.on("notification_read", handleNotificationRead);
    notificationService.on("notifications_cleared", handleNotificationsCleared);

    // Configurar listeners de Expo Notifications
    const notificationListener = Notifications.addNotificationReceivedListener(
      handleNotificationReceived
    );
    const responseListener =
      Notifications.addNotificationResponseReceivedListener(
        handleNotificationResponse
      );

    // Configurar listener de cambios en el estado de la app
    const appStateSubscription = AppState.addEventListener(
      "change",
      handleAppStateChange
    );

    // Configurar ping periódico para mantener conexión
    const pingInterval = setInterval(() => {
      notificationService.ping();
    }, 30000); // Cada 30 segundos

    // Cleanup
    return () => {
      notificationService.off("notification_received", handleNewNotification);
      notificationService.off("notification_read", handleNotificationRead);
      notificationService.off(
        "notifications_cleared",
        handleNotificationsCleared
      );

      notificationListener.remove();
      responseListener.remove();
      appStateSubscription.remove();
      clearInterval(pingInterval);
    };
  }, []);

  // Calcular notificaciones no leídas
  const unreadCount = notifications.filter((n) => !n.read).length;

  return {
    notifications,
    unreadCount,
    isConnected,
    markAsRead,
    clearAll,
    refreshNotifications,
    connectionStatus,
  };
};

export default useNotifications;