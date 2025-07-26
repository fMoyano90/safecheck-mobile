import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  Alert,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Text, View } from '@/components/Themed';
import { useAuth } from '@/contexts/auth-context';
import useAuthRedirect from '@/hooks/useAuthRedirect';

export default function ProfileModal() {
  const router = useRouter();
  const { user, logout, isLoading } = useAuth();
  const { shouldShowContent } = useAuthRedirect();

  // No mostrar contenido si no está autenticado
  if (!shouldShowContent) {
    return null;
  }

  const handleLogout = () => {
    Alert.alert(
      'Cerrar Sesión',
      '¿Estás seguro que deseas cerrar sesión?',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Cerrar Sesión',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
              router.replace('/login');
            } catch (error) {
              console.error('Error during logout:', error);
              // Aún así redirigir al login
              router.replace('/login');
            }
          },
        },
      ]
    );
  };

  // Mostrar loading mientras carga los datos del usuario
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ff6d00" />
          <Text style={styles.loadingText}>Cargando perfil...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Si no hay usuario después de cargar, no mostrar nada (useEffect manejará la redirección)
  if (!user) {
    return null;
  }

  const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Usuario';
  const userInitials = fullName.split(' ').map((n: string) => n[0]).join('').toUpperCase();
  const formattedJoinDate = user.createdAt ? new Date(user.createdAt).toLocaleDateString('es-ES') : 'N/A';

  const profileOptions = [
    {
      id: 'permissions',
      title: 'Permisos',
      description: 'Configurar notificaciones, cámara y GPS',
      icon: 'shield-checkmark-outline',
      onPress: () => {
        router.push('/permissions');
      },
    },
    {
      id: 'theme',
      title: 'Tema',
      description: 'Configurar modo claro, oscuro o sistema',
      icon: 'color-palette-outline',
      onPress: () => {
        router.push('/theme-settings');
      },
    },
    {
      id: 'profile',
      title: 'Mi Perfil',
      description: 'Ver y editar información personal',
      icon: 'person-outline',
      onPress: () => {
        router.push('/profile');
      },
    },
    {
      id: 'connectivity',
      title: 'Conectividad',
      description: 'Configurar trabajo offline',
      icon: 'wifi-outline',
      onPress: () => {
        router.push('/connectivity-settings');
      },
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.closeButton}
          onPress={() => router.back()}
        >
          <Ionicons name="close" size={24} color="#2c3e50" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Perfil</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* User Info Card */}
        <View style={styles.userCard}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {userInitials}
              </Text>
            </View>
          </View>
          
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{fullName}</Text>
            <Text style={styles.userRole}>{user.role === 'worker' ? 'Trabajador' : user.role || 'Usuario'}</Text>
          </View>

          <View style={styles.userDetails}>
            <View style={styles.detailRow}>
              <Ionicons name="mail-outline" size={16} color="#ff6d00" />
              <Text style={styles.detailText}>{user.email}</Text>
            </View>
            {user.phone && (
              <View style={styles.detailRow}>
                <Ionicons name="call-outline" size={16} color="#ff6d00" />
                <Text style={styles.detailText}>{user.phone}</Text>
              </View>
            )}
            <View style={styles.detailRow}>
              <Ionicons name="id-card-outline" size={16} color="#ff6d00" />
              <Text style={styles.detailText}>ID: {user.id}</Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="calendar-outline" size={16} color="#ff6d00" />
              <Text style={styles.detailText}>
                Desde: {formattedJoinDate}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="checkmark-circle-outline" size={16} color="#ff6d00" />
              <Text style={styles.detailText}>
                Estado: {user.isActive ? 'Activo' : 'Inactivo'}
              </Text>
            </View>
          </View>
        </View>

        {/* Profile Options */}
        <View style={styles.optionsContainer}>
          {profileOptions.map((option) => (
            <TouchableOpacity
              key={option.id}
              style={styles.optionCard}
              onPress={option.onPress}
            >
              <View style={styles.optionIcon}>
                <Ionicons name={option.icon as any} size={24} color="#0066cc" />
              </View>
              <View style={styles.optionContent}>
                <Text style={styles.optionTitle}>{option.title}</Text>
                <Text style={styles.optionDescription}>{option.description}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#bdc3c7" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout Button */}
        <View style={styles.logoutContainer}>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={24} color="#F44336" />
            <Text style={styles.logoutText}>Cerrar Sesión</Text>
          </TouchableOpacity>
        </View>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={styles.appInfoText}>Núcleo Gestor Mobile v1.0.0</Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e8ed',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  userCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 6,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#0066cc',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0066cc',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  userInfo: {
    alignItems: 'center',
    marginBottom: 20,
  },
  userName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4,
  },
  userRole: {
    fontSize: 16,
    color: '#0066cc',
    fontWeight: '600',
    marginBottom: 8,
  },
  userDetails: {
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#7f8c8d',
    flex: 1,
  },
  optionsContainer: {
    gap: 12,
    marginBottom: 20,
  },
  optionCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e6f3ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 2,
  },
  optionDescription: {
    fontSize: 14,
    color: '#7f8c8d',
  },
  logoutContainer: {
    marginBottom: 20,
  },
  logoutButton: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fecaca',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F44336',
    marginLeft: 8,
  },
  appInfo: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  appInfoText: {
    fontSize: 12,
    color: '#95a5a6',
    marginBottom: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#7f8c8d',
  },
});
