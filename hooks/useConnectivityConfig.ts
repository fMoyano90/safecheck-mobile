import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { connectivityConfig, ConnectivityConfig } from '@/lib/config/connectivity-config';

const CONNECTIVITY_CONFIG_KEY = 'connectivity_config';

interface UseConnectivityConfigReturn {
  config: ConnectivityConfig;
  updateConfig: (updates: Partial<ConnectivityConfig>) => Promise<void>;
  setEnvironment: (environment: 'office' | 'mining' | 'field') => Promise<void>;
  resetToDefaults: () => Promise<void>;
  isLoading: boolean;
}

/**
 * Hook para manejar la configuración de conectividad
 * Persiste la configuración en AsyncStorage y la sincroniza con el manager global
 */
export function useConnectivityConfig(): UseConnectivityConfigReturn {
  const [config, setConfig] = useState<ConnectivityConfig>(connectivityConfig.getConfig());
  const [isLoading, setIsLoading] = useState(true);

  // Cargar configuración guardada al inicializar
  useEffect(() => {
    loadSavedConfig();
  }, []);

  const loadSavedConfig = async () => {
    try {
      setIsLoading(true);
      const savedConfig = await AsyncStorage.getItem(CONNECTIVITY_CONFIG_KEY);
      
      if (savedConfig) {
        const parsedConfig: ConnectivityConfig = JSON.parse(savedConfig);
        
        // Aplicar configuración guardada
        connectivityConfig.setConfig(parsedConfig);
        setConfig(connectivityConfig.getConfig());
        
        console.log('📱 Configuración de conectividad cargada:', parsedConfig.environment);
      } else {
        // Si no hay configuración guardada, usar la configuración por defecto (minero)
        console.log('📱 Usando configuración por defecto para entorno minero');
        await saveConfig(connectivityConfig.getConfig());
      }
    } catch (error) {
      console.error('❌ Error cargando configuración de conectividad:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveConfig = async (newConfig: ConnectivityConfig) => {
    try {
      await AsyncStorage.setItem(CONNECTIVITY_CONFIG_KEY, JSON.stringify(newConfig));
    } catch (error) {
      console.error('❌ Error guardando configuración de conectividad:', error);
    }
  };

  const updateConfig = useCallback(async (updates: Partial<ConnectivityConfig>) => {
    try {
      // Actualizar configuración en el manager
      connectivityConfig.setConfig(updates);
      const newConfig = connectivityConfig.getConfig();
      
      // Actualizar estado local
      setConfig(newConfig);
      
      // Guardar en AsyncStorage
      await saveConfig(newConfig);
      
      console.log('📱 Configuración de conectividad actualizada:', newConfig.environment);
    } catch (error) {
      console.error('❌ Error actualizando configuración de conectividad:', error);
    }
  }, []);

  const setEnvironment = useCallback(async (environment: 'office' | 'mining' | 'field') => {
    try {
      // Aplicar configuración predefinida
      connectivityConfig.setEnvironment(environment);
      const newConfig = connectivityConfig.getConfig();
      
      // Actualizar estado local
      setConfig(newConfig);
      
      // Guardar en AsyncStorage
      await saveConfig(newConfig);
      
      console.log(`📱 Configuración cambiada a entorno: ${environment}`);
    } catch (error) {
      console.error('❌ Error cambiando entorno de conectividad:', error);
    }
  }, []);

  const resetToDefaults = useCallback(async () => {
    try {
      // Resetear a configuración minera por defecto
      await setEnvironment('mining');
      console.log('📱 Configuración reseteada a valores por defecto (minero)');
    } catch (error) {
      console.error('❌ Error reseteando configuración:', error);
    }
  }, [setEnvironment]);

  return {
    config,
    updateConfig,
    setEnvironment,
    resetToDefaults,
    isLoading,
  };
}

/**
 * Hook simplificado para verificar configuraciones específicas
 */
export function useConnectivitySettings() {
  const { config } = useConnectivityConfig();
  
  return {
    isSilentMode: config.silentMode,
    showOnlyIndicator: config.showOnlyIndicator,
    hideReconnectionMessages: config.hideReconnectionMessages,
    hideSyncAlerts: config.hideSyncAlerts,
    environment: config.environment,
    shouldShowConnectionNotification: () => connectivityConfig.shouldShowConnectionNotification(),
    shouldShowReconnectionMessages: () => connectivityConfig.shouldShowReconnectionMessages(),
    shouldShowSyncAlerts: () => connectivityConfig.shouldShowSyncAlerts(),
  };
}

export default useConnectivityConfig;