import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { deviceTokenService } from '../../services/deviceTokenService';

interface NotificationSettingsProps {
  onClose?: () => void;
}

const NotificationSettings: React.FC<NotificationSettingsProps> = ({ onClose }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [tokenStatus, setTokenStatus] = useState<any>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  useEffect(() => {
    loadTokenStatus();
  }, []);

  const loadTokenStatus = async () => {
    try {
      const status = await deviceTokenService.getTokenStatus();
      setTokenStatus(status);
      // Verificar si hay token localmente como fallback
      const hasToken = deviceTokenService.getToken() !== null;
      setNotificationsEnabled(hasToken);
    } catch (error) {
      console.error('Error cargando estado del token:', error);
      // Fallback: verificar token local
      const hasToken = deviceTokenService.getToken() !== null;
      setNotificationsEnabled(hasToken);
    }
  };

  const handleToggleNotifications = async (enabled: boolean) => {
    setIsLoading(true);
    try {
      if (enabled) {
        // Habilitar notificaciones
        const initialized = await deviceTokenService.initialize();
        if (initialized) {
          const registered = await deviceTokenService.registerToken();
          if (registered) {
            setNotificationsEnabled(true);
            Alert.alert(
              '✅ Notificaciones Habilitadas',
              'Las notificaciones push han sido habilitadas exitosamente.'
            );
          } else {
            Alert.alert(
              '❌ Error',
              'No se pudo registrar el dispositivo para notificaciones.'
            );
          }
        } else {
          Alert.alert(
            '❌ Error',
            'No se pudieron inicializar las notificaciones. Verifica los permisos.'
          );
        }
      } else {
        // Deshabilitar notificaciones
        const unregistered = await deviceTokenService.unregisterToken();
        if (unregistered) {
          setNotificationsEnabled(false);
          Alert.alert(
            '🔕 Notificaciones Deshabilitadas',
            'Las notificaciones push han sido deshabilitadas.'
          );
        }
      }
      await loadTokenStatus();
    } catch (error) {
      console.error('Error toggling notifications:', error);
      Alert.alert('❌ Error', 'Ocurrió un error al cambiar la configuración.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestNotification = async () => {
    setIsLoading(true);
    try {
      const success = await deviceTokenService.sendTestNotification();
      if (success) {
        Alert.alert(
          '📱 Notificación Enviada',
          'Se ha enviado una notificación de prueba. Deberías recibirla en unos segundos.'
        );
      } else {
        Alert.alert(
          '❌ Error',
          'No se pudo enviar la notificación de prueba. Verifica que las notificaciones estén habilitadas.'
        );
      }
    } catch (error) {
      console.error('Error enviando notificación de prueba:', error);
      Alert.alert('❌ Error', 'Ocurrió un error al enviar la notificación de prueba.');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = () => {
    if (!tokenStatus) return '#666';
    const hasTokens = deviceTokenService.getToken() !== null;
    return hasTokens ? '#4CAF50' : '#FF9800';
  };

  const getStatusText = () => {
    if (!tokenStatus) return 'Cargando...';
    const hasTokens = deviceTokenService.getToken() !== null;
    if (hasTokens) {
      return `Activo (${tokenStatus.tokenCount || 1} dispositivo${(tokenStatus.tokenCount || 1) !== 1 ? 's' : ''})`;
    }
    return 'Inactivo';
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Configuración de Notificaciones</Text>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#666" />
          </TouchableOpacity>
        )}
      </View>

      {/* Estado actual */}
      <View style={styles.statusSection}>
        <View style={styles.statusRow}>
          <View style={[styles.statusIndicator, { backgroundColor: getStatusColor() }]} />
          <Text style={styles.statusText}>{getStatusText()}</Text>
        </View>
        {tokenStatus?.expoServiceReady !== undefined && (
          <Text style={styles.serviceStatus}>
            Servicio Expo: {tokenStatus.expoServiceReady ? '✅ Listo' : '❌ No disponible'}
          </Text>
        )}
      </View>

      {/* Toggle de notificaciones */}
      <View style={styles.settingRow}>
        <View style={styles.settingInfo}>
          <Text style={styles.settingTitle}>Notificaciones Push</Text>
          <Text style={styles.settingDescription}>
            Recibe notificaciones de nuevas actividades, revisiones y recordatorios
          </Text>
        </View>
        <Switch
          value={notificationsEnabled}
          onValueChange={handleToggleNotifications}
          disabled={isLoading}
          trackColor={{ false: '#767577', true: '#4CAF50' }}
          thumbColor={notificationsEnabled ? '#fff' : '#f4f3f4'}
        />
      </View>

      {/* Botón de prueba */}
      {notificationsEnabled && (
        <TouchableOpacity
          style={[styles.testButton, isLoading && styles.disabledButton]}
          onPress={handleTestNotification}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="notifications-outline" size={20} color="#fff" />
              <Text style={styles.testButtonText}>Enviar Notificación de Prueba</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {/* Información adicional */}
      <View style={styles.infoSection}>
        <Text style={styles.infoTitle}>ℹ️ Información</Text>
        <Text style={styles.infoText}>
          • Las notificaciones te alertarán sobre nuevas actividades asignadas{"\n"}
          • Recibirás actualizaciones sobre el estado de tus actividades{"\n"}
          • Los recordatorios te ayudarán a no perder fechas límite{"\n"}
          • Puedes desactivar las notificaciones en cualquier momento
        </Text>
      </View>

      {/* Debug info (solo en desarrollo) */}
      {__DEV__ && tokenStatus && (
        <View style={styles.debugSection}>
          <Text style={styles.debugTitle}>🔧 Debug Info</Text>
          <Text style={styles.debugText}>
            User ID: {tokenStatus.userId}{"\n"}
            Token Count: {tokenStatus.tokenCount}{"\n"}
            Has Tokens: {deviceTokenService.getToken() !== null ? 'Sí' : 'No'}{"\n"}
            Expo Service: {tokenStatus.expoServiceReady ? 'Ready' : 'Not Ready'}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 8,
  },
  statusSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  serviceStatus: {
    fontSize: 14,
    color: '#666',
    marginLeft: 24,
  },
  settingRow: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  testButton: {
    backgroundColor: '#2196F3',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  testButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  infoSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  debugSection: {
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  debugText: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
  },
});

export default NotificationSettings;