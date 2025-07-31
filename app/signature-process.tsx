import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Switch,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import * as Device from 'expo-device';
import { usePendingSignatures } from '../hooks/usePendingSignatures';
import { useAuth } from '../contexts/auth-context';
import { tokenManager } from '../lib/api';

interface DeviceInfo {
  platform: string;
  version: string;
  model: string;
  fingerprint: string;
}

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export default function SignatureProcess() {
  const router = useRouter();
  const { user } = useAuth();
  const { signDocument } = usePendingSignatures();
  const params = useLocalSearchParams();
  
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: Términos, 2: Datos, 3: Firma
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [password, setPassword] = useState('');
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [location, setLocation] = useState<LocationData | null>(null);
  const [collectingLocation, setCollectingLocation] = useState(false);

  const {
    signatureId,
    documentId,
    documentTitle,
  } = params;

  useEffect(() => {
    collectDeviceInfo();
    requestLocationPermission();
  }, []);

  const collectDeviceInfo = async () => {
    try {
      const info: DeviceInfo = {
        platform: Platform.OS,
        version: Platform.Version.toString(),
        model: Device.modelName || 'Unknown',
        fingerprint: Device.osInternalBuildId || 'Unknown',
      };
      setDeviceInfo(info);
    } catch (error) {
      console.error('Error collecting device info:', error);
    }
  };

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        collectLocation();
      }
    } catch (error) {
      console.error('Error requesting location permission:', error);
    }
  };

  const collectLocation = async () => {
    try {
      setCollectingLocation(true);
      const locationData = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      
      setLocation({
        latitude: locationData.coords.latitude,
        longitude: locationData.coords.longitude,
        accuracy: locationData.coords.accuracy || 0,
      });
    } catch (error) {
      console.error('Error collecting location:', error);
    } finally {
      setCollectingLocation(false);
    }
  };

  const handleNextStep = async () => {
    if (step === 1 && !acceptedTerms) {
      Alert.alert('Error', 'Debe aceptar los términos y condiciones para continuar');
      return;
    }
    
    if (step === 2) {
      if (!password.trim()) {
        Alert.alert('Error', 'Debe ingresar su contraseña para continuar');
        return;
      }
      
      // Validar contraseña antes de continuar
      try {
        setLoading(true);
        const accessToken = await tokenManager.getAccessToken();
        const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/v1/auth/verify-password`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ password }),
        });
        
        const result = await response.json();
        
        if (!response.ok || !result.data?.valid) {
          Alert.alert('Contraseña Incorrecta', 'La contraseña ingresada no es correcta. Por favor, verifique e intente nuevamente.');
          return;
        }
      } catch (error) {
        console.error('Error validating password:', error);
        Alert.alert('Error', 'No se pudo verificar la contraseña. Verifique su conexión e intente nuevamente.');
        return;
      } finally {
        setLoading(false);
      }
    }
    
    if (step < 3) {
      setStep(step + 1);
    } else {
      handleSign();
    }
  };

  const handleSign = async () => {
    if (!deviceInfo) {
      Alert.alert('Error', 'No se pudo obtener la información del dispositivo');
      return;
    }

    try {
      setLoading(true);
      
      const signatureData = {
        password,
        acceptedTerms,
        deviceInfo,
        location: location || undefined,
      };

      await signDocument(Number(signatureId), signatureData);
      
      Alert.alert(
        'Éxito',
        'El documento ha sido firmado exitosamente',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/(tabs)/pending-signatures'),
          },
        ]
      );
    } catch (error: any) {
      console.error('Error signing document:', error);
      Alert.alert('Error', error.message || 'No se pudo procesar la firma');
    } finally {
      setLoading(false);
    }
  };

  const renderTermsStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Términos y Condiciones</Text>
      
      <ScrollView style={styles.termsContainer}>
        <Text style={styles.termsText}>
          Al firmar este documento, usted acepta que:
          
          • La firma digital tiene la misma validez legal que una firma manuscrita
          • Se registrará información sobre el dispositivo y ubicación para fines de trazabilidad
          • La firma será vinculada a su identidad de usuario
          • El documento firmado será almacenado de forma segura
          • No podrá modificar el documento después de firmarlo
          
          Esta firma digital cumple con los estándares de seguridad y validez legal establecidos.
        </Text>
      </ScrollView>
      
      <View style={styles.acceptContainer}>
        <Switch
          value={acceptedTerms}
          onValueChange={setAcceptedTerms}
          trackColor={{ false: '#767577', true: '#007AFF' }}
          thumbColor={acceptedTerms ? '#fff' : '#f4f3f4'}
        />
        <Text style={styles.acceptText}>
          Acepto los términos y condiciones
        </Text>
      </View>
    </View>
  );

  const renderDataStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Verificación de Identidad</Text>
      
      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Contraseña *</Text>
        <TextInput
          style={styles.passwordInput}
          value={password}
          onChangeText={setPassword}
          placeholder="Ingrese su contraseña"
          secureTextEntry
          autoCapitalize="none"
        />
      </View>
      
      {/* La firma visual se maneja en el paso 3, no en el paso 2 */}
      
      <View style={styles.infoContainer}>
        <Text style={styles.infoTitle}>Información de Trazabilidad</Text>
        
        <View style={styles.infoItem}>
          <Ionicons name="phone-portrait-outline" size={16} color="#666" />
          <Text style={styles.infoText}>
            Dispositivo: {deviceInfo?.model} ({deviceInfo?.platform})
          </Text>
        </View>
        
        <View style={styles.infoItem}>
          <Ionicons name="location-outline" size={16} color="#666" />
          <Text style={styles.infoText}>
            {location 
              ? `Ubicación: ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`
              : collectingLocation 
                ? 'Obteniendo ubicación...'
                : 'Ubicación no disponible'
            }
          </Text>
        </View>
        
        <View style={styles.infoItem}>
          <Ionicons name="time-outline" size={16} color="#666" />
          <Text style={styles.infoText}>
            Fecha: {new Date().toLocaleString('es-ES')}
          </Text>
        </View>
      </View>
    </View>
  );

  const renderSignStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Confirmar Firma</Text>
      
      <View style={styles.summaryContainer}>
        <Text style={styles.summaryTitle}>Resumen de la Firma</Text>
        
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Documento:</Text>
          <Text style={styles.summaryValue}>{documentTitle}</Text>
        </View>
        
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Usuario:</Text>
          <Text style={styles.summaryValue}>{user?.firstName} {user?.lastName}</Text>
        </View>
        
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Email:</Text>
          <Text style={styles.summaryValue}>{user?.email}</Text>
        </View>
        
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Fecha y Hora:</Text>
          <Text style={styles.summaryValue}>{new Date().toLocaleString('es-ES')}</Text>
        </View>
      </View>
      
      <View style={styles.warningContainer}>
        <Ionicons name="warning-outline" size={24} color="#FF8800" />
        <Text style={styles.warningText}>
          Una vez firmado, el documento no podrá ser modificado. 
          Verifique que toda la información sea correcta.
        </Text>
      </View>
    </View>
  );

  const renderCurrentStep = () => {
    switch (step) {
      case 1: return renderTermsStep();
      case 2: return renderDataStep();
      case 3: return renderSignStep();
      default: return renderTermsStep();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        
        <Text style={styles.title}>Proceso de Firma</Text>
        
        <View style={styles.stepIndicator}>
          <Text style={styles.stepText}>{step}/3</Text>
        </View>
      </View>

      <View style={styles.progressBar}>
        <View style={[styles.progress, { width: `${(step / 3) * 100}%` }]} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {renderCurrentStep()}
      </ScrollView>

      <View style={styles.footer}>
        {step > 1 && (
          <TouchableOpacity
            style={styles.backStepButton}
            onPress={() => setStep(step - 1)}
          >
            <Text style={styles.backStepText}>Anterior</Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity
          style={[
            styles.nextButton,
            (step === 1 && !acceptedTerms) || (step === 2 && !password.trim()) 
              ? styles.nextButtonDisabled 
              : {},
          ]}
          onPress={handleNextStep}
          disabled={loading || (step === 1 && !acceptedTerms) || (step === 2 && !password.trim())}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.nextButtonText}>
                {step === 3 ? 'Firmar Documento' : 'Continuar'}
              </Text>
              <Ionicons 
                name={step === 3 ? 'create-outline' : 'arrow-forward'} 
                size={20} 
                color="#fff" 
              />
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e5e9',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  stepIndicator: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  stepText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  progressBar: {
    height: 4,
    backgroundColor: '#e1e5e9',
  },
  progress: {
    height: '100%',
    backgroundColor: '#007AFF',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  stepContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 20,
  },
  termsContainer: {
    maxHeight: 200,
    marginBottom: 20,
  },
  termsText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  acceptContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  acceptText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  passwordInput: {
    borderWidth: 1,
    borderColor: '#e1e5e9',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#e1e5e9',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  infoContainer: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  summaryContainer: {
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  summaryItem: {
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 16,
    color: '#333',
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    backgroundColor: '#fff3e0',
    borderRadius: 8,
    gap: 12,
  },
  warningText: {
    fontSize: 14,
    color: '#f57c00',
    flex: 1,
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e1e5e9',
    gap: 12,
  },
  backStepButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#007AFF',
    alignItems: 'center',
  },
  backStepText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  nextButton: {
    flex: 2,
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  nextButtonDisabled: {
    backgroundColor: '#ccc',
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});