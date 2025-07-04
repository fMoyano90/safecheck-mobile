import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { connectivityConfig, ConnectivityConfig } from '@/lib/config/connectivity-config';

interface ConnectivitySettingsProps {
  onConfigChange?: (config: ConnectivityConfig) => void;
}

export function ConnectivitySettings({ onConfigChange }: ConnectivitySettingsProps) {
  const [config, setConfig] = useState<ConnectivityConfig>(connectivityConfig.getConfig());

  useEffect(() => {
    // Cargar configuración actual
    setConfig(connectivityConfig.getConfig());
  }, []);

  const updateConfig = (updates: Partial<ConnectivityConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    connectivityConfig.setConfig(newConfig);
    onConfigChange?.(newConfig);
  };

  const setEnvironmentPreset = (environment: 'office' | 'mining' | 'field') => {
    Alert.alert(
      'Cambiar configuración',
      `¿Deseas aplicar la configuración predefinida para entorno ${environment === 'mining' ? 'minero' : environment === 'field' ? 'de campo' : 'de oficina'}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Aplicar',
          onPress: () => {
            connectivityConfig.setEnvironment(environment);
            setConfig(connectivityConfig.getConfig());
            onConfigChange?.(connectivityConfig.getConfig());
          },
        },
      ]
    );
  };

  const getEnvironmentDescription = (env: string) => {
    switch (env) {
      case 'mining':
        return 'Entorno minero con conectividad limitada';
      case 'field':
        return 'Trabajo de campo con conectividad variable';
      case 'office':
        return 'Oficina con conectividad estable';
      default:
        return 'Configuración personalizada';
    }
  };

  const getEnvironmentIcon = (env: string) => {
    switch (env) {
      case 'mining':
        return 'hammer-outline';
      case 'field':
        return 'location-outline';
      case 'office':
        return 'business-outline';
      default:
        return 'settings-outline';
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Configuración de Conectividad</Text>
      <Text style={styles.subtitle}>
        Personaliza cómo se muestran los mensajes de conexión según tu entorno de trabajo
      </Text>

      {/* Configuraciones predefinidas */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Configuraciones Predefinidas</Text>
        
        {(['mining', 'field', 'office'] as const).map((env) => (
          <TouchableOpacity
            key={env}
            style={[
              styles.presetCard,
              config.environment === env && styles.presetCardActive,
            ]}
            onPress={() => setEnvironmentPreset(env)}
          >
            <View style={styles.presetHeader}>
              <Ionicons
                name={getEnvironmentIcon(env) as any}
                size={24}
                color={config.environment === env ? '#007bff' : '#666'}
              />
              <Text
                style={[
                  styles.presetTitle,
                  config.environment === env && styles.presetTitleActive,
                ]}
              >
                {env === 'mining' ? 'Minero' : env === 'field' ? 'Campo' : 'Oficina'}
              </Text>
              {config.environment === env && (
                <Ionicons name="checkmark-circle" size={20} color="#007bff" />
              )}
            </View>
            <Text style={styles.presetDescription}>
              {getEnvironmentDescription(env)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Configuración manual */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Configuración Manual</Text>
        
        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Modo Silencioso</Text>
            <Text style={styles.settingDescription}>
              No mostrar ningún mensaje de conexión
            </Text>
          </View>
          <Switch
            value={config.silentMode}
            onValueChange={(value) => updateConfig({ silentMode: value })}
            trackColor={{ false: '#e9ecef', true: '#007bff' }}
            thumbColor={config.silentMode ? '#ffffff' : '#f4f3f4'}
          />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Solo Indicador Visual</Text>
            <Text style={styles.settingDescription}>
              Mostrar únicamente un pequeño ícono de estado
            </Text>
          </View>
          <Switch
            value={config.showOnlyIndicator}
            onValueChange={(value) => updateConfig({ showOnlyIndicator: value })}
            trackColor={{ false: '#e9ecef', true: '#007bff' }}
            thumbColor={config.showOnlyIndicator ? '#ffffff' : '#f4f3f4'}
            disabled={config.silentMode}
          />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Ocultar Mensajes de Reconexión</Text>
            <Text style={styles.settingDescription}>
              No mostrar mensajes cuando se intenta reconectar
            </Text>
          </View>
          <Switch
            value={config.hideReconnectionMessages}
            onValueChange={(value) => updateConfig({ hideReconnectionMessages: value })}
            trackColor={{ false: '#e9ecef', true: '#007bff' }}
            thumbColor={config.hideReconnectionMessages ? '#ffffff' : '#f4f3f4'}
            disabled={config.silentMode}
          />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Ocultar Alertas de Sincronización</Text>
            <Text style={styles.settingDescription}>
              No mostrar alertas cuando se sincroniza información
            </Text>
          </View>
          <Switch
            value={config.hideSyncAlerts}
            onValueChange={(value) => updateConfig({ hideSyncAlerts: value })}
            trackColor={{ false: '#e9ecef', true: '#007bff' }}
            thumbColor={config.hideSyncAlerts ? '#ffffff' : '#f4f3f4'}
          />
        </View>
      </View>

      {/* Estado actual */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Estado Actual</Text>
        <View style={styles.statusCard}>
          <Text style={styles.statusText}>
            Entorno: {config.environment === 'mining' ? 'Minero' : config.environment === 'field' ? 'Campo' : 'Oficina'}
          </Text>
          <Text style={styles.statusText}>
            Modo silencioso: {config.silentMode ? 'Activado' : 'Desactivado'}
          </Text>
          <Text style={styles.statusText}>
            Solo indicador: {config.showOnlyIndicator ? 'Activado' : 'Desactivado'}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
    paddingHorizontal: 16,
    lineHeight: 22,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  presetCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  presetCardActive: {
    borderColor: '#007bff',
    backgroundColor: '#f8f9ff',
  },
  presetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  presetTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 12,
    flex: 1,
  },
  presetTitleActive: {
    color: '#007bff',
  },
  presetDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginBottom: 1,
    padding: 16,
    borderRadius: 8,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  },
  statusCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  statusText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
});

export default ConnectivitySettings;