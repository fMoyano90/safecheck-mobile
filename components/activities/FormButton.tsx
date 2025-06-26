import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

interface FormButtonProps {
  activityId: number;
  activityType: 'scheduled' | 'recurring';
  activityName: string;
  disabled?: boolean;
  size?: 'small' | 'medium' | 'large';
  variant?: 'primary' | 'secondary' | 'outline';
}

const FormButton: React.FC<FormButtonProps> = ({
  activityId,
  activityType,
  activityName,
  disabled = false,
  size = 'medium',
  variant = 'primary',
}) => {
  const router = useRouter();

  const handlePress = () => {
    if (disabled) return;

    // Confirmar que quiere abrir el formulario
    Alert.alert(
      'Abrir Formulario',
      `¿Deseas completar el formulario para "${activityName}"?`,
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Abrir',
          onPress: () => {
            router.push(`/form-demo?activityId=${activityId}&activityType=${activityType}` as any);
          },
        },
      ]
    );
  };

  const getButtonStyle = () => {
    const baseStyle: any[] = [styles.button, styles[size]];
    
    if (disabled) {
      baseStyle.push(styles.disabled);
    } else {
      baseStyle.push(styles[variant]);
    }
    
    return baseStyle;
  };

  const getTextStyle = () => {
    const baseStyle: any[] = [styles.buttonText, styles[`${size}Text`]];
    
    if (disabled) {
      baseStyle.push(styles.disabledText);
    } else {
      baseStyle.push(styles[`${variant}Text`]);
    }
    
    return baseStyle;
  };

  const getIconSize = () => {
    switch (size) {
      case 'small': return 14;
      case 'medium': return 16;
      case 'large': return 18;
      default: return 16;
    }
  };

  const getIconColor = () => {
    if (disabled) return '#a3a3a3'; // neutral-400
    
    switch (variant) {
      case 'primary': return '#FFFFFF';
      case 'secondary': return '#FFFFFF';
      case 'outline': return '#ff6d00'; // brand-500
      default: return '#FFFFFF';
    }
  };

  return (
    <TouchableOpacity
      style={getButtonStyle()}
      onPress={handlePress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <Ionicons
        name="document-text"
        size={getIconSize()}
        color={getIconColor()}
      />
      <Text style={getTextStyle()}>
        {size === 'small' ? 'Formulario' : 'Abrir Formulario'}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    gap: 6,
  },
  
  // Tamaños
  small: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  medium: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  large: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  
  // Variantes
  primary: {
    backgroundColor: '#ff6d00', // brand-500
  },
  secondary: {
    backgroundColor: '#1565c0', // blue-500
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#ff6d00', // brand-500
  },
  
  // Estado deshabilitado
  disabled: {
    backgroundColor: '#e5e5e5', // neutral-200
  },
  
  // Textos
  buttonText: {
    fontWeight: '600',
  },
  smallText: {
    fontSize: 12,
  },
  mediumText: {
    fontSize: 14,
  },
  largeText: {
    fontSize: 16,
  },
  
  // Colores de texto por variante
  primaryText: {
    color: '#FFFFFF',
  },
  secondaryText: {
    color: '#FFFFFF',
  },
  outlineText: {
    color: '#ff6d00', // brand-500
  },
  disabledText: {
    color: '#a3a3a3', // neutral-400
  },
});

export default FormButton; 