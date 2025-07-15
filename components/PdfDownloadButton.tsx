import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePdfDownload } from '@/hooks/usePdfDownload';

interface PdfDownloadButtonProps {
  activityId: string;
  variant?: 'icon' | 'button';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
}

export const PdfDownloadButton: React.FC<PdfDownloadButtonProps> = ({
  activityId,
  variant = 'button',
  size = 'medium',
  disabled = false,
}) => {
  const { downloadPdf, isDownloading } = usePdfDownload();

  const handleDownload = () => {
    if (!disabled && !isDownloading) {
      downloadPdf(activityId);
    }
  };

  const getIconSize = () => {
    switch (size) {
      case 'small': return 16;
      case 'medium': return 20;
      case 'large': return 24;
      default: return 20;
    }
  };

  const getButtonStyle = () => {
    const baseStyle: any[] = [styles.button];
    
    if (variant === 'icon') {
      baseStyle.push(styles.iconButton);
    }
    
    if (size === 'small') {
      baseStyle.push(styles.smallButton);
    } else if (size === 'large') {
      baseStyle.push(styles.largeButton);
    }
    
    if (disabled || isDownloading) {
      baseStyle.push(styles.disabledButton);
    }
    
    return baseStyle;
  };

  if (variant === 'icon') {
    return (
      <TouchableOpacity
        style={getButtonStyle()}
        onPress={handleDownload}
        disabled={disabled || isDownloading}
      >
        {isDownloading ? (
          <ActivityIndicator size="small" color="#0066cc" />
        ) : (
          <Ionicons 
            name="download-outline" 
            size={getIconSize()} 
            color={disabled ? "#94A3B8" : "#0066cc"} 
          />
        )}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={getButtonStyle()}
      onPress={handleDownload}
      disabled={disabled || isDownloading}
    >
      <View style={styles.buttonContent}>
        {isDownloading ? (
          <ActivityIndicator size="small" color="white" />
        ) : (
          <Ionicons name="download-outline" size={getIconSize()} color="white" />
        )}
        <Text style={styles.buttonText}>
          {isDownloading ? 'Descargando...' : 'Descargar PDF'}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#0066cc',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButton: {
    backgroundColor: '#f1f5f9',
    padding: 8,
    borderRadius: 8,
  },
  smallButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  largeButton: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  disabledButton: {
    backgroundColor: '#94A3B8',
    opacity: 0.6,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});