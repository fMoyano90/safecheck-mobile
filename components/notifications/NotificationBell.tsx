import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import useNotifications from '../../hooks/useNotifications';
import NotificationSettings from './NotificationSettings';

interface NotificationBellProps {
  onPress?: () => void;
  size?: number;
  color?: string;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({
  onPress,
  size = 24,
  color = '#333',
}) => {
  const router = useRouter();
  const { unreadCount, isConnected } = useNotifications();
  const [showSettings, setShowSettings] = useState(false);

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push('/notifications');
    }
  };

  const handleLongPress = () => {
    setShowSettings(true);
  };

  const handleCloseSettings = () => {
    setShowSettings(false);
  };

  return (
    <>
      <TouchableOpacity 
        onPress={handlePress} 
        onLongPress={handleLongPress}
        style={styles.container}
        activeOpacity={0.7}
      >
        <View style={styles.bellContainer}>
          <Ionicons 
            name={unreadCount > 0 ? 'notifications' : 'notifications-outline'} 
            size={size} 
            color={color} 
          />
          
          {/* Indicador de conexión */}
          <View 
            style={[
              styles.connectionIndicator, 
              { backgroundColor: isConnected ? '#4CAF50' : '#FF5722' }
            ]} 
          />
          
          {/* Badge de notificaciones no leídas */}
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {unreadCount > 99 ? '99+' : unreadCount.toString()}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>

      {/* Modal de configuración */}
      <Modal
        visible={showSettings}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCloseSettings}
      >
        <NotificationSettings onClose={handleCloseSettings} />
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 8,
  },
  bellContainer: {
    position: 'relative',
  },
  connectionIndicator: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#fff',
  },
  badge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#FF5722',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default NotificationBell;