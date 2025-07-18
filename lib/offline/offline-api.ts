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
    await this.loadCache();
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

    if (method === 'GET' && config.enableCache) {
      const cachedData = this.getFromCache<T>(cacheKey, config.cacheTimeout!);
      if (cachedData && !networkManager.isOnline()) {
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
        
        if (method === 'GET' && config.enableCache) {
          const cachedData = this.getFromCache<T>(cacheKey, config.cacheTimeout! * 2);
          if (cachedData) {
            return cachedData;
          }
        }
        
        throw error;
      }
    }

    if (method === 'GET') {
      const cachedData = this.getFromCache<T>(cacheKey, config.cacheTimeout! * 4);
      if (cachedData) {
        return cachedData;
      } else {
        throw new Error('No hay datos cached disponibles para esta consulta offline');
      }
    } else {
      if (config.allowOfflineExecution) {
        await this.handleOfflineWriteOperation(endpoint, options, config);
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
      // Body parsing failed, using empty object
    }

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

  }

  private createOfflineResponse<T>(endpoint: string, options: RequestInit): T {
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
      }
    } catch (error) {
      console.warn('⚠️ No se pudo cargar cache:', error);
    }
  }

  // === MÉTODOS PÚBLICOS ===
  async clearCache(): Promise<void> {
    this.cache.clear();
    await this.saveCache();
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
    // Primero obtenemos la información del usuario autenticado para saber su ID
    const profile = await this.request<any>('/api/v1/auth/profile', {
      method: 'GET',
    }, {
      enableCache: true,
      cacheTimeout: 60, // Cache del perfil por 1 hora
      priority: 'high',
    });
    const userId = profile.id;
    
    // Usar el endpoint específico del usuario
    return this.request<any[]>(`/api/v1/activities/user/${userId}`, {
      method: 'GET',
    }, {
      enableCache: true,
      cacheTimeout: 15, // 15 minutos para actividades
      priority: 'high',
    });
  }

  async getRecurringActivities(): Promise<any[]> {
    // Primero obtenemos la información del usuario autenticado para saber su ID
    const profile = await this.request<any>('/api/v1/auth/profile', {
      method: 'GET',
    }, {
      enableCache: true,
      cacheTimeout: 60, // Cache del perfil por 1 hora
      priority: 'high',
    });
    const userId = profile.id;
    
    // Usar el endpoint específico para actividades recurrentes del usuario
    return this.request<any[]>(`/api/v1/recurring-activities/user/${userId}`, {
      method: 'GET',
    }, {
      enableCache: true,
      cacheTimeout: 30, // 30 minutos para actividades recurrentes
      priority: 'medium',
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

    return this.request<any>('/api/v1/documents/worker', {
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
  getMyActivities: async (params?: {
    status?: 'pending' | 'completed' | 'approved' | 'rejected' | 'overdue';
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    startDate?: string;
    endDate?: string;
  }) => {
    const allActivities = await offlineApi.getActivities();
    
    // Aplicar filtros si se proporcionan
    let filteredActivities = allActivities;
    
    if (params) {
      if (params.status) {
        filteredActivities = filteredActivities.filter(a => a.status === params.status);
      }
      if (params.priority) {
        filteredActivities = filteredActivities.filter(a => a.priority === params.priority);
      }
      if (params.startDate) {
        const startDate = new Date(params.startDate);
        filteredActivities = filteredActivities.filter(a => new Date(a.assignedDate) >= startDate);
      }
      if (params.endDate) {
        const endDate = new Date(params.endDate);
        filteredActivities = filteredActivities.filter(a => new Date(a.assignedDate) <= endDate);
      }
    }
    
    return filteredActivities;
  },
  
  getTodayCompleted: async () => {
    const allActivities = await offlineApi.getActivities();
    const today = new Date().toDateString();
    
    return allActivities.filter(activity => {
      const activityDate = new Date(activity.assignedDate).toDateString();
      return activity.status === 'completed' && activityDate === today;
    });
  },
  
  getRecurringActivities: async (params?: {
    status?: 'active' | 'inactive' | 'paused';
  }) => {
    const allRecurringActivities = await offlineApi.getRecurringActivities();
    
    // Aplicar filtros si se proporcionan
    let filteredActivities = allRecurringActivities;
    
    if (params?.status) {
      filteredActivities = filteredActivities.filter(a => a.status === params.status);
    }
    
    return filteredActivities;
  },
  
  complete: (id: number, data: any) => offlineApi.completeActivity(id, data),
};

export const offlineDocumentsApi = {
  getTemplate: (activityId: number, activityType: string) => 
    offlineApi.getTemplate(activityId, activityType),
  createFromActivity: (data: any) => offlineApi.createDocument(data),
};