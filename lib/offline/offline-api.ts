import { networkManager } from './network-manager';
import { offlineStorage } from './storage';
import { syncManager } from './sync-manager';
import { apiRequest } from '../api/config';

export interface OfflineApiOptions {
  enableCache?: boolean;
  cacheTimeout?: number; // en minutos
  priority?: 'high' | 'medium' | 'low';
  allowOfflineExecution?: boolean;
}

interface CacheEntry {
  data: any;
  timestamp: string;
  endpoint: string;
  method: string;
}

class OfflineApiManager {
  private cache = new Map<string, CacheEntry>();
  private readonly defaultOptions: OfflineApiOptions = {
    enableCache: true,
    cacheTimeout: 30, // 30 minutos
    priority: 'medium',
    allowOfflineExecution: true,
  };

  async initialize(): Promise<void> {
    // Cargar cache desde almacenamiento persistente
    await this.loadCache();
    console.log('📡 OfflineApiManager inicializado');
  }

  // === API WRAPPER PRINCIPAL ===
  async request<T>(
    endpoint: string,
    options: RequestInit = {},
    offlineOptions: OfflineApiOptions = {}
  ): Promise<T> {
    const config = { ...this.defaultOptions, ...offlineOptions };
    const method = (options.method || 'GET').toUpperCase();
    const cacheKey = this.getCacheKey(endpoint, method, options.body);

    console.log(`📡 API Request: ${method} ${endpoint}`);

    // Para métodos GET, intentar cache primero
    if (method === 'GET' && config.enableCache) {
      const cachedData = this.getFromCache<T>(cacheKey, config.cacheTimeout!);
      if (cachedData && !networkManager.isOnline()) {
        console.log(`💾 Datos servidos desde cache offline: ${endpoint}`);
        return cachedData;
      }
    }

    // Si hay conexión, hacer request normal
    if (networkManager.canMakeRequests()) {
      try {
        const result = await apiRequest<T>(endpoint, options);
        
        // Cachear resultado si es GET
        if (method === 'GET' && config.enableCache) {
          this.setCache(cacheKey, result, endpoint, method);
        }
        
        return result;
      } catch (error) {
        console.error(`❌ Error en API request online: ${endpoint}`, error);
        
        // Si hay error y tenemos cache, usar cache
        if (method === 'GET' && config.enableCache) {
          const cachedData = this.getFromCache<T>(cacheKey, config.cacheTimeout! * 2); // Cache extendido en caso de error
          if (cachedData) {
            console.log(`💾 Usando cache por error de red: ${endpoint}`);
            return cachedData;
          }
        }
        
        throw error;
      }
    }

    // Si no hay conexión
    if (method === 'GET') {
      // Para GET, intentar cache
      const cachedData = this.getFromCache<T>(cacheKey, config.cacheTimeout! * 4); // Cache muy extendido offline
      if (cachedData) {
        console.log(`💾 Datos offline desde cache: ${endpoint}`);
        return cachedData;
      } else {
        throw new Error('No hay datos cached disponibles para esta consulta offline');
      }
    } else {
      // Para métodos de escritura, añadir a cola de sincronización
      if (config.allowOfflineExecution) {
        await this.handleOfflineWriteOperation(endpoint, options, config);
        
        // Retornar una respuesta simulada para que la UI funcione
        return this.createOfflineResponse<T>(endpoint, options);
      } else {
        throw new Error('Operación no disponible offline');
      }
    }
  }

  // === MANEJO DE OPERACIONES OFFLINE ===
  private async handleOfflineWriteOperation(
    endpoint: string,
    options: RequestInit,
    config: OfflineApiOptions
  ): Promise<void> {
    const method = options.method?.toUpperCase() || 'POST';
    let data: any = {};
    
    try {
      data = options.body ? JSON.parse(options.body as string) : {};
    } catch (error) {
      console.warn('⚠️ No se pudo parsear body para operación offline');
    }

    // Determinar tipo de operación
    let operationType: any = 'document_create';
    
    if (endpoint.includes('/activities/') && endpoint.includes('/complete')) {
      operationType = 'activity_complete';
    } else if (endpoint.includes('/documents/') && method === 'POST') {
      operationType = 'document_create';
    } else if (endpoint.includes('/documents/') && method === 'PATCH') {
      operationType = 'document_update';
    } else if (endpoint.includes('/users/') || endpoint.includes('/profile/')) {
      operationType = 'user_update';
    }

    // Añadir a cola de sincronización
    await syncManager.addToQueue({
      type: operationType,
      endpoint,
      method: method as any,
      data,
      priority: config.priority!,
      attempts: 0,
      maxAttempts: 3,
    });

    console.log(`📤 Operación añadida a cola offline: ${operationType} - ${endpoint}`);
  }

  private createOfflineResponse<T>(endpoint: string, options: RequestInit): T {
    // Crear respuesta simulada basada en el tipo de operación
    const method = options.method?.toUpperCase() || 'POST';
    let mockResponse: any = { success: true, offline: true };

    if (endpoint.includes('/activities/') && endpoint.includes('/complete')) {
      mockResponse = {
        id: Date.now(),
        status: 'pending_sync',
        completedAt: new Date().toISOString(),
        offline: true,
      };
    } else if (endpoint.includes('/documents/')) {
      mockResponse = {
        id: `offline_${Date.now()}`,
        createdAt: new Date().toISOString(),
        status: 'pending_sync',
        offline: true,
      };
    }

    return mockResponse as T;
  }

  // === SISTEMA DE CACHE ===
  private getCacheKey(endpoint: string, method: string, body?: any): string {
    const bodyHash = body ? btoa(JSON.stringify(body)).slice(0, 8) : '';
    return `${method}_${endpoint}_${bodyHash}`;
  }

  private getFromCache<T>(key: string, timeoutMinutes: number): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = new Date();
    const cacheTime = new Date(entry.timestamp);
    const diffMinutes = (now.getTime() - cacheTime.getTime()) / (1000 * 60);

    if (diffMinutes > timeoutMinutes) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  private setCache(key: string, data: any, endpoint: string, method: string): void {
    const entry: CacheEntry = {
      data,
      timestamp: new Date().toISOString(),
      endpoint,
      method,
    };
    
    this.cache.set(key, entry);
    this.saveCache(); // Persistir cache
  }

  private async saveCache(): Promise<void> {
    try {
      const cacheData = Array.from(this.cache.entries());
      await offlineStorage.setItem('api_cache', cacheData);
    } catch (error) {
      console.warn('⚠️ No se pudo guardar cache:', error);
    }
  }

  private async loadCache(): Promise<void> {
    try {
      const cacheData = await offlineStorage.getItem<[string, CacheEntry][]>('api_cache');
      if (cacheData) {
        this.cache = new Map(cacheData);
        console.log(`💾 Cache cargado: ${this.cache.size} entradas`);
      }
    } catch (error) {
      console.warn('⚠️ No se pudo cargar cache:', error);
    }
  }

  // === MÉTODOS PÚBLICOS ===
  async clearCache(): Promise<void> {
    this.cache.clear();
    await this.saveCache();
    console.log('🧹 Cache limpiado');
  }

  async clearExpiredCache(): Promise<void> {
    const now = new Date();
    let removedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      const cacheTime = new Date(entry.timestamp);
      const diffHours = (now.getTime() - cacheTime.getTime()) / (1000 * 60 * 60);
      
      // Remover cache más viejo de 24 horas
      if (diffHours > 24) {
        this.cache.delete(key);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      await this.saveCache();
      console.log(`🧹 ${removedCount} entradas de cache expiradas eliminadas`);
    }
  }

  getCacheStats(): { entries: number; sizeKB: number; oldestEntry?: string } {
    let oldestEntry: string | undefined;
    let oldestTime = new Date();
    let totalSize = 0;

    for (const [key, entry] of this.cache.entries()) {
      const entryTime = new Date(entry.timestamp);
      if (entryTime < oldestTime) {
        oldestTime = entryTime;
        oldestEntry = entryTime.toISOString();
      }
      totalSize += JSON.stringify(entry).length;
    }

    return {
      entries: this.cache.size,
      sizeKB: Math.round(totalSize / 1024),
      oldestEntry,
    };
  }

  // === MÉTODOS ESPECÍFICOS PARA APIS EXISTENTES ===
  
  // Wrapper específico para actividades
  async getActivities(params?: any): Promise<any[]> {
    return this.request<any[]>('/api/v1/activities/user/me', {
      method: 'GET',
    }, {
      enableCache: true,
      cacheTimeout: 15, // 15 minutos para actividades
      priority: 'high',
    });
  }

  async completeActivity(activityId: number, formData: any): Promise<any> {
    // Actualizar datos locales inmediatamente
    await offlineStorage.updateActivityStatus(activityId, formData);
    
    return this.request<any>(`/api/v1/activities/${activityId}/complete`, {
      method: 'PATCH',
      body: JSON.stringify({ formData }),
    }, {
      priority: 'high',
      allowOfflineExecution: true,
    });
  }

  async getTemplate(activityId: number, activityType: string): Promise<any> {
    // Intentar cargar desde almacenamiento local primero
    const localTemplate = await offlineStorage.getTemplate(activityId, activityType);
    if (localTemplate && !networkManager.isOnline()) {
      return localTemplate;
    }

    return this.request<any>(`/api/v1/documents/template/${activityId}/${activityType}`, {
      method: 'GET',
    }, {
      enableCache: true,
      cacheTimeout: 60, // Templates cache por 1 hora
      priority: 'medium',
    });
  }

  async createDocument(documentData: any): Promise<any> {
    // Guardar documento localmente
    const offlineDoc = {
      id: `offline_${Date.now()}`,
      activityId: documentData.activityId,
      formData: documentData.formData,
      localFiles: [],
      createdAt: new Date().toISOString(),
      syncStatus: 'pending' as const,
    };
    
    await offlineStorage.saveDocument(offlineDoc);

    return this.request<any>('/api/v1/documents', {
      method: 'POST',
      body: JSON.stringify(documentData),
    }, {
      priority: 'high',
      allowOfflineExecution: true,
    });
  }
}

// Instancia singleton
export const offlineApi = new OfflineApiManager();

// Exportar métodos específicos para fácil uso
export const offlineActivitiesApi = {
  getMyActivities: () => offlineApi.getActivities(),
  complete: (id: number, data: any) => offlineApi.completeActivity(id, data),
};

export const offlineDocumentsApi = {
  getTemplate: (activityId: number, activityType: string) => 
    offlineApi.getTemplate(activityId, activityType),
  createFromActivity: (data: any) => offlineApi.createDocument(data),
}; 