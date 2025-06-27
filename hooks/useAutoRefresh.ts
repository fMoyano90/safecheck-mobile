import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

interface UseAutoRefreshOptions {
  refreshFunction: () => Promise<void>;
  interval?: number; // en milisegundos
  enabled?: boolean;
  onDataChanged?: () => void; // Callback cuando hay cambios
  backgroundInterval?: number; // Intervalo más largo cuando no hay interacción
  pauseOnInteraction?: boolean; // Pausar cuando el usuario está interactuando
}

export const useAutoRefresh = ({ 
  refreshFunction, 
  interval = 120000, // 2 minutos por defecto (era 30 segundos)
  backgroundInterval = 300000, // 5 minutos cuando no hay interacción
  enabled = true,
  onDataChanged,
  pauseOnInteraction = true
}: UseAutoRefreshOptions) => {
  const pollingTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastInteractionTime = useRef<number>(Date.now());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasUpdates, setHasUpdates] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Detectar interacción del usuario
  const recordInteraction = () => {
    lastInteractionTime.current = Date.now();
    if (isPaused && pauseOnInteraction) {
      setIsPaused(false);
      startPolling();
    }
  };

  // Determinar qué intervalo usar basado en la actividad del usuario
  const getActiveInterval = () => {
    const timeSinceLastInteraction = Date.now() - lastInteractionTime.current;
    const fiveMinutes = 5 * 60 * 1000;
    
    // Si han pasado más de 5 minutos sin interacción, usar intervalo más largo
    return timeSinceLastInteraction > fiveMinutes ? backgroundInterval : interval;
  };

  const startPolling = () => {
    if (!enabled || isPaused) return;
    
    if (pollingTimer.current) {
      clearInterval(pollingTimer.current);
    }
    
    const currentInterval = getActiveInterval();
    
    pollingTimer.current = setInterval(async () => {
      try {
        // No refrescar si el usuario está interactuando activamente
        const timeSinceLastInteraction = Date.now() - lastInteractionTime.current;
        if (pauseOnInteraction && timeSinceLastInteraction < 10000) { // 10 segundos
          return;
        }

        setIsRefreshing(true);
        await refreshFunction();
        
        // Marcar que hay actualizaciones disponibles
        setHasUpdates(true);
        onDataChanged?.();
      } catch (error) {
        console.error('Error in auto-refresh:', error);
      } finally {
        setIsRefreshing(false);
        
        // Reajustar el intervalo si es necesario
        const newInterval = getActiveInterval();
        if (newInterval !== currentInterval) {
          startPolling();
        }
      }
    }, currentInterval);
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
      recordInteraction(); // Registrar que el usuario interactuó
      await refreshFunction();
    } catch (error) {
      console.error('Error in manual refresh:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Iniciar polling cuando el hook se monta
  useEffect(() => {
    if (enabled) {
      startPolling();
    }
    return () => stopPolling();
  }, [enabled, interval, backgroundInterval]);

  // Manejar cambios en el estado de la app
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active') {
        recordInteraction();
        if (enabled && !isPaused) {
          startPolling();
          // Solo refrescar si han pasado más de 2 minutos desde la última vez
          const timeSinceLastInteraction = Date.now() - lastInteractionTime.current;
          if (timeSinceLastInteraction > 120000) { // 2 minutos
            manualRefresh();
          }
        }
      } else {
        stopPolling();
      }
    };

    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      appStateSubscription.remove();
    };
  }, [enabled, refreshFunction, isPaused]);

  return {
    startPolling,
    stopPolling,
    pausePolling,
    resumePolling,
    manualRefresh,
    recordInteraction,
    isPolling: pollingTimer.current !== null,
    isRefreshing,
    hasUpdates,
    isPaused,
    clearUpdates: () => setHasUpdates(false),
  };
}; 