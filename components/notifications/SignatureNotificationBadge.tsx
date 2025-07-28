import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import usePendingSignatures from '@/hooks/usePendingSignatures';

interface SignatureNotificationBadgeProps {
  showLabel?: boolean;
  size?: 'small' | 'medium' | 'large';
  color?: string;
}

export function SignatureNotificationBadge({
  showLabel = false,
  size = 'medium',
  color = '#FF4444',
}: SignatureNotificationBadgeProps) {
  const router = useRouter();
  const { statistics, getUnreadCount } = usePendingSignatures();
  
  const unreadCount = getUnreadCount();
  const criticalCount = statistics.critical;
  
  // No mostrar badge si no hay firmas pendientes
  if (statistics.total === 0) {
    return null;
  }

  const handlePress = () => {
    router.push('/pending-signatures');
  };

  const getIconSize = () => {
    switch (size) {
      case 'small': return 16;
      case 'medium': return 20;
      case 'large': return 24;
      default: return 20;
    }
  };

  const getBadgeSize = () => {
    switch (size) {
      case 'small': return 16;
      case 'medium': return 20;
      case 'large': return 24;
      default: return 20;
    }
  };

  const getFontSize = () => {
    switch (size) {
      case 'small': return 10;
      case 'medium': return 12;
      case 'large': return 14;
      default: return 12;
    }
  };

  return (
    <TouchableOpacity 
      style={styles.container} 
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <View style={styles.iconContainer}>
        <Ionicons 
          name="document-text" 
          size={getIconSize()} 
          color={criticalCount > 0 ? '#FF4444' : '#666'} 
        />
        
        {/* Badge para firmas no leídas */}
        {unreadCount > 0 && (
          <View style={[
            styles.badge,
            {
              backgroundColor: criticalCount > 0 ? '#FF4444' : '#FF8800',
              minWidth: getBadgeSize(),
              height: getBadgeSize(),
              borderRadius: getBadgeSize() / 2,
            }
          ]}>
            <Text style={[
              styles.badgeText,
              { fontSize: getFontSize() }
            ]}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </Text>
          </View>
        )}
      </View>
      
      {showLabel && (
        <View style={styles.labelContainer}>
          <Text style={styles.labelText}>Firmas</Text>
          {criticalCount > 0 && (
            <Text style={styles.criticalLabel}>
              {criticalCount} crítica{criticalCount !== 1 ? 's' : ''}
            </Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

// Componente simplificado para usar en headers
export function SignatureNotificationIcon({ color = '#666' }: { color?: string }) {
  const { statistics, getUnreadCount } = usePendingSignatures();
  const router = useRouter();
  
  const unreadCount = getUnreadCount();
  const criticalCount = statistics.critical;
  
  if (statistics.total === 0) {
    return (
      <Ionicons name="document-text-outline" size={24} color={color} />
    );
  }

  const handlePress = () => {
    router.push('/pending-signatures');
  };

  return (
    <TouchableOpacity onPress={handlePress} style={styles.iconButton}>
      <View style={styles.iconContainer}>
        <Ionicons 
          name="document-text" 
          size={24} 
          color={criticalCount > 0 ? '#FF4444' : color} 
        />
        
        {unreadCount > 0 && (
          <View style={[
            styles.badge,
            styles.smallBadge,
            {
              backgroundColor: criticalCount > 0 ? '#FF4444' : '#FF8800',
            }
          ]}>
            <Text style={[styles.badgeText, styles.smallBadgeText]}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

// Componente para mostrar resumen rápido
export function SignatureQuickSummary() {
  const { statistics } = usePendingSignatures();
  const router = useRouter();
  
  if (statistics.total === 0) {
    return null;
  }

  const handlePress = () => {
    router.push('/pending-signatures');
  };

  return (
    <TouchableOpacity style={styles.summaryContainer} onPress={handlePress}>
      <View style={styles.summaryIcon}>
        <Ionicons 
          name="document-text" 
          size={20} 
          color={statistics.critical > 0 ? '#FF4444' : '#FF8800'} 
        />
      </View>
      
      <View style={styles.summaryContent}>
        <Text style={styles.summaryTitle}>
          {statistics.total} firma{statistics.total !== 1 ? 's' : ''} pendiente{statistics.total !== 1 ? 's' : ''}
        </Text>
        
        {statistics.critical > 0 && (
          <Text style={styles.summaryCritical}>
            {statistics.critical} crítica{statistics.critical !== 1 ? 's' : ''}
          </Text>
        )}
        
        {statistics.expiring > 0 && (
          <Text style={styles.summaryExpiring}>
            {statistics.expiring} por vencer
          </Text>
        )}
      </View>
      
      <Ionicons name="chevron-forward" size={16} color="#666" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  iconContainer: {
    position: 'relative',
  },
  iconButton: {
    padding: 4,
  },
  badge: {
    position: 'absolute',
    top: -8,
    right: -8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 20,
    height: 20,
    borderRadius: 10,
  },
  smallBadge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    top: -6,
    right: -6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  smallBadgeText: {
    fontSize: 10,
  },
  labelContainer: {
    marginLeft: 8,
  },
  labelText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  criticalLabel: {
    fontSize: 12,
    color: '#FF4444',
    fontWeight: '600',
  },
  summaryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  summaryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  summaryContent: {
    flex: 1,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  summaryCritical: {
    fontSize: 12,
    color: '#FF4444',
    fontWeight: '500',
  },
  summaryExpiring: {
    fontSize: 12,
    color: '#FF8800',
    fontWeight: '500',
  },
});

export default SignatureNotificationBadge;