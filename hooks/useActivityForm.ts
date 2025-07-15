import { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { 
  documentsApi, 
  type DocumentFormData, 
  type ActivityTemplate, 
  type DocumentResponse 
} from '@/lib/api';
import { 
  offlineDocumentsApi, 
  offlineStorage,
  useOfflineStatus 
} from '@/lib/offline';
import { useDocumentCacheInvalidation } from '@/hooks/useDocumentCache';

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
  const router = useRouter();
  
  // Hook para estado offline
  const { isOnline, canMakeRequests } = useOfflineStatus();
  
  // Hook para invalidar caché de documentos
  const { invalidateDocumentCache } = useDocumentCacheInvalidation();

  // Cargar template al montar el componente
  useEffect(() => {
    loadTemplate();
  }, [activityId, activityType]);

  const loadTemplate = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Intentar cargar desde sistema offline primero
      let templateData: ActivityTemplate | null = null;
      
      // Si hay conexión, usar API normal, sino usar sistema offline
      if (canMakeRequests) {
        try {
          templateData = await documentsApi.getTemplate(activityId, activityType);
          
          // Guardar template para uso offline
          const templates = await offlineStorage.getTemplates();
          const existingIndex = templates.findIndex(t => 
            t.activityId === activityId && t.activityType === activityType
          );
          
          const templateToSave = {
            activityId,
            activityType,
            ...templateData
          };
          
          if (existingIndex !== -1) {
            templates[existingIndex] = templateToSave;
          } else {
            templates.push(templateToSave);
          }
          
          await offlineStorage.saveTemplates(templates);
          console.log('📱 Template guardado para uso offline');
          
        } catch (error) {
          console.warn('⚠️ Error con API online, intentando offline:', error);
          // Si falla la API online, intentar offline
          templateData = await offlineDocumentsApi.getTemplate(activityId, activityType);
        }
      } else {
        // Sin conexión, usar solo sistema offline
        console.log('📱 Modo offline: cargando template desde almacenamiento local');
        templateData = await offlineDocumentsApi.getTemplate(activityId, activityType);
      }
      
      if (!templateData) {
        throw new Error('No se encontró el template ni online ni offline');
      }
      
      setTemplate(templateData);
      
      // Cargar borrador si existe
      const draftData = await offlineStorage.getDraftForm(activityId);
      if (draftData) {
        console.log('📝 Borrador encontrado para actividad', activityId);
        // Aquí podrías emitir un evento o callback para cargar el borrador en el formulario
      }
      
    } catch (error) {
      console.error('❌ Error cargando template:', error);
      const errorMessage = !canMakeRequests 
        ? 'No hay plantilla disponible offline. Conéctate a internet para descargarla.'
        : 'Error al cargar el formulario';
      
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Función para convertir URI local a base64
  const convertUriToBase64 = async (uri: string): Promise<string> => {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Error convirtiendo URI a base64:', error);
      throw error;
    }
  };

  // Función para procesar imágenes y convertir URIs a base64
  const processImages = async (images: any): Promise<any> => {
    if (!images) return images;

    if (Array.isArray(images)) {
      const processedImages = [];
      for (const image of images) {
        if (typeof image === 'string' && (image.startsWith('file://') || image.startsWith('content://'))) {
          try {
            const base64Image = await convertUriToBase64(image);
            processedImages.push(base64Image);
          } catch (error) {
            console.warn('No se pudo convertir imagen a base64, manteniendo URI:', image);
            processedImages.push(image);
          }
        } else {
          processedImages.push(image);
        }
      }
      return processedImages;
    } else if (typeof images === 'string' && (images.startsWith('file://') || images.startsWith('content://'))) {
      try {
        return await convertUriToBase64(images);
      } catch (error) {
        console.warn('No se pudo convertir imagen a base64, manteniendo URI:', images);
        return images;
      }
    }

    return images;
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

    // Procesar imágenes y firmas para convertir URIs a base64
    const processedPhotos: Record<string, any> = {};
    const processedSignatures: Record<string, any> = {};
    const processedFormData: Record<string, any> = { ...cleanFormData };

    // Procesar fotos
    if (_photos && Object.keys(_photos).length > 0) {
      for (const [fieldName, photos] of Object.entries(_photos)) {
        processedPhotos[fieldName] = await processImages(photos);
      }
    }

    // Procesar firmas
    if (_signatures && Object.keys(_signatures).length > 0) {
      for (const [fieldName, signature] of Object.entries(_signatures)) {
        processedSignatures[fieldName] = await processImages(signature);
      }
    }

    // Procesar campos del formulario que puedan contener imágenes
     if (template?.structure) {
       for (const field of template.structure) {
         const fieldValue = processedFormData[field.id];
         if (fieldValue && (field.type === 'photo' || field.type === 'signature')) {
           processedFormData[field.id] = await processImages(fieldValue);
         }
       }
     }

    // Preparar datos para envío
    const documentData: DocumentFormData = {
      activityId,
      activityType,
      formData: processedFormData,
      startedAt,
      metadata: {
        signatures: processedSignatures,
        photos: processedPhotos,
        hasSignatures: Object.keys(processedSignatures).length > 0,
        hasPhotos: Object.keys(processedPhotos).length > 0,
        completedFields: Object.keys(processedFormData).length,
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

      // Usar sistema offline que maneja automáticamente la conectividad
      const result = await offlineDocumentsApi.createFromActivity(documentData);
      
      // Limpiar borrador si existe
      await offlineStorage.deleteDraftForm(activityId);
      
      // Invalidar caché de documentos para que se actualice la lista
      await invalidateDocumentCache();
      
      const successMessage = canMakeRequests 
        ? 'Formulario enviado correctamente'
        : 'Formulario guardado offline. Se enviará cuando recuperes la conexión';
      
      Alert.alert(
        'Éxito', 
        successMessage, 
        [{ 
          text: 'OK',
          onPress: () => {
            // Navegar de vuelta a la vista correspondiente
            if (activityType === 'scheduled') {
              router.push('/(tabs)/scheduled');
            } else {
              router.push('/(tabs)/recurring-activities');
            }
          }
        }]
      );

      console.log('📄 Documento procesado:', result);
      
    } catch (error) {
      console.error('❌ Error enviando formulario:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      setError(errorMessage);
      
      // Guardar como borrador en caso de error
      try {
        await offlineStorage.saveDraftForm(activityId, formData);
        Alert.alert(
          'Error', 
          'No se pudo enviar el formulario, pero se guardó como borrador. Puedes intentar de nuevo más tarde.',
          [{ text: 'OK' }]
        );
      } catch (draftError) {
        Alert.alert(
          'Error', 
          'No se pudo enviar el formulario. Inténtalo de nuevo.',
          [{ text: 'OK' }]
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const saveForm = async (formData: any): Promise<void> => {
    try {
      setError(null);

      // Guardar borrador usando el sistema offline
      await offlineStorage.saveDraftForm(activityId, formData);
      
      Alert.alert(
        'Guardado', 
        'Progreso guardado localmente como borrador',
        [{ text: 'OK' }]
      );

      console.log('📝 Borrador guardado para actividad:', activityId);
      
    } catch (error) {
      console.error('❌ Error guardando borrador:', error);
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