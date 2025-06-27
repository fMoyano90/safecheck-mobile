import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface RefreshIndicatorProps {
  visible: boolean;
  onRefresh: () => void;
  message?: string;
}

export const RefreshIndicator: React.FC<RefreshIndicatorProps> = ({
  visible,
  onRefresh,
  message = 'Nuevas actividades disponibles'
}) => {
  if (!visible) return null;

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
        <Ionicons name="refresh" size={16} color="#ffffff" />
        <Text style={styles.refreshText}>{message}</Text>
        <Ionicons name="chevron-up" size={16} color="#ffffff" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 10,
    left: 20,
    right: 20,
    zIndex: 1000,
    elevation: 1000,
  },
  refreshButton: {
    backgroundColor: '#ff6d00',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  refreshText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginHorizontal: 8,
  },
}); 