import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useOfflineStatus, syncManager } from '@/lib/offline';
import { connectivityConfig } from '@/lib/config/connectivity-config';

interface OfflineStatusBarProps {
  style?: any;
}

export function OfflineStatusBar({ style }: OfflineStatusBarProps) {
  const { 
    isOnline, 
    hasStrongConnection, 
    networkType, 
    syncStatus, 
    canMakeRequests 
  } = useOfflineStatus();

  const handleSyncPress = async () => {
    if (!canMakeRequests) {
      // Solo mostrar alerta si no está en modo silencioso
      if (!connectivityConfig.isSilentMode()) {
        Alert.alert(
          'Sin conexión',
          'No hay conexión a internet disponible para sincronizar',
          [{ text: 'OK' }]
        );
      }
      return;
    }

    try {
      const result = await syncManager.syncNow();
      
      // Solo mostrar alertas de sincronización si está permitido
      if (connectivityConfig.shouldShowSyncAlerts()) {
        if (result.success) {
          Alert.alert(
            'Sincronización completada',
            `${result.syncedItems} elementos sincronizados correctamente`,
            [{ text: 'OK' }]
          );
        } else {
          Alert.alert(
            'Error en sincronización',
            `Se sincronizaron ${result.syncedItems} elementos, pero ${result.failedItems} fallaron`,
            [{ text: 'OK' }]
          );
        }
      }
    } catch (error) {
      // Solo mostrar error si está permitido
      if (connectivityConfig.shouldShowSyncAlerts()) {
        Alert.alert(
          'Error',
          'No se pudo iniciar la sincronización',
          [{ text: 'OK' }]
        );
      }
    }
  };

  const getStatusColor = () => {
    if (!isOnline) return '#ff4444'; // Rojo para offline
    if (!hasStrongConnection) return '#ff8800'; // Naranja para conexión débil
    return '#44ff44'; // Verde para conexión fuerte
  };

  const getStatusText = () => {
    if (!isOnline) return 'Offline';
    if (!hasStrongConnection) return `${networkType} débil`;
    return `${networkType} fuerte`;
  };

  const getSyncText = () => {
    if (syncStatus.isRunning) {
      return `Sincronizando... ${Math.round(syncStatus.progress)}%`;
    }
    if (syncStatus.totalItems > 0) {
      return `${syncStatus.totalItems} elementos pendientes`;
    }
    return 'Sincronizado';
  };

  // Si está configurado para mostrar solo indicador, usar versión compacta
  if (connectivityConfig.shouldShowOnlyIndicator()) {
    return (
      <View style={[styles.compactContainer, style]}>
        <Ionicons 
          name={isOnline ? 'wifi' : 'wifi-outline'} 
          size={14} 
          color={getStatusColor()} 
        />
        {syncStatus.isRunning && (
          <Ionicons 
            name="sync" 
            size={12} 
            color="#666"
            style={styles.syncIcon}
          />
        )}
      </View>
    );
  }

  // Si está en modo silencioso, no mostrar nada
  if (connectivityConfig.isSilentMode()) {
    return null;
  }

  return (
    <View style={[styles.container, style]}>
      {/* Estado de conectividad */}
      <View style={styles.statusSection}>
        <Ionicons 
          name={isOnline ? 'wifi' : 'wifi-outline'} 
          size={16} 
          color={getStatusColor()} 
        />
        <Text style={[styles.statusText, { color: getStatusColor() }]}>
          {getStatusText()}
        </Text>
      </View>

      {/* Estado de sincronización */}
      <TouchableOpacity 
        style={styles.syncSection} 
        onPress={handleSyncPress}
        disabled={syncStatus.isRunning}
      >
        <Ionicons 
          name={syncStatus.isRunning ? 'sync' : 'cloud-upload-outline'} 
          size={16} 
          color="#666"
        />
        <Text style={styles.syncText}>
          {getSyncText()}
        </Text>
      </TouchableOpacity>

      {/* Indicador de progreso si está sincronizando */}
      {syncStatus.isRunning && (
        <View style={styles.progressContainer}>
          <View 
            style={[
              styles.progressBar, 
              { width: `${syncStatus.progress}%` }
            ]} 
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'transparent',
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 1000,
  },
  statusSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusText: {
    marginLeft: 8,
    fontSize: 12,
    fontWeight: '600',
  },
  syncSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#e9ecef',
  },
  syncText: {
    marginLeft: 6,
    fontSize: 11,
    color: '#666',
  },
  syncIcon: {
    marginLeft: 4,
  },
  progressContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#e9ecef',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#007bff',
  },
});

export default OfflineStatusBar;