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
  // Función para limpiar strings de emojis y caracteres especiales
  const cleanString = (str: string): string => {
    if (typeof str !== 'string') return str;
    
    // Remover emojis
    const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u;
    let cleaned = str.replace(emojiRegex, '');
    
    // Remover caracteres no ASCII
    cleaned = cleaned.replace(/[^\x00-\x7F]/g, '');
    
    return cleaned.trim();
  };

  const convertUriToBase64 = async (uri: string): Promise<string> => {
    console.log('🔄 convertUriToBase64 llamado con URI:', uri);
    console.log('🔄 Tipo de URI:', typeof uri);
    console.log('🔄 Longitud de URI:', uri?.length);
    console.log('🔄 Primeros 100 caracteres:', uri?.substring(0, 100));
    
    try {
      // Validar que la URI no sea vacía o inválida
      if (!uri || typeof uri !== 'string' || uri.trim() === '') {
        console.error('❌ URI inválida o vacía:', uri);
        throw new Error('URI inválida o vacía');
      }

      // Validar que la URI tenga un formato válido
      if (!uri.startsWith('file://') && !uri.startsWith('content://') && !uri.startsWith('data:image')) {
        console.error('❌ URI no válida para conversión a base64:', uri);
        throw new Error('URI no válida para conversión a base64');
      }

      const response = await fetch(uri);
      
      // Verificar que la respuesta sea exitosa
      if (!response.ok) {
        throw new Error(`Error al obtener la imagen: ${response.status} ${response.statusText}`);
      }
      
      const blob = await response.blob();
      
      // Verificar que el blob no esté vacío
      if (blob.size === 0) {
        throw new Error('La imagen está vacía');
      }
      
      // Verificar que el tipo MIME sea válido
      if (!blob.type.startsWith('image/')) {
        throw new Error(`Tipo de archivo no válido: ${blob.type}`);
      }
      
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const result = reader.result as string;
            // Verificar que el resultado sea válido
            if (!result || typeof result !== 'string' || result.trim() === '') {
              reject(new Error('Resultado de conversión inválido'));
              return;
            }
            
            // Verificar que el resultado sea un data URL válido
            if (!result.startsWith('data:image/')) {
              reject(new Error('Resultado no es un data URL de imagen válido'));
              return;
            }
            
            resolve(result);
          } catch (error) {
            console.error('Error procesando resultado de FileReader:', error);
            reject(new Error('Error al procesar el resultado de la conversión'));
          }
        };
        reader.onerror = (error) => {
          console.error('Error en FileReader:', error);
          reject(new Error('Error al leer el archivo'));
        };
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Error convirtiendo URI a base64:', error);
      throw error;
    }
  };

  // Función para procesar imágenes y convertir URIs a base64
  const processImages = async (images: any): Promise<any> => {
    console.log('🖼️ processImages llamado con:', typeof images, images);
    console.log('🖼️ Contenido detallado:', JSON.stringify(images, null, 2));
    
    // Validar que images no sea null, undefined, o string vacío
    if (!images || images === '' || images === null || images === undefined) {
      console.log('🖼️ Images es null/undefined/vacío, retornando null');
      return null;
    }

    // Si no es string ni array, probablemente no es una imagen válida
    if (typeof images !== 'string' && !Array.isArray(images)) {
      console.warn('❌ Datos no válidos para procesamiento de imagen:', typeof images, images);
      return null;
    }

    // Validación adicional: si es un objeto o cualquier otro tipo complejo, no procesar
    if (typeof images === 'object' && images !== null && !Array.isArray(images)) {
      console.warn('❌ Objeto detectado en processImages, no procesando:', images);
      return null;
    }

    // Validación adicional: si contiene emojis o caracteres especiales, no procesar
    if (typeof images === 'string') {
      // Verificar si contiene emojis o caracteres especiales
      const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u;
      if (emojiRegex.test(images)) {
        console.warn('❌ String contiene emojis, no procesando como imagen:', images);
        return null;
      }
      
      // Verificar si contiene caracteres no ASCII
      if (!/^[\x00-\x7F]*$/.test(images)) {
        console.warn('❌ String contiene caracteres no ASCII, no procesando como imagen:', images);
        return null;
      }
    }

    if (Array.isArray(images)) {
      const processedImages = [];
      for (const image of images) {
        // Validar cada imagen individual
        if (!image || image === '' || image === null || image === undefined) {
          continue; // Saltar imágenes inválidas
        }
        
        // Solo procesar strings que parezcan URIs de imagen
        if (typeof image === 'string') {
          if (image.startsWith('file://') || image.startsWith('content://')) {
            try {
              const base64Image = await convertUriToBase64(image);
              processedImages.push(base64Image);
            } catch (error) {
              console.warn('No se pudo convertir imagen a base64, manteniendo URI:', image);
              processedImages.push(image);
            }
          } else if (image.startsWith('data:image')) {
            // Si ya es base64, mantenerlo
            processedImages.push(image);
          } else {
            // Si no es un URI de imagen válido, saltarlo
            console.warn('URI de imagen no válido, saltando:', image);
            continue;
          }
        } else {
          // Si no es string, saltarlo
          console.warn('Elemento no válido en array de imágenes, saltando:', typeof image, image);
          continue;
        }
      }
      return processedImages.length > 0 ? processedImages : null;
    } else if (typeof images === 'string') {
      // Validar que no sea string vacío
      if (images.trim() === '') {
        return null;
      }
      
      // Solo procesar strings que parezcan URIs de imagen
      if (images.startsWith('file://') || images.startsWith('content://')) {
        try {
          return await convertUriToBase64(images);
        } catch (error) {
          console.warn('No se pudo convertir imagen a base64, manteniendo URI:', images);
          return images;
        }
      } else if (images.startsWith('data:image')) {
        // Si ya es base64, mantenerlo
        return images;
      } else {
        // Si no es un URI de imagen válido, retornar null
        console.warn('URI de imagen no válido:', images);
        return null;
      }
    }

    // Si llegamos aquí, no es un tipo válido para procesamiento de imágenes
    console.warn('Tipo de datos no válido para procesamiento de imagen:', typeof images);
    return null;
  };

  const processFormData = async (formData: any): Promise<DocumentFormData> => {
    console.log('🔄 Iniciando processFormData...');
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
    const { _signatures, _photos, _locations, _files, _qrCodes, _enrichedResponses, ...cleanFormData } = formData;
    
    console.log('📸 Datos de fotos:', _photos);
    console.log('✍️ Datos de firmas:', _signatures);
    console.log('📍 Datos de ubicación:', _locations);
    console.log('📁 Datos de archivos:', _files);
    console.log('📱 Datos de QR:', _qrCodes);
    console.log('🧹 Datos limpios del formulario:', cleanFormData);
    
    // Limpiar datos de campos de diseño que puedan haberse incluido
    const cleanedFormData = { ...cleanFormData };
    if (template?.structure) {
      for (const field of template.structure) {
        if (field.type === 'sectionHeader' || field.type === 'paragraph' || field.type === 'spacer' || field.type === 'info_text') {
          if (cleanedFormData.hasOwnProperty(field.id)) {
            console.log(`🧹 Removiendo campo de diseño ${field.id} (${field.type}) de los datos`);
            delete cleanedFormData[field.id];
          }
        }
      }
    }
    console.log('🧹 Datos limpios después de remover campos de diseño:', cleanedFormData);

    // Procesar imágenes y firmas para convertir URIs a base64
    const processedPhotos: Record<string, any> = {};
    const processedSignatures: Record<string, any> = {};
    
    // Filtrar solo campos de entrada reales (no campos de diseño)
    const processedFormData: Record<string, any> = {};
    if (template?.structure) {
      console.log('🔍 Filtrando campos del template...');
      for (const field of template.structure) {
        console.log(`🔍 Campo: ${field.id} (tipo: ${field.type})`);
        // Solo incluir campos que no sean elementos de diseño
        if (field.type !== 'sectionHeader' && field.type !== 'paragraph' && field.type !== 'spacer' && field.type !== 'info_text') {
          const fieldValue = cleanedFormData[field.id];
          console.log(`✅ Incluyendo campo ${field.id}:`, fieldValue);
          if (fieldValue !== undefined && fieldValue !== null && fieldValue !== '') {
            // Limpiar strings de emojis y caracteres especiales
            if (typeof fieldValue === 'string') {
              processedFormData[field.id] = cleanString(fieldValue);
            } else {
              processedFormData[field.id] = fieldValue;
            }
          }
        } else {
          console.log(`❌ Excluyendo campo de diseño ${field.id} (tipo: ${field.type})`);
        }
      }
    } else {
      // Fallback: usar todos los datos si no hay template
      console.log('⚠️ No hay template, usando todos los datos');
      Object.assign(processedFormData, cleanedFormData);
    }
    
    console.log('📊 Datos procesados finales:', processedFormData);

    // Procesar fotos
    if (_photos && Object.keys(_photos).length > 0) {
      console.log('🔄 Procesando fotos...');
      for (const [fieldName, photos] of Object.entries(_photos)) {
        console.log(`📸 Procesando fotos para campo: ${fieldName}`, photos);
        try {
          processedPhotos[fieldName] = await processImages(photos);
          console.log(`✅ Fotos procesadas para ${fieldName}:`, processedPhotos[fieldName]);
        } catch (error) {
          console.error(`❌ Error procesando fotos para ${fieldName}:`, error);
          processedPhotos[fieldName] = null;
        }
      }
    } else {
      console.log('📸 No hay fotos para procesar');
    }

    // Procesar firmas
    if (_signatures && Object.keys(_signatures).length > 0) {
      console.log('🔄 Procesando firmas...');
      for (const [fieldName, signature] of Object.entries(_signatures)) {
        console.log(`✍️ Procesando firma para campo: ${fieldName}`, signature);
        try {
          processedSignatures[fieldName] = await processImages(signature);
          console.log(`✅ Firma procesada para ${fieldName}:`, processedSignatures[fieldName]);
        } catch (error) {
          console.error(`❌ Error procesando firma para ${fieldName}:`, error);
          processedSignatures[fieldName] = null;
        }
      }
    } else {
      console.log('✍️ No hay firmas para procesar');
    }

    // Procesar campos del formulario que puedan contener imágenes
     if (template?.structure) {
       console.log('🔄 Procesando campos del formulario...');
       console.log('📊 Total de campos en template:', template.structure.length);
       
       for (const field of template.structure) {
         console.log(`🔍 Revisando campo: ${field.id} (tipo: ${field.type})`);
         
         // Solo procesar campos que realmente sean imágenes o firmas, no elementos de diseño
         if (field.type === 'photo' || field.type === 'signature') {
           const fieldValue = processedFormData[field.id];
           if (fieldValue) {
             // Validación adicional: asegurarse de que el valor parezca ser una imagen
             const isValidImageData = 
               (typeof fieldValue === 'string' && (fieldValue.startsWith('file://') || fieldValue.startsWith('content://') || fieldValue.startsWith('data:image'))) ||
               (Array.isArray(fieldValue) && fieldValue.length > 0);
             
             if (isValidImageData) {
               console.log(`🔄 Procesando campo ${field.id} (${field.type}):`, typeof fieldValue, fieldValue);
               try {
                 processedFormData[field.id] = await processImages(fieldValue);
                 console.log(`✅ Campo ${field.id} procesado exitosamente`);
               } catch (error) {
                 console.error(`❌ Error procesando campo ${field.id}:`, error);
                 processedFormData[field.id] = null;
               }
             } else {
               console.log(`⏭️ Campo ${field.id} no contiene datos de imagen válidos, saltando:`, fieldValue);
             }
           } else {
             console.log(`⏭️ Campo ${field.id} no tiene valor, saltando`);
           }
         } else {
           console.log(`⏭️ Campo ${field.id} es de tipo ${field.type}, saltando procesamiento de imagen`);
         }
       }
     } else {
       console.log('⚠️ No hay template para procesar campos del formulario');
     }

    // Contar campos de entrada reales (excluyendo campos de diseño)
    const inputFieldsCount = template?.structure ? 
      template.structure.filter(field => 
        field.type !== 'sectionHeader' && 
        field.type !== 'paragraph' && 
        field.type !== 'spacer' && 
        field.type !== 'info_text'
      ).length : 0;

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
        totalFields: inputFieldsCount,
        templateId: template?.id,
        templateName: template?.name,
        enrichedResponses: _enrichedResponses, // Estructura enriquecida para revisiones
      },
      // Estructura enriquecida en campos separados para el backend
      templateSnapshot: template ? {
        id: template.id,
        name: template.name,
        type: template.type || 'form',
        description: template.description,
        structure: template.structure,
      } : undefined,
      responses: _enrichedResponses,
      submissionMetadata: {
        submittedAt: new Date().toISOString(),
        deviceInfo: {
          platform: 'mobile',
          version: '1.0.0',
          screenWidth: 0, // Se puede obtener del dispositivo si es necesario
        },
      },
    };

    if (locationData) {
      documentData.locationData = locationData;
    }

    console.log('✅ processFormData completado exitosamente');
    console.log('📄 Documento final:', JSON.stringify(documentData, null, 2));
    
    // Validación final: verificar que no haya campos de diseño en los datos procesados
    console.log('🔍 Validación final - Campos en processedFormData:');
    for (const [fieldId, value] of Object.entries(processedFormData)) {
      const field = template?.structure?.find(f => f.id === fieldId);
      console.log(`  ${fieldId}: ${field?.type || 'unknown'} = ${typeof value} (${value})`);
    }

    return documentData;
  };

  const submitForm = async (formData: any): Promise<void> => {
    try {
      setIsSubmitting(true);
      setError(null);

      console.log('🔍 Iniciando procesamiento de formulario...');
      console.log('📋 Datos del formulario:', JSON.stringify(formData, null, 2));
      
      const documentData = await processFormData(formData);
      
      console.log('📤 Documento procesado, preparando para envío...');
      
      // Añadir tiempo de completado
      documentData.metadata = {
        ...documentData.metadata,
        completedAt: new Date().toISOString(),
      };

      console.log('📤 Enviando documento al backend...');
      
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