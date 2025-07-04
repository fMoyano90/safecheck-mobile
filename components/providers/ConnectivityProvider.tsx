import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { useConnectivityConfig } from '@/hooks/useConnectivityConfig';
import { ConnectivityConfig } from '@/lib/config/connectivity-config';

interface ConnectivityContextType {
  config: ConnectivityConfig;
  updateConfig: (updates: Partial<ConnectivityConfig>) => Promise<void>;
  setEnvironment: (environment: 'office' | 'mining' | 'field') => Promise<void>;
  resetToDefaults: () => Promise<void>;
  isLoading: boolean;
}

const ConnectivityContext = createContext<ConnectivityContextType | undefined>(undefined);

export const useConnectivityContext = () => {
  const context = useContext(ConnectivityContext);
  if (!context) {
    throw new Error('useConnectivityContext must be used within a ConnectivityProvider');
  }
  return context;
};

interface ConnectivityProviderProps {
  children: ReactNode;
  defaultEnvironment?: 'office' | 'mining' | 'field';
}

/**
 * Proveedor de configuración de conectividad
 * Inicializa automáticamente la configuración para entornos mineros
 * y proporciona el contexto a toda la aplicación
 */
export function ConnectivityProvider({ 
  children, 
  defaultEnvironment = 'mining' 
}: ConnectivityProviderProps) {
  const connectivityHook = useConnectivityConfig();
  const { config, setEnvironment, isLoading } = connectivityHook;

  // Inicializar configuración al montar el componente
  useEffect(() => {
    const initializeConnectivity = async () => {
      try {
        // Si no hay configuración previa, establecer el entorno por defecto
        if (!config.environment || config.environment !== defaultEnvironment) {
          console.log(`🔧 Inicializando configuración para entorno: ${defaultEnvironment}`);
          await setEnvironment(defaultEnvironment);
        }
      } catch (error) {
        console.error('❌ Error inicializando configuración de conectividad:', error);
      }
    };

    if (!isLoading) {
      initializeConnectivity();
    }
  }, [isLoading, defaultEnvironment, setEnvironment, config.environment]);

  // Mostrar información de configuración en desarrollo
  useEffect(() => {
    if (!isLoading && __DEV__) {
      console.log('📱 Configuración de conectividad activa:', {
        environment: config.environment,
        silentMode: config.silentMode,
        showOnlyIndicator: config.showOnlyIndicator,
        hideReconnectionMessages: config.hideReconnectionMessages,
        hideSyncAlerts: config.hideSyncAlerts,
      });
    }
  }, [config, isLoading]);

  return (
    <ConnectivityContext.Provider value={connectivityHook}>
      {children}
    </ConnectivityContext.Provider>
  );
}

export default ConnectivityProvider;