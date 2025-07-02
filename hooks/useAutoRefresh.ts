import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { notificationService } from '../lib/notifications/notification-service';

interface UseAutoRefreshOptions {
  refreshFunction: () => Promise<void>;
  interval?: number; // en milisegundos
  enabled?: boolean;
  onDataChanged?: () => void; // Callback cuando hay cambios
  manualRefreshOnly?: boolean; // Solo permitir refresh manual
}

export const useAutoRefresh = ({ 
  refreshFunction, 
  interval = 300000, // 5 minutos por defecto (reducido de polling agresivo)
  enabled = true,
  onDataChanged,
  manualRefreshOnly = false // Nueva opción para deshabilitar auto-refresh
}: UseAutoRefreshOptions) => {
  const pollingTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasUpdates, setHasUpdates] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const startPolling = () => {
    if (!enabled || isPaused || manualRefreshOnly) return;
    
    if (pollingTimer.current) {
      clearInterval(pollingTimer.current);
    }
    
    pollingTimer.current = setInterval(async () => {
      try {
        setIsRefreshing(true);
        await refreshFunction();
        
        // NO marcar automáticamente que hay actualizaciones
        // Solo se activará por notificaciones push
        onDataChanged?.();
      } catch (error) {
        console.error('Error in auto-refresh:', error);
      } finally {
        setIsRefreshing(false);
      }
    }, interval);
  };

  // Función para activar el banner cuando llegue una notificación de actividad
  const handleActivityNotification = (notification: any) => {
    if (notification.type === 'activity' || notification.title?.includes('actividad') || notification.title?.includes('Actividad')) {
      setHasUpdates(true);
      onDataChanged?.();
    }
  };

  const stopPolling = () => {
    if (pollingTimer.current) {
      clearInterval(pollingTimer.current);
      pollingTimer.current = null;
    }
  };

  const pausePolling = () => {
    setIsPaused(true);
    stopPolling();
  };

  const resumePolling = () => {
    setIsPaused(false);
    if (enabled) {
      startPolling();
    }
  };

  const manualRefresh = async () => {
    try {
      setIsRefreshing(true);
      setHasUpdates(false); // Limpiar el indicador de actualizaciones
      await refreshFunction();
    } catch (error) {
      console.error('Error in manual refresh:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Iniciar polling cuando el hook se monta (solo si no es manual only)
  useEffect(() => {
    if (enabled && !manualRefreshOnly) {
      startPolling();
    }

    // Configurar listener para notificaciones de actividades
    notificationService.on('notification_received', handleActivityNotification);

    return () => {
      stopPolling();
      notificationService.off('notification_received', handleActivityNotification);
    };
  }, [enabled, interval, manualRefreshOnly]);

  // Manejar cambios en el estado de la app de forma más conservadora
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active') {
        // Solo reiniciar polling si estaba habilitado y no es manual only
        if (enabled && !isPaused && !manualRefreshOnly) {
          startPolling();
        }
      } else {
        // Pausar polling cuando la app va al background
        stopPolling();
      }
    };

    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      appStateSubscription.remove();
    };
  }, [enabled, isPaused, manualRefreshOnly]);

  return {
    startPolling,
    stopPolling,
    pausePolling,
    resumePolling,
    manualRefresh,
    isPolling: pollingTimer.current !== null,
    isRefreshing,
    hasUpdates,
    isPaused,
    clearUpdates: () => setHasUpdates(false),
  };
};