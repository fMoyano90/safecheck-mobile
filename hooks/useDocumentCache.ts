import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { documentsApi, type DocumentResponse } from '@/lib/api';
import { offlineStorage } from '@/lib/offline';
import { useOfflineStatus } from '@/lib/offline';

interface DocumentCacheState {
  documents: DocumentResponse[];
  loading: boolean;
  refreshing: boolean;
  lastUpdated: Date | null;
  error: string | null;
}

interface CachedDocuments {
  documents: DocumentResponse[];
  timestamp: string;
  version: number;
}

const CACHE_KEY = 'documents_cache';
const CACHE_VERSION = 1;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos en milisegundos

export function useDocumentCache() {
  const [state, setState] = useState<DocumentCacheState>({
    documents: [],
    loading: false,
    refreshing: false,
    lastUpdated: null,
    error: null,
  });

  const { isOnline, canMakeRequests } = useOfflineStatus();

  // Cargar documentos desde caché
  const loadFromCache = useCallback(async (): Promise<DocumentResponse[] | null> => {
    try {
      const cached = await offlineStorage.getItem<CachedDocuments>(CACHE_KEY);
      
      if (!cached) {
        return null;
      }

      if (cached.version !== CACHE_VERSION) {
        await AsyncStorage.removeItem(CACHE_KEY);
        return null;
      }

      const cacheAge = Date.now() - new Date(cached.timestamp).getTime();
      if (cacheAge > CACHE_DURATION) {
        return null;
      }

      return cached.documents;
    } catch (error) {
      console.error('❌ Error cargando caché de documentos:', error);
      return null;
    }
  }, []);

  // Guardar documentos en caché
  const saveToCache = useCallback(async (documents: DocumentResponse[]): Promise<void> => {
    try {
      const cacheData: CachedDocuments = {
        documents,
        timestamp: new Date().toISOString(),
        version: CACHE_VERSION,
      };

      await offlineStorage.setItem(CACHE_KEY, cacheData);
    } catch (error) {
      console.error('❌ Error guardando caché de documentos:', error);
    }
  }, []);

  const loadFromApi = useCallback(async (): Promise<DocumentResponse[]> => {
    try {
      const documents = await documentsApi.getMyDocuments();
      await saveToCache(documents);
      return documents;
    } catch (error) {
      console.error('❌ Error cargando documentos desde API:', error);
      throw error;
    }
  }, [saveToCache]);

  // Función principal para cargar documentos
  const loadDocuments = useCallback(async (forceRefresh: boolean = false): Promise<void> => {
    setState(prev => ({ 
      ...prev, 
      loading: !prev.documents.length, // Solo mostrar loading si no hay documentos
      refreshing: !!prev.documents.length, // Mostrar refreshing si ya hay documentos
      error: null 
    }));

    try {
      let documents: DocumentResponse[] | null = null;

      // Si no es refresh forzado, intentar cargar desde caché primero
      if (!forceRefresh) {
        documents = await loadFromCache();
      }

      // Si no hay caché válido o es refresh forzado, cargar desde API
      if (!documents) {
        if (canMakeRequests) {
          documents = await loadFromApi();
        } else {
          const cached = await offlineStorage.getItem<CachedDocuments>(CACHE_KEY);
          if (cached && cached.version === CACHE_VERSION) {
            documents = cached.documents;
          } else {
            throw new Error('No hay conexión y no hay caché disponible');
          }
        }
      }

      setState(prev => ({
        ...prev,
        documents: documents || [],
        loading: false,
        refreshing: false,
        lastUpdated: new Date(),
        error: null,
      }));

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      
      setState(prev => ({
        ...prev,
        loading: false,
        refreshing: false,
        error: errorMessage,
      }));

      // Si hay error y tenemos documentos en caché, mantenerlos
      if (!state.documents.length) {
        const cached = await loadFromCache();
        if (cached) {
          setState(prev => ({
            ...prev,
            documents: cached,
            error: `${errorMessage} (mostrando caché)`,
          }));
        }
      }
    }
  }, [canMakeRequests, loadFromCache, loadFromApi, state.documents.length]);

  const invalidateCache = useCallback(async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem(CACHE_KEY);
      await loadDocuments(true);
    } catch (error) {
      console.error('❌ Error invalidando caché:', error);
    }
  }, [loadDocuments]);

  const clearCache = useCallback(async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem(CACHE_KEY);
    } catch (error) {
      console.error('❌ Error limpiando caché:', error);
    }
  }, []);

  // Verificar si el caché es válido
  const isCacheValid = useCallback(async (): Promise<boolean> => {
    try {
      const cached = await offlineStorage.getItem<CachedDocuments>(CACHE_KEY);
      
      if (!cached || cached.version !== CACHE_VERSION) {
        return false;
      }

      const cacheAge = Date.now() - new Date(cached.timestamp).getTime();
      return cacheAge <= CACHE_DURATION;
    } catch (error) {
      return false;
    }
  }, []);

  // Cargar documentos al montar el componente
  useEffect(() => {
    loadDocuments();
  }, []);

  // Recargar cuando se recupere la conexión
  useEffect(() => {
    if (isOnline && canMakeRequests && state.documents.length > 0) {
      isCacheValid().then(isValid => {
        if (!isValid) {
          loadDocuments(true);
        }
      });
    }
  }, [isOnline, canMakeRequests, loadDocuments, isCacheValid, state.documents.length]);

  return {
    // Estado
    documents: state.documents,
    loading: state.loading,
    refreshing: state.refreshing,
    lastUpdated: state.lastUpdated,
    error: state.error,
    
    // Acciones
    refresh: () => loadDocuments(true),
    invalidateCache,
    clearCache,
    
    // Información del caché
    isCacheValid,
    isOnline,
    canMakeRequests,
  };
}

// Hook para usar en otros componentes cuando se complete una actividad
export function useDocumentCacheInvalidation() {
  const invalidateDocumentCache = useCallback(async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem(CACHE_KEY);
    } catch (error) {
      console.error('❌ Error invalidando caché de documentos:', error);
    }
  }, []);

  return { invalidateDocumentCache };
}