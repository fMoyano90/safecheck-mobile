import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { apiRequest } from '@/lib/api/config';
import { useAuth } from '@/contexts/auth-context';
import { pushNotificationService, PushNotificationData } from '@/services/push-notification.service';
import * as Notifications from 'expo-notifications';

export interface PendingSignature {
  id: number;
  documentId: number;
  documentTitle: string;
  documentType: string;
  documentContent?: any;
  documentFields?: any;
  requestedBy: {
    id: number;
    name: string;
    email: string;
  };
  priority: 'low' | 'medium' | 'high' | 'critical';
  expiresAt?: string;
  createdAt: string;
  isViewed?: boolean;
  metadata?: {
    multipleSignature?: boolean;
    signerRole?: string;
    signerOrder?: number;
    requiresAllSignatures?: boolean;
    viewedAt?: string;
  };
}

export interface PendingSignaturesStats {
  total: number;
  critical: number;
  expiring: number;
}

export interface PendingSignaturesResponse {
  pendingSignatures: PendingSignature[];
  totalCount: number;
}

export function usePendingSignatures() {
  const [signatures, setSignatures] = useState<PendingSignature[]>([]);
  const [statistics, setStatistics] = useState<PendingSignaturesStats>({
    total: 0,
    critical: 0,
    expiring: 0,
  });
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const router = useRouter();

  // Función para actualizar el badge count
  const setBadgeCount = useCallback(async (count: number) => {
    try {
      await Notifications.setBadgeCountAsync(count);
    } catch (error) {
      console.error('Error setting badge count:', error);
    }
  }, []);

  // Cargar firmas pendientes
  const loadPendingSignatures = useCallback(async () => {
    if (!user) return;

    try {
      setError(null);
      const response = await apiRequest<PendingSignaturesResponse>('/pending-signatures');
      
      setSignatures(response.pendingSignatures || []);
      setStatistics({
        total: response.totalCount || 0,
        critical: 0,
        expiring: 0,
      });
      
      // Actualizar badge count
      setBadgeCount(response.totalCount || 0);
    } catch (err: any) {
      console.error('Error loading pending signatures:', err);
      setError(err.message || 'Error al cargar firmas pendientes');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  // Marcar firma como vista
  const markAsViewed = useCallback(async (signatureId: number) => {
    try {
      await apiRequest(`/pending-signatures/${signatureId}/mark-viewed`, {
        method: 'POST'
      });
      
      // Actualizar estado local
      setSignatures(prev => 
        prev.map(s => 
          s.id === signatureId ? { ...s, isViewed: true } : s
        )
      );
      
      return true;
    } catch (err: any) {
      console.error('Error marking signature as viewed:', err);
      return false;
    }
  }, []);

  // Obtener detalles de una firma específica
  const getSignatureDetails = useCallback(async (signatureId: number) => {
    try {
      const response = await apiRequest<{success: boolean; data: PendingSignature}>(
        `/pending-signatures/${signatureId}/details`
      );
      
      return response.success ? response.data : null;
    } catch (err: any) {
      console.error('Error getting signature details:', err);
      return null;
    }
  }, []);

  // Navegar a una firma específica
  const navigateToSignature = useCallback(async (signature: PendingSignature) => {
    try {
      // Marcar como vista si no ha sido vista
      if (!signature.isViewed) {
        await markAsViewed(signature.id);
      }

      // Navegar a la pantalla de firma
      router.push({
        pathname: '/modal',
        params: { 
          signatureId: signature.id,
          documentId: signature.documentId,
          mode: 'sign'
        }
      });
    } catch (error) {
      console.error('Error navigating to signature:', error);
      Alert.alert('Error', 'No se pudo abrir la firma');
    }
  }, [router, markAsViewed]);

  // Procesar firma digital
  const signDocument = useCallback(async (
    signatureId: number,
    signatureData: {
      password: string;
      acceptedTerms: boolean;
      visualSignature?: string;
      deviceInfo: {
        platform: string;
        version: string;
        model: string;
        fingerprint: string;
      };
      location?: {
        latitude: number;
        longitude: number;
        accuracy: number;
      };
    }
  ) => {
    try {
      const response = await apiRequest<any>(
        `/pending-signatures/${signatureId}/sign`,
        {
          method: 'POST',
          body: JSON.stringify(signatureData),
        }
      );

      // La función apiRequest ya extrae automáticamente la propiedad 'data' 
      // de respuestas con estructura {success: true, data: ...}
      // Refrescar la lista después de firmar
      await loadPendingSignatures();
      return response;
    } catch (error: any) {
      console.error('Error signing document:', error);
      throw error;
    }
  }, [loadPendingSignatures]);


 
   // Refrescar datos
   const refresh = useCallback(() => {
    setRefreshing(true);
    loadPendingSignatures();
  }, [loadPendingSignatures]);

  // Configurar listeners de notificaciones
  useEffect(() => {
    // Listener para notificaciones recibidas mientras la app está abierta
    const notificationListener = pushNotificationService.addNotificationReceivedListener(
      (notification) => {
        const data = notification.request.content.data as PushNotificationData;
        
        if (data.type === 'signature_request' || data.type === 'signature_reminder') {
          // Recargar firmas pendientes cuando se recibe una nueva notificación
          loadPendingSignatures();
        }
      }
    );

    // Listener para cuando el usuario toca una notificación
    const responseListener = pushNotificationService.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as PushNotificationData;
        
        // Manejar navegación basada en el tipo de notificación
        pushNotificationService.handleNotificationNavigation(data, router);
      }
    );

    return () => {
      notificationListener.remove();
      responseListener.remove();
    };
  }, [loadPendingSignatures, router]);

  // Cargar datos iniciales
  useEffect(() => {
    loadPendingSignatures();
  }, [loadPendingSignatures]);

  // Utilidades para el UI
  const getPriorityColor = useCallback((priority: string) => {
    switch (priority) {
      case 'critical': return '#FF4444';
      case 'high': return '#FF8800';
      case 'medium': return '#4CAF50';
      case 'low': return '#2196F3';
      default: return '#666';
    }
  }, []);

  const getPriorityLabel = useCallback((priority: string) => {
    switch (priority) {
      case 'critical': return 'Crítica';
      case 'high': return 'Alta';
      case 'medium': return 'Media';
      case 'low': return 'Baja';
      default: return 'Normal';
    }
  }, []);

  const formatDate = useCallback((dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, []);

  const isExpiringSoon = useCallback((expiresAt: string) => {
    const expiration = new Date(expiresAt);
    const now = new Date();
    const diffHours = (expiration.getTime() - now.getTime()) / (1000 * 60 * 60);
    return diffHours <= 24 && diffHours > 0;
  }, []);

  const getUnreadCount = useCallback(() => {
    return (signatures || []).filter(s => !s.isViewed).length;
  }, [signatures]);

  return {
    // Data
    signatures: signatures || [],
    statistics: statistics || {
      total: 0,
      critical: 0,
      expiring: 0,
    },
    loading,
    refreshing,
    error,
    
    // Actions
    loadPendingSignatures,
    markAsViewed,
    getSignatureDetails,
    navigateToSignature,
    signDocument,
    refresh,
    
    // Utilities
    getPriorityColor,
    getPriorityLabel,
    formatDate,
    isExpiringSoon,
    getUnreadCount,
  };
}

export default usePendingSignatures;