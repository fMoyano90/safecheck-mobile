import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface CacheIndicatorProps {
  isOnline: boolean;
  lastUpdated?: Date | null;
  onRefresh?: () => void;
  showRefreshButton?: boolean;
  compact?: boolean;
}

export function CacheIndicator({
  isOnline,
  lastUpdated,
  onRefresh,
  showRefreshButton = true,
  compact = false
}: CacheIndicatorProps) {
  const getStatusColor = () => {
    if (!isOnline) return '#ff6d00'; // Naranja para offline
    return '#4CAF50'; // Verde para online
  };

  const getStatusIcon = () => {
    if (!isOnline) return 'cloud-offline-outline';
    return 'cloud-done-outline';
  };

  const getStatusText = () => {
    if (!isOnline) return 'Modo offline';
    return 'Conectado';
  };

  const formatLastUpdated = () => {
    if (!lastUpdated) return 'Nunca';
    
    const now = new Date();
    const diffMs = now.getTime() - lastUpdated.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    
    if (diffMinutes < 1) return 'Ahora';
    if (diffMinutes < 60) return `Hace ${diffMinutes}m`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `Hace ${diffHours}h`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `Hace ${diffDays}d`;
  };

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <View style={styles.statusRow}>
          <Ionicons 
            name={getStatusIcon()} 
            size={14} 
            color={getStatusColor()} 
          />
          <Text style={[styles.statusText, { color: getStatusColor() }]}>
            {getStatusText()}
          </Text>
        </View>
        {lastUpdated && (
          <Text style={styles.lastUpdatedCompact}>
            {formatLastUpdated()}
          </Text>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.statusRow}>
        <Ionicons 
          name={getStatusIcon()} 
          size={16} 
          color={getStatusColor()} 
        />
        <Text style={[styles.statusText, { color: getStatusColor() }]}>
          {getStatusText()}
        </Text>
      </View>
      
      {lastUpdated && (
        <Text style={styles.lastUpdatedText}>
          Última actualización: {formatLastUpdated()}
        </Text>
      )}
      
      {showRefreshButton && onRefresh && (
        <TouchableOpacity 
          style={styles.refreshButton} 
          onPress={onRefresh}
          disabled={!isOnline}
        >
          <Ionicons 
            name="refresh-outline" 
            size={16} 
            color={isOnline ? '#0066cc' : '#94a3b8'} 
          />
          <Text style={[
            styles.refreshText,
            { color: isOnline ? '#0066cc' : '#94a3b8' }
          ]}>
            Actualizar
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 8,
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  lastUpdatedText: {
    fontSize: 12,
    color: '#64748b',
  },
  lastUpdatedCompact: {
    fontSize: 11,
    color: '#94a3b8',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  refreshText: {
    fontSize: 12,
    fontWeight: '500',
  },
});