/**
 * Configuración para el manejo de conectividad en entornos mineros
 * Permite personalizar cómo se muestran los mensajes de conexión
 */

export interface ConnectivityConfig {
  // Modo silencioso: no mostrar alertas de conexión
  silentMode: boolean;
  
  // Mostrar solo indicador visual discreto
  showOnlyIndicator: boolean;
  
  // Ocultar mensajes de reconexión automática
  hideReconnectionMessages: boolean;
  
  // Ocultar alertas de sincronización
  hideSyncAlerts: boolean;
  
  // Tiempo mínimo entre notificaciones de conexión (ms)
  notificationCooldown: number;
  
  // Entorno de trabajo (minero requiere configuración especial)
  environment: 'office' | 'mining' | 'field';
}

// Configuración por defecto para entornos mineros
const MINING_CONFIG: ConnectivityConfig = {
  silentMode: true,
  showOnlyIndicator: true,
  hideReconnectionMessages: true,
  hideSyncAlerts: false, // Mantener alertas de sincronización importantes
  notificationCooldown: 300000, // 5 minutos
  environment: 'mining'
};

// Configuración por defecto para oficina
const OFFICE_CONFIG: ConnectivityConfig = {
  silentMode: false,
  showOnlyIndicator: false,
  hideReconnectionMessages: false,
  hideSyncAlerts: false,
  notificationCooldown: 30000, // 30 segundos
  environment: 'office'
};

// Configuración por defecto para campo
const FIELD_CONFIG: ConnectivityConfig = {
  silentMode: false,
  showOnlyIndicator: true,
  hideReconnectionMessages: true,
  hideSyncAlerts: false,
  notificationCooldown: 120000, // 2 minutos
  environment: 'field'
};

class ConnectivityConfigManager {
  private config: ConnectivityConfig = MINING_CONFIG; // Por defecto usar configuración minera
  private lastNotificationTime = 0;

  /**
   * Establece la configuración de conectividad
   */
  setConfig(config: Partial<ConnectivityConfig>) {
    this.config = { ...this.config, ...config };
  }

  /**
   * Obtiene la configuración actual
   */
  getConfig(): ConnectivityConfig {
    return { ...this.config };
  }

  /**
   * Establece configuración predefinida según el entorno
   */
  setEnvironment(environment: 'office' | 'mining' | 'field') {
    switch (environment) {
      case 'mining':
        this.config = { ...MINING_CONFIG };
        break;
      case 'office':
        this.config = { ...OFFICE_CONFIG };
        break;
      case 'field':
        this.config = { ...FIELD_CONFIG };
        break;
    }
  }

  /**
   * Verifica si se debe mostrar una notificación de conexión
   */
  shouldShowConnectionNotification(): boolean {
    if (this.config.silentMode) {
      return false;
    }

    const now = Date.now();
    if (now - this.lastNotificationTime < this.config.notificationCooldown) {
      return false;
    }

    this.lastNotificationTime = now;
    return true;
  }

  /**
   * Verifica si se debe mostrar mensajes de reconexión
   */
  shouldShowReconnectionMessages(): boolean {
    return !this.config.hideReconnectionMessages && !this.config.silentMode;
  }

  /**
   * Verifica si se debe mostrar alertas de sincronización
   */
  shouldShowSyncAlerts(): boolean {
    return !this.config.hideSyncAlerts;
  }

  /**
   * Verifica si solo se debe mostrar el indicador visual
   */
  shouldShowOnlyIndicator(): boolean {
    return this.config.showOnlyIndicator;
  }

  /**
   * Verifica si está en modo silencioso
   */
  isSilentMode(): boolean {
    return this.config.silentMode;
  }
}

// Instancia singleton
export const connectivityConfig = new ConnectivityConfigManager();
export default connectivityConfig;