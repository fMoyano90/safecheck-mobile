import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  Switch,
  Linking,
} from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import { Camera } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library';
import * as Contacts from 'expo-contacts';

interface PermissionItem {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  isGranted: boolean;
  isRequired: boolean;
  checkPermission: () => Promise<boolean>;
  requestPermission: () => Promise<boolean>;
}

export default function PermissionsScreen() {
  const [permissions, setPermissions] = useState<PermissionItem[]>([]);
  const [loading, setLoading] = useState(true);

  const permissionsList: Omit<PermissionItem, 'isGranted'>[] = [
    {
      id: 'notifications',
      title: 'Notificaciones',
      description: 'Recibir alertas y recordatorios importantes',
      icon: 'notifications-outline',
      isRequired: true,
      checkPermission: async () => {
        const { status } = await Notifications.getPermissionsAsync();
        return status === 'granted';
      },
      requestPermission: async () => {
        const { status } = await Notifications.requestPermissionsAsync();
        return status === 'granted';
      },
    },
    {
      id: 'location',
      title: 'Ubicación',
      description: 'Registrar ubicación en actividades de trabajo',
      icon: 'location-outline',
      isRequired: true,
      checkPermission: async () => {
        const { status } = await Location.getForegroundPermissionsAsync();
        return status === 'granted';
      },
      requestPermission: async () => {
        const { status } = await Location.requestForegroundPermissionsAsync();
        return status === 'granted';
      },
    },
    {
      id: 'camera',
      title: 'Cámara',
      description: 'Tomar fotos para documentar actividades',
      icon: 'camera-outline',
      isRequired: true,
      checkPermission: async () => {
        const { status } = await Camera.getCameraPermissionsAsync();
        return status === 'granted';
      },
      requestPermission: async () => {
        const { status } = await Camera.requestCameraPermissionsAsync();
        return status === 'granted';
      },
    },
    {
      id: 'media',
      title: 'Galería',
      description: 'Acceder a fotos y videos guardados',
      icon: 'images-outline',
      isRequired: false,
      checkPermission: async () => {
        const { status } = await MediaLibrary.getPermissionsAsync();
        return status === 'granted';
      },
      requestPermission: async () => {
        const { status } = await MediaLibrary.requestPermissionsAsync();
        return status === 'granted';
      },
    },
    {
      id: 'contacts',
      title: 'Contactos',
      description: 'Acceder a contactos para emergencias',
      icon: 'people-outline',
      isRequired: false,
      checkPermission: async () => {
        const { status } = await Contacts.getPermissionsAsync();
        return status === 'granted';
      },
      requestPermission: async () => {
        const { status } = await Contacts.requestPermissionsAsync();
        return status === 'granted';
      },
    },
  ];

  const checkAllPermissions = async () => {
    setLoading(true);
    try {
      const updatedPermissions = await Promise.all(
        permissionsList.map(async (permission) => {
          const isGranted = await permission.checkPermission();
          return {
            ...permission,
            isGranted,
          };
        })
      );
      setPermissions(updatedPermissions);
    } catch (error) {
      console.error('Error checking permissions:', error);
      Alert.alert('Error', 'No se pudieron verificar los permisos');
    } finally {
      setLoading(false);
    }
  };

  const handlePermissionToggle = async (permission: PermissionItem) => {
    if (permission.isGranted) {
      // Si el permiso ya está concedido, mostrar información sobre cómo deshabilitarlo
      Alert.alert(
        'Permiso Concedido',
        `El permiso para ${permission.title.toLowerCase()} ya está activo. Para deshabilitarlo, ve a Configuración > Privacidad y Seguridad > ${permission.title}.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Ir a Configuración', onPress: () => Linking.openSettings() },
        ]
      );
      return;
    }

    try {
      const granted = await permission.requestPermission();
      if (granted) {
        // Actualizar el estado del permiso
        setPermissions(prev =>
          prev.map(p =>
            p.id === permission.id ? { ...p, isGranted: true } : p
          )
        );
        Alert.alert('Éxito', `Permiso para ${permission.title.toLowerCase()} concedido`);
      } else {
        Alert.alert(
          'Permiso Denegado',
          `El permiso para ${permission.title.toLowerCase()} fue denegado. Puedes habilitarlo manualmente en Configuración.`,
          [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Ir a Configuración', onPress: () => Linking.openSettings() },
          ]
        );
      }
    } catch (error) {
      console.error('Error requesting permission:', error);
      Alert.alert('Error', `No se pudo solicitar el permiso para ${permission.title.toLowerCase()}`);
    }
  };

  const handleGrantAllRequired = async () => {
    const requiredPermissions = permissions.filter(p => p.isRequired && !p.isGranted);
    
    if (requiredPermissions.length === 0) {
      Alert.alert('Información', 'Todos los permisos requeridos ya están concedidos');
      return;
    }

    Alert.alert(
      'Conceder Permisos Requeridos',
      `Se solicitarán ${requiredPermissions.length} permisos necesarios para el funcionamiento de la aplicación.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Continuar',
          onPress: async () => {
            for (const permission of requiredPermissions) {
              await handlePermissionToggle(permission);
            }
          },
        },
      ]
    );
  };

  useEffect(() => {
    checkAllPermissions();
  }, []);

  const requiredPermissions = permissions.filter(p => p.isRequired);
  const optionalPermissions = permissions.filter(p => !p.isRequired);
  const grantedRequired = requiredPermissions.filter(p => p.isGranted).length;
  const totalRequired = requiredPermissions.length;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Verificando permisos...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Permisos',
          headerShown: true,
          headerBackTitle: 'Atrás',
          headerStyle: {
            backgroundColor: '#ffffff',
          },
          headerTintColor: '#2c3e50',
          headerTitleStyle: {
            fontWeight: '600',
          },
        }}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Status Overview */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <Ionicons
              name={grantedRequired === totalRequired ? 'checkmark-circle' : 'warning'}
              size={24}
              color={grantedRequired === totalRequired ? '#10b981' : '#f59e0b'}
            />
            <Text style={styles.statusTitle}>
              {grantedRequired === totalRequired ? 'Todos los permisos concedidos' : 'Permisos pendientes'}
            </Text>
          </View>
          <Text style={styles.statusDescription}>
            {grantedRequired}/{totalRequired} permisos requeridos concedidos
          </Text>
          
          {grantedRequired < totalRequired && (
            <TouchableOpacity
              style={styles.grantAllButton}
              onPress={handleGrantAllRequired}
            >
              <Ionicons name="shield-checkmark-outline" size={20} color="white" />
              <Text style={styles.grantAllButtonText}>Conceder Permisos Requeridos</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Required Permissions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Permisos Requeridos</Text>
          <Text style={styles.sectionDescription}>
            Estos permisos son necesarios para el funcionamiento básico de la aplicación
          </Text>
          
          {requiredPermissions.map((permission) => (
            <TouchableOpacity
              key={permission.id}
              style={styles.permissionCard}
              onPress={() => handlePermissionToggle(permission)}
            >
              <View style={styles.permissionIcon}>
                <Ionicons
                  name={permission.icon}
                  size={24}
                  color={permission.isGranted ? '#10b981' : '#6b7280'}
                />
              </View>
              
              <View style={styles.permissionContent}>
                <Text style={styles.permissionTitle}>{permission.title}</Text>
                <Text style={styles.permissionDescription}>{permission.description}</Text>
              </View>
              
              <View style={styles.permissionStatus}>
                <Switch
                  value={permission.isGranted}
                  onValueChange={() => handlePermissionToggle(permission)}
                  trackColor={{ false: '#d1d5db', true: '#10b981' }}
                  thumbColor={permission.isGranted ? '#ffffff' : '#f3f4f6'}
                />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Optional Permissions */}
        {optionalPermissions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Permisos Opcionales</Text>
            <Text style={styles.sectionDescription}>
              Estos permisos mejoran la experiencia pero no son obligatorios
            </Text>
            
            {optionalPermissions.map((permission) => (
              <TouchableOpacity
                key={permission.id}
                style={styles.permissionCard}
                onPress={() => handlePermissionToggle(permission)}
              >
                <View style={styles.permissionIcon}>
                  <Ionicons
                    name={permission.icon}
                    size={24}
                    color={permission.isGranted ? '#10b981' : '#6b7280'}
                  />
                </View>
                
                <View style={styles.permissionContent}>
                  <Text style={styles.permissionTitle}>{permission.title}</Text>
                  <Text style={styles.permissionDescription}>{permission.description}</Text>
                </View>
                
                <View style={styles.permissionStatus}>
                  <Switch
                    value={permission.isGranted}
                    onValueChange={() => handlePermissionToggle(permission)}
                    trackColor={{ false: '#d1d5db', true: '#10b981' }}
                    thumbColor={permission.isGranted ? '#ffffff' : '#f3f4f6'}
                  />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Info Section */}
        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <Ionicons name="information-circle-outline" size={20} color="#0066cc" />
            <Text style={styles.infoTitle}>Información sobre Permisos</Text>
          </View>
          <Text style={styles.infoText}>
            • Los permisos se pueden modificar en cualquier momento desde Configuración del dispositivo
          </Text>
          <Text style={styles.infoText}>
            • Algunos permisos son necesarios para funciones específicas de la aplicación
          </Text>
          <Text style={styles.infoText}>
            • La aplicación funcionará con funcionalidad limitada si no se conceden todos los permisos
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#7f8c8d',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  statusCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginLeft: 12,
  },
  statusDescription: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 16,
  },
  grantAllButton: {
    backgroundColor: '#ff6d00',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  grantAllButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 16,
  },
  permissionCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  permissionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  permissionContent: {
    flex: 1,
  },
  permissionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 4,
  },
  permissionDescription: {
    fontSize: 14,
    color: '#7f8c8d',
  },
  permissionStatus: {
    marginLeft: 12,
  },
  infoCard: {
    backgroundColor: '#f0f9ff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#0066cc',
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0066cc',
    marginLeft: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 8,
    lineHeight: 20,
  },
});