import React, { useState, useRef, useCallback, useEffect } from 'react';
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
import { type ActivityTemplate } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { AzureUploadService } from '@/services/azure-upload.service';
import { authApi } from '@/lib/api/auth';
import { apiRequest } from '@/lib/api/config';
import { UserSelector } from './UserSelector';
import { PendingSignatures } from './PendingSignatures';
import { User, signaturesApi, notificationsApi } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';

interface SignatureRecord {
  user: User;
  status: 'pending' | 'signed' | 'current';
  signedAt?: Date;
  signature?: string;
  signatureMethod?: 'digital' | 'local' | 'remote';
  ipAddress?: string;
  deviceInfo?: any;
  locationInfo?: any;
}

const { width: screenWidth } = Dimensions.get('window');

// Función para obtener la IP real del cliente
const getClientIpAddress = async (): Promise<string> => {
  try {
    const response = await apiRequest<{requestInfo: {
      ip: string
    }}>('/digital-signatures/debug/ip-info');
    return response?.requestInfo?.ip || 'N/A';
  } catch (error) {
    console.warn('Error obteniendo IP del cliente:', error);
    return 'N/A';
  }
};

// Función para actualizar firmas con documentId después de crear el documento
export const updateSignaturesWithDocumentId = async (signatureIds: number[], documentId: number) => {
  
  if (!signatureIds || signatureIds.length === 0) {
    console.log('❌ No hay IDs de firmas para actualizar');
    return;
  }
  
  if (!documentId || documentId <= 0) {
    console.error('❌ documentId inválido:', documentId);
    throw new Error('Document ID debe ser un número positivo válido');
  }
  
  try {
    const requestData = {
      signatureIds,
      documentId
    };
    
    const result = await signaturesApi.updateSignaturesWithDocumentId(requestData);

    return result;
    
  } catch (error: any) {
    console.error('❌ Error actualizando firmas con documentId:', error);
    throw error;
  }
};

interface FormData {
  [key: string]: any;
}

interface FormRendererProps {
  template: ActivityTemplate;
  onSubmit: (data: FormData) => void;
  onSave?: (data: FormData) => void;
  initialValues?: FormData;
  isLoading?: boolean;
  // onCreateSignatures eliminado: los formularios simples no deben crear firmas
}

const FormRenderer: React.FC<FormRendererProps> = ({
  template,
  onSubmit,
  onSave,
  initialValues = {},
  isLoading = false,
  // onCreateSignatures eliminado
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
  const [deviceMetadata, setDeviceMetadata] = useState<any>(null);
  const [globalLocation, setGlobalLocation] = useState<any>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [signatureRecords, setSignatureRecords] = useState<SignatureRecord[]>([]);
  const [showUserSelector, setShowUserSelector] = useState(false);
  const [showPendingSignatures, setShowPendingSignatures] = useState(false);
  
  // Estados derivados para mejor organización
  const pendingSignatures = signatureRecords.filter(record => record.status === 'pending');
  const completedSignatures = signatureRecords.filter(record => record.status === 'signed');
  const allSignatures = signatureRecords;
  // Para mostrar en el modal, incluir todas las firmas (pendientes y completadas)
  const allSignaturesForDisplay = signatureRecords;
  
  const signatureRef = useRef<any>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  // Hook para manejar permisos
  const { 
    permissions, 
    requestCameraPermissionOnly, 
    requestLocationPermissionOnly, 
    requestMediaLibraryPermissionOnly 
  } = usePermissions();

  // Hook para obtener el usuario actual
  const { user } = useAuth();

  // Efecto para agregar automáticamente al usuario actual como firmante por defecto
  useEffect(() => {
    if (user) {
      // Verificar si el usuario actual ya está en la lista de firmantes
      const isCurrentUserIncluded = signatureRecords.some(record => record.user.id === user.id);
      
      if (!isCurrentUserIncluded) {
        const currentUserRecord: SignatureRecord = {
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role as 'admin' | 'supervisor' | 'worker',
            isActive: true,
          },
          status: 'pending',
          signatureMethod: 'digital',
          ipAddress: undefined,
          deviceInfo: deviceMetadata,
          locationInfo: globalLocation,
        };
        
        const currentUser = {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role as 'admin' | 'supervisor' | 'worker',
          isActive: true,
        };
        
        setSignatureRecords(prev => [currentUserRecord, ...prev]);
        setSelectedUsers(prev => [currentUser, ...prev]);
      }
    }
  }, [user, deviceMetadata, globalLocation, signatureRecords]);

  // Funciones para manejar firmas múltiples
  const handleUserSelection = useCallback((users: User[]) => {
    try {
      // Filtrar usuarios que no estén ya en la lista
      const currentUserIds = signatureRecords.map(sig => sig.user.id);
      const newUsers = users.filter(user => !currentUserIds.includes(user.id));
      
      if (newUsers.length === 0) {
        Alert.alert(
          'Información', 
          'Los usuarios seleccionados ya están en la lista de firmas.',
          [{ text: 'OK' }]
        );
        setTimeout(() => {
          setShowUserSelector(false);
        }, 10);
        return;
      }
      
      // Crear nuevos registros de firma pendientes para los usuarios nuevos
      const newSignatureRecords = newUsers.map(user => ({
        user,
        status: 'pending' as const,
        signatureMethod: 'digital' as const,
        ipAddress: undefined,
        deviceInfo: deviceMetadata,
        locationInfo: globalLocation,
      }));
      
      // Añadir a los registros existentes
      setSignatureRecords(prev => [...prev, ...newSignatureRecords]);
      setSelectedUsers(prev => {
        const newSelectedUsers = [...prev, ...newUsers];
        return newSelectedUsers;
      });
      
      // El modal se cerrará solo cuando el usuario presione "Confirmar" en UserSelector
    } catch (error) {
      Alert.alert('Error', 'Hubo un problema al seleccionar los usuarios');
    }
  }, [signatureRecords, deviceMetadata, globalLocation]);

  const handleCloseUserSelector = useCallback(() => {
    setShowUserSelector(false);
  }, []);

  // Memoizar el renderizado de usuarios seleccionados para evitar re-renders innecesarios
  const renderSelectedUsers = useCallback(() => {
    if (signatureRecords.length === 0) return null;
    
    return signatureRecords.map((signature) => {
      const { user, status, signedAt } = signature;
      const isCompleted = status === 'signed';
      
      return (
        <View key={user.id} style={styles.selectedUserItem}>
          <View style={styles.selectedUserInfo}>
            <Text style={styles.selectedUserName}>{user.firstName} {user.lastName}</Text>
            <Text style={styles.selectedUserRole}>{user.role}</Text>
          </View>
          <View style={styles.selectedUserStatus}>
            {isCompleted ? (
              <View style={styles.userCompletedIndicator}>
                <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
                <Text style={styles.userCompletedText}>Firmado</Text>
                {signedAt && (
                  <Text style={styles.signedTime}>
                    {signedAt.toLocaleTimeString()}
                  </Text>
                )}
              </View>
            ) : (
              <View style={styles.userPendingIndicator}>
                <Ionicons name="time-outline" size={24} color="#FF9800" />
                <Text style={styles.userPendingText}>Pendiente</Text>
              </View>
            )}
          </View>
        </View>
      );
    });
  }, [signatureRecords]);

  const captureDeviceAndLocationMetadata = async () => {
    try {
      // Capturar información del dispositivo
      const deviceInfo = {
        platform: Platform.OS,
        version: Platform.Version,
        screenWidth: Dimensions.get('window').width,
        screenHeight: Dimensions.get('window').height,
        timestamp: new Date().toISOString(),
        userAgent: 'NucleoGestor-Mobile/1.0.0',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };
      setDeviceMetadata(deviceInfo);

      // Intentar obtener ubicación (sin mostrar errores si falla)
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const currentLocation = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced, // Usar precisión balanceada para ahorrar batería
          });
          const locationData = {
            latitude: currentLocation.coords.latitude,
            longitude: currentLocation.coords.longitude,
            accuracy: currentLocation.coords.accuracy,
            timestamp: currentLocation.timestamp,
            capturedAt: new Date().toISOString(),
          };
          setGlobalLocation(locationData);
        }
      } catch (locationError) {
        console.warn('No se pudo obtener la ubicación:', locationError);
        // En ambientes mineros, la ubicación puede no estar disponible
      }
    } catch (error) {
      console.error('Error capturando metadatos:', error);
    }
  };

  // Ejecutar captura de metadatos al montar el componente
  React.useEffect(() => {
    captureDeviceAndLocationMetadata();
  }, []);

  // Función helper para mantener el orden original de los campos
  const getOrderedFields = () => {
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
    
    return visibleElements;
  };
  
  const visibleElements = getVisibleElementsForPage();

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

              case 'digital_signature':
                return (
                  <View style={styles.digitalSignatureContainer}>
                    <Text style={styles.digitalSignatureTitle}>
                      {field.config?.documentTitle || template.name}
                    </Text>
                    
                    {/* Términos y condiciones legales */}
                    <View style={styles.legalTermsContainer}>
                      <Text style={styles.legalTermsTitle}>Términos y Condiciones de Firma Digital</Text>
                      <ScrollView style={styles.legalTermsScroll} showsVerticalScrollIndicator={true}>
                        <Text style={styles.legalTermsText}>
                          <Text style={styles.legalTermsBold}>DECLARACIÓN DE VALIDEZ LEGAL:</Text>{"\n"}
                          Al firmar digitalmente este documento, declaro bajo juramento que:{"\n\n"}
                          
                          <Text style={styles.legalTermsBold}>1. IDENTIDAD Y AUTORIZACIÓN:</Text>{"\n"}
                          • Soy la persona identificada en este sistema{"\n"}
                          • Tengo autorización para firmar este documento{"\n"}
                          • Acepto la responsabilidad legal de mi firma{"\n\n"}
                          
                          <Text style={styles.legalTermsBold}>2. VALIDEZ JURÍDICA:</Text>{"\n"}
                          • Esta firma digital tiene la misma validez legal que una firma manuscrita{"\n"}
                          • Me comprometo a no repudiar esta firma en el futuro{"\n"}
                          • Acepto que esta firma sea vinculante legalmente{"\n\n"}
                          
                          <Text style={styles.legalTermsBold}>3. TRAZABILIDAD Y SEGURIDAD:</Text>{"\n"}
                          • Autorizo la captura de metadatos (ubicación, dispositivo, timestamp){"\n"}
                          • Acepto que estos datos sean utilizados como evidencia legal{"\n"}
                          • Confirmo que firmo desde un ambiente minero autorizado{"\n\n"}
                          
                          <Text style={styles.legalTermsBold}>4. RESPONSABILIDADES:</Text>{"\n"}
                          • Soy responsable del contenido del documento firmado{"\n"}
                          • Confirmo haber leído y entendido el documento completo{"\n"}
                          • Acepto las consecuencias legales de esta firma{"\n\n"}
                          
                          <Text style={styles.legalTermsBold}>5. CUMPLIMIENTO NORMATIVO:</Text>{"\n"}
                          • Esta firma cumple con la normativa de seguridad minera{"\n"}
                          • Respeta los protocolos de trazabilidad requeridos{"\n"}
                          • Garantiza la integridad del proceso de firma{"\n\n"}
                          
                          {field.config?.acceptanceText && (
                            <Text style={styles.legalTermsBold}>CONDICIONES ESPECÍFICAS:{"\n"}</Text>
                          )}
                          {field.config?.acceptanceText}
                        </Text>
                      </ScrollView>
                    </View>

                    {/* Autenticación con contraseña */}
                    <View style={styles.passwordAuthContainer}>
                      <Text style={styles.passwordAuthLabel}>Confirme su contraseña para firmar</Text>
                      <View style={styles.passwordInputContainer}>
                        <TextInput
                          style={styles.passwordInput}
                          placeholder="Ingrese su contraseña de la aplicación"
                          secureTextEntry={!showPassword}
                          value={controllerField.value?.password || ''}
                          onChangeText={(text) => {
                            const currentValue = controllerField.value || {};
                            controllerField.onChange({
                              ...currentValue,
                              password: text
                            });
                          }}
                        />
                        <TouchableOpacity
                          style={styles.passwordToggleButton}
                          onPress={() => setShowPassword(!showPassword)}
                        >
                          <Ionicons
                            name={showPassword ? "eye-off" : "eye"}
                            size={20}
                            color="#666"
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                    
                    {/* Checkbox de aceptación de términos */}
                    <TouchableOpacity 
                      style={styles.digitalCheckboxContainer}
                      onPress={() => {
                        const currentValue = controllerField.value || {};
                        controllerField.onChange({
                          ...currentValue,
                          termsAccepted: !currentValue.termsAccepted
                        });
                      }}
                    >
                      <View style={[
                        styles.digitalCheckbox,
                        controllerField.value?.termsAccepted && styles.digitalCheckboxChecked
                      ]}>
                        {controllerField.value?.termsAccepted && (
                          <Ionicons name="checkmark" size={16} color="white" />
                        )}
                      </View>
                      <Text style={styles.digitalCheckboxLabel}>
                        He leído, entendido y acepto todos los términos y condiciones de la firma digital
                      </Text>
                    </TouchableOpacity>

                    {/* Checkbox de confirmación de identidad */}
                    <TouchableOpacity 
                      style={styles.digitalCheckboxContainer}
                      onPress={() => {
                        const currentValue = controllerField.value || {};
                        controllerField.onChange({
                          ...currentValue,
                          identityConfirmed: !currentValue.identityConfirmed
                        });
                      }}
                    >
                      <View style={[
                        styles.digitalCheckbox,
                        controllerField.value?.identityConfirmed && styles.digitalCheckboxChecked
                      ]}>
                        {controllerField.value?.identityConfirmed && (
                          <Ionicons name="checkmark" size={16} color="white" />
                        )}
                      </View>
                      <Text style={styles.digitalCheckboxLabel}>
                        Confirmo mi identidad y autorización para firmar este documento
                      </Text>
                    </TouchableOpacity>

                    {/* Firma visual opcional */}
                    {field.config?.requiresVisualSignature && (
                      <View style={styles.digitalVisualSignatureContainer}>
                        <Text style={styles.digitalSignatureLabel}>Firma Visual (Requerida)</Text>
                        <Text style={styles.signatureInstructions}>
                          Dibuje su firma en el recuadro. Esta firma será parte del documento legal.
                        </Text>
                        <SignatureCanvas
                          ref={signatureRef}
                          style={styles.digitalSignatureCanvas}
                          onOK={(signature) => {
                            const currentValue = controllerField.value || {};
                            controllerField.onChange({
                              ...currentValue,
                              visualSignature: signature
                            });
                            setSignatures({ ...signatures, [field.id]: signature });
                          }}
                          onEmpty={() => {
                            const currentValue = controllerField.value || {};
                            controllerField.onChange({
                              ...currentValue,
                              visualSignature: null
                            });
                          }}
                          descriptionText="Firme aquí"
                          clearText="Limpiar"
                          confirmText="Confirmar"
                          webStyle={`
                            .m-signature-pad--footer {
                              display: none;
                            }
                            .m-signature-pad {
                              box-shadow: none;
                              border: 2px solid #0066cc;
                              border-radius: 8px;
                              background-color: #fafafa;
                            }
                            body,html {
                              width: 100%; height: 100%;
                            }
                          `}
                        />
                        <View style={styles.digitalSignatureButtons}>
                          <TouchableOpacity 
                            style={styles.digitalSignatureButton}
                            onPress={() => {
                              signatureRef.current?.clearSignature();
                              const currentValue = controllerField.value || {};
                              controllerField.onChange({
                                ...currentValue,
                                visualSignature: null
                              });
                              const newSignatures = { ...signatures };
                              delete newSignatures[field.id];
                              setSignatures(newSignatures);
                            }}
                          >
                            <Text style={styles.digitalSignatureButtonText}>Limpiar</Text>
                          </TouchableOpacity>
                          <TouchableOpacity 
                            style={[styles.digitalSignatureButton, styles.digitalSignatureButtonPrimary]}
                            onPress={() => signatureRef.current?.readSignature()}
                          >
                            <Text style={[styles.digitalSignatureButtonText, styles.digitalSignatureButtonTextPrimary]}>Confirmar Firma</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}

                    {/* Botón de firma final */}
                    <TouchableOpacity 
                      style={[
                        styles.finalSignatureButton,
                        (controllerField.value?.termsAccepted && 
                         controllerField.value?.identityConfirmed && 
                         controllerField.value?.password?.length >= 6 &&
                         (!field.config?.requiresVisualSignature || controllerField.value?.visualSignature)) 
                          ? styles.finalSignatureButtonEnabled 
                          : styles.finalSignatureButtonDisabled
                      ]}
                      disabled={!(controllerField.value?.termsAccepted && 
                                 controllerField.value?.identityConfirmed && 
                                 controllerField.value?.password?.length >= 6 &&
                                 (!field.config?.requiresVisualSignature || controllerField.value?.visualSignature))}
                      onPress={async () => {
                        const currentValue = controllerField.value || {};
                        const password = currentValue.password;
                        
                        if (!password || password.length < 6) {
                          Alert.alert('Error', 'Debe ingresar una contraseña válida de al menos 6 caracteres.');
                          return;
                        }
                        
                        try {
                          // Verificar la contraseña con el backend
                          const verificationResult = await authApi.verifyPassword({ password });
                          
                          if (!verificationResult.valid) {
                            Alert.alert('Contraseña Incorrecta', 'La contraseña ingresada no es correcta. Por favor, verifique e intente nuevamente.');
                            return;
                          }
                          
                          // Si la contraseña es válida, proceder con la firma
                          // Excluir la contraseña de los datos guardados por seguridad
                          const { password: _, ...dataWithoutPassword } = currentValue;
                          const signatureData = {
                            ...dataWithoutPassword,
                            signed: true,
                            signedAt: new Date().toISOString(),
                            documentHash: `hash_${template.id}_${Date.now()}`,
                            signatureMethod: field.config?.requiresVisualSignature ? 'digital_signature_with_visual' : 'digital_signature_checkbox',
                            traceability: {
                              device: deviceMetadata,
                              location: globalLocation,
                              timestamp: new Date().toISOString(),
                              documentHash: `hash_${template.id}_${Date.now()}`,
                              ipAddress: await getClientIpAddress(),
                              userAgent: deviceMetadata?.userAgent
                            }
                          };
                          controllerField.onChange(signatureData);
                          Alert.alert(
                            'Firma Completada',
                            'Su firma digital ha sido registrada exitosamente con validez legal completa.',
                            [{ text: 'Entendido', style: 'default' }]
                          );
                        } catch (error) {
                          console.error('Error verificando contraseña:', error);
                          Alert.alert('Error', 'No se pudo verificar la contraseña. Verifique su conexión e intente nuevamente.');
                        }
                      }}
                    >
                      <Text style={[
                        styles.finalSignatureButtonText,
                        (controllerField.value?.termsAccepted && 
                         controllerField.value?.identityConfirmed && 
                         controllerField.value?.password?.length >= 6 &&
                         (!field.config?.requiresVisualSignature || controllerField.value?.visualSignature)) 
                          ? styles.finalSignatureButtonTextEnabled 
                          : styles.finalSignatureButtonTextDisabled
                      ]}>
                        {controllerField.value?.signed ? '✓ Documento Firmado' : 'FIRMAR DOCUMENTO'}
                      </Text>
                    </TouchableOpacity>

                    {/* Información de trazabilidad */}
                    {controllerField.value?.signed && (
                      <View style={styles.digitalTraceabilityInfo}>
                        <Text style={styles.digitalTraceabilityTitle}>✓ Firma Registrada - Información de Trazabilidad</Text>
                        <Text style={styles.digitalTraceabilityText}>Dispositivo: {deviceMetadata?.platform} {deviceMetadata?.version}</Text>
                        <Text style={styles.digitalTraceabilityText}>Ubicación: {globalLocation ? `${globalLocation.latitude.toFixed(6)}, ${globalLocation.longitude.toFixed(6)}` : 'No disponible'}</Text>
                        <Text style={styles.digitalTraceabilityText}>Fecha y hora: {new Date(controllerField.value?.signedAt).toLocaleString('es-ES')}</Text>
                        <Text style={styles.digitalTraceabilityText}>Hash del documento: {controllerField.value?.documentHash || 'Generando...'}</Text>
                        <Text style={styles.digitalTraceabilityText}>Estado: Firmado digitalmente con validez legal</Text>
                      </View>
                    )}
                  </View>
                );

              case 'multiple_signature':
                return (
                  <View style={styles.multipleSignatureContainer}>
                    <Text style={styles.signatureTitle}>
                      {field.config?.documentTitle || template.name}
                    </Text>
                    <Text style={styles.signatureAcceptanceText}>
                      {field.config?.acceptanceText || 'Acepto los términos y condiciones de este documento'}
                    </Text>
                    
                    {/* Botón para seleccionar/añadir usuarios */}
                    <TouchableOpacity
                      style={styles.userSelectButton}
                      onPress={() => setShowUserSelector(true)}
                    >
                      <View style={styles.userSelectButtonContent}>
                        <Text style={styles.userSelectButtonText}>
                          {allSignaturesForDisplay.length === 0 
                            ? 'Seleccionar usuarios para firmar' 
                            : `Gestionar firmas (${allSignaturesForDisplay.length} usuarios)`
                          }
                        </Text>
                        <Ionicons name="person-add" size={20} color="#34495e" />
                      </View>
                    </TouchableOpacity>
                    
                    {/* Lista de usuarios seleccionados */}
                    {allSignaturesForDisplay.length > 0 && (
                      <View style={styles.selectedUsersContainer}>
                        <Text style={styles.selectedUsersLabel}>Usuarios seleccionados:</Text>
                        <View style={styles.selectedUsersList}>
                          {renderSelectedUsers()}
                        </View>
                        
                        {/* Botones de acción */}
                        <View style={styles.multiSignatureButtons}>
                          <TouchableOpacity
                            style={[styles.multiSignatureButton, styles.multiSignatureButtonPrimary]}
                            onPress={() => setShowPendingSignatures(true)}
                          >
                            <Text style={[styles.multiSignatureButtonText, styles.multiSignatureButtonTextPrimary]}>
                              Gestionar Firmas
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.multiSignatureButton}
                            onPress={() => {
                              console.log('Reiniciando selección de usuarios');
                              try {
                                setSelectedUsers(() => []);
                                setSignatureRecords(() => []);
                                console.log('Reinicio completado');
                              } catch (error) {
                                console.error('Error al reiniciar:', error);
                              }
                            }}
                          >
                            <Text style={styles.multiSignatureButtonText}>Reiniciar</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                    
                    {/* Modal para seleccionar usuarios */}
                    {showUserSelector && (
                      <Modal
                        visible={showUserSelector}
                        animationType="slide"
                        presentationStyle="pageSheet"
                        onRequestClose={handleCloseUserSelector}
                      >
                        <UserSelector
                          visible={showUserSelector}
                          onUsersSelected={handleUserSelection}
                          onClose={handleCloseUserSelector}
                          selectedUsers={selectedUsers}
                          title={allSignaturesForDisplay.length === 0 ? 'Seleccionar Usuarios' : 'Añadir Más Usuarios'}
                          subtitle={allSignaturesForDisplay.length === 0 
                            ? 'Selecciona los usuarios que deben firmar el documento'
                            : 'Selecciona usuarios adicionales para firmar'
                          }
                        />
                      </Modal>
                    )}
                    
                    {/* Modal para gestionar firmas pendientes */}
                    <Modal
                      visible={showPendingSignatures}
                      animationType="slide"
                      presentationStyle="pageSheet"
                    >
                      <PendingSignatures
                        pendingSignatures={allSignaturesForDisplay}
                        onSignatureComplete={async (userId, signature) => {
                          console.log('Signature completed for user:', userId, signature);
                          // Obtener IP del cliente
                          const clientIp = await getClientIpAddress();
                          // Update the signature status
                          setSignatureRecords(prev => prev.map((record: SignatureRecord) => 
                            record.user.id === userId 
                              ? { 
                                  ...record, 
                                  status: 'signed' as const, 
                                  signedAt: new Date(), 
                                  signature,
                                  ipAddress: clientIp,
                                  deviceInfo: deviceMetadata,
                                  locationInfo: globalLocation,
                                }
                              : record
                          ));
                        }}
                        onRemoveUser={(userId) => {
                          setSignatureRecords(prev => prev.filter((record: SignatureRecord) => record.user.id !== userId));
                          setSelectedUsers(prev => prev.filter(user => user.id !== userId));
                        }}
                        onClose={() => setShowPendingSignatures(false)}
                        documentTitle={field.config?.documentTitle || template.name}
                      />
                    </Modal>
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

  const onFormSubmit = async (data: FormData) => {
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
    
    // Filtrar solo firmas pendientes para enviar
    const onlyPendingSignatures = pendingSignatures.filter(signature => signature.status === 'pending');

    // Procesar firmas completadas
    const processedCompletedSignatures = completedSignatures.map(sig => ({
      userId: sig.user.id,
      userName: `${sig.user.firstName} ${sig.user.lastName}`,
      userEmail: sig.user.email,
      userRole: sig.user.role,
      signatureData: sig.signature,
      signedAt: sig.signedAt,
      ipAddress: sig.ipAddress,
      geolocation: sig.locationInfo,
      deviceInfo: sig.deviceInfo,
      visualSignature: sig.signature,
      userAgent: sig.deviceInfo?.userAgent,
      acceptanceText: 'Acepto los términos y condiciones'
    }));

    // Agregar datos especiales y estructura enriquecida
    const enrichedData = {
      ...cleanData,
      _signatures: signatures,
      _photos: photos,
      _locations: location,
      _files: files,
      _qrCodes: qrCodes,
      _enrichedResponses: enrichedResponses, // Estructura enriquecida para revisiones
      _pendingSignatures: onlyPendingSignatures.map(sig => ({ // Información de firmas pendientes
        userId: sig.user.id,
        userName: `${sig.user.firstName} ${sig.user.lastName}`,
        userEmail: sig.user.email,
        userRole: sig.user.role
      })),
      _completedSignatures: processedCompletedSignatures // Información de firmas completadas
    };
    
    onSubmit(enrichedData);
  };

  const handleSave = () => {
    const currentData = watch();
    
    const cleanData: any = {};
    
    inputFields.forEach((field: any) => {
      const value = currentData[field.id];
      if (value !== undefined && value !== null && value !== '') {
        cleanData[field.id] = value;
      }
    });
    
    const enrichedResponses = {
      sections: [{
        id: 'main_section',
        title: template.name || 'Formulario',
        description: template.description,
        questions: orderedFields.map((field: any) => {
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
    
    const enrichedData = {
      ...cleanData,
      _signatures: signatures,
      _photos: photos,
      _locations: location,
      _files: files,
      _qrCodes: qrCodes,
      _enrichedResponses: enrichedResponses, // Estructura enriquecida para revisiones
    };
    
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
  // Estilos para firmas digitales
  digitalSignatureContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  digitalSignatureTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  digitalSignatureAcceptanceText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
    lineHeight: 20,
  },
  digitalCheckboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  digitalCheckbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    borderRadius: 4,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
  },
  digitalCheckboxChecked: {
    backgroundColor: '#0066cc',
    borderColor: '#0066cc',
  },
  digitalCheckboxLabel: {
    fontSize: 16,
    color: '#374151',
    flex: 1,
  },
  digitalVisualSignatureContainer: {
    marginTop: 16,
  },
  digitalSignatureLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  digitalSignatureCanvas: {
    height: 200,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    backgroundColor: 'white',
  },
  digitalSignatureButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  digitalSignatureButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: 'white',
    alignItems: 'center',
  },
  digitalSignatureButtonPrimary: {
    backgroundColor: '#0066cc',
    borderColor: '#0066cc',
  },
  digitalSignatureButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  digitalSignatureButtonTextPrimary: {
    color: 'white',
  },
  digitalTraceabilityInfo: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  digitalTraceabilityTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  digitalTraceabilityText: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  // Estilos para firmas múltiples
  multipleSignatureContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  multipleWorkerSelectorContainer: {
    marginTop: 16,
  },
  multipleWorkerSelectorLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  multipleWorkersList: {
    gap: 8,
  },
  multipleWorkerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    backgroundColor: 'white',
  },
  multipleWorkerItemSigned: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  multipleWorkerInfo: {
    flex: 1,
  },
  multipleWorkerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  multipleWorkerRole: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  multipleWorkerStatus: {
    alignItems: 'center',
  },
  multipleSignedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  multipleSignedText: {
    fontSize: 12,
    color: '#16A34A',
    fontWeight: '600',
  },
  multiplePendingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  multiplePendingText: {
    fontSize: 12,
    color: '#F59E0B',
    fontWeight: '600',
  },
  multipleSignaturesStatus: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  multipleSignaturesStatusTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  multipleSignaturesStatusText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  multipleCompletedStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  multipleCompletedStatusText: {
    fontSize: 14,
    color: '#16A34A',
    fontWeight: '600',
  },
  multipleSignaturesList: {
    gap: 8,
  },
  multipleSignatureItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'white',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  multipleSignatureItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#16A34A',
  },
  multipleSignatureItemTime: {
    fontSize: 12,
    color: '#6B7280',
  },
  
  // Estilos para nuevos elementos de múltiples firmas
  userSelectButton: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  userSelectButtonContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  userSelectButtonText: {
    fontSize: 16,
    color: '#34495e',
    fontWeight: '500',
    flex: 1,
  },
  multiSignatureTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
    textAlign: 'center',
  },
  multiSignatureAcceptanceText: {
    fontSize: 14,
    color: '#7f8c8d',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  selectedUsersContainer: {
    marginTop: 16,
  },
  selectedUsersLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#34495e',
    marginBottom: 12,
  },
  selectedUsersList: {
    gap: 8,
  },
  selectedUserItem: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  selectedUserInfo: {
    flex: 1,
  },
  selectedUserName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
  },
  selectedUserRole: {
    fontSize: 14,
    color: '#7f8c8d',
    marginTop: 2,
  },
  selectedUserStatus: {
    alignItems: 'center',
  },
  userPendingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  userPendingText: {
    fontSize: 12,
    color: '#FF9800',
    fontWeight: '600',
  },
  userCompletedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  userCompletedText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '600',
  },
  signedTime: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 2,
  },
  multiSignatureButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  multiSignatureButton: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  multiSignatureButtonPrimary: {
    backgroundColor: '#3498db',
    borderColor: '#3498db',
  },
  multiSignatureButtonText: {
    fontSize: 14,
    color: '#34495e',
    fontWeight: '600',
  },
  multiSignatureButtonTextPrimary: {
    color: '#ffffff',
  },
  
  // Estilos adicionales para firma digital mejorada
  legalTermsContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dee2e6',
    marginBottom: 20,
    maxHeight: 200,
  },
  legalTermsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    padding: 12,
    backgroundColor: '#e9ecef',
    color: '#495057',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  legalTermsScroll: {
    maxHeight: 150,
    padding: 12,
  },
  legalTermsText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#495057',
  },
  legalTermsBold: {
    fontWeight: 'bold',
    color: '#212529',
  },
  
  // Autenticación con contraseña
  passwordAuthContainer: {
    marginBottom: 20,
  },
  passwordAuthLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#495057',
  },
  passwordInput: {
    flex: 1,
    padding: 12,
    fontSize: 16,
    backgroundColor: 'transparent',
  },
  
  // Instrucciones de firma
  signatureInstructions: {
    fontSize: 13,
    color: '#6c757d',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  
  // Botón de firma final
  finalSignatureButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 2,
  },
  finalSignatureButtonEnabled: {
    backgroundColor: '#28a745',
    borderColor: '#28a745',
  },
  finalSignatureButtonDisabled: {
    backgroundColor: '#e9ecef',
    borderColor: '#ced4da',
  },
  finalSignatureButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  finalSignatureButtonTextEnabled: {
    color: '#ffffff',
  },
  finalSignatureButtonTextDisabled: {
    color: '#6c757d',
  },
  
  // Estilos faltantes para firma digital
  signatureTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  signatureAcceptanceText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    lineHeight: 20,
  },
  
  // Estilos faltantes para múltiples firmas
  workerSelectorContainer: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  workerSelectorLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  workersList: {
    gap: 8,
  },
  workerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    backgroundColor: 'white',
  },
  workerItemSigned: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  workerInfo: {
    flex: 1,
  },
  workerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  workerRole: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  workerStatus: {
    alignItems: 'center',
  },
  signedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  signedText: {
    fontSize: 12,
    color: '#16A34A',
    fontWeight: '600',
  },
  pendingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pendingText: {
    fontSize: 12,
    color: '#F59E0B',
    fontWeight: '600',
  },
  signaturesStatus: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  signaturesStatusTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  signaturesStatusText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  completedStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  completedStatusText: {
    fontSize: 14,
    color: '#16A34A',
    fontWeight: '600',
  },
  signaturesList: {
    gap: 8,
  },
  signatureItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'white',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  signatureItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#16A34A',
  },
  signatureItemTime: {
    fontSize: 12,
    color: '#6B7280',
  },
  traceabilityInfo: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  traceabilityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  traceabilityText: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 16,
  },
  
  // Estilos para el contenedor de contraseña con botón de mostrar/ocultar
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ced4da',
    borderRadius: 6,
    backgroundColor: '#ffffff',
  },
  passwordToggleButton: {
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

// Función helper exportable para crear firmas con un ID de documento específico
export const createSignaturesForDocument = async (documentId: number | string | null, documentTitle: string, signers: any[], completedSignatures?: any[]): Promise<{ signatureIds: number[] } | void> => {
  // Si no hay documentId, crear firmas sin asociar al documento (se asociarán después)
  let numericDocumentId: number | null = null;
  
  if (documentId) {
    // Verificar si es un ID offline (string que empieza con 'offline_')
    if (typeof documentId === 'string' && documentId.startsWith('offline_')) {
      console.log('📱 ID offline detectado, no se pueden crear firmas digitales hasta que se sincronice');
      return;
    }

    // Convertir a número si es string
    numericDocumentId = typeof documentId === 'string' ? parseInt(documentId, 10) : documentId;
    
    if (isNaN(numericDocumentId)) {
      console.error('❌ No se pudo convertir documentId a número:', documentId);
      throw new Error('Document ID debe ser convertible a número');
    }

    if (numericDocumentId <= 0) {
      console.error('❌ documentId debe ser mayor que 0:', numericDocumentId);
      throw new Error('Document ID debe ser un número positivo válido');
    }
  }

  if (!signers || signers.length === 0) {
    console.log('❌ No hay firmantes para crear solicitudes');
    return;
  }

  try {
    // Procesar firmas completadas si existen
    const processedCompletedSignatures = completedSignatures?.map(signature => ({
      userId: signature.userId,
      signatureData: signature.signatureData,
      signedAt: signature.signedAt?.toISOString() || new Date().toISOString(),
      ipAddress: signature.ipAddress || '127.0.0.1',
      geolocation: signature.geolocation || null,
      deviceInfo: signature.deviceInfo || null,
      visualSignature: signature.visualSignature,
      userAgent: signature.userAgent || 'Mobile App',
      acceptanceText: signature.acceptanceText || 'Firma completada desde la aplicación móvil'
    })) || [];

    // Combinar firmantes pendientes y completados para la lista de signers
    const allSigners = [...signers];
    
    // Agregar usuarios que completaron firmas pero no están en la lista de pendientes
    if (completedSignatures && completedSignatures.length > 0) {
      completedSignatures.forEach(completed => {
        const existsInSigners = signers.some(signer => signer.userId === completed.userId);
        if (!existsInSigners) {
          // Extraer información del usuario desde signatureData si está disponible
          let userEmail = completed.userEmail;
          let userRole = completed.userRole;
          
          // Si no están disponibles directamente, intentar extraer del signatureData
          if (!userEmail || !userRole) {
            try {
              const signatureData = typeof completed.signatureData === 'string' 
                ? JSON.parse(completed.signatureData) 
                : completed.signatureData;
              
              if (signatureData && signatureData.user) {
                userEmail = userEmail || signatureData.user.email;
                userRole = userRole || signatureData.user.role;
              }
            } catch (error) {
              console.warn('Error parsing signatureData:', error);
            }
          }
          
          allSigners.push({
            userId: completed.userId,
            userEmail: userEmail,
            userRole: userRole
          });
        }
      });
    }

    const signatureData: any = {
      signers: allSigners.map((signer, index) => ({
        userId: signer.userId,
        email: signer.userEmail,
        role: signer.userRole,
        order: index + 1
      })),
      requiresAllSignatures: true,
      expirationHours: 168, // 7 días
      notificationMessage: `Nueva solicitud de firma para: ${documentTitle}`,
      ...(processedCompletedSignatures.length > 0 && { completedSignatures: processedCompletedSignatures })
    };
    
    // Solo incluir documentId si existe
    if (numericDocumentId) {
      signatureData.documentId = numericDocumentId;
    }

    const result = await signaturesApi.createMultipleSignatures(signatureData);

    // Extraer los IDs de las firmas creadas
    let signatureIds: number[] = [];
    
    // Extraer signatureIds del array de signers (puede estar en result.signers o result.data.signers)
    if (result?.signers && Array.isArray(result.signers)) {
      signatureIds = result.signers
        .map((signer: any) => signer.signatureId)
        .filter((id: any) => id !== undefined && id !== null);
    } else if (result?.data?.signers && Array.isArray(result.data.signers)) {
      signatureIds = result.data.signers
        .map((signer: any) => signer.signatureId)
        .filter((id: any) => id !== undefined && id !== null);
    } else {
      signatureIds = [];
    }
    Alert.alert(
      'Éxito', 
      `Se han creado ${signers.length} solicitudes de firma digitales`,
      [{ text: 'OK' }]
    );

    return { signatureIds };
  } catch (error: any) {
    console.error('❌ Error completo creando firmas digitales:', error);
    console.error('❌ Error message:', error?.message);
    console.error('❌ Error response:', error?.response?.data);
    
    // Si es un error de autenticación, no mostrar alert de error
    // ya que el manejo se hace en el nivel superior
    if (error?.message?.includes('Sesión expirada') || error?.status === 401) {
      console.warn('⚠️ Error de autenticación detectado en createSignaturesForDocument');
    } else {
      Alert.alert('Error', `No se pudieron crear las solicitudes de firma: ${error?.message || 'Error desconocido'}`);
    }
    
    throw error;
  }
};

export default FormRenderer;