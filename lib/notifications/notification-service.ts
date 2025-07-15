import * as Notifications from "expo-notifications";
import { io, Socket } from "socket.io-client";
import { tokenManager } from "../api/config";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { connectivityConfig } from "../config/connectivity-config";

// Configurar el comportamiento de las notificaciones
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

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
}

class NotificationService {
  private socket: Socket | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // 1 segundo inicial
  private listeners: Map<string, Function[]> = new Map();

  constructor() {
    this.setupNotificationPermissions();
  }

  // Configurar permisos de notificaciones
  private async setupNotificationPermissions() {
    try {
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") {
        console.warn("⚠️ Permisos de notificación no concedidos");
        return;
      }

      // Configurar canal de notificaciones para Android
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
          name: "Núcleo Gestor Notifications",
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#FF231F7C",
        });
      }

      console.log("✅ Permisos de notificación configurados");
    } catch (error) {
      console.error("❌ Error configurando permisos de notificación:", error);
    }
  }

  // Conectar al WebSocket del backend
  async connect() {
    try {
      // Verificar si ya hay una conexión activa
      if (this.socket && this.isConnected) {
        console.log("ℹ️ Ya hay una conexión WebSocket activa");
        return;
      }

      // Desconectar socket anterior si existe pero no está conectado
      if (this.socket && !this.isConnected) {
        this.socket.disconnect();
        this.socket = null;
      }

      const token = await tokenManager.getAccessToken();
      if (!token) {
        console.warn(
          "⚠️ No hay token de autenticación para conectar WebSocket"
        );
        return;
      }

      const API_BASE_URL =
        process.env.EXPO_PUBLIC_API_URL || "http://localhost:3030";
      const wsUrl = API_BASE_URL.replace(/^http/, "ws");

      this.socket = io(`${wsUrl}/events`, {
        auth: {
          token: token,
        },
        transports: ["websocket"],
        timeout: 10000,
      });

      this.setupSocketListeners();

      console.log("🔌 Intentando conectar al WebSocket...");
    } catch (error) {
      console.error("❌ Error conectando al WebSocket:", error);
    }
  }

  // Configurar listeners del socket
  private setupSocketListeners() {
    if (!this.socket) return;

    this.socket.on("connect", () => {
      // Solo mostrar mensaje de conexión si está permitido
      if (connectivityConfig.shouldShowReconnectionMessages()) {
        console.log("✅ Conectado al WebSocket");
      }
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000;
    });

    this.socket.on("disconnect", (reason) => {
      // Solo mostrar mensaje de desconexión si está permitido
      if (connectivityConfig.shouldShowReconnectionMessages()) {
        console.log("❌ Desconectado del WebSocket:", reason);
      }
      this.isConnected = false;
      this.handleReconnection();
    });

    this.socket.on("connect_error", (error) => {
      // Solo mostrar error de conexión si está permitido
      if (connectivityConfig.shouldShowReconnectionMessages()) {
        console.error("❌ Error de conexión WebSocket:", error);
      }
      this.isConnected = false;
      this.handleReconnection();
    });

    // Escuchar notificaciones
    this.socket.on("notification", (notification: NotificationData) => {
      this.handleIncomingNotification(notification);
    });

    // Escuchar eventos específicos de actividades
    this.socket.on("activity_assigned", (data) => {
      this.emit("activity_assigned", data);
    });

    this.socket.on("activity_completed", (data) => {
      this.emit("activity_completed", data);
    });

    this.socket.on("activity_reviewed", (data) => {
      this.emit("activity_reviewed", data);
    });

    // Ping/pong para mantener conexión
    this.socket.on("pong", (data) => {
      console.log("🏓 Pong recibido:", data);
    });
  }

  // Manejar reconexión automática
  private handleReconnection() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      // Solo mostrar mensaje si no está en modo silencioso
      if (connectivityConfig.shouldShowReconnectionMessages()) {
        console.error("❌ Máximo de intentos de reconexión alcanzado");
      }
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Backoff exponencial

    // Solo mostrar mensajes de reconexión si está permitido
    if (connectivityConfig.shouldShowReconnectionMessages()) {
      console.log(
        `🔄 Reintentando conexión en ${delay}ms (intento ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
      );
    }

    setTimeout(() => {
      this.connect();
    }, delay);
  }

  // Manejar notificación entrante
  private async handleIncomingNotification(notification: NotificationData) {
    try {
      console.log("📱 Notificación recibida:", notification);

      // Mostrar notificación push
      await this.showPushNotification(notification);

      // Guardar notificación localmente
      await this.saveNotificationLocally(notification);

      // Emitir evento para que los componentes puedan reaccionar
      this.emit("notification_received", notification);
    } catch (error) {
      console.error("❌ Error manejando notificación:", error);
    }
  }

  // Mostrar notificación push
  private async showPushNotification(notification: NotificationData) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: notification.title,
          body: notification.message,
          data: {
            notificationId: notification.id,
            activityId: notification.activityId,
            actionUrl: notification.actionUrl,
            ...notification.data,
          },
          priority: this.getPriorityLevel(notification.priority),
        },
        trigger: null, // Mostrar inmediatamente
      });
    } catch (error) {
      console.error("❌ Error mostrando notificación push:", error);
    }
  }

  // Convertir prioridad a nivel de Expo
  private getPriorityLevel(
    priority: string
  ): Notifications.AndroidNotificationPriority {
    switch (priority) {
      case "urgent":
        return Notifications.AndroidNotificationPriority.MAX;
      case "high":
        return Notifications.AndroidNotificationPriority.HIGH;
      case "normal":
        return Notifications.AndroidNotificationPriority.DEFAULT;
      case "low":
        return Notifications.AndroidNotificationPriority.LOW;
      default:
        return Notifications.AndroidNotificationPriority.DEFAULT;
    }
  }

  // Guardar notificación localmente
  private async saveNotificationLocally(notification: NotificationData) {
    try {
      const existingNotifications = await this.getLocalNotifications();
      
      // Verificar si la notificación ya existe para evitar duplicados
      const existingIndex = existingNotifications.findIndex(n => n.id === notification.id);
      
      let updatedNotifications;
      if (existingIndex !== -1) {
        // Si ya existe, actualizar la notificación existente
        updatedNotifications = [...existingNotifications];
        updatedNotifications[existingIndex] = notification;
      } else {
        // Si no existe, agregar al inicio
        updatedNotifications = [
          notification,
          ...existingNotifications,
        ].slice(0, 100); // Mantener solo las últimas 100
      }

      await AsyncStorage.setItem(
        "local_notifications",
        JSON.stringify(updatedNotifications)
      );
    } catch (error) {
      console.error("❌ Error guardando notificación localmente:", error);
    }
  }

  // Limpiar notificaciones duplicadas del almacenamiento
  private async cleanDuplicateNotifications(): Promise<NotificationData[]> {
    try {
      const notifications = await AsyncStorage.getItem("local_notifications");
      if (!notifications) return [];
      
      const parsedNotifications: NotificationData[] = JSON.parse(notifications);
      
      // Eliminar duplicados basándose en el ID
      const uniqueNotifications = parsedNotifications.filter((notification, index, self) => 
        index === self.findIndex(n => n.id === notification.id)
      );
      
      // Si había duplicados, guardar la versión limpia
      if (uniqueNotifications.length !== parsedNotifications.length) {
        await AsyncStorage.setItem("local_notifications", JSON.stringify(uniqueNotifications));
        console.log(`🧹 Eliminadas ${parsedNotifications.length - uniqueNotifications.length} notificaciones duplicadas`);
      }
      
      return uniqueNotifications;
    } catch (error) {
      console.error("❌ Error limpiando notificaciones duplicadas:", error);
      return [];
    }
  }

  // Obtener notificaciones locales
  async getLocalNotifications(): Promise<NotificationData[]> {
    try {
      return await this.cleanDuplicateNotifications();
    } catch (error) {
      console.error("❌ Error obteniendo notificaciones locales:", error);
      return [];
    }
  }

  // Marcar notificación como leída
  async markNotificationAsRead(notificationId: string) {
    try {
      const notifications = await this.getLocalNotifications();
      const updatedNotifications = notifications.map((n) =>
        n.id === notificationId ? { ...n, read: true } : n
      );

      await AsyncStorage.setItem(
        "local_notifications",
        JSON.stringify(updatedNotifications)
      );
      this.emit("notification_read", notificationId);
    } catch (error) {
      console.error("❌ Error marcando notificación como leída:", error);
    }
  }

  // Limpiar notificaciones locales
  async clearLocalNotifications() {
    try {
      await AsyncStorage.removeItem("local_notifications");
      this.emit("notifications_cleared");
    } catch (error) {
      console.error("❌ Error limpiando notificaciones:", error);
    }
  }

  // Sistema de eventos personalizado
  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  off(event: string, callback: Function) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      const index = eventListeners.indexOf(callback);
      if (index > -1) {
        eventListeners.splice(index, 1);
      }
    }
  }

  private emit(event: string, data?: any) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach((callback) => callback(data));
    }
  }

  // Enviar ping para mantener conexión
  ping() {
    if (this.socket && this.isConnected) {
      this.socket.emit("ping");
    }
  }

  // Desconectar
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  // Obtener estado de conexión
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
    };
  }
}

// Instancia singleton
export const notificationService = new NotificationService();
export default notificationService;