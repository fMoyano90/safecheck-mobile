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
      console.log('⚠️ Sistema offline ya inicializado');
      return;
    }

    try {
      console.log('🚀 Inicializando sistema offline...');

      // Inicializar componentes en orden específico
      console.log('1️⃣ Inicializando NetworkManager...');
      await networkManager.initialize();

      console.log('2️⃣ Inicializando OfflineStorage...');
      await offlineStorage.initialize();

      console.log('3️⃣ Inicializando OfflineApi...');
      await offlineApi.initialize();

      console.log('4️⃣ Inicializando SyncManager...');
      await syncManager.initialize();

      // Limpiar cache expirado al iniciar
      console.log('🧹 Limpiando cache expirado...');
      await offlineApi.clearExpiredCache();

      this.initialized = true;
      console.log('✅ Sistema offline inicializado correctamente');

      // Reportar estado inicial
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
      
      console.log('📊 Estado del sistema offline:');
      console.log('  🌐 Red:', status.network.isConnected ? '✅ Conectado' : '❌ Desconectado');
      console.log('  💾 Actividades locales:', status.storage.totalActivities);
      console.log('  📤 Cola de sincronización:', status.syncQueue.pending, 'pendientes');
      console.log('  💽 Cache:', status.cache.entries, 'entradas,', status.cache.sizeKB, 'KB');
      
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
    console.log('🔄 Reiniciando sistema offline...');
    
    try {
      await offlineStorage.clearAllData();
      await offlineApi.clearCache();
      await syncManager.clearQueue();
      
      this.initialized = false;
      await this.initialize();
      
      console.log('✅ Sistema offline reiniciado');
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