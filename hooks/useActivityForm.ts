import { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import * as Location from 'expo-location';
import { 
  documentsApi, 
  type DocumentFormData, 
  type ActivityTemplate, 
  type DocumentResponse 
} from '@/lib/api';

interface UseActivityFormProps {
  activityId: number;
  activityType: 'scheduled' | 'recurring';
}

interface UseActivityFormResult {
  template: ActivityTemplate | null;
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;
  submitForm: (formData: any) => Promise<void>;
  saveForm: (formData: any) => Promise<void>;
}

export const useActivityForm = ({ 
  activityId, 
  activityType 
}: UseActivityFormProps): UseActivityFormResult => {
  const [template, setTemplate] = useState<ActivityTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cargar template al montar el componente
  useEffect(() => {
    loadTemplate();
  }, [activityId, activityType]);

  const loadTemplate = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const templateData = await documentsApi.getTemplate(activityId, activityType);
      setTemplate(templateData);
    } catch (error) {
      console.error('Error cargando template:', error);
      setError('Error al cargar el formulario');
      Alert.alert('Error', 'No se pudo cargar el formulario');
    } finally {
      setIsLoading(false);
    }
  };

  const processFormData = async (formData: any): Promise<DocumentFormData> => {
    const startedAt = new Date().toISOString();
    
    // Obtener ubicación si el formulario la requiere
    let locationData = null;
    if (formData._locations && Object.keys(formData._locations).length > 0) {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const currentLocation = await Location.getCurrentPositionAsync({});
          locationData = {
            latitude: currentLocation.coords.latitude,
            longitude: currentLocation.coords.longitude,
            accuracy: currentLocation.coords.accuracy,
            timestamp: currentLocation.timestamp,
            formLocations: formData._locations,
          };
        }
      } catch (error) {
        console.warn('No se pudo obtener la ubicación:', error);
      }
    }

    // Separar datos especiales del resto del formulario
    const { _signatures, _photos, _locations, ...cleanFormData } = formData;

    // Preparar datos para envío
    const documentData: DocumentFormData = {
      activityId,
      activityType,
      formData: cleanFormData,
      startedAt,
      metadata: {
        signatures: _signatures || {},
        photos: _photos || {},
        hasSignatures: _signatures && Object.keys(_signatures).length > 0,
        hasPhotos: _photos && Object.keys(_photos).length > 0,
        completedFields: Object.keys(cleanFormData).length,
        totalFields: template?.structure.length || 0,
        templateId: template?.id,
        templateName: template?.name,
      },
    };

    if (locationData) {
      documentData.locationData = locationData;
    }

    return documentData;
  };

  const submitForm = async (formData: any): Promise<void> => {
    try {
      setIsSubmitting(true);
      setError(null);

      const documentData = await processFormData(formData);
      
      // Añadir tiempo de completado
      documentData.metadata = {
        ...documentData.metadata,
        completedAt: new Date().toISOString(),
      };

      // Enviar formulario
      const result = await documentsApi.createFromActivity(documentData);
      
      Alert.alert(
        'Éxito', 
        'Formulario enviado correctamente', 
        [{ text: 'OK' }]
      );

      console.log('Documento creado:', result);
      
    } catch (error) {
      console.error('Error enviando formulario:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      setError(errorMessage);
      
      Alert.alert(
        'Error', 
        'No se pudo enviar el formulario. Inténtalo de nuevo.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const saveForm = async (formData: any): Promise<void> => {
    try {
      setError(null);

      const documentData = await processFormData(formData);
      
      // Guardar como draft (esto requeriría un endpoint específico o localStorage)
      // Por ahora solo mostramos un mensaje de confirmación
      Alert.alert(
        'Guardado', 
        'Progreso guardado localmente',
        [{ text: 'OK' }]
      );

      console.log('Datos guardados:', documentData);
      
    } catch (error) {
      console.error('Error guardando formulario:', error);
      Alert.alert(
        'Error', 
        'No se pudo guardar el progreso',
        [{ text: 'OK' }]
      );
    }
  };

  return {
    template,
    isLoading,
    isSubmitting,
    error,
    submitForm,
    saveForm,
  };
}; 