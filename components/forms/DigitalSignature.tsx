import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Device from 'expo-device';
import SignatureCanvas from 'react-native-signature-canvas';
import { useAuth } from '../../contexts/auth-context';
import { apiRequest } from '../../lib/api/config';

interface DigitalSignatureProps {
  documentId: number;
  documentTitle: string;
  acceptanceText: string;
  onSignatureComplete: (signatureData: any) => void;
  onCancel: () => void;
  requiresVisualSignature?: boolean;
}

interface SignatureData {
  signatureId: number;
  status: string;
  documentHash: string;
  timestamp: string;
  requiresOtp: boolean;
  otpSent: boolean;
  validationToken: string;
  auditLogId: number;
}

interface DeviceInfo {
  platform: string;
  version: string;
  model?: string;
  fingerprint?: string;
}

interface GeolocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

interface SignatureInitiateResponse {
  signatureId: number;
  status: string;
  documentHash: string;
  timestamp: string;
  requiresOtp: boolean;
  otpSent: boolean;
  validationToken: string;
  auditLogId: number;
}

interface SignatureVerifyResponse {
  signatureId: number;
  status: string;
  documentHash: string;
  timestamp: string;
  validationToken: string;
  certificateData: string;
}

const { width, height } = Dimensions.get('window');

export const DigitalSignature: React.FC<DigitalSignatureProps> = ({
  documentId,
  documentTitle,
  acceptanceText,
  onSignatureComplete,
  onCancel,
  requiresVisualSignature = false,
}) => {
  const { user } = useAuth();
  const [step, setStep] = useState<'review' | 'signature' | 'otp' | 'completed'>('review');
  const [loading, setLoading] = useState(false);
  const [signatureData, setSignatureData] = useState<SignatureData | null>(null);
  const [visualSignature, setVisualSignature] = useState<string>('');
  const [otpCode, setOtpCode] = useState('');
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [geolocation, setGeolocation] = useState<GeolocationData | null>(null);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  useEffect(() => {
    initializeSignatureProcess();
  }, []);

  const initializeSignatureProcess = async () => {
    try {
      setLoading(true);
      
      // Obtener información del dispositivo
      const deviceData: DeviceInfo = {
        platform: Device.osName || 'Unknown',
        version: Device.osVersion || 'Unknown',
        model: Device.modelName || 'Unknown',
        fingerprint: await generateDeviceFingerprint(),
      };
      setDeviceInfo(deviceData);

      // Solicitar permisos de ubicación
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        setGeolocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracy: location.coords.accuracy || undefined,
        });
      }
    } catch (error) {
      console.error('Error initializing signature process:', error);
      Alert.alert('Error', 'No se pudo inicializar el proceso de firma');
    } finally {
      setLoading(false);
    }
  };

  const generateDeviceFingerprint = async (): Promise<string> => {
    // Generar una huella digital básica del dispositivo
    const fingerprint = [
      Device.brand,
      Device.modelName,
      Device.osName,
      Device.osVersion,
      width.toString(),
      height.toString(),
    ].join('|');
    
    return fingerprint;
  };

  const handleAcceptTerms = () => {
    if (!acceptedTerms) {
      Alert.alert('Error', 'Debe aceptar los términos para continuar');
      return;
    }
    setStep('signature');
  };

  const handleSignatureCapture = () => {
    if (requiresVisualSignature && !visualSignature) {
      setShowSignatureModal(true);
    } else {
      initiateDigitalSignature();
    }
  };

  const onSignatureOK = (signature: string) => {
    setVisualSignature(signature);
    setShowSignatureModal(false);
    initiateDigitalSignature();
  };

  const onSignatureClear = () => {
    setVisualSignature('');
  };

  const initiateDigitalSignature = async () => {
    try {
      setLoading(true);
      
      const signatureRequest = {
        documentId,
        acceptanceText,
        signatureMethod: requiresVisualSignature ? 'digital_signature' : 'acceptance_checkbox',
        visualSignature: visualSignature || undefined,
        geolocation,
        deviceInfo,
      };

      const response = await apiRequest<ApiResponse<SignatureInitiateResponse>>('/digital-signatures/initiate', {
        method: 'POST',
        body: JSON.stringify(signatureRequest),
      });

      if (response.success) {
        setSignatureData(response.data);
        setStep('otp');
      } else {
        throw new Error(response.message || 'Error al iniciar firma');
      }
    } catch (error) {
      console.error('Error initiating signature:', error);
      Alert.alert('Error', 'No se pudo iniciar el proceso de firma');
    } finally {
      setLoading(false);
    }
  };

  const verifyOtpAndComplete = async () => {
    if (!otpCode || otpCode.length !== 6) {
      Alert.alert('Error', 'Ingrese un código OTP válido de 6 dígitos');
      return;
    }

    try {
      setLoading(true);
      
      const verificationRequest = {
        signatureId: signatureData?.signatureId,
        otpCode,
      };

      const response = await apiRequest<ApiResponse<SignatureVerifyResponse>>('/digital-signatures/verify-otp', {
        method: 'POST',
        body: JSON.stringify(verificationRequest),
      });

      if (response.success) {
        setStep('completed');
        onSignatureComplete(response.data);
      } else {
        throw new Error(response.message || 'Código OTP inválido');
      }
    } catch (error) {
      console.error('Error verifying OTP:', error);
      Alert.alert('Error', 'Código OTP inválido o expirado');
    } finally {
      setLoading(false);
    }
  };

  const renderReviewStep = () => (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="document-text" size={48} color="#007AFF" />
        <Text style={styles.title}>Firma Digital</Text>
        <Text style={styles.subtitle}>{documentTitle}</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.sectionTitle}>Documento a Firmar</Text>
        <Text style={styles.documentInfo}>{acceptanceText}</Text>

        <Text style={styles.sectionTitle}>Información de Seguridad</Text>
        <View style={styles.securityInfo}>
          <View style={styles.securityItem}>
            <Ionicons name="location" size={20} color="#666" />
            <Text style={styles.securityText}>
              {geolocation ? 'Ubicación capturada' : 'Ubicación no disponible'}
            </Text>
          </View>
          <View style={styles.securityItem}>
            <Ionicons name="phone-portrait" size={20} color="#666" />
            <Text style={styles.securityText}>
              {deviceInfo?.platform} {deviceInfo?.version}
            </Text>
          </View>
          <View style={styles.securityItem}>
            <Ionicons name="time" size={20} color="#666" />
            <Text style={styles.securityText}>
              {new Date().toLocaleString()}
            </Text>
          </View>
        </View>

        <View style={styles.termsContainer}>
          <TouchableOpacity
            style={styles.checkbox}
            onPress={() => setAcceptedTerms(!acceptedTerms)}
          >
            <Ionicons
              name={acceptedTerms ? 'checkbox' : 'square-outline'}
              size={24}
              color={acceptedTerms ? '#007AFF' : '#666'}
            />
          </TouchableOpacity>
          <Text style={styles.termsText}>
            He leído y acepto los términos y condiciones. Entiendo que esta
            acción constituye una firma electrónica válida.
          </Text>
        </View>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelButtonText}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.continueButton, !acceptedTerms && styles.disabledButton]}
          onPress={handleAcceptTerms}
          disabled={!acceptedTerms}
        >
          <Text style={styles.continueButtonText}>Continuar</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderSignatureStep = () => (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="create" size={48} color="#007AFF" />
        <Text style={styles.title}>Captura de Firma</Text>
        <Text style={styles.subtitle}>
          {requiresVisualSignature
            ? 'Dibuje su firma en el área designada'
            : 'Confirme su aceptación'}
        </Text>
      </View>

      <View style={styles.content}>
        {requiresVisualSignature ? (
          <View style={styles.signatureContainer}>
            {visualSignature ? (
              <View style={styles.signaturePreview}>
                <Text style={styles.signaturePreviewText}>Firma capturada</Text>
                <TouchableOpacity
                  style={styles.retakeButton}
                  onPress={() => setShowSignatureModal(true)}
                >
                  <Text style={styles.retakeButtonText}>Volver a firmar</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.signatureButton}
                onPress={() => setShowSignatureModal(true)}
              >
                <Ionicons name="create" size={32} color="#007AFF" />
                <Text style={styles.signatureButtonText}>Tocar para firmar</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.acceptanceContainer}>
            <Ionicons name="checkmark-circle" size={64} color="#4CAF50" />
            <Text style={styles.acceptanceText}>
              Su aceptación será registrada como firma electrónica
            </Text>
          </View>
        )}
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelButtonText}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.continueButton,
            requiresVisualSignature && !visualSignature && styles.disabledButton,
          ]}
          onPress={handleSignatureCapture}
          disabled={requiresVisualSignature && !visualSignature}
        >
          <Text style={styles.continueButtonText}>Firmar Documento</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderOtpStep = () => (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="shield-checkmark" size={48} color="#007AFF" />
        <Text style={styles.title}>Verificación OTP</Text>
        <Text style={styles.subtitle}>
          Ingrese el código enviado a {user?.email}
        </Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.otpInfo}>
          Se ha enviado un código de verificación de 6 dígitos a su correo
          electrónico. Este código expira en 10 minutos.
        </Text>

        <TextInput
          style={styles.otpInput}
          value={otpCode}
          onChangeText={setOtpCode}
          placeholder="000000"
          keyboardType="numeric"
          maxLength={6}
          textAlign="center"
        />

        <TouchableOpacity style={styles.resendButton}>
          <Text style={styles.resendButtonText}>Reenviar código</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelButtonText}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.continueButton, otpCode.length !== 6 && styles.disabledButton]}
          onPress={verifyOtpAndComplete}
          disabled={otpCode.length !== 6 || loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.continueButtonText}>Verificar</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderCompletedStep = () => (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="checkmark-circle" size={64} color="#4CAF50" />
        <Text style={styles.title}>Firma Completada</Text>
        <Text style={styles.subtitle}>El documento ha sido firmado exitosamente</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.completedInfo}>
          <Text style={styles.completedText}>
            Su firma digital ha sido registrada y verificada. El documento ahora
            cuenta con validez legal.
          </Text>
          
          <View style={styles.signatureDetails}>
            <Text style={styles.detailLabel}>ID de Firma:</Text>
            <Text style={styles.detailValue}>{signatureData?.signatureId}</Text>
            
            <Text style={styles.detailLabel}>Timestamp:</Text>
            <Text style={styles.detailValue}>
              {signatureData?.timestamp ? new Date(signatureData.timestamp).toLocaleString() : ''}
            </Text>
            
            <Text style={styles.detailLabel}>Hash del Documento:</Text>
            <Text style={styles.detailValue}>
              {signatureData?.documentHash?.substring(0, 16)}...
            </Text>
          </View>
        </View>
      </View>

      <TouchableOpacity
        style={styles.downloadButton}
        onPress={() => {
          // TODO: Implementar descarga de comprobante
          Alert.alert('Info', 'Función de descarga en desarrollo');
        }}
      >
        <Ionicons name="download" size={20} color="white" />
        <Text style={styles.downloadButtonText}>Descargar Comprobante</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading && step === 'review') {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Inicializando proceso de firma...</Text>
      </View>
    );
  }

  return (
    <>
      {step === 'review' && renderReviewStep()}
      {step === 'signature' && renderSignatureStep()}
      {step === 'otp' && renderOtpStep()}
      {step === 'completed' && renderCompletedStep()}

      <Modal
        visible={showSignatureModal}
        animationType="slide"
        onRequestClose={() => setShowSignatureModal(false)}
      >
        <View style={styles.signatureModal}>
          <View style={styles.signatureModalHeader}>
            <Text style={styles.signatureModalTitle}>Firme aquí</Text>
            <TouchableOpacity onPress={() => setShowSignatureModal(false)}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          
          <SignatureCanvas
            onOK={onSignatureOK}
            onClear={onSignatureClear}
            descriptionText="Firme en el área de abajo"
            clearText="Limpiar"
            confirmText="Confirmar"
            webStyle={`
              .m-signature-pad {
                box-shadow: none;
                border: 1px solid #e0e0e0;
                border-radius: 8px;
              }
              .m-signature-pad--body {
                border: none;
              }
              .m-signature-pad--footer {
                display: none;
              }
            `}
          />
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    marginTop: 20,
  },
  documentInfo: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  securityInfo: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  securityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  securityText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 20,
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  checkbox: {
    marginRight: 12,
    marginTop: 2,
  },
  termsText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  signatureContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  signatureButton: {
    backgroundColor: 'white',
    padding: 40,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
    alignItems: 'center',
    width: '100%',
    minHeight: 200,
    justifyContent: 'center',
  },
  signatureButtonText: {
    fontSize: 16,
    color: '#007AFF',
    marginTop: 8,
  },
  signaturePreview: {
    backgroundColor: 'white',
    padding: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#4CAF50',
    alignItems: 'center',
    width: '100%',
    minHeight: 200,
    justifyContent: 'center',
  },
  signaturePreviewText: {
    fontSize: 16,
    color: '#4CAF50',
    marginBottom: 16,
  },
  retakeButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
  },
  retakeButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  acceptanceContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptanceText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 24,
  },
  otpInfo: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  otpInput: {
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 8,
    marginBottom: 20,
  },
  resendButton: {
    alignSelf: 'center',
  },
  resendButtonText: {
    color: '#007AFF',
    fontSize: 16,
    textDecorationLine: 'underline',
  },
  completedInfo: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  completedText: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
    marginBottom: 20,
  },
  signatureDetails: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 16,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginTop: 8,
  },
  detailValue: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
    fontFamily: 'monospace',
  },
  buttonContainer: {
    flexDirection: 'row',
    padding: 20,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginRight: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '500',
  },
  continueButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    marginLeft: 10,
    alignItems: 'center',
  },
  continueButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  downloadButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    margin: 20,
    borderRadius: 8,
  },
  downloadButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  signatureModal: {
    flex: 1,
    backgroundColor: 'white',
  },
  signatureModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  signatureModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
});