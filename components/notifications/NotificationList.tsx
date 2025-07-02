import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import useNotifications from '../../hooks/useNotifications';

interface NotificationData {
  id: string;
  title: string;
  message: string;
  type: 'activity' | 'review' | 'warning' | 'info' | 'success' | 'error';
  timestamp: Date;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  actionUrl?: string;
  activityId?: number;
  activityName?: string;
  data?: any;
  read?: boolean;
}

interface NotificationListProps {
  onNotificationPress?: (notification: NotificationData) => void;
}

export const NotificationList: React.FC<NotificationListProps> = ({
  onNotificationPress,
}) => {
  const {
    notifications,
    unreadCount,
    isConnected,
    markAsRead,
    clearAll,
    refreshNotifications,
    connectionStatus,
  } = useNotifications();

  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshNotifications();
    setIsRefreshing(false);
  };

  const handleNotificationPress = async (notification: NotificationData) => {
    if (!notification.read) {
      await markAsRead(notification.id);
    }
    onNotificationPress?.(notification);
  };

  const handleClearAll = () => {
    Alert.alert(
      'Limpiar Notificaciones',
      '¿Estás seguro de que quieres eliminar todas las notificaciones?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: clearAll },
      ]
    );
  };

  const getNotificationIcon = (type: string, priority: string) => {
    if (priority === 'urgent') return 'alert-circle';
    if (priority === 'high') return 'warning';
    
    switch (type) {
      case 'activity':
        return 'checkmark-circle';
      case 'review':
        return 'document-text';
      case 'warning':
        return 'warning-outline';
      case 'success':
        return 'checkmark-circle-outline';
      case 'error':
        return 'close-circle-outline';
      default:
        return 'information-circle-outline';
    }
  };

  const getNotificationColor = (type: string, priority: string) => {
    if (priority === 'urgent') return '#FF1744';
    if (priority === 'high') return '#FF9800';
    
    switch (type) {
      case 'activity':
        return '#4CAF50';
      case 'review':
        return '#2196F3';
      case 'warning':
        return '#FF9800';
      case 'success':
        return '#4CAF50';
      case 'error':
        return '#F44336';
      default:
        return '#757575';
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Ahora';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    return `${days}d`;
  };

  const renderNotification = ({ item }: { item: NotificationData }) => {
    const iconName = getNotificationIcon(item.type, item.priority);
    const iconColor = getNotificationColor(item.type, item.priority);
    
    return (
      <TouchableOpacity
        style={[
          styles.notificationItem,
          !item.read && styles.unreadNotification,
        ]}
        onPress={() => handleNotificationPress(item)}
      >
        <View style={styles.notificationContent}>
          <View style={styles.notificationHeader}>
            <Ionicons name={iconName as any} size={20} color={iconColor} />
            <Text style={styles.timestamp}>
              {formatTimestamp(item.timestamp)}
            </Text>
            {!item.read && <View style={styles.unreadDot} />}
          </View>
          
          <Text style={[styles.title, !item.read && styles.unreadTitle]}>
            {item.title}
          </Text>
          
          <Text style={styles.message} numberOfLines={2}>
            {item.message}
          </Text>
          
          {item.activityName && (
            <Text style={styles.activityName}>
              📋 {item.activityName}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderStatusBar = () => (
    <View style={styles.statusBar}>
      <View style={styles.statusContainer}>
        <View 
          style={[
            styles.statusDot, 
            { backgroundColor: isConnected ? '#4CAF50' : '#FF5722' }
          ]} 
        />
        <Text style={styles.statusText}>
          {isConnected ? 'Conectado' : 'Desconectado'}
        </Text>
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="notifications-outline" size={64} color="#ccc" />
      <Text style={styles.emptyTitle}>No hay notificaciones</Text>
      <Text style={styles.emptyMessage}>
        Las notificaciones aparecerán aquí cuando recibas nuevas actividades
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {renderStatusBar()}
      
      <FlatList
        data={notifications}
        renderItem={renderNotification}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={['#2196F3']}
          />
        }
        ListEmptyComponent={renderEmpty}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={notifications.length === 0 ? styles.emptyList : undefined}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  statusBar: {
    padding: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    color: '#666',
  },

  notificationItem: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 8,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  unreadNotification: {
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
    marginLeft: 8,
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2196F3',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  unreadTitle: {
    fontWeight: 'bold',
  },
  message: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 8,
  },
  activityName: {
    fontSize: 12,
    color: '#2196F3',
    fontStyle: 'italic',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyList: {
    flexGrow: 1,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#999',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 14,
    color: '#ccc',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default NotificationList;