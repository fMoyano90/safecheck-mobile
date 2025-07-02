import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';

// Prefijos para diferentes tipos de datos
const STORAGE_KEYS = {
  // Datos de usuario y autenticación
  USER_PROFILE: 'offline_user_profile',
  ACTIVITIES: 'offline_activities',
  TEMPLATES: 'offline_templates',
  DOCUMENTS: 'offline_documents',
  
  // Cola de sincronización
  SYNC_QUEUE: 'offline_sync_queue',
  FAILED_REQUESTS: 'offline_failed_requests',
  
  // Configuración offline
  LAST_SYNC: 'offline_last_sync',
  OFFLINE_MODE: 'offline_mode_enabled',
  
  // Datos temporales
  DRAFT_FORMS: 'offline_draft_forms',
  CACHED_IMAGES: 'offline_cached_images',
} as const;

export interface OfflineActivity {
  id: number;
  data: any;
  lastModified: string;
  syncStatus: 'pending' | 'synced' | 'failed';
  localChanges?: any;
}

export interface OfflineDocument {
  id: string;
  activityId: number;
  formData: any;
  localFiles: string[]; // Rutas a archivos locales
  createdAt: string;
  syncStatus: 'pending' | 'synced' | 'failed';
}

export interface SyncQueueItem {
  id: string;
  type: 'activity_complete' | 'document_create' | 'document_update' | 'user_update';
  endpoint: string;
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  data: any;
  priority: 'high' | 'medium' | 'low';
  createdAt: string;
  attempts: number;
  maxAttempts: number;
  lastError?: string;
}

export interface OfflineStorageStats {
  totalActivities: number;
  pendingSyncItems: number;
  failedSyncItems: number;
  draftForms: number;
  cachedFiles: number;
  lastSyncDate?: string;
  storageSizeKB: number;
}

class OfflineStorage {
  private documentDir = `${FileSystem.documentDirectory}offline/`;

  async initialize(): Promise<void> {
    try {
      // Crear directorio para archivos offline si no existe
      const dirInfo = await FileSystem.getInfoAsync(this.documentDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(this.documentDir, { intermediates: true });
        console.log('📁 Directorio offline creado');
      }
      
      console.log('💾 OfflineStorage inicializado');
    } catch (error) {
      console.error('❌ Error inicializando OfflineStorage:', error);
    }
  }

  // === MANEJO DE ACTIVIDADES ===
  async saveActivities(activities: any[]): Promise<void> {
    const offlineActivities: OfflineActivity[] = activities.map(activity => ({
      id: activity.id,
      data: activity,
      lastModified: new Date().toISOString(),
      syncStatus: 'synced'
    }));

    await this.setItem(STORAGE_KEYS.ACTIVITIES, offlineActivities);
    console.log(`💾 ${activities.length} actividades guardadas offline`);
  }

  async getActivities(): Promise<OfflineActivity[]> {
    const activities = await this.getItem<OfflineActivity[]>(STORAGE_KEYS.ACTIVITIES);
    return activities || [];
  }

  async updateActivityStatus(activityId: number, formData: any): Promise<void> {
    const activities = await this.getActivities();
    const activityIndex = activities.findIndex(a => a.id === activityId);
    
    if (activityIndex !== -1) {
      activities[activityIndex] = {
        ...activities[activityIndex],
        data: { ...activities[activityIndex].data, formData },
        lastModified: new Date().toISOString(),
        syncStatus: 'pending',
        localChanges: formData
      };
      
      await this.setItem(STORAGE_KEYS.ACTIVITIES, activities);
      console.log(`💾 Actividad ${activityId} actualizada offline`);
    }
  }

  // === MANEJO DE DOCUMENTOS ===
  async saveDocument(document: OfflineDocument): Promise<void> {
    const documents = await this.getDocuments();
    const existingIndex = documents.findIndex(d => d.id === document.id);
    
    if (existingIndex !== -1) {
      documents[existingIndex] = document;
    } else {
      documents.push(document);
    }
    
    await this.setItem(STORAGE_KEYS.DOCUMENTS, documents);
    console.log(`💾 Documento ${document.id} guardado offline`);
  }

  async getDocuments(): Promise<OfflineDocument[]> {
    const documents = await this.getItem<OfflineDocument[]>(STORAGE_KEYS.DOCUMENTS);
    return documents || [];
  }

  async getPendingDocuments(): Promise<OfflineDocument[]> {
    const documents = await this.getDocuments();
    return documents.filter(d => d.syncStatus === 'pending');
  }

  // === MANEJO DE PLANTILLAS ===
  async saveTemplates(templates: any[]): Promise<void> {
    await this.setItem(STORAGE_KEYS.TEMPLATES, templates);
    console.log(`💾 ${templates.length} plantillas guardadas offline`);
  }

  async getTemplates(): Promise<any[]> {
    const templates = await this.getItem<any[]>(STORAGE_KEYS.TEMPLATES);
    return templates || [];
  }

  async getTemplate(activityId: number, activityType: string): Promise<any | null> {
    const templates = await this.getTemplates();
    return templates.find(t => 
      t.activityId === activityId && t.activityType === activityType
    ) || null;
  }

  // === MANEJO DE ARCHIVOS LOCALES ===
  async saveFile(filename: string, content: string | ArrayBuffer): Promise<string> {
    const filePath = `${this.documentDir}${filename}`;
    
    if (typeof content === 'string') {
      await FileSystem.writeAsStringAsync(filePath, content);
    } else {
      // Para archivos binarios
      const base64 = this.arrayBufferToBase64(content);
      await FileSystem.writeAsStringAsync(filePath, base64, {
        encoding: FileSystem.EncodingType.Base64
      });
    }
    
    console.log(`💾 Archivo guardado: ${filename}`);
    return filePath;
  }

  async getFile(filename: string): Promise<string | null> {
    const filePath = `${this.documentDir}${filename}`;
    
    try {
      const content = await FileSystem.readAsStringAsync(filePath);
      return content;
    } catch (error) {
      console.warn(`⚠️ No se pudo leer archivo ${filename}:`, error);
      return null;
    }
  }

  async deleteFile(filename: string): Promise<void> {
    const filePath = `${this.documentDir}${filename}`;
    
    try {
      await FileSystem.deleteAsync(filePath);
      console.log(`🗑️ Archivo eliminado: ${filename}`);
    } catch (error) {
      console.warn(`⚠️ No se pudo eliminar archivo ${filename}:`, error);
    }
  }

  // === MANEJO DE COLA DE SINCRONIZACIÓN ===
  async addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'createdAt'>): Promise<void> {
    const queue = await this.getSyncQueue();
    const queueItem: SyncQueueItem = {
      ...item,
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
    };
    
    queue.push(queueItem);
    await this.setItem(STORAGE_KEYS.SYNC_QUEUE, queue);
    console.log(`📤 Ítem añadido a cola de sincronización: ${queueItem.type}`);
  }

  async getSyncQueue(): Promise<SyncQueueItem[]> {
    const queue = await this.getItem<SyncQueueItem[]>(STORAGE_KEYS.SYNC_QUEUE);
    return queue || [];
  }

  async removeFromSyncQueue(itemId: string): Promise<void> {
    const queue = await this.getSyncQueue();
    const updatedQueue = queue.filter(item => item.id !== itemId);
    await this.setItem(STORAGE_KEYS.SYNC_QUEUE, updatedQueue);
    console.log(`✅ Ítem removido de cola de sincronización: ${itemId}`);
  }

  async updateSyncQueueItem(itemId: string, updates: Partial<SyncQueueItem>): Promise<void> {
    const queue = await this.getSyncQueue();
    const itemIndex = queue.findIndex(item => item.id === itemId);
    
    if (itemIndex !== -1) {
      queue[itemIndex] = { ...queue[itemIndex], ...updates };
      await this.setItem(STORAGE_KEYS.SYNC_QUEUE, queue);
    }
  }

  // === BORRADORES DE FORMULARIOS ===
  async saveDraftForm(activityId: number, formData: any): Promise<void> {
    const drafts = await this.getDraftForms();
    drafts[activityId.toString()] = {
      data: formData,
      savedAt: new Date().toISOString()
    };
    
    await this.setItem(STORAGE_KEYS.DRAFT_FORMS, drafts);
    console.log(`💾 Borrador guardado para actividad ${activityId}`);
  }

  async getDraftForm(activityId: number): Promise<any | null> {
    const drafts = await this.getDraftForms();
    return drafts[activityId.toString()]?.data || null;
  }

  async deleteDraftForm(activityId: number): Promise<void> {
    const drafts = await this.getDraftForms();
    delete drafts[activityId.toString()];
    await this.setItem(STORAGE_KEYS.DRAFT_FORMS, drafts);
    console.log(`🗑️ Borrador eliminado para actividad ${activityId}`);
  }

  private async getDraftForms(): Promise<Record<string, any>> {
    const drafts = await this.getItem<Record<string, any>>(STORAGE_KEYS.DRAFT_FORMS);
    return drafts || {};
  }

  // === ESTADÍSTICAS Y LIMPIEZA ===
  async getStorageStats(): Promise<OfflineStorageStats> {
    const activities = await this.getActivities();
    const syncQueue = await this.getSyncQueue();
    const documents = await this.getDocuments();
    const drafts = await this.getDraftForms();
    const lastSync = await this.getItem<string>(STORAGE_KEYS.LAST_SYNC);
    
    // Calcular tamaño aproximado de almacenamiento
    let storageSize = 0;
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const offlineKeys = allKeys.filter(key => key.startsWith('offline_'));
      
      for (const key of offlineKeys) {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          storageSize += value.length;
        }
      }
    } catch (error) {
      console.warn('⚠️ No se pudo calcular tamaño de almacenamiento:', error);
    }
    
    return {
      totalActivities: activities.length,
      pendingSyncItems: syncQueue.filter(item => item.attempts < item.maxAttempts).length,
      failedSyncItems: syncQueue.filter(item => item.attempts >= item.maxAttempts).length,
      draftForms: Object.keys(drafts).length,
      cachedFiles: 0, // TODO: implementar conteo de archivos
      lastSyncDate: lastSync || undefined,
      storageSizeKB: Math.round(storageSize / 1024),
    };
  }

  async clearAllData(): Promise<void> {
    const allKeys = Object.values(STORAGE_KEYS);
    await AsyncStorage.multiRemove(allKeys);
    
    // Limpiar archivos
    try {
      await FileSystem.deleteAsync(this.documentDir);
      await FileSystem.makeDirectoryAsync(this.documentDir, { intermediates: true });
    } catch (error) {
      console.warn('⚠️ Error limpiando archivos offline:', error);
    }
    
    console.log('🧹 Todos los datos offline eliminados');
  }

  async setLastSyncTime(timestamp: string): Promise<void> {
    await this.setItem(STORAGE_KEYS.LAST_SYNC, timestamp);
  }

  async getLastSyncTime(): Promise<string | null> {
    return await this.getItem<string>(STORAGE_KEYS.LAST_SYNC);
  }

  // === MÉTODOS AUXILIARES ===
  async setItem<T>(key: string, value: T): Promise<void> {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`❌ Error guardando ${key}:`, error);
      throw error;
    }
  }

  async getItem<T>(key: string): Promise<T | null> {
    try {
      const value = await AsyncStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error(`❌ Error obteniendo ${key}:`, error);
      return null;
    }
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}

// Instancia singleton
export const offlineStorage = new OfflineStorage(); 