import React from 'react';
import { View, Text, Image, StyleSheet, Dimensions, ScrollView, TouchableOpacity } from 'react-native';

interface FieldRendererProps {
  fieldKey: string;
  value: any;
}

const { width: screenWidth } = Dimensions.get('window');

export const FieldRenderer: React.FC<FieldRendererProps> = ({ fieldKey, value }) => {
  // Función para detectar si es una imagen base64
  const isBase64Image = (val: any): boolean => {
    if (typeof val !== 'string') return false;
    return /^data:image\/(jpeg|jpg|png|gif|webp);base64,/.test(val);
  };

  // Función para detectar si es una URL de imagen (mejorada)
  const isImageUrl = (val: any): boolean => {
    if (typeof val !== 'string') return false;
    
    // Detectar URLs de imágenes con extensiones comunes
    const hasImageExtension = /\.(jpeg|jpg|png|gif|webp|bmp|svg)(\?.*)?$/i.test(val);
    
    // Detectar URLs de Azure Storage que pueden ser imágenes
    const isAzureStorageUrl = val.includes('blob.core.windows.net') && 
                              /\.(jpeg|jpg|png|gif|webp|bmp|svg)(\?.*)?$/i.test(val);
    
    // Detectar URLs que empiezan con http/https y tienen extensión de imagen
    const isHttpImageUrl = (val.startsWith('http://') || val.startsWith('https://')) && hasImageExtension;
    
    return hasImageExtension || isAzureStorageUrl || isHttpImageUrl;
  };

  // Función para verificar si es un array de imágenes
  const isImageArray = (val: any): boolean => {
    if (!Array.isArray(val)) return false;
    return val.every(item => isBase64Image(item) || isImageUrl(item));
  };

  // Función para formatear el nombre del campo
  const formatFieldName = (key: string): string => {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .replace(/_/g, ' ')
      .replace(/field/gi, 'Campo')
      .trim();
  };

  // Renderizar una sola imagen
  const renderSingleImage = (imageValue: string, index?: number) => {
    return (
      <View key={index} style={styles.singleImageContainer}>
        <Image 
          source={{ uri: imageValue }}
          style={styles.image}
          resizeMode="contain"
        />
        {index !== undefined && (
          <Text style={styles.imageIndex}>Imagen {index + 1}</Text>
        )}
      </View>
    );
  };

  // Renderizar múltiples imágenes
  const renderImageArray = (images: string[], fieldName: string) => {
    return (
      <View style={styles.imageArrayContainer}>
        <Text style={styles.fieldLabel}>
          {formatFieldName(fieldName)} ({images.length} imagen{images.length > 1 ? 'es' : ''}):
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
          {images.map((imageValue, index) => renderSingleImage(imageValue, index))}
        </ScrollView>
      </View>
    );
  };

  // Renderizar imagen base64 o URL
  const renderImage = (imageValue: string, fieldName: string) => {
    return (
      <View style={styles.imageContainer}>
        <Text style={styles.fieldLabel}>{formatFieldName(fieldName)}:</Text>
        {renderSingleImage(imageValue)}
      </View>
    );
  };

  // Renderizar firma
  const renderSignature = (signatureValue: string, fieldName: string) => {
    return (
      <View style={styles.signatureContainer}>
        <Text style={styles.fieldLabel}>{formatFieldName(fieldName)}:</Text>
        <View style={styles.signatureWrapper}>
          <Image 
            source={{ uri: signatureValue }}
            style={styles.signature}
            resizeMode="contain"
          />
          <Text style={styles.signatureLabel}>Firma Digital</Text>
        </View>
      </View>
    );
  };

  // Renderizar texto normal
  const renderText = (textValue: any, fieldName: string) => {
    const displayValue = typeof textValue === 'object' 
      ? JSON.stringify(textValue, null, 2) 
      : String(textValue);

    return (
      <View style={styles.textContainer}>
        <Text style={styles.fieldLabel}>{formatFieldName(fieldName)}:</Text>
        <Text style={styles.fieldValue}>{displayValue}</Text>
      </View>
    );
  };

  // Determinar el tipo de campo y renderizar apropiadamente
  
  // Caso 1: Array de imágenes
  if (isImageArray(value)) {
    const isSignatureField = /signature|firma|sign/i.test(fieldKey);
    
    if (isSignatureField) {
      // Si es un array de firmas, renderizar cada una
      return (
        <View style={styles.signatureArrayContainer}>
          <Text style={styles.fieldLabel}>
            {formatFieldName(fieldKey)} ({value.length} firma{value.length > 1 ? 's' : ''}):
          </Text>
          {value.map((signatureValue: string, index: number) => (
            <View key={index} style={styles.signatureWrapper}>
              <Image 
                source={{ uri: signatureValue }}
                style={styles.signature}
                resizeMode="contain"
              />
              <Text style={styles.signatureLabel}>Firma Digital {index + 1}</Text>
            </View>
          ))}
        </View>
      );
    } else {
      return renderImageArray(value, fieldKey);
    }
  }

  // Caso 2: Imagen individual
  if (isBase64Image(value) || isImageUrl(value)) {
    const isSignatureField = /signature|firma|sign/i.test(fieldKey);
    
    if (isSignatureField) {
      return renderSignature(value, fieldKey);
    } else {
      return renderImage(value, fieldKey);
    }
  }

  // Caso 3: Texto normal
  return renderText(value, fieldKey);
};

const styles = StyleSheet.create({
  imageContainer: {
    marginBottom: 16,
  },
  imageArrayContainer: {
    marginBottom: 16,
  },
  singleImageContainer: {
    marginRight: 12,
    alignItems: 'center',
  },
  imageScroll: {
    flexDirection: 'row',
  },
  imageIndex: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    textAlign: 'center',
  },
  signatureContainer: {
    marginBottom: 16,
  },
  signatureArrayContainer: {
    marginBottom: 16,
  },
  textContainer: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  image: {
    width: screenWidth - 80, // Ajustar al ancho de la pantalla con padding
    height: 200,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  signatureWrapper: {
    alignItems: 'center',
    marginBottom: 12,
  },
  signature: {
    width: screenWidth - 64,
    height: 120,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    borderColor: '#0066cc',
    borderStyle: 'dashed',
  },
  signatureLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    fontStyle: 'italic',
  },
  fieldValue: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
});

export default FieldRenderer;