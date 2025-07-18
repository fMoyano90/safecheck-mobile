// Importar React para el hook
import * as React from 'react';

// Importar instancias para uso interno
import { networkManager, type NetworkState } from './network-manager';
import { offlineStorage, type OfflineStorageStats, type SyncQueueItem } from './storage';
import { syncManager, type SyncResult, type SyncStatus } from './sync-manager';
import { 
  offlineApi, 
  offlineActivitiesApi, 
  offlineDocumentsApi,
  type OfflineApiOptions 
} from './offline-api';

// Exportar todas las funcionalidades offline
export { networkManager, type NetworkState } from './network-manager';
export { offlineStorage, type OfflineStorageStats, type SyncQueueItem } from './storage';
export { syncManager, type SyncResult, type SyncStatus } from './sync-manager';
export { 
  offlineApi, 
  offlineActivitiesApi, 
  offlineDocumentsApi,
  type OfflineApiOptions 
} from './offline-api';

// Sistema de inicialización
export class OfflineSystem {
  private static initialized = false;

  static async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      await networkManager.initialize();
      await offlineStorage.initialize();
      await offlineApi.initialize();
      await syncManager.initialize();
      await offlineApi.clearExpiredCache();

      this.initialized = true;
      this.reportSystemStatus();
      
    } catch (error) {
      console.error('❌ Error inicializando sistema offline:', error);
      throw error;
    }
  }

  static async getSystemStatus(): Promise<{
    network: NetworkState;
    storage: OfflineStorageStats;
    syncQueue: { pending: number; failed: number; total: number };
    cache: { entries: number; sizeKB: number; oldestEntry?: string };
  }> {
    const [storageStats, queueStatus] = await Promise.all([
      offlineStorage.getStorageStats(),
      syncManager.getQueueStatus(),
    ]);

    return {
      network: networkManager.getState(),
      storage: storageStats,
      syncQueue: queueStatus,
      cache: offlineApi.getCacheStats(),
    };
  }

  private static async reportSystemStatus(): Promise<void> {
    try {
      const status = await this.getSystemStatus();
      
      if (status.syncQueue.failed > 0) {
        console.warn('⚠️ ', status.syncQueue.failed, 'elementos fallidos en cola');
      }
    } catch (error) {
      console.warn('⚠️ No se pudo obtener estado del sistema:', error);
    }
  }

  static isInitialized(): boolean {
    return this.initialized;
  }

  static async reset(): Promise<void> {
    try {
      await offlineStorage.clearAllData();
      await offlineApi.clearCache();
      await syncManager.clearQueue();
      
      this.initialized = false;
      await this.initialize();
    } catch (error) {
      console.error('❌ Error reiniciando sistema offline:', error);
      throw error;
    }
  }
}

// Hook para React
export function useOfflineStatus() {
  const [networkState, setNetworkState] = React.useState<NetworkState>({
    isConnected: false,
    isInternetReachable: false,
    type: 'none',
    hasStrongConnection: false,
  });

  const [syncStatus, setSyncStatus] = React.useState<SyncStatus>({
    isRunning: false,
    progress: 0,
    totalItems: 0,
  });

  React.useEffect(() => {
    // Obtener estado inicial
    setNetworkState(networkManager.getState());

    // Escuchar cambios de red
    const handleNetworkChange = (state: NetworkState) => setNetworkState(state);
    networkManager.addListener('connectionChange', handleNetworkChange);

    // Escuchar cambios de sincronización
    const unsubscribeSync = syncManager.onSyncStatusChange(setSyncStatus);

    return () => {
      networkManager.removeListener('connectionChange', handleNetworkChange);
      unsubscribeSync();
    };
  }, []);

  return {
    isOnline: networkManager.isOnline(),
    hasStrongConnection: networkManager.hasStrongConnection(),
    networkType: networkState.type,
    syncStatus,
    canMakeRequests: networkManager.canMakeRequests(),
    isSafeForUpload: networkManager.isSafeForUpload(),
  };
}