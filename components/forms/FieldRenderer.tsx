import React from 'react';
import { View, Text, Image, StyleSheet, Dimensions, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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

  // Renderizar ubicación
  const renderLocation = (locationValue: any, fieldName: string) => {
    return (
      <View style={styles.textContainer}>
        <Text style={styles.fieldLabel}>{formatFieldName(fieldName)}:</Text>
        <Text style={styles.fieldValue}>
          📍 Lat: {locationValue.latitude?.toFixed(6) || 'N/A'}
        </Text>
        <Text style={styles.fieldValue}>
          📍 Lng: {locationValue.longitude?.toFixed(6) || 'N/A'}
        </Text>
        {locationValue.accuracy && (
          <Text style={styles.fieldValue}>
            Precisión: ±{Math.round(locationValue.accuracy)}m
          </Text>
        )}
      </View>
    );
  };

  // Renderizar archivos
  const renderFiles = (filesValue: any[], fieldName: string) => {
    return (
      <View style={styles.textContainer}>
        <Text style={styles.fieldLabel}>
          {formatFieldName(fieldName)} ({filesValue.length} archivo{filesValue.length > 1 ? 's' : ''}):
        </Text>
        {filesValue.map((file, index) => (
          <View key={index} style={styles.textContainer}>
            <Text style={styles.fieldValue}>
              📄 {file.name || `Archivo ${index + 1}`}
            </Text>
            {file.size && (
              <Text style={styles.fieldValue}>
                Tamaño: {(file.size / 1024).toFixed(1)} KB
              </Text>
            )}
          </View>
        ))}
      </View>
    );
  };

  // Renderizar calificación
  const renderRating = (ratingValue: number, fieldName: string) => {
    const stars = Array.from({ length: 5 }, (_, i) => i + 1 <= ratingValue ? '⭐' : '☆').join('');
    return (
      <View style={styles.textContainer}>
        <Text style={styles.fieldLabel}>{formatFieldName(fieldName)}:</Text>
        <Text style={styles.fieldValue}>
          {stars} ({ratingValue}/5)
        </Text>
      </View>
    );
  };

  // Renderizar slider
  const renderSlider = (sliderValue: number, fieldName: string) => {
    return (
      <View style={styles.textContainer}>
        <Text style={styles.fieldLabel}>{formatFieldName(fieldName)}:</Text>
        <Text style={styles.fieldValue}>
          Valor: {sliderValue}
        </Text>
      </View>
    );
  };

  // Renderizar código QR
  const renderQRCode = (qrValue: string, fieldName: string) => {
    return (
      <View style={styles.textContainer}>
        <Text style={styles.fieldLabel}>{formatFieldName(fieldName)}:</Text>
        <Text style={styles.fieldValue}>
          📱 {qrValue}
        </Text>
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
  
  // Casos especiales para nuevos tipos de campos
  
  // Ubicación
  if (typeof value === 'object' && value !== null && 'latitude' in value && 'longitude' in value) {
    return renderLocation(value, fieldKey);
  }

  // Archivos
  if (Array.isArray(value) && value.length > 0 && value[0] && typeof value[0] === 'object' && ('name' in value[0] || 'uri' in value[0])) {
    return renderFiles(value, fieldKey);
  }

  // Calificación (números del 1 al 5)
  if (typeof value === 'number' && value >= 1 && value <= 5 && /rating|calificacion|star/i.test(fieldKey)) {
    return renderRating(value, fieldKey);
  }

  // Slider (números con configuración específica)
  if (typeof value === 'number' && /slider|rango|range/i.test(fieldKey)) {
    return renderSlider(value, fieldKey);
  }

  // Código QR
  if (typeof value === 'string' && /qr|barcode|codigo/i.test(fieldKey)) {
    return renderQRCode(value, fieldKey);
  }
  
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
  // Estilos para nuevos tipos de campos
  locationContainer: {
    marginBottom: 16,
    backgroundColor: '#FFF5F0',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FF6D00',
  },
  locationInfo: {
    gap: 4,
  },
  locationText: {
    fontSize: 14,
    color: '#FF6D00',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  locationAccuracy: {
    fontSize: 12,
    color: '#7F8C8D',
    fontStyle: 'italic',
  },
  filesContainer: {
    marginBottom: 16,
  },
  filesList: {
    gap: 8,
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 8,
  },
  fileName: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
  },
  fileSize: {
    fontSize: 12,
    color: '#6B7280',
  },
  ratingContainer: {
    marginBottom: 16,
    alignItems: 'center',
  },
  ratingStars: {
    flexDirection: 'row',
    gap: 4,
  },
  ratingValue: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '600',
    marginTop: 8,
  },
  sliderContainer: {
    marginBottom: 16,
  },
  sliderValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0891B2',
    textAlign: 'center',
    marginBottom: 8,
  },
  sliderLabel: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
});

export default FieldRenderer;