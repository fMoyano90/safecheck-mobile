import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

interface SubtleRefreshIndicatorProps {
  visible: boolean;
}

export const SubtleRefreshIndicator: React.FC<SubtleRefreshIndicatorProps> = ({ visible }) => {
  if (!visible) return null;

  return (
    <View style={styles.container}>
      <ActivityIndicator size="small" color="#ff6d00" />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
}); 