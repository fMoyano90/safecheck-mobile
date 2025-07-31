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
import { AzureUploadService } from '@/services/azure-upload.service';

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
          
        } catch (error) {
          console.warn('⚠️ Error con API online, intentando offline:', error);
          // Si falla la API online, intentar offline
          templateData = await offlineDocumentsApi.getTemplate(activityId, activityType);
        }
      } else {
        // Sin conexión, usar solo sistema offline
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
        // TODO: Aquí podrías emitir un evento o callback para cargar el borrador en el formulario
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

  // Función para procesar imágenes y subirlas directamente a Azure
  const processImages = async (images: any, onProgress?: (progress: any) => void): Promise<any> => {
    // Validar que images no sea null, undefined, o string vacío
    if (!images || images === '' || images === null || images === undefined) {
      console.warn('🖼️ Images es null/undefined/vacío, retornando null');
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
      for (let i = 0; i < images.length; i++) {
        const image = images[i];
        // Validar cada imagen individual
        if (!image || image === '' || image === null || image === undefined) {
          continue; // Saltar imágenes inválidas
        }
        
        // Solo procesar strings que parezcan URIs de imagen
        if (typeof image === 'string') {
          if (image.startsWith('file://') || image.startsWith('content://')) {
            try {
              const fileName = `image_${Date.now()}_${i}.jpg`;
              const azureUrl = await AzureUploadService.uploadImage(
                image, 
                fileName,
                (progress) => {
                  if (onProgress) {
                    onProgress({ index: i, progress });
                  }
                }
              );
              processedImages.push(azureUrl);
            } catch (error) {
              console.warn('❌ No se pudo subir imagen a Azure, usando fallback a base64:', image, error);
              try {
                const base64Image = await convertUriToBase64(image);
                processedImages.push(base64Image);
              } catch (base64Error) {
                console.warn('❌ Fallback a base64 también falló, manteniendo URI:', image);
                processedImages.push(image);
              }
            }
          } else if (image.startsWith('data:image')) {
            // Si ya es base64, mantenerlo
            processedImages.push(image);
          } else if (image.startsWith('https://')) {
            // Si ya es una URL de Azure, mantenerla
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
          const fileName = `image_${Date.now()}.jpg`;
          const azureUrl = await AzureUploadService.uploadImage(
            images, 
            fileName,
            onProgress
          );
          return azureUrl;
        } catch (error) {
          console.warn('❌ No se pudo subir imagen a Azure, usando fallback a base64:', images, error);
          try {
            return await convertUriToBase64(images);
          } catch (base64Error) {
            console.warn('❌ Fallback a base64 también falló, manteniendo URI:', images);
            return images;
          }
        }
      } else if (images.startsWith('data:image')) {
        // Si ya es base64, mantenerlo
        return images;
      } else if (images.startsWith('https://')) {
        // Si ya es una URL de Azure, mantenerla
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
    const { _signatures, _photos, _locations, _files, _qrCodes, _enrichedResponses, _pendingSignatures, _completedSignatures, ...cleanFormData } = formData;
    
    // Limpiar datos de campos de diseño que puedan haberse incluido
    const cleanedFormData = { ...cleanFormData };
    if (template?.structure) {
      for (const field of template.structure) {
        if (field.type === 'sectionHeader' || field.type === 'paragraph' || field.type === 'spacer' || field.type === 'info_text') {
          if (cleanedFormData.hasOwnProperty(field.id)) {
            delete cleanedFormData[field.id];
          }
        }
      }
    }

    // Procesar imágenes y firmas para convertir URIs a base64
    const processedPhotos: Record<string, any> = {};
    const processedSignatures: Record<string, any> = {};
    
    // Filtrar solo campos de entrada reales (no campos de diseño)
    const processedFormData: Record<string, any> = {};
    if (template?.structure) {
      for (const field of template.structure) {
        if (field.type !== 'sectionHeader' && field.type !== 'paragraph' && field.type !== 'spacer' && field.type !== 'info_text') {
          const fieldValue = cleanedFormData[field.id];
          if (fieldValue !== undefined && fieldValue !== null && fieldValue !== '') {
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
    
    // Procesar fotos
    if (_photos && Object.keys(_photos).length > 0) {
      for (const [fieldName, photos] of Object.entries(_photos)) {
        try {
          processedPhotos[fieldName] = await processImages(photos);
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
      for (const [fieldName, signature] of Object.entries(_signatures)) {
        try {
          processedSignatures[fieldName] = await processImages(signature);
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
       for (const field of template.structure) {
         if (field.type === 'photo' || field.type === 'signature') {
           const fieldValue = processedFormData[field.id];
           if (fieldValue) {
             const isValidImageData = 
               (typeof fieldValue === 'string' && (fieldValue.startsWith('file://') || fieldValue.startsWith('content://') || fieldValue.startsWith('data:image'))) ||
               (Array.isArray(fieldValue) && fieldValue.length > 0);
             
             if (isValidImageData) {
               try {
                 processedFormData[field.id] = await processImages(fieldValue);
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
        // Nota: Las firmas se guardan como referencias en signatureIds en lugar de objetos completos
        // _pendingSignatures y _completedSignatures se omiten para evitar duplicación
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

    for (const [fieldId, value] of Object.entries(processedFormData)) {
      const field = template?.structure?.find(f => f.id === fieldId);
    }

    return documentData;
  };

  const submitForm = async (formData: any): Promise<void> => {
    try {
      setIsSubmitting(true);
      setError(null);

      // Verificar si el formulario tiene campos de tipo 'multiple_signature'
      const hasMultipleSignatureFields = template?.structure?.some((field: any) => field.type === 'multiple_signature');
      let signatureIds: number[] = [];
      
      if (hasMultipleSignatureFields && (formData._pendingSignatures?.length > 0 || formData._completedSignatures?.length > 0) && canMakeRequests) {
        try {
          const documentTitle = template?.name || 'Documento';
          
          // Crear las firmas digitales SIN documentId (se asignará después)
          const { createSignaturesForDocument } = await import('../components/forms/FormRenderer');
          const signaturesResult = await createSignaturesForDocument(null, documentTitle, formData._pendingSignatures, formData._completedSignatures);
          
          // Extraer los IDs de las firmas creadas
          if (signaturesResult && signaturesResult.signatureIds) {
            signatureIds = signaturesResult.signatureIds;
          }
          
        } catch (signatureError: any) {
          console.error('❌ Error creando firmas digitales:', signatureError);
          
          // Si es un error de autenticación, mostrar un mensaje específico
          if (signatureError?.message?.includes('Sesión expirada') || signatureError?.status === 401) {
            console.warn('⚠️ Error de autenticación al crear firmas');
            Alert.alert(
              'Error de autenticación',
              'Hubo un problema con la autenticación al crear las firmas digitales. Por favor, inicia sesión nuevamente.',
              [{ text: 'Entendido' }]
            );
            return;
          }
          // Fallar el proceso si no se pueden crear las firmas
          throw signatureError;
        }
      }
      
      // PASO 2: Procesar datos del documento
      const documentData = await processFormData(formData);
      
      // Añadir tiempo de completado
      documentData.metadata = {
        ...documentData.metadata,
        completedAt: new Date().toISOString(),
      };
      
      // PASO 3: Agregar referencias de firmas al documento
      const documentDataWithSignatures = {
        ...documentData,
        ...(signatureIds.length > 0 && { signatureIds })
      };

      // PASO 4: Crear el documento con las referencias de firmas
      const result = await offlineDocumentsApi.createFromActivity(documentDataWithSignatures);
      
      if (signatureIds.length > 0 && canMakeRequests) {
        try {
          let documentId = null;
          
          // Extraer documentId de la respuesta
          if (result?.id) {
            if (typeof result.id === 'string' && result.id.startsWith('offline_')) {
              console.log('📱 ID offline detectado en result.id, omitiendo actualización de firmas');
            } else {
              documentId = typeof result.id === 'string' ? parseInt(result.id, 10) : result.id;
              console.log('📋 DocumentId extraído de result.id:', documentId);
            }
          } else if (result?.data?.id) {
            if (typeof result.data.id === 'string' && result.data.id.startsWith('offline_')) {
              console.log('📱 ID offline detectado en result.data.id, omitiendo actualización de firmas');
            } else {
              documentId = typeof result.data.id === 'string' ? parseInt(result.data.id, 10) : result.data.id;
              console.log('📋 DocumentId extraído de result.data.id:', documentId);
            }
          } else {
            console.log('⚠️ No se pudo extraer documentId de la respuesta');
          }
          
          // Actualizar las firmas con el documentId
          if (documentId && !isNaN(documentId) && documentId > 0) {
            const { updateSignaturesWithDocumentId } = await import('../components/forms/FormRenderer');
            await updateSignaturesWithDocumentId(signatureIds, documentId);
          } else {
            console.log('❌ DocumentId inválido, no se pueden actualizar las firmas:', documentId);
          }
          
        } catch (updateError: any) {
          console.error('❌ Error actualizando firmas con documentId:', updateError);
          console.error('❌ Stack trace:', updateError?.stack);
          // No fallar todo el proceso por este error, pero mostrar alerta
          Alert.alert(
            'Advertencia',
            'El documento se creó correctamente, pero hubo un problema actualizando las referencias de firmas. La trazabilidad podría verse afectada.',
            [{ text: 'OK' }]
          );
        }
      } else {
        console.log('❌ CONDICIÓN NO CUMPLIDA: No se actualizarán las firmas');
        console.log('  - Razón detallada:');
        if (signatureIds.length === 0) {
          console.log('    ❌ signatureIds.length === 0 (No hay firmas para actualizar)');
        }
        if (!canMakeRequests) {
          console.log('    ❌ canMakeRequests === false (Sin conexión)');
          console.log('    📱 Detalles de conectividad:', { isOnline, canMakeRequests });
        }
      }
      
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