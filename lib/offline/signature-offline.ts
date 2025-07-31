import AsyncStorage from '@react-native-async-storage/async-storage';
import { syncManager } from './sync-manager';
import * as Location from 'expo-location';
import * as Device from 'expo-device';

// Tipos específicos para firmas offline
export interface OfflineSignature {
  id: string;
  documentId: number;
  userId: number;
  signatureData: {
    visualSignature?: string;
    acceptanceText: string;
    signatureMethod: 'digital_signature' | 'acceptance_checkbox';
    geolocation: {
      latitude: number;
      longitude: number;
      accuracy?: number;
      timestamp: string;
    };
    deviceInfo: {
      platform: string;
      version: string;
      model?: string;
      userAgent: string;
      screenResolution: string;
      timezone: string;
      language: string;
    };
    timestamp: string;
    documentHash?: string;
  };
  status: 'pending_sync' | 'synced' | 'failed' | 'expired';
  attempts: number;
  createdAt: string;
  priority: 'critical' | 'high' | 'medium';
  miningType?: MiningSignatureType;
  expiresAt: string; // 24 horas desde creación
}

export enum MiningSignatureType {
  SAFETY_INSPECTION = 'safety_inspection',
  EQUIPMENT_CHECK = 'equipment_check',
  INCIDENT_REPORT = 'incident_report',
  SHIFT_HANDOVER = 'shift_handover',
  EMERGENCY_PROCEDURE = 'emergency_procedure',
  DAILY_REPORT = 'daily_report',
}

export interface SignatureValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

class SignatureOfflineManager {
  private readonly STORAGE_KEY = 'offline_signatures';
  private readonly MINING_AREA_BOUNDS = {
    // Coordenadas del área minera autorizada (ejemplo)
    north: -23.5000,
    south: -23.6000,
    east: -46.5000,
    west: -46.7000,
  };

  // Prioridades por tipo de firma minera
  private readonly MINING_PRIORITIES = {
    [MiningSignatureType.EMERGENCY_PROCEDURE]: 'critical' as const,
    [MiningSignatureType.SAFETY_INSPECTION]: 'critical' as const,
    [MiningSignatureType.INCIDENT_REPORT]: 'high' as const,
    [MiningSignatureType.EQUIPMENT_CHECK]: 'high' as const,
    [MiningSignatureType.SHIFT_HANDOVER]: 'medium' as const,
    [MiningSignatureType.DAILY_REPORT]: 'medium' as const,
  };

  /**
   * Crear una firma offline
   */
  async createOfflineSignature({
    documentId,
    userId,
    acceptanceText,
    requiresVisualSignature = false,
    visualSignature,
    miningType = MiningSignatureType.DAILY_REPORT,
  }: {
    documentId: number;
    userId: number;
    acceptanceText: string;
    requiresVisualSignature?: boolean;
    visualSignature?: string;
    miningType?: MiningSignatureType;
  }): Promise<OfflineSignature> {
    try {
      // Obtener geolocalización
      const location = await this.getCurrentLocation();
      
      // Obtener información del dispositivo
      const deviceInfo = await this.getDeviceInfo();
      
      // Crear firma offline
      const offlineSignature: OfflineSignature = {
        id: `offline_sig_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        documentId,
        userId,
        signatureData: {
          visualSignature: requiresVisualSignature ? visualSignature : undefined,
          acceptanceText,
          signatureMethod: requiresVisualSignature ? 'digital_signature' : 'acceptance_checkbox',
          geolocation: {
            latitude: location.latitude,
            longitude: location.longitude,
            accuracy: location.accuracy,
            timestamp: new Date().toISOString(),
          },
          deviceInfo,
          timestamp: new Date().toISOString(),
        },
        status: 'pending_sync',
        attempts: 0,
        createdAt: new Date().toISOString(),
        priority: this.MINING_PRIORITIES[miningType],
        miningType,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 horas
      };

      // Validar firma antes de guardar
      const validation = await this.validateOfflineSignature(offlineSignature);
      if (!validation.isValid) {
        throw new Error(`Firma inválida: ${validation.errors.join(', ')}`);
      }

      // Guardar localmente
      await this.saveOfflineSignature(offlineSignature);
      
      // Añadir a cola de sincronización
      await this.addToSyncQueue(offlineSignature);
      
      return offlineSignature;
    } catch (error) {
      console.error('❌ Error creando firma offline:', error);
      throw error;
    }
  }

  /**
   * Validar firma offline
   */
  async validateOfflineSignature(signature: OfflineSignature): Promise<SignatureValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // 1. Validar expiración (24 horas)
      const now = new Date();
      const expiresAt = new Date(signature.expiresAt);
      if (now > expiresAt) {
        errors.push('Firma expirada (más de 24 horas)');
      }

      // 2. Validar geolocalización (área minera)
      const { latitude, longitude } = signature.signatureData.geolocation;
      if (!this.isInMiningArea(latitude, longitude)) {
        errors.push('Ubicación fuera del área minera autorizada');
      }

      // 3. Validar datos requeridos
      if (!signature.signatureData.acceptanceText) {
        errors.push('Texto de aceptación requerido');
      }

      if (!signature.signatureData.deviceInfo.platform) {
        errors.push('Información de dispositivo incompleta');
      }

      // 4. Validar firma visual si es requerida
      if (signature.signatureData.signatureMethod === 'digital_signature' && 
          !signature.signatureData.visualSignature) {
        errors.push('Firma visual requerida pero no proporcionada');
      }

      // 5. Advertencias
      const signatureTime = new Date(signature.createdAt);
      const hoursDiff = (now.getTime() - signatureTime.getTime()) / (1000 * 60 * 60);
      
      if (hoursDiff > 12) {
        warnings.push('Firma creada hace más de 12 horas');
      }

      if (signature.signatureData.geolocation.accuracy && 
          signature.signatureData.geolocation.accuracy > 100) {
        warnings.push('Precisión de GPS baja (>100m)');
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [`Error de validación: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings: [],
      };
    }
  }

  /**
   * Obtener firmas offline pendientes
   */
  async getPendingSignatures(): Promise<OfflineSignature[]> {
    const signatures = await this.getAllOfflineSignatures();
    return signatures.filter(s => s.status === 'pending_sync' && !this.isExpired(s));
  }

  /**
   * Obtener firmas críticas pendientes
   */
  async getCriticalPendingSignatures(): Promise<OfflineSignature[]> {
    const pending = await this.getPendingSignatures();
    return pending.filter(s => s.priority === 'critical');
  }

  /**
   * Sincronizar firmas pendientes
   */
  async syncPendingSignatures(): Promise<{
    synced: number;
    failed: number;
    errors: string[];
  }> {
    const pendingSignatures = await this.getPendingSignatures();
    let synced = 0;
    let failed = 0;
    const errors: string[] = [];

    // Procesar firmas críticas primero
    const critical = pendingSignatures.filter(s => s.priority === 'critical');
    const others = pendingSignatures.filter(s => s.priority !== 'critical');
    
    const orderedSignatures = [...critical, ...others];

    for (const signature of orderedSignatures) {
      try {
        await this.syncSingleSignature(signature);
        synced++;
      } catch (error) {
        failed++;
        errors.push(`${signature.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        console.error(`❌ Error sincronizando firma ${signature.id}:`, error);
        
        // Incrementar intentos
        signature.attempts++;
        if (signature.attempts >= 5) {
          signature.status = 'failed';
        }
        await this.updateOfflineSignature(signature);
      }
    }

    return { synced, failed, errors };
  }

  /**
   * Limpiar firmas expiradas
   */
  async cleanupExpiredSignatures(): Promise<number> {
    const signatures = await this.getAllOfflineSignatures();
    const expired = signatures.filter(s => this.isExpired(s));
    
    for (const signature of expired) {
      signature.status = 'expired';
      await this.updateOfflineSignature(signature);
    }
    
    return expired.length;
  }

  /**
   * Obtener estadísticas de firmas offline
   */
  async getSignatureStats(): Promise<{
    total: number;
    pending: number;
    synced: number;
    failed: number;
    expired: number;
    critical: number;
  }> {
    const signatures = await this.getAllOfflineSignatures();
    
    return {
      total: signatures.length,
      pending: signatures.filter(s => s.status === 'pending_sync').length,
      synced: signatures.filter(s => s.status === 'synced').length,
      failed: signatures.filter(s => s.status === 'failed').length,
      expired: signatures.filter(s => s.status === 'expired').length,
      critical: signatures.filter(s => s.priority === 'critical' && s.status === 'pending_sync').length,
    };
  }

  // Métodos privados
  private async getCurrentLocation(): Promise<{
    latitude: number;
    longitude: number;
    accuracy?: number;
  }> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Permisos de ubicación denegados');
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        timeInterval: 5000,
      });

      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy ?? undefined,
      };
    } catch (error) {
      console.warn('⚠️ No se pudo obtener ubicación:', error);
      // Ubicación por defecto (centro de la mina)
      return {
        latitude: -23.5505,
        longitude: -46.6333,
        accuracy: 1000,
      };
    }
  }

  private async getDeviceInfo(): Promise<{
    platform: string;
    version: string;
    model?: string;
    userAgent: string;
    screenResolution: string;
    timezone: string;
    language: string;
  }> {
    const { width, height } = require('react-native').Dimensions.get('window');
    
    return {
      platform: Device.osName || 'unknown',
      version: Device.osVersion || 'unknown',
      model: Device.modelName || 'unknown',
      userAgent: `NucleoGestor Mobile/${Device.osName} ${Device.osVersion}`,
      screenResolution: `${width}x${height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: 'es-ES',
    };
  }

  private isInMiningArea(latitude: number, longitude: number): boolean {
    const { north, south, east, west } = this.MINING_AREA_BOUNDS;
    return latitude <= north && latitude >= south && 
           longitude <= east && longitude >= west;
  }

  private isExpired(signature: OfflineSignature): boolean {
    const now = new Date();
    const expiresAt = new Date(signature.expiresAt);
    return now > expiresAt;
  }

  private async saveOfflineSignature(signature: OfflineSignature): Promise<void> {
    const signatures = await this.getAllOfflineSignatures();
    signatures.push(signature);
    await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(signatures));
  }

  private async updateOfflineSignature(signature: OfflineSignature): Promise<void> {
    const signatures = await this.getAllOfflineSignatures();
    const index = signatures.findIndex(s => s.id === signature.id);
    if (index !== -1) {
      signatures[index] = signature;
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(signatures));
    }
  }

  public async getAllOfflineSignatures(): Promise<OfflineSignature[]> {
    try {
      const data = await AsyncStorage.getItem(this.STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error loading offline signatures:', error);
      return [];
    }
  }

  private async addToSyncQueue(signature: OfflineSignature): Promise<void> {
    await syncManager.addToQueue({
      type: 'document_create',
      endpoint: '/api/v1/digital-signatures/offline-complete',
      method: 'POST',
      data: signature,
      priority: signature.priority === 'critical' ? 'high' : signature.priority,
      attempts: 0,
      maxAttempts: signature.priority === 'critical' ? 10 : 5,
    });
  }

  private async syncSingleSignature(signature: OfflineSignature): Promise<void> {
    // Implementar llamada a API para sincronizar firma individual
    const response = await fetch('/api/v1/digital-signatures/offline-complete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(signature),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message || 'Error desconocido');
    }

    // Marcar como sincronizada
    signature.status = 'synced';
    await this.updateOfflineSignature(signature);
  }
}

// Instancia singleton
export const signatureOfflineManager = new SignatureOfflineManager();

// Hook para React
export const useOfflineSignatures = () => {
  const [signatures, setSignatures] = React.useState<OfflineSignature[]>([]);
  const [stats, setStats] = React.useState({
    total: 0,
    pending: 0,
    synced: 0,
    failed: 0,
    expired: 0,
    critical: 0,
  });
  const [loading, setLoading] = React.useState(false);

  const loadSignatures = React.useCallback(async () => {
    try {
      setLoading(true);
      const [allSignatures, signatureStats] = await Promise.all([
        signatureOfflineManager.getAllOfflineSignatures(),
        signatureOfflineManager.getSignatureStats(),
      ]);
      setSignatures(allSignatures);
      setStats(signatureStats);
    } catch (error) {
      console.error('Error loading offline signatures:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const createSignature = React.useCallback(async (params: {
    documentId: number;
    userId: number;
    acceptanceText: string;
    requiresVisualSignature?: boolean;
    visualSignature?: string;
    miningType?: MiningSignatureType;
  }) => {
    const signature = await signatureOfflineManager.createOfflineSignature(params);
    await loadSignatures(); // Recargar lista
    return signature;
  }, [loadSignatures]);

  const syncSignatures = React.useCallback(async () => {
    const result = await signatureOfflineManager.syncPendingSignatures();
    await loadSignatures(); // Recargar lista
    return result;
  }, [loadSignatures]);

  React.useEffect(() => {
    loadSignatures();
  }, [loadSignatures]);

  return {
    signatures,
    stats,
    loading,
    createSignature,
    syncSignatures,
    loadSignatures,
  };
};

// Importar React para el hook
import React from 'react';