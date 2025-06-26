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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import SignatureCanvas from 'react-native-signature-canvas';
import { type TemplateField, type ActivityTemplate } from '@/lib/api';

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
  
  const signatureRef = useRef<any>(null);

  // Dividir campos en páginas (6 campos por página para mejor UX)
  const fieldsPerPage = 6;
  const totalPages = Math.ceil(template.structure.length / fieldsPerPage);
  const currentFields = template.structure.slice(
    currentPage * fieldsPerPage,
    (currentPage + 1) * fieldsPerPage
  );

  // Crear esquema de validación dinámico
  const createValidationSchema = () => {
    const schemaFields: any = {};
    
    template.structure.forEach((field) => {
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
  } = useForm<FormData>({
    resolver: yupResolver(createValidationSchema()),
    defaultValues: initialValues,
  });

  // Funciones para manejar campos especiales
  const handleTakePhoto = async (fieldId: string) => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Error', 'Se requieren permisos de cámara');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const currentPhotos = photos[fieldId] || [];
        const newPhotos = [...currentPhotos, result.assets[0].uri];
        setPhotos({ ...photos, [fieldId]: newPhotos });
        setValue(fieldId, newPhotos);
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo tomar la foto');
    }
  };

  const handlePickPhoto = async (fieldId: string) => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Error', 'Se requieren permisos de galería');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const currentPhotos = photos[fieldId] || [];
        const newPhotos = [...currentPhotos, result.assets[0].uri];
        setPhotos({ ...photos, [fieldId]: newPhotos });
        setValue(fieldId, newPhotos);
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo seleccionar la foto');
    }
  };

  const handleGetLocation = async (fieldId: string) => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Error', 'Se requieren permisos de ubicación');
        return;
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
  };

  const removePhoto = (fieldId: string, index: number) => {
    const currentPhotos = photos[fieldId] || [];
    const newPhotos = currentPhotos.filter((_, i) => i !== index);
    setPhotos({ ...photos, [fieldId]: newPhotos });
    setValue(fieldId, newPhotos);
  };

  const renderField = (field: TemplateField) => {
    const hasError = !!errors[field.id];
    
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
                    onChangeText={(text) => controllerField.onChange(parseFloat(text) || text)}
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
                return (
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={controllerField.value}
                      onValueChange={controllerField.onChange}
                      style={styles.picker}
                    >
                      <Picker.Item label="Selecciona una opción..." value="" />
                      {field.options?.map((option) => (
                        <Picker.Item key={option.value} label={option.label} value={option.value} />
                      ))}
                    </Picker>
                  </View>
                );

              case 'radio':
                return (
                  <View style={styles.radioContainer}>
                    {field.options?.map((option) => (
                      <TouchableOpacity
                        key={option.value}
                        style={styles.radioOption}
                        onPress={() => controllerField.onChange(option.value)}
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
                    {field.options?.map((option) => {
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
                return (
                  <View>
                    <TouchableOpacity
                      style={styles.dateButton}
                      onPress={() => setShowDatePicker({ field: field.id, mode: field.type as any })}
                    >
                      <Text style={styles.dateButtonText}>
                        {controllerField.value 
                          ? new Date(controllerField.value).toLocaleDateString('es-ES')
                          : field.placeholder || 'Seleccionar fecha'
                        }
                      </Text>
                      <Ionicons name="calendar-outline" size={20} color="#0891B2" />
                    </TouchableOpacity>
                    
                    {showDatePicker?.field === field.id && (
                      <DateTimePicker
                        value={controllerField.value ? new Date(controllerField.value) : new Date()}
                        mode={showDatePicker.mode}
                        display="default"
                        onChange={(event, selectedDate) => {
                          setShowDatePicker(null);
                          if (selectedDate) {
                            controllerField.onChange(selectedDate.toISOString());
                          }
                        }}
                      />
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

              case 'signature':
                return (
                  <View style={styles.signatureContainer}>
                    <View style={styles.signatureCanvas}>
                      <SignatureCanvas
                        ref={signatureRef}
                        onOK={(signature) => handleSignature(field.id, signature)}
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
                        onPress={() => signatureRef.current?.clearSignature()}
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
    // Combinar datos del formulario con archivos adjuntos
    const finalData = {
      ...data,
      _signatures: signatures,
      _photos: photos,
      _locations: location,
    };
    onSubmit(finalData);
  };

  const handleSave = () => {
    const currentData = watch();
    const finalData = {
      ...currentData,
      _signatures: signatures,
      _photos: photos,
      _locations: location,
    };
    onSave?.(finalData);
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
      <ScrollView style={styles.formContainer} showsVerticalScrollIndicator={false}>
        {currentFields.map(renderField)}
      </ScrollView>

      {/* Botones de navegación */}
      <View style={styles.navigationContainer}>
        <View style={styles.navigationButtons}>
          {currentPage > 0 && (
            <TouchableOpacity
              style={[styles.navButton, styles.navButtonSecondary, styles.navButtonIcon]}
              onPress={() => setCurrentPage(currentPage - 1)}
            >
              <Ionicons name="chevron-back" size={28} color="#0891B2" />
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
              onPress={() => setCurrentPage(currentPage + 1)}
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: 'white',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  formTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 4,
  },
  formDescription: {
    fontSize: 14,
    color: '#64748b',
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
    backgroundColor: '#e2e8f0',
    borderRadius: 2,
    marginRight: 12,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#0891B2',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: '#64748b',
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
    color: '#1e293b',
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
  },
  picker: {
    height: 50,
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
    color: '#374151',
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
    color: '#374151',
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
  },
  dateButtonText: {
    fontSize: 16,
    color: '#374151',
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
    backgroundColor: '#0891B2',
    padding: 12,
    borderRadius: 8,
  },
  photoButtonSecondary: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#0891B2',
  },
  photoButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  photoButtonTextSecondary: {
    color: '#0891B2',
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
  },
  signatureButtonPrimary: {
    backgroundColor: '#0891B2',
    borderColor: '#0891B2',
  },
  signatureButtonText: {
    color: '#374151',
    fontWeight: '600',
  },
  signatureButtonTextPrimary: {
    color: 'white',
  },
  signaturePreview: {
    padding: 12,
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
    alignItems: 'center',
  },
  signaturePreviewText: {
    color: '#0891B2',
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
    backgroundColor: '#0891B2',
    padding: 12,
    borderRadius: 8,
  },
  locationButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  locationInfo: {
    backgroundColor: '#f0f9ff',
    padding: 12,
    borderRadius: 8,
    gap: 4,
  },
  locationText: {
    fontSize: 14,
    color: '#0891B2',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  locationAccuracy: {
    fontSize: 12,
    color: '#64748b',
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
    borderTopColor: '#e2e8f0',
    padding: 20,
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
    backgroundColor: '#0891B2',
    padding: 16,
    borderRadius: 8,
  },
  navButtonSecondary: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#0891B2',
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
  },
  saveButton: {
    flex: 0.5,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  navButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  navButtonTextSecondary: {
    color: '#0891B2',
  },
  saveButtonText: {
    color: '#6B7280',
    fontWeight: '600',
    fontSize: 14,
  },
});

export default FormRenderer; 