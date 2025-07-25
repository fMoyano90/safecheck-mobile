import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Image,
  Platform,
  Dimensions,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as DocumentPicker from 'expo-document-picker';
import { CameraView } from 'expo-camera';
import DateTimePicker from '@react-native-community/datetimepicker';
import Slider from '@react-native-community/slider';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import SignatureCanvas from 'react-native-signature-canvas';
import { type TemplateField, type ActivityTemplate } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { AzureUploadService } from '@/services/azure-upload.service';

const { width: screenWidth } = Dimensions.get('window');

interface FormData {
  [key: string]: any;
}

interface FormRendererProps {
  template: ActivityTemplate;
  onSubmit: (data: FormData) => void;
  onSave?: (data: FormData) => void;
  initialValues?: FormData;
  isLoading?: boolean;
}

const FormRenderer: React.FC<FormRendererProps> = ({
  template,
  onSubmit,
  onSave,
  initialValues = {},
  isLoading = false,
}) => {
  const [currentPage, setCurrentPage] = useState(0);
  const [showDatePicker, setShowDatePicker] = useState<{ field: string; mode: 'date' | 'time' | 'datetime' } | null>(null);
  const [signatures, setSignatures] = useState<{ [key: string]: string }>({});
  const [photos, setPhotos] = useState<{ [key: string]: string[] }>({});
  const [location, setLocation] = useState<{ [key: string]: any }>({});
  const [files, setFiles] = useState<{ [key: string]: any[] }>({});
  const [qrCodes, setQrCodes] = useState<{ [key: string]: string }>({});
  const [showQrScanner, setShowQrScanner] = useState<string | null>(null);
  const [showSelectModal, setShowSelectModal] = useState<{ fieldId: string; options: any[] } | null>(null);
  const [isSigningActive, setIsSigningActive] = useState(false);
  
  const signatureRef = useRef<any>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  // Hook para manejar permisos
  const { 
    permissions, 
    requestCameraPermissionOnly, 
    requestLocationPermissionOnly, 
    requestMediaLibraryPermissionOnly 
  } = usePermissions();

  // Función helper para mantener el orden original de los campos
  const getOrderedFields = () => {
    console.log('🔍 Debugging template structure:', {
      hasTemplate: !!template,
      hasStructure: !!template?.structure,
      structureType: typeof template?.structure,
      isArray: Array.isArray(template?.structure),
      structureLength: template?.structure?.length
    });
    
    // Verificar si el template tiene la estructura esperada
    if (!template.structure || !Array.isArray(template.structure)) {
      console.warn('Template no tiene la estructura esperada:', template);
      return [];
    }
    
    // Mantener el orden original del array
    const orderedFields = template.structure.map((field: any) => {
      // Para campos normales, mantener el tipo original
      return {
        ...field,
        type: field.type // Mantener el tipo original (sectionHeader, paragraph, info_text, text, select_choice, date, etc.)
      };
    });
    
    console.log('📋 Campos ordenados:', orderedFields.length);
    console.log('📋 Detalle de campos:', orderedFields.map(f => ({ id: f.id, type: f.type, label: f.label })));
    return orderedFields;
  };

  const orderedFields = getOrderedFields();
  
  // Si no hay campos, mostrar mensaje de error
  if (orderedFields.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.formTitle}>{template.name}</Text>
          <Text style={styles.formDescription}>
            Error: El formulario no tiene campos configurados correctamente.
          </Text>
        </View>
      </View>
    );
  }
  
  // Filtrar solo los campos de entrada (no elementos de diseño) para paginación
  const inputFields = orderedFields.filter(field => 
    field.type !== 'sectionHeader' && 
    field.type !== 'paragraph' && 
    field.type !== 'info_text' &&
    field.type !== 'spacer'
  );
  
  // Dividir campos en páginas (6 campos por página para mejor UX)
  const fieldsPerPage = 6;
  const totalPages = Math.ceil(inputFields.length / fieldsPerPage);
  const currentInputFields = inputFields.slice(
    currentPage * fieldsPerPage,
    (currentPage + 1) * fieldsPerPage
  );
  
  // Crear un mapa de campos visibles en la página actual
  const visibleFieldIds = new Set(currentInputFields.map((f: any) => f.id));
  
  // Función para determinar qué elementos mostrar en la página actual
  const getVisibleElementsForPage = () => {
    const visibleElements: any[] = [];
    
    // Para la primera página, mostrar todos los elementos
    if (currentPage === 0) {
      return orderedFields;
    }
    
    // Para otras páginas, mostrar solo los campos de entrada en el rango
    const currentFieldIndices = currentInputFields.map(field => 
      orderedFields.findIndex(f => f.id === field.id)
    );
    
    if (currentFieldIndices.length === 0) return visibleElements;
    
    const minIndex = Math.min(...currentFieldIndices);
    const maxIndex = Math.max(...currentFieldIndices);
    
    // Recorrer todos los campos y agregar solo los que están en el rango de la página actual
    orderedFields.forEach((field, index) => {
      // Si está en el rango de la página actual, agregarlo
      if (index >= minIndex && index <= maxIndex) {
        visibleElements.push(field);
      }
    });
    
    console.log('🔍 getVisibleElementsForPage:', {
      currentPage,
      minIndex,
      maxIndex,
      visibleElementsCount: visibleElements.length,
      visibleElements: visibleElements.map(f => ({ id: f.id, type: f.type, label: f.label }))
    });
    
    return visibleElements;
  };
  
  const visibleElements = getVisibleElementsForPage();
  
  console.log('🔍 Debugging pagination:', {
    totalFields: orderedFields.length,
    inputFieldsCount: inputFields.length,
    currentPage,
    totalPages,
    fieldsPerPage,
    currentInputFieldsCount: currentInputFields.length,
    visibleFieldIds: Array.from(visibleFieldIds),
    visibleElementsCount: visibleElements.length,
    visibleElements: visibleElements.map(f => ({ id: f.id, type: f.type, label: f.label }))
  });

  // Crear esquema de validación dinámico
  const createValidationSchema = () => {
    const schemaFields: any = {};
    
    inputFields.forEach((field: any) => {
      let validator: any;
      
      if (field.type === 'email') {
        validator = yup.string().email('Email inválido');
        if (field.required) validator = validator.required(`${field.label} es obligatorio`);
      } else if (field.type === 'number') {
        validator = yup.number();
        if (field.validation?.min !== undefined) {
          validator = validator.min(field.validation.min, `Mínimo ${field.validation.min}`);
        }
        if (field.validation?.max !== undefined) {
          validator = validator.max(field.validation.max, `Máximo ${field.validation.max}`);
        }
        if (field.required) validator = validator.required(`${field.label} es obligatorio`);
      } else if (field.type === 'text' || field.type === 'textarea') {
        validator = yup.string();
        if (field.validation?.minLength) {
          validator = validator.min(field.validation.minLength, `Mínimo ${field.validation.minLength} caracteres`);
        }
        if (field.validation?.maxLength) {
          validator = validator.max(field.validation.maxLength, `Máximo ${field.validation.maxLength} caracteres`);
        }
        if (field.validation?.pattern) {
          validator = validator.matches(new RegExp(field.validation.pattern), field.validation.message || 'Formato inválido');
        }
        if (field.required) validator = validator.required(`${field.label} es obligatorio`);
      } else if (field.type === 'select' || field.type === 'select_choice' || field.type === 'radio') {
        validator = yup.string();
        if (field.required) {
          validator = validator.required(`${field.label} es obligatorio`);
        }
      } else {
        validator = yup.mixed();
        if (field.required) {
          validator = validator.required(`${field.label} es obligatorio`);
        }
      }
      
      schemaFields[field.id] = validator;
    });
    
    return yup.object().shape(schemaFields);
  };

  const {
    control,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    trigger,
  } = useForm<FormData>({
    resolver: yupResolver(createValidationSchema()),
    defaultValues: initialValues,
    mode: 'onChange',
  });

  // Funciones para manejar campos especiales
  const handleTakePhoto = async (fieldId: string) => {
    try {
      if (!permissions.camera) {
        await requestCameraPermissionOnly();
        if (!permissions.camera) {
          Alert.alert('Error', 'Se requieren permisos de cámara');
          return;
        }
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const localUri = result.assets[0].uri;
        
        try {
          // Mostrar indicador de carga
          Alert.alert('Subiendo', 'Subiendo imagen a la nube...');
          
          // Subir inmediatamente a Azure
          const fileName = `photo_${Date.now()}_${fieldId}.jpg`;
          const azureUrl = await AzureUploadService.uploadImage(localUri, fileName);
          
          // Guardar la URL de Azure en lugar de la URI local
          const currentPhotos = photos[fieldId] || [];
          const newPhotos = [...currentPhotos, azureUrl];
          setPhotos({ ...photos, [fieldId]: newPhotos });
          setValue(fieldId, newPhotos);
          
          Alert.alert('Éxito', 'Imagen subida correctamente');
        } catch (uploadError) {
          console.error('Error subiendo imagen:', uploadError);
          Alert.alert('Error', 'No se pudo subir la imagen. Inténtalo de nuevo.');
        }
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo tomar la foto');
    }
  };

  const handlePickPhoto = async (fieldId: string) => {
    try {
      if (!permissions.mediaLibrary) {
        await requestMediaLibraryPermissionOnly();
        if (!permissions.mediaLibrary) {
          Alert.alert('Error', 'Se requieren permisos de galería');
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const localUri = result.assets[0].uri;
        
        try {
          // Mostrar indicador de carga
          Alert.alert('Subiendo', 'Subiendo imagen a la nube...');
          
          // Subir inmediatamente a Azure
          const fileName = `photo_${Date.now()}_${fieldId}.jpg`;
          const azureUrl = await AzureUploadService.uploadImage(localUri, fileName);
          
          // Guardar la URL de Azure en lugar de la URI local
          const currentPhotos = photos[fieldId] || [];
          const newPhotos = [...currentPhotos, azureUrl];
          setPhotos({ ...photos, [fieldId]: newPhotos });
          setValue(fieldId, newPhotos);
          
          Alert.alert('Éxito', 'Imagen subida correctamente');
        } catch (uploadError) {
          console.error('Error subiendo imagen:', uploadError);
          Alert.alert('Error', 'No se pudo subir la imagen. Inténtalo de nuevo.');
        }
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo seleccionar la foto');
    }
  };

  const handleGetLocation = async (fieldId: string) => {
    try {
      if (!permissions.location) {
        await requestLocationPermissionOnly();
        if (!permissions.location) {
          Alert.alert('Error', 'Se requieren permisos de ubicación');
          return;
        }
      }

      const currentLocation = await Location.getCurrentPositionAsync({});
      const locationData = {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        accuracy: currentLocation.coords.accuracy,
        timestamp: currentLocation.timestamp,
      };
      
      setLocation({ ...location, [fieldId]: locationData });
      setValue(fieldId, locationData);
    } catch (error) {
      Alert.alert('Error', 'No se pudo obtener la ubicación');
    }
  };

  const handleSignature = (fieldId: string, signature: string) => {
    setSignatures({ ...signatures, [fieldId]: signature });
    setValue(fieldId, signature);
    setIsSigningActive(false); // Desactivar modo firma al confirmar
  };

  const handleSignatureStart = () => {
    setIsSigningActive(true); // Activar modo firma al empezar a firmar
  };

  const handleSignatureClear = () => {
    setIsSigningActive(false); // Desactivar modo firma al limpiar
  };

  const removePhoto = (fieldId: string, index: number) => {
    const currentPhotos = photos[fieldId] || [];
    const newPhotos = currentPhotos.filter((_, i) => i !== index);
    setPhotos({ ...photos, [fieldId]: newPhotos });
    setValue(fieldId, newPhotos);
  };

  const handlePickFile = async (fieldId: string) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
      });

      if (!result.canceled && result.assets[0]) {
        const currentFiles = files[fieldId] || [];
        const newFiles = [...currentFiles, result.assets[0]];
        setFiles({ ...files, [fieldId]: newFiles });
        setValue(fieldId, newFiles);
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo seleccionar el archivo');
    }
  };

  const removeFile = (fieldId: string, index: number) => {
    const currentFiles = files[fieldId] || [];
    const newFiles = currentFiles.filter((_, i) => i !== index);
    setFiles({ ...files, [fieldId]: newFiles });
    setValue(fieldId, newFiles);
  };

  const handleScanQRCode = async (fieldId: string) => {
    try {
      if (!permissions.camera) {
        await requestCameraPermissionOnly();
        if (!permissions.camera) {
          Alert.alert('Error', 'Se requieren permisos de cámara para escanear códigos');
          return;
        }
      }
      setShowQrScanner(fieldId);
    } catch (error) {
      Alert.alert('Error', 'No se pudo acceder a la cámara');
    }
  };

  const handleBarCodeScanned = (fieldId: string, { type, data }: { type: string; data: string }) => {
    setQrCodes({ ...qrCodes, [fieldId]: data });
    setValue(fieldId, data);
    setShowQrScanner(null);
  };

  const renderField = (field: any) => {
    const hasError = !!errors[field.id];
    
    // Debug: Log del tipo de campo para ubicación GPS
    if (field.label && field.label.toLowerCase().includes('ubicación')) {
      console.log('🗺️ Campo de ubicación detectado:', {
        id: field.id,
        type: field.type,
        label: field.label,
        field: field
      });
    }
    
    // Campos especiales que no necesitan label ni contenedor estándar
    if (field.type === 'sectionHeader' || field.type === 'paragraph' || field.type === 'spacer' || field.type === 'info_text') {
      return (
        <View key={field.id}>
          <Controller
            name={field.id}
            control={control}
            render={({ field: controllerField }) => {
              switch (field.type) {
                case 'sectionHeader':
                  const level = field.config?.level || 2;
                  const headerStyle = [
                    styles.sectionHeader,
                    level === 1 && styles.sectionHeaderH1,
                    level === 2 && styles.sectionHeaderH2,
                    level === 3 && styles.sectionHeaderH3,
                    level === 4 && styles.sectionHeaderH4,
                    level === 5 && styles.sectionHeaderH5,
                    level === 6 && styles.sectionHeaderH6,
                  ];
                  return (
                    <View style={styles.sectionHeaderContainer}>
                      <Text style={headerStyle}>{field.label}</Text>
                    </View>
                  );

                case 'paragraph':
                  return (
                    <View style={styles.paragraphContainer}>
                      <Text style={styles.paragraphText}>
                        {field.config?.content || field.label || 'Texto del párrafo...'}
                      </Text>
                    </View>
                  );

                case 'spacer':
                  return <View style={styles.spacer} />;

                case 'info_text':
                  return (
                    <View style={styles.infoTextContainer}>
                      <Text style={styles.infoText}>
                        {field.label || 'Texto informativo...'}
                      </Text>
                    </View>
                  );

                default:
                  return <View />;
              }
            }}
          />
        </View>
      );
    }
    
    return (
      <View key={field.id} style={[styles.fieldContainer, hasError && styles.fieldError]}>
        <Text style={styles.fieldLabel}>
          {field.label}
          {field.required && <Text style={styles.required}> *</Text>}
        </Text>
        
        <Controller
          name={field.id}
          control={control}
          render={({ field: controllerField }) => {
            switch (field.type) {
              case 'text':
              case 'email':
              case 'phone':
                return (
                  <TextInput
                    style={styles.textInput}
                    value={controllerField.value || ''}
                    onChangeText={controllerField.onChange}
                    placeholder={field.placeholder}
                    keyboardType={
                      field.type === 'email' ? 'email-address' :
                      field.type === 'phone' ? 'phone-pad' : 'default'
                    }
                    autoCapitalize={field.type === 'email' ? 'none' : 'sentences'}
                  />
                );

              case 'number':
                return (
                  <TextInput
                    style={styles.textInput}
                    value={controllerField.value?.toString() || ''}
                    onChangeText={(text) => {
                      // Solo permitir números, punto decimal y signo negativo
                      const numericRegex = /^-?\d*\.?\d*$/;
                      
                      if (text === '' || numericRegex.test(text)) {
                        // Si está vacío o es un número válido, actualizar el valor
                        const numericValue = text === '' ? '' : (isNaN(parseFloat(text)) ? text : parseFloat(text));
                        controllerField.onChange(numericValue);
                      }
                      // Si contiene caracteres no válidos, simplemente no actualizar el campo
                      // No mostrar alerta para mejor UX - el campo simplemente no acepta la entrada
                    }}
                    placeholder={field.placeholder}
                    keyboardType="numeric"
                  />
                );

              case 'textarea':
                return (
                  <TextInput
                    style={[styles.textInput, styles.textArea]}
                    value={controllerField.value || ''}
                    onChangeText={controllerField.onChange}
                    placeholder={field.placeholder}
                    multiline
                    numberOfLines={4}
                  />
                );

              case 'select':
              case 'select_choice':
                return (
                  <View>
                    <TouchableOpacity
                      style={styles.selectButton}
                      onPress={() => setShowSelectModal({ fieldId: field.id, options: field.options || [] })}
                    >
                      <Text style={[
                        styles.selectButtonText,
                        !controllerField.value && styles.selectPlaceholderText
                      ]}>
                        {controllerField.value 
                          ? field.options?.find((opt: any) => opt.value === controllerField.value)?.label 
                          : 'Selecciona una opción...'
                        }
                      </Text>
                      <Ionicons name="chevron-down" size={20} color="#9CA3AF" />
                    </TouchableOpacity>
                  </View>
                );

              case 'radio':
                return (
                  <View style={styles.radioContainer}>
                    {field.options?.map((option: any) => (
                      <TouchableOpacity
                        key={option.value}
                        style={styles.radioOption}
                        onPress={() => {
                          controllerField.onChange(option.value);
                          trigger(field.id);
                        }}
                      >
                        <Ionicons
                          name={controllerField.value === option.value ? "radio-button-on" : "radio-button-off"}
                          size={24}
                          color={controllerField.value === option.value ? "#0891B2" : "#9CA3AF"}
                        />
                        <Text style={styles.radioText}>{option.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                );

              case 'checkbox':
                return (
                  <View style={styles.checkboxContainer}>
                    {field.options?.map((option: any) => {
                      const isSelected = Array.isArray(controllerField.value) && 
                                       controllerField.value.includes(option.value);
                      return (
                        <TouchableOpacity
                          key={option.value}
                          style={styles.checkboxOption}
                          onPress={() => {
                            const currentValues = Array.isArray(controllerField.value) ? controllerField.value : [];
                            if (isSelected) {
                              controllerField.onChange(currentValues.filter(v => v !== option.value));
                            } else {
                              controllerField.onChange([...currentValues, option.value]);
                            }
                            trigger(field.id);
                          }}
                        >
                          <Ionicons
                            name={isSelected ? "checkbox" : "checkbox-outline"}
                            size={24}
                            color={isSelected ? "#0891B2" : "#9CA3AF"}
                          />
                          <Text style={styles.checkboxText}>{option.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                );

              case 'date':
              case 'time':
              case 'datetime':
                const formatDate = (date: Date, type: string) => {
                  const options: Intl.DateTimeFormatOptions = {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  };
                  
                  if (type === 'time') {
                    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                  } else if (type === 'datetime') {
                    return date.toLocaleDateString('es-ES', options) + ' ' + date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                  }
                  return date.toLocaleDateString('es-ES', options);
                };
                
                // Obtener la fecha actual para inicialización
                const getCurrentDate = () => {
                  const now = new Date();
                  // Para campos de fecha, establecer la hora a 00:00:00
                  if (field.type === 'date') {
                    now.setHours(0, 0, 0, 0);
                  }
                  return now;
                };
                
                // Determinar la fecha a mostrar en el picker
                const getPickerDate = () => {
                  if (controllerField.value) {
                    return new Date(controllerField.value);
                  }
                  return getCurrentDate();
                };
                
                return (
                  <View>
                    <TouchableOpacity
                      style={styles.dateButton}
                      onPress={() => {
                        // Si no hay valor, establecer la fecha actual antes de abrir el picker
                        if (!controllerField.value) {
                          controllerField.onChange(getCurrentDate().toISOString());
                        }
                        setShowDatePicker({ field: field.id, mode: field.type as any });
                      }}
                    >
                      <Text style={styles.dateButtonText}>
                        {controllerField.value 
                          ? formatDate(new Date(controllerField.value), field.type)
                          : field.placeholder || 'Seleccionar fecha'
                        }
                      </Text>
                      <Ionicons name="calendar-outline" size={20} color="#0891B2" />
                    </TouchableOpacity>
                    
                    {showDatePicker?.field === field.id && (
                      <Modal
                        transparent={true}
                        animationType="slide"
                        visible={showDatePicker?.field === field.id}
                        onRequestClose={() => setShowDatePicker(null)}
                      >
                        <View style={styles.modalOverlay}>
                          <View style={styles.modalContent}>
                            <View style={styles.modalHeader}>
                              <Text style={styles.modalTitle}>Seleccionar {field.type === 'time' ? 'hora' : field.type === 'datetime' ? 'fecha y hora' : 'fecha'}</Text>
                              <TouchableOpacity onPress={() => setShowDatePicker(null)}>
                                <Ionicons name="close" size={24} color="#666" />
                              </TouchableOpacity>
                            </View>
                            <DateTimePicker
                              value={getPickerDate()}
                              mode={showDatePicker?.mode || 'date'}
                              display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
                              locale="es-ES"
                              onChange={(event, selectedDate) => {
                                // Aplicar la fecha inmediatamente cuando se selecciona
                                if (selectedDate) {
                                  controllerField.onChange(selectedDate.toISOString());
                                }
                              }}
                            />
                            <View style={styles.modalFooter}>
                              <TouchableOpacity 
                                style={styles.modalButton}
                                onPress={() => setShowDatePicker(null)}
                              >
                                <Text style={styles.modalButtonText}>Confirmar</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        </View>
                      </Modal>
                    )}
                  </View>
                );

              case 'photo':
                return (
                  <View style={styles.photoContainer}>
                    <View style={styles.photoButtons}>
                      <TouchableOpacity
                        style={styles.photoButton}
                        onPress={() => handleTakePhoto(field.id)}
                      >
                        <Ionicons name="camera" size={20} color="white" />
                        <Text style={styles.photoButtonText}>Tomar Foto</Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity
                        style={[styles.photoButton, styles.photoButtonSecondary]}
                        onPress={() => handlePickPhoto(field.id)}
                      >
                        <Ionicons name="images" size={20} color="#0891B2" />
                        <Text style={[styles.photoButtonText, styles.photoButtonTextSecondary]}>Galería</Text>
                      </TouchableOpacity>
                    </View>
                    
                    {photos[field.id] && photos[field.id].length > 0 && (
                      <View style={styles.photoGrid}>
                        {photos[field.id].map((photo, index) => (
                          <View key={index} style={styles.photoItem}>
                            <Image source={{ uri: photo }} style={styles.photoImage} />
                            <TouchableOpacity
                              style={styles.removePhotoButton}
                              onPress={() => removePhoto(field.id, index)}
                            >
                              <Ionicons name="close-circle" size={24} color="#EF4444" />
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                );

              case 'info_image':
                return (
                  <View style={styles.referenceImageContainer}>
                    {field.imageUrl && (
                      <View style={styles.referenceImageWrapper}>
                        <Image 
                          source={{ uri: field.imageUrl }} 
                          style={styles.referenceImage}
                          resizeMode="contain"
                        />
                        <Text style={styles.referenceImageCaption}>
                          {field.label || 'Imagen de referencia'}
                        </Text>
                      </View>
                    )}
                  </View>
                );

              case 'signature':
                return (
                  <View style={styles.signatureContainer}>
                    <View style={styles.signatureCanvas}>
                      <SignatureCanvas
                        ref={signatureRef}
                        onOK={(signature) => handleSignature(field.id, signature)}
                        onBegin={handleSignatureStart}
                        onClear={handleSignatureClear}
                        descriptionText="Firme aquí"
                        clearText="Limpiar"
                        confirmText="Confirmar"
                        webStyle={`
                          .m-signature-pad--footer {
                            display: none;
                          }
                          .m-signature-pad {
                            box-shadow: none;
                            border: 1px solid #e5e7eb;
                          }
                        `}
                      />
                    </View>
                    
                    <View style={styles.signatureButtons}>
                      <TouchableOpacity
                        style={styles.signatureButton}
                        onPress={() => {
                          signatureRef.current?.clearSignature();
                          handleSignatureClear();
                        }}
                      >
                        <Text style={styles.signatureButtonText}>Limpiar</Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity
                        style={[styles.signatureButton, styles.signatureButtonPrimary]}
                        onPress={() => signatureRef.current?.readSignature()}
                      >
                        <Text style={[styles.signatureButtonText, styles.signatureButtonTextPrimary]}>Confirmar</Text>
                      </TouchableOpacity>
                    </View>
                    
                    {signatures[field.id] && (
                      <View style={styles.signaturePreview}>
                        <Text style={styles.signaturePreviewText}>✓ Firma capturada</Text>
                      </View>
                    )}
                  </View>
                );

              case 'location':
                return (
                  <View style={styles.locationContainer}>
                    <TouchableOpacity
                      style={styles.locationButton}
                      onPress={() => handleGetLocation(field.id)}
                    >
                      <Ionicons name="location" size={20} color="white" />
                      <Text style={styles.locationButtonText}>Obtener Ubicación</Text>
                    </TouchableOpacity>
                    
                    {location[field.id] && (
                      <View style={styles.locationInfo}>
                        <Text style={styles.locationText}>
                          📍 Lat: {location[field.id].latitude.toFixed(6)}
                        </Text>
                        <Text style={styles.locationText}>
                          📍 Lng: {location[field.id].longitude.toFixed(6)}
                        </Text>
                        <Text style={styles.locationAccuracy}>
                          Precisión: ±{Math.round(location[field.id].accuracy)}m
                        </Text>
                      </View>
                    )}
                  </View>
                );

              case 'fileUpload':
                return (
                  <View style={styles.fileUploadContainer}>
                    <TouchableOpacity
                      style={styles.fileUploadButton}
                      onPress={() => handlePickFile(field.id)}
                    >
                      <Ionicons name="document-attach" size={20} color="white" />
                      <Text style={styles.fileUploadButtonText}>Seleccionar Archivo</Text>
                    </TouchableOpacity>
                    
                    {files[field.id] && files[field.id].length > 0 && (
                      <View style={styles.filesList}>
                        {files[field.id].map((file, index) => (
                          <View key={index} style={styles.fileItem}>
                            <Ionicons name="document" size={24} color="#0891B2" />
                            <Text style={styles.fileName}>{file.name}</Text>
                            <TouchableOpacity
                              style={styles.removeFileButton}
                              onPress={() => removeFile(field.id, index)}
                            >
                              <Ionicons name="close-circle" size={20} color="#EF4444" />
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                );

              case 'rating':
                return (
                  <View style={styles.ratingContainer}>
                    <View style={styles.ratingStars}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <TouchableOpacity
                          key={star}
                          style={styles.starButton}
                          onPress={() => controllerField.onChange(star)}
                        >
                          <Ionicons
                            name={star <= (controllerField.value || 0) ? "star" : "star-outline"}
                            size={32}
                            color={star <= (controllerField.value || 0) ? "#FFD700" : "#9CA3AF"}
                          />
                        </TouchableOpacity>
                      ))}
                    </View>
                    <Text style={styles.ratingText}>
                      {controllerField.value ? `${controllerField.value}/5` : 'Sin calificación'}
                    </Text>
                  </View>
                );

              case 'slider':
                return (
                  <View style={styles.sliderContainer}>
                    <View style={styles.sliderLabels}>
                      <Text style={styles.sliderLabel}>{field.config?.min || 0}</Text>
                      <Text style={styles.sliderValue}>
                        {controllerField.value || field.config?.min || 0}
                        {field.config?.unit && ` ${field.config.unit}`}
                      </Text>
                      <Text style={styles.sliderLabel}>{field.config?.max || 100}</Text>
                    </View>
                    <Slider
                      style={styles.slider}
                      minimumValue={field.config?.min || 0}
                      maximumValue={field.config?.max || 100}
                      step={field.config?.step || 1}
                      value={controllerField.value || field.config?.min || 0}
                      onValueChange={controllerField.onChange}
                      minimumTrackTintColor="#0891B2"
                      maximumTrackTintColor="#E5E7EB"
                    />
                  </View>
                );

              case 'qrCode':
                return (
                  <View style={styles.qrCodeContainer}>
                    <TouchableOpacity
                      style={styles.qrCodeButton}
                      onPress={() => handleScanQRCode(field.id)}
                    >
                      <Ionicons name="qr-code" size={20} color="white" />
                      <Text style={styles.qrCodeButtonText}>Escanear Código</Text>
                    </TouchableOpacity>
                    
                    {qrCodes[field.id] && (
                      <View style={styles.qrCodeResult}>
                        <Text style={styles.qrCodeResultText}>
                          Código escaneado: {qrCodes[field.id]}
                        </Text>
                      </View>
                    )}
                  </View>
                );

              case 'referenceImage':
                return (
                  <View style={styles.referenceImageContainer}>
                    {field.config?.imageUrl && (
                      <View style={styles.referenceImageWrapper}>
                        <Image 
                          source={{ uri: field.config.imageUrl }} 
                          style={styles.referenceImage}
                          resizeMode="contain"
                        />
                        <Text style={styles.referenceImageCaption}>
                          {field.config.caption || 'Imagen de referencia'}
                        </Text>
                      </View>
                    )}
                  </View>
                );

              default:
                return (
                  <TextInput
                    style={styles.textInput}
                    value={controllerField.value || ''}
                    onChangeText={controllerField.onChange}
                    placeholder={field.placeholder}
                  />
                );
            }
          }}
        />
        
        {hasError && (
          <Text style={styles.errorText}>{String(errors[field.id]?.message || 'Error en este campo')}</Text>
        )}
      </View>
    );
  };

  const onFormSubmit = (data: FormData) => {
    // Limpiar los datos para enviar solo valores planos
    const cleanData: any = {};
    
    // Solo incluir campos que tengan valores válidos
    inputFields.forEach((field: any) => {
      const value = data[field.id];
      if (value !== undefined && value !== null && value !== '') {
        cleanData[field.id] = value;
      }
    });
    
    // Crear estructura enriquecida para revisiones con toda la estructura del template
    const enrichedResponses = {
      sections: [{
        id: 'main_section',
        title: template.name || 'Formulario',
        description: template.description,
        questions: orderedFields.map((field: any) => {
          // Para campos de entrada, incluir respuesta
          if (field.type !== 'section' && field.type !== 'paragraph' && field.type !== 'info_text') {
            return {
              id: field.id,
              text: field.label,
              type: field.type,
              required: field.required,
              placeholder: field.placeholder,
              options: field.options,
              content: field.content,
              answer: {
                value: data[field.id],
                timestamp: new Date().toISOString(),
                metadata: {
                  location: location[field.id],
                  photos: photos[field.id] || [],
                  signature: signatures[field.id],
                  files: files[field.id] || [],
                  qrCode: qrCodes[field.id],
                }
              }
            };
          }
          
          // Para títulos de sección
          if (field.type === 'section') {
            return {
              id: field.id,
              text: field.title,
              type: 'sectionHeader',
              required: false,
              content: field.config?.description,
              answer: {
                value: null,
                timestamp: new Date().toISOString(),
                metadata: {}
              }
            };
          }
          
          // Para párrafos
          if (field.type === 'paragraph') {
            return {
              id: field.id,
              text: field.content,
              type: 'paragraph',
              required: false,
              content: field.content,
              answer: {
                value: null,
                timestamp: new Date().toISOString(),
                metadata: {}
              }
            };
          }
          
          // Para otros tipos (separadores, etc.)
          return {
            id: field.id,
            text: field.label || field.content || '',
            type: field.type,
            required: false,
            content: field.content,
            answer: {
              value: null,
              timestamp: new Date().toISOString(),
              metadata: {}
            }
          };
        })
      }]
    };
    
    // Agregar datos especiales y estructura enriquecida
    const enrichedData = {
      ...cleanData,
      _signatures: signatures,
      _photos: photos,
      _locations: location,
      _files: files,
      _qrCodes: qrCodes,
      _enrichedResponses: enrichedResponses, // Estructura enriquecida para revisiones
    };
    
    console.log('📤 Enviando datos con estructura enriquecida:', enrichedData);
    onSubmit(enrichedData);
  };

  const handleSave = () => {
    const currentData = watch();
    
    // Limpiar los datos para enviar solo valores planos
    const cleanData: any = {};
    
    // Solo incluir campos que tengan valores válidos
    inputFields.forEach((field: any) => {
      const value = currentData[field.id];
      if (value !== undefined && value !== null && value !== '') {
        cleanData[field.id] = value;
      }
    });
    
    // Crear estructura enriquecida para revisiones con toda la estructura del template
    const enrichedResponses = {
      sections: [{
        id: 'main_section',
        title: template.name || 'Formulario',
        description: template.description,
        questions: orderedFields.map((field: any) => {
          // Para campos de entrada, incluir respuesta
          if (field.type !== 'section' && field.type !== 'paragraph' && field.type !== 'info_text') {
            return {
              id: field.id,
              text: field.label,
              type: field.type,
              required: field.required,
              placeholder: field.placeholder,
              options: field.options,
              content: field.content,
              answer: {
                value: currentData[field.id],
                timestamp: new Date().toISOString(),
                metadata: {
                  location: location[field.id],
                  photos: photos[field.id] || [],
                  signature: signatures[field.id],
                  files: files[field.id] || [],
                  qrCode: qrCodes[field.id],
                }
              }
            };
          }
          
          // Para títulos de sección
          if (field.type === 'section') {
            return {
              id: field.id,
              text: field.title,
              type: 'sectionHeader',
              required: false,
              content: field.config?.description,
              answer: {
                value: null,
                timestamp: new Date().toISOString(),
                metadata: {}
              }
            };
          }
          
          // Para párrafos
          if (field.type === 'paragraph') {
            return {
              id: field.id,
              text: field.content,
              type: 'paragraph',
              required: false,
              content: field.content,
              answer: {
                value: null,
                timestamp: new Date().toISOString(),
                metadata: {}
              }
            };
          }
          
          // Para otros tipos (separadores, etc.)
          return {
            id: field.id,
            text: field.label || field.content || '',
            type: field.type,
            required: false,
            content: field.content,
            answer: {
              value: null,
              timestamp: new Date().toISOString(),
              metadata: {}
            }
          };
        })
      }]
    };
    
    // Agregar datos especiales y estructura enriquecida
    const enrichedData = {
      ...cleanData,
      _signatures: signatures,
      _photos: photos,
      _locations: location,
      _files: files,
      _qrCodes: qrCodes,
      _enrichedResponses: enrichedResponses, // Estructura enriquecida para revisiones
    };
    
    console.log('💾 Guardando datos con estructura enriquecida:', enrichedData);
    onSave?.(enrichedData);
  };

  return (
    <View style={styles.container}>
      {/* Header con progreso */}
      <View style={styles.header}>
        <Text style={styles.formTitle}>{template.name}</Text>
        {template.description && (
          <Text style={styles.formDescription}>{template.description}</Text>
        )}
        
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { width: `${((currentPage + 1) / totalPages) * 100}%` }
              ]} 
            />
          </View>
          <Text style={styles.progressText}>
            Página {currentPage + 1} de {totalPages}
          </Text>
        </View>
      </View>

      {/* Campos del formulario */}
      <ScrollView 
        ref={scrollViewRef}
        style={styles.formContainer} 
        showsVerticalScrollIndicator={false}
        scrollEnabled={!isSigningActive}
      >
        {visibleElements.map((field: any) => {
          console.log('🎯 Rendering field:', {
            id: field.id,
            type: field.type,
            label: field.label
          });
          
          // Renderizar título de sección
          if (field.type === 'sectionHeader') {
            const level = field.config?.level || 2;
            const headerStyle = [
              styles.sectionHeader,
              level === 1 && styles.sectionHeaderH1,
              level === 2 && styles.sectionHeaderH2,
              level === 3 && styles.sectionHeaderH3,
              level === 4 && styles.sectionHeaderH4,
              level === 5 && styles.sectionHeaderH5,
              level === 6 && styles.sectionHeaderH6,
            ];
            return (
              <View key={field.id} style={styles.sectionHeaderContainer}>
                <Text style={headerStyle}>
                  {field.label}
                </Text>
              </View>
            );
          }
          
          // Renderizar párrafo
          if (field.type === 'paragraph') {
            return (
              <View key={field.id} style={styles.paragraphContainer}>
                <Text style={styles.paragraphText}>
                  {field.config?.content || field.label || 'Texto del párrafo...'}
                </Text>
              </View>
            );
          }
          
          // Renderizar texto informativo
          if (field.type === 'info_text') {
            return (
              <View key={field.id} style={styles.infoTextContainer}>
                <Text style={styles.infoText}>
                  {field.label || 'Texto informativo...'}
                </Text>
              </View>
            );
          }
          
          // Renderizar separador
          if (field.type === 'spacer') {
            return <View key={field.id} style={styles.spacer} />;
          }
          
          // Renderizar campo de entrada
          if (field.type !== 'sectionHeader' && field.type !== 'paragraph' && field.type !== 'info_text' && field.type !== 'spacer') {
            return (
              <View key={field.id}>
                {renderField(field)}
              </View>
            );
          }
          
          return null;
        })}
      </ScrollView>

      {/* Botones de navegación */}
      <View style={styles.navigationContainer}>
        <View style={styles.navigationButtons}>
          {currentPage > 0 && (
            <TouchableOpacity
              style={[styles.navButton, styles.navButtonSecondary, styles.navButtonIcon]}
              onPress={() => {
                setCurrentPage(currentPage - 1);
                // Scroll automático al inicio del formulario
                setTimeout(() => {
                  scrollViewRef.current?.scrollTo({ y: 0, animated: true });
                }, 100);
              }}
            >
              <Ionicons name="chevron-back" size={20} color="#0066cc" />
            </TouchableOpacity>
          )}
          
          {onSave && (
            <TouchableOpacity
              style={[styles.navButton, styles.saveButton]}
              onPress={handleSave}
            >
              <Ionicons name="save-outline" size={20} color="#6B7280" />
              <Text style={styles.saveButtonText}>Guardar</Text>
            </TouchableOpacity>
          )}
          
          {currentPage < totalPages - 1 ? (
            <TouchableOpacity
              style={styles.navButton}
              onPress={() => {
                setCurrentPage(currentPage + 1);
                // Scroll automático al inicio del formulario
                setTimeout(() => {
                  scrollViewRef.current?.scrollTo({ y: 0, animated: true });
                }, 100);
              }}
            >
              <Text style={styles.navButtonText}>Siguiente</Text>
              <Ionicons name="chevron-forward" size={20} color="white" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.navButton, isLoading && styles.navButtonDisabled]}
              onPress={handleSubmit(onFormSubmit)}
              disabled={isLoading}
            >
              {isLoading ? (
                <Text style={styles.navButtonText}>Enviando...</Text>
              ) : (
                <>
                  <Text style={styles.navButtonText}>Enviar</Text>
                  <Ionicons name="send" size={20} color="white" />
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Modal del scanner QR */}
      <Modal
        visible={!!showQrScanner}
        animationType="slide"
        statusBarTranslucent={true}
      >
        <View style={styles.qrScannerModal}>
          <View style={styles.qrScannerHeader}>
            <Text style={styles.qrScannerTitle}>Escanear Código QR</Text>
            <TouchableOpacity
              style={styles.qrScannerCloseButton}
              onPress={() => setShowQrScanner(null)}
            >
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
          </View>
          <CameraView
            style={styles.qrScannerCamera}
            onBarcodeScanned={(scanningResult) => {
              if (showQrScanner) {
                handleBarCodeScanned(showQrScanner, scanningResult);
              }
            }}
          >
            <View style={styles.qrScannerOverlay}>
              <View style={styles.qrScannerFrame} />
            </View>
          </CameraView>
        </View>
      </Modal>

      {/* Modal de selección personalizado */}
      <Modal
        visible={!!showSelectModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSelectModal(null)}
      >
        <View style={styles.selectModalOverlay}>
          <View style={styles.selectModalContainer}>
            <View style={styles.selectModalHeader}>
              <Text style={styles.selectModalTitle}>Seleccionar opción</Text>
              <TouchableOpacity
                style={styles.selectModalCloseButton}
                onPress={() => setShowSelectModal(null)}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.selectModalOptions}>
              {showSelectModal?.options.map((option) => {
                const currentField = inputFields.find((f: any) => f.id === showSelectModal.fieldId);
                const currentValue = watch(showSelectModal.fieldId);
                const isSelected = currentValue === option.value;
                
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.selectModalOption,
                      isSelected && styles.selectModalOptionSelected
                    ]}
                    onPress={() => {
                      setValue(showSelectModal.fieldId, option.value);
                      trigger(showSelectModal.fieldId);
                      setShowSelectModal(null);
                    }}
                  >
                    <Text style={[
                      styles.selectModalOptionText,
                      isSelected && styles.selectModalOptionTextSelected
                    ]}>
                      {option.label}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark" size={20} color="#0066cc" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  header: {
    backgroundColor: 'white',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e8ed',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4,
  },
  formDescription: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 16,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: '#e1e8ed',
    borderRadius: 2,
    marginRight: 12,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#0066cc',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: '#7f8c8d',
    fontWeight: '500',
  },
  formContainer: {
    flex: 1,
    padding: 20,
  },
  fieldContainer: {
    marginBottom: 24,
  },
  fieldError: {
    borderColor: '#EF4444',
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
  },
  required: {
    color: '#EF4444',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  picker: {
    height: 50,
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  selectButtonText: {
    fontSize: 16,
    color: '#34495e',
  },
  selectPlaceholderText: {
    color: '#9CA3AF',
  },
  radioContainer: {
    gap: 12,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  radioText: {
    fontSize: 16,
    color: '#34495e',
  },
  checkboxContainer: {
    gap: 12,
  },
  checkboxOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  checkboxText: {
    fontSize: 16,
    color: '#34495e',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  dateButtonText: {
    fontSize: 16,
    color: '#34495e',
  },
  photoContainer: {
    gap: 16,
  },
  photoButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  photoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0066cc',
    padding: 12,
    borderRadius: 8,
    shadowColor: '#0066cc',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  photoButtonSecondary: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#0066cc',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  photoButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  photoButtonTextSecondary: {
    color: '#0066cc',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  photoItem: {
    position: 'relative',
  },
  photoImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  removePhotoButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: 'white',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  signatureContainer: {
    gap: 16,
  },
  signatureCanvas: {
    height: 200,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  signatureButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  signatureButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  signatureButtonPrimary: {
    backgroundColor: '#0066cc',
    borderColor: '#0066cc',
    shadowColor: '#0066cc',
    shadowOpacity: 0.2,
  },
  signatureButtonText: {
    color: '#34495e',
    fontWeight: '600',
  },
  signatureButtonTextPrimary: {
    color: 'white',
  },
  signaturePreview: {
    padding: 12,
    backgroundColor: '#e6f3ff',
    borderRadius: 8,
    alignItems: 'center',
  },
  signaturePreviewText: {
    color: '#0066cc',
    fontWeight: '600',
  },
  locationContainer: {
    gap: 16,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ff6d00',
    padding: 12,
    borderRadius: 8,
    shadowColor: '#ff6d00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  locationButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  locationInfo: {
    backgroundColor: '#fff5f0',
    padding: 12,
    borderRadius: 8,
    gap: 4,
  },
  locationText: {
    fontSize: 14,
    color: '#ff6d00',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  locationAccuracy: {
    fontSize: 12,
    color: '#7f8c8d',
    fontStyle: 'italic',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    marginTop: 4,
  },
  navigationContainer: {
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e1e8ed',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  navigationButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  navButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0066cc',
    padding: 16,
    borderRadius: 8,
    shadowColor: '#0066cc',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  navButtonSecondary: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#0066cc',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  navButtonIcon: {
    flex: 0,
    width: 52,
    height: 52,
    paddingHorizontal: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButtonDisabled: {
    backgroundColor: '#9CA3AF',
    shadowColor: '#9CA3AF',
  },
  saveButton: {
    flex: 0.5,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#d1d5db',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  navButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  navButtonTextSecondary: {
    color: '#0066cc',
  },
  saveButtonText: {
    color: '#6B7280',
    fontWeight: '600',
    fontSize: 14,
  },
  // Estilos para nuevos tipos de campos
  fileUploadContainer: {
    gap: 16,
  },
  fileUploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#7C3AED',
    padding: 12,
    borderRadius: 8,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  fileUploadButtonText: {
    color: 'white',
    fontWeight: '600',
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
  removeFileButton: {
    padding: 4,
  },
  ratingContainer: {
    alignItems: 'center',
    gap: 12,
  },
  ratingStars: {
    flexDirection: 'row',
    gap: 8,
  },
  starButton: {
    padding: 4,
  },
  ratingText: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  sliderContainer: {
    gap: 12,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sliderLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  sliderValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0891B2',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderThumb: {
    backgroundColor: '#0891B2',
    width: 20,
    height: 20,
  },
  qrCodeContainer: {
    gap: 16,
  },
  qrCodeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#059669',
    padding: 12,
    borderRadius: 8,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  qrCodeButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  qrCodeResult: {
    backgroundColor: '#ECFDF5',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#059669',
  },
  qrCodeResultText: {
    fontSize: 14,
    color: '#065F46',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  // Estilos para modal de scanner QR
  qrScannerModal: {
    flex: 1,
    backgroundColor: 'black',
  },
  qrScannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 50,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  qrScannerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  qrScannerCloseButton: {
    padding: 8,
  },
  qrScannerCamera: {
    flex: 1,
  },
  qrScannerOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    flexDirection: 'row',
    margin: 60,
  },
  qrScannerFrame: {
    flex: 1,
    backgroundColor: 'transparent',
    borderColor: '#fff',
    borderWidth: 2,
    borderRadius: 10,
  },
  // Estilos para imagen de referencia
  referenceImageContainer: {
    marginVertical: 8,
  },
  referenceImageWrapper: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  referenceImage: {
    width: screenWidth - 80,
    height: 200,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  referenceImageCaption: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  // Estilos para modal de selección personalizado
  selectModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  selectModalContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    width: '100%',
    maxHeight: '70%',
    minHeight: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  selectModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  selectModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  selectModalCloseButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  selectModalOptions: {
    maxHeight: 400,
  },
  selectModalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  selectModalOptionSelected: {
    backgroundColor: '#EBF8FF',
    borderBottomColor: '#BFDBFE',
  },
  selectModalOptionText: {
    fontSize: 16,
    color: '#374151',
    flex: 1,
  },
  selectModalOptionTextSelected: {
    color: '#0066cc',
    fontWeight: '600',
  },
  // Estilos para modal de DateTimePicker
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  // Estilos para elementos de diseño
  sectionHeaderContainer: {
    marginVertical: 16,
    marginBottom: 8,
  },
  sectionHeader: {
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  sectionHeaderH1: {
    fontSize: 28,
    marginBottom: 12,
  },
  sectionHeaderH2: {
    fontSize: 24,
    marginBottom: 10,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  modalButton: {
    backgroundColor: '#0066cc',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  modalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  sectionHeaderH3: {
    fontSize: 20,
    marginBottom: 8,
  },
  sectionHeaderH4: {
    fontSize: 18,
    marginBottom: 6,
  },
  sectionHeaderH5: {
    fontSize: 16,
    marginBottom: 4,
  },
  sectionHeaderH6: {
    fontSize: 14,
    marginBottom: 4,
  },
  paragraphContainer: {
    marginVertical: 8,
  },
  paragraphText: {
    fontSize: 16,
    color: '#64748B',
    lineHeight: 24,
    textAlign: 'left',
  },
  infoTextContainer: {
    marginVertical: 8,
    paddingHorizontal: 4,
  },
  infoText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    textAlign: 'left',
    fontStyle: 'italic',
  },
  spacer: {
    height: 16,
  },
});

export default FormRenderer;