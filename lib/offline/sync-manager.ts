import { networkManager } from './network-manager';
import { offlineStorage, SyncQueueItem } from './storage';
import { apiRequest } from '../api/config';

export interface SyncResult {
  success: boolean;
  syncedItems: number;
  failedItems: number;
  errors: string[];
}

export interface SyncStatus {
  isRunning: boolean;
  progress: number;
  totalItems: number;
  currentItem?: string;
  lastSync?: string;
}

class SyncManager {
  private isRunning = false;
  private syncInterval: ReturnType<typeof setTimeout> | null = null;
  private listeners: Array<(status: SyncStatus) => void> = [];
  
  // Configuración de sincronización
  private readonly config = {
    maxRetries: 3,
    retryDelay: 5000, // 5 segundos
    syncInterval: 30000, // 30 segundos cuando hay conexión
    batchSize: 10, // Procesar hasta 10 items por lote
  };

  async initialize(): Promise<void> {
    // Escuchar cambios de conectividad
    networkManager.on('connected', this.handleConnectionRestored);
    networkManager.on('disconnected', this.handleConnectionLost);
    
    // Verificar si hay elementos pendientes al iniciar
    const pendingItems = await offlineStorage.getSyncQueue();
    if (pendingItems.length > 0) {
      console.log(`🔄 ${pendingItems.length} elementos pendientes de sincronización`);
      
      // Si hay conexión, iniciar sincronización
      if (networkManager.isOnline()) {
        this.startPeriodicSync();
      }
    }
    
    console.log('🔄 SyncManager inicializado');
  }

  private handleConnectionRestored = async () => {
    console.log('🟢 Conexión restaurada - iniciando sincronización');
    await this.syncNow();
    this.startPeriodicSync();
  };

  private handleConnectionLost = () => {
    console.log('🔴 Conexión perdida - pausando sincronización');
    this.stopPeriodicSync();
  };

  async syncNow(): Promise<SyncResult> {
    if (this.isRunning) {
      console.log('⚠️ Sincronización ya en progreso');
      return { success: false, syncedItems: 0, failedItems: 0, errors: ['Sync already running'] };
    }

    if (!networkManager.canMakeRequests()) {
      console.log('⚠️ No hay conexión disponible para sincronizar');
      return { success: false, syncedItems: 0, failedItems: 0, errors: ['No connection'] };
    }

    this.isRunning = true;
    const errors: string[] = [];
    let syncedItems = 0;
    let failedItems = 0;

    try {
      console.log('🔄 Iniciando sincronización...');
      this.notifyListeners({ isRunning: true, progress: 0, totalItems: 0 });

      // Obtener cola de sincronización
      const queue = await offlineStorage.getSyncQueue();
      const eligibleItems = queue.filter(item => item.attempts < item.maxAttempts);
      
      if (eligibleItems.length === 0) {
        console.log('✅ No hay elementos para sincronizar');
        return { success: true, syncedItems: 0, failedItems: 0, errors: [] };
      }

      console.log(`🔄 Sincronizando ${eligibleItems.length} elementos...`);
      
      // Ordenar por prioridad y fecha
      const sortedItems = this.sortQueueByPriority(eligibleItems);
      
      // Procesar en lotes
      const batches = this.createBatches(sortedItems, this.config.batchSize);
      
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        console.log(`🔄 Procesando lote ${i + 1}/${batches.length} (${batch.length} elementos)`);
        
        // Procesar elementos del lote en paralelo
        const batchPromises = batch.map(item => this.syncItem(item));
        const batchResults = await Promise.allSettled(batchPromises);
        
        // Procesar resultados
        for (let j = 0; j < batchResults.length; j++) {
          const result = batchResults[j];
          const item = batch[j];
          
          if (result.status === 'fulfilled' && result.value.success) {
            syncedItems++;
            await offlineStorage.removeFromSyncQueue(item.id);
            console.log(`✅ Elemento sincronizado: ${item.type}`);
          } else {
            failedItems++;
            const error = result.status === 'rejected' ? 
              result.reason.message : result.value.error;
            errors.push(`${item.type}: ${error}`);
            
            // Actualizar intentos
            await offlineStorage.updateSyncQueueItem(item.id, {
              attempts: item.attempts + 1,
              lastError: error
            });
            
            console.log(`❌ Error sincronizando ${item.type}: ${error}`);
          }
        }
        
        // Actualizar progreso
        const progress = ((i + 1) / batches.length) * 100;
        this.notifyListeners({
          isRunning: true,
          progress,
          totalItems: eligibleItems.length,
          currentItem: `Lote ${i + 1}/${batches.length}`
        });
        
        // Pequeña pausa entre lotes para no sobrecargar
        if (i < batches.length - 1) {
          await this.delay(1000);
        }
      }

      // Actualizar tiempo de última sincronización
      await offlineStorage.setLastSyncTime(new Date().toISOString());
      
      console.log(`✅ Sincronización completada: ${syncedItems} éxitos, ${failedItems} fallos`);
      
      return {
        success: syncedItems > 0 || failedItems === 0,
        syncedItems,
        failedItems,
        errors
      };
      
    } catch (error) {
      console.error('❌ Error durante sincronización:', error);
      errors.push(error instanceof Error ? error.message : 'Unknown error');
      return {
        success: false,
        syncedItems,
        failedItems: failedItems + 1,
        errors
      };
    } finally {
      this.isRunning = false;
      this.notifyListeners({
        isRunning: false,
        progress: 100,
        totalItems: 0,
        lastSync: new Date().toISOString()
      });
    }
  }

  private async syncItem(item: SyncQueueItem): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`🔄 Sincronizando: ${item.type} - ${item.endpoint}`);
      
      switch (item.type) {
        case 'activity_complete':
          await this.syncActivityComplete(item);
          break;
        case 'document_create':
          await this.syncDocumentCreate(item);
          break;
        case 'document_update':
          await this.syncDocumentUpdate(item);
          break;
        case 'user_update':
          await this.syncUserUpdate(item);
          break;
        default:
          throw new Error(`Tipo de sincronización no soportado: ${item.type}`);
      }
      
      return { success: true };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown sync error';
      console.error(`❌ Error sincronizando ${item.type}:`, error);
      return { success: false, error: errorMessage };
    }
  }

  private async syncActivityComplete(item: SyncQueueItem): Promise<any> {
    const response = await apiRequest(item.endpoint, {
      method: item.method,
      body: JSON.stringify(item.data),
    });
    
    // Actualizar actividad local como sincronizada
    await offlineStorage.updateActivityStatus(item.data.activityId, {
      ...item.data.formData,
      syncStatus: 'synced'
    });
    
    return response;
  }

  private async syncDocumentCreate(item: SyncQueueItem): Promise<any> {
    const response = await apiRequest(item.endpoint, {
      method: item.method,
      body: JSON.stringify(item.data),
    });
    
    // Marcar documento como sincronizado
    const documents = await offlineStorage.getDocuments();
    const docIndex = documents.findIndex(d => d.id === item.data.documentId);
    if (docIndex !== -1) {
      documents[docIndex].syncStatus = 'synced';
      await offlineStorage.saveDocument(documents[docIndex]);
    }
    
    return response;
  }

  private async syncDocumentUpdate(item: SyncQueueItem): Promise<any> {
    return await apiRequest(item.endpoint, {
      method: item.method,
      body: JSON.stringify(item.data),
    });
  }

  private async syncUserUpdate(item: SyncQueueItem): Promise<any> {
    return await apiRequest(item.endpoint, {
      method: item.method,
      body: JSON.stringify(item.data),
    });
  }

  async addToQueue(item: Omit<SyncQueueItem, 'id' | 'createdAt'>): Promise<void> {
    await offlineStorage.addToSyncQueue(item);
    
    if (networkManager.canMakeRequests() && !this.isRunning) {
      setTimeout(() => this.syncNow(), 2000);
    }
  }

  async getQueueStatus(): Promise<{ pending: number; failed: number; total: number }> {
    const queue = await offlineStorage.getSyncQueue();
    const pending = queue.filter(item => item.attempts < item.maxAttempts).length;
    const failed = queue.filter(item => item.attempts >= item.maxAttempts).length;
    
    return { pending, failed, total: queue.length };
  }

  private startPeriodicSync(): void {
    if (this.syncInterval) return;
    
    this.syncInterval = setInterval(async () => {
      if (networkManager.canMakeRequests()) {
        const queue = await offlineStorage.getSyncQueue();
        if (queue.length > 0) {
          console.log('🔄 Sincronización periódica iniciada');
          await this.syncNow();
        }
      }
    }, this.config.syncInterval);
    
    console.log('⏰ Sincronización periódica activada');
  }

  private stopPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('⏰ Sincronización periódica desactivada');
    }
  }

  private sortQueueByPriority(items: SyncQueueItem[]): SyncQueueItem[] {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    
    return items.sort((a, b) => {
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  onSyncStatusChange(callback: (status: SyncStatus) => void): () => void {
    this.listeners.push(callback);
    
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(status: Partial<SyncStatus>): void {
    const fullStatus: SyncStatus = {
      isRunning: false,
      progress: 0,
      totalItems: 0,
      ...status
    };
    
    this.listeners.forEach(callback => {
      try {
        callback(fullStatus);
      } catch (error) {
        console.error('❌ Error en listener de sync:', error);
      }
    });
  }

  async clearQueue(): Promise<void> {
    const queue = await offlineStorage.getSyncQueue();
    for (const item of queue) {
      await offlineStorage.removeFromSyncQueue(item.id);
    }
    console.log('🧹 Cola de sincronización limpiada completamente');
  }
}

export const syncManager = new SyncManager();
