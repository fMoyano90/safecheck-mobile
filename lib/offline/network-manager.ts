import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { EventEmitter } from 'events';
import { connectivityConfig } from '../config/connectivity-config';

export interface NetworkState {
  isConnected: boolean;
  isInternetReachable: boolean;
  type: string;
  hasStrongConnection: boolean;
}

class NetworkManager extends EventEmitter {
  private currentState: NetworkState = {
    isConnected: false,
    isInternetReachable: false,
    type: 'none',
    hasStrongConnection: false,
  };

  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Obtener estado inicial
    const initialState = await NetInfo.fetch();
    this.updateNetworkState(initialState);

    // Escuchar cambios
    NetInfo.addEventListener(this.handleNetworkChange);
    
    this.initialized = true;
    console.log('🌐 NetworkManager inicializado:', this.currentState);
  }

  private handleNetworkChange = (state: NetInfoState) => {
    const previousState = { ...this.currentState };
    this.updateNetworkState(state);
    
    // Emitir eventos solo si hay cambios significativos
    if (previousState.isConnected !== this.currentState.isConnected) {
      this.emit('connectionChange', this.currentState);
      
      if (this.currentState.isConnected) {
        // Solo mostrar mensaje si está permitido
        if (connectivityConfig.shouldShowConnectionNotification()) {
          console.log('🟢 Conexión restaurada');
        }
        this.emit('connected', this.currentState);
      } else {
        // Solo mostrar mensaje si está permitido
        if (connectivityConfig.shouldShowConnectionNotification()) {
          console.log('🔴 Conexión perdida');
        }
        this.emit('disconnected', this.currentState);
      }
    }

    if (previousState.hasStrongConnection !== this.currentState.hasStrongConnection) {
      this.emit('connectionQualityChange', this.currentState);
    }
  };

  private updateNetworkState(state: NetInfoState): void {
    console.log('🔍 NetInfo state:', {
      isConnected: state.isConnected,
      isInternetReachable: state.isInternetReachable,
      type: state.type,
      details: state.details
    });
    
    const hasStrongConnection = this.evaluateConnectionQuality(state);
    
    this.currentState = {
      isConnected: !!state.isConnected,
      // Ser más tolerante con isInternetReachable - si es null, asumir true si isConnected es true
      isInternetReachable: state.isInternetReachable !== false,
      type: state.type || 'none',
      hasStrongConnection,
    };
    
    console.log('🔍 Updated NetworkState:', this.currentState);
  }

  private evaluateConnectionQuality(state: NetInfoState): boolean {
    // Usar la misma lógica tolerante que en updateNetworkState
    const isInternetReachable = state.isInternetReachable !== false;
    
    if (!state.isConnected || !isInternetReachable) {
      return false;
    }

    // Para WiFi, considerar fuerte a menos que la señal sea muy débil
    if (state.type === 'wifi' && state.details) {
      const wifiDetails = state.details as any;
      // Solo considerar débil si la fuerza de señal es muy baja (< -85 dBm)
      return wifiDetails.strength ? wifiDetails.strength > -85 : true;
    }

    // Para datos móviles, ser más permisivo
    if (state.type === 'cellular' && state.details) {
      const cellularDetails = state.details as any;
      // Considerar fuerte 4G/5G, aceptable 3G, solo rechazar 2G o inferior
      const generation = cellularDetails.cellularGeneration;
      return generation !== '2g' && generation !== 'edge' && generation !== 'gprs';
    }

    // Por defecto, si hay conexión estable, considerarla fuerte
    return true;
  }

  async testConnectivity(): Promise<boolean> {
    try {
      // Hacer un test real de conectividad con un ping rápido
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 segundos timeout

      const response = await fetch('https://www.google.com/generate_204', {
        method: 'HEAD',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      console.warn('❌ Test de conectividad falló:', error);
      return false;
    }
  }

  getState(): NetworkState {
    return { ...this.currentState };
  }

  isOnline(): boolean {
    // Si isInternetReachable es explícitamente false, respetarlo
    if (this.currentState.isInternetReachable === false) {
      return false;
    }
    
    // Si tenemos conexión pero isInternetReachable es null/undefined, asumir que hay internet
    return this.currentState.isConnected;
  }

  hasStrongConnection(): boolean {
    return this.currentState.hasStrongConnection;
  }

  // Método para verificar si es seguro hacer una operación costosa
  isSafeForUpload(): boolean {
    return this.isOnline() && this.hasStrongConnection();
  }

  // Método para verificar si podemos hacer operaciones básicas
  canMakeRequests(): boolean {
    return this.isOnline();
  }

  // Método alternativo que hace test real de conectividad
  async isOnlineWithTest(): Promise<boolean> {
    if (!this.currentState.isConnected) {
      return false;
    }
    
    // Si isInternetReachable es explícitamente true, confiar en él
    if (this.currentState.isInternetReachable === true) {
      return true;
    }
    
    // Si es null o false, hacer test real
    return await this.testConnectivity();
  }
}

// Instancia singleton
export const networkManager = new NetworkManager();