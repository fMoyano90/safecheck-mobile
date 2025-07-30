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
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/auth-context';
import { apiRequest } from '../../lib/api/config';
import { DigitalSignature } from './DigitalSignature';

interface MultipleSignatureProps {
  documentId: number;
  documentTitle: string;
  acceptanceText: string;
  requiredSigners: SignerInfo[];
  onAllSignaturesComplete: (signatures: CompletedSignature[]) => void;
  onCancel: () => void;
  allowPartialCompletion?: boolean;
}

interface SignerInfo {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role?: string;
  required: boolean;
  order?: number;
}

interface CompletedSignature {
  signerId: number;
  signatureId: number;
  status: 'completed' | 'pending' | 'failed';
  timestamp: string;
  documentHash: string;
  validationToken: string;
}

interface SignatureSession {
  id: string;
  documentId: number;
  status: 'active' | 'completed' | 'expired';
  createdAt: string;
  expiresAt: string;
  requiredSigners: SignerInfo[];
  completedSignatures: CompletedSignature[];
  currentSignerId?: number;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

interface MultipleSignatureSetupResponse {
  sessionId: string;
  qrCode: string;
  shareableLink: string;
  expiresAt: string;
}

interface SignatureStatusResponse {
  session: SignatureSession;
  canSign: boolean;
  isMyTurn: boolean;
  nextSigner?: SignerInfo;
}

export const MultipleSignature: React.FC<MultipleSignatureProps> = ({
  documentId,
  documentTitle,
  acceptanceText,
  requiredSigners,
  onAllSignaturesComplete,
  onCancel,
  allowPartialCompletion = false,
}) => {
  const { user } = useAuth();
  const [step, setStep] = useState<'setup' | 'waiting' | 'signing' | 'completed'>('setup');
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<SignatureSession | null>(null);
  const [sessionId, setSessionId] = useState<string>('');
  const [qrCode, setQrCode] = useState<string>('');
  const [shareableLink, setShareableLink] = useState<string>('');
  const [completedSignatures, setCompletedSignatures] = useState<CompletedSignature[]>([]);
  const [canSign, setCanSign] = useState(false);
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [pollInterval, setPollInterval] = useState<number | null>(null);

  useEffect(() => {
    if (sessionId) {
      startPollingStatus();
    }
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [sessionId]);

  const setupMultipleSignature = async () => {
    try {
      setLoading(true);
      
      const setupRequest = {
        documentId,
        requiredSigners: requiredSigners.map(signer => ({
          userId: signer.id,
          email: signer.email,
          required: signer.required,
          order: signer.order || 0,
        })),
        acceptanceText,
        allowPartialCompletion,
        expirationHours: 24, // 24 horas para completar todas las firmas
      };

      const response = await apiRequest<ApiResponse<MultipleSignatureSetupResponse>>(
        '/digital-signatures/setup-multiple',
        {
          method: 'POST',
          body: JSON.stringify(setupRequest),
        }
      );

      if (response.success) {
        setSessionId(response.data.sessionId);
        setQrCode(response.data.qrCode);
        setShareableLink(response.data.shareableLink);
        setStep('waiting');
        await checkSignatureStatus();
      } else {
        throw new Error(response.message || 'Error al configurar firmas múltiples');
      }
    } catch (error) {
      console.error('Error setting up multiple signature:', error);
      Alert.alert('Error', 'No se pudo configurar el proceso de firmas múltiples');
    } finally {
      setLoading(false);
    }
  };

  const checkSignatureStatus = async () => {
    if (!sessionId) return;

    try {
      const response = await apiRequest<ApiResponse<SignatureStatusResponse>>(
        `/digital-signatures/status/${sessionId}`,
        { method: 'GET' }
      );

      if (response.success) {
        const { session: sessionData, canSign: userCanSign, isMyTurn: userTurn } = response.data;
        
        setSession(sessionData);
        setCompletedSignatures(sessionData.completedSignatures);
        setCanSign(userCanSign);
        setIsMyTurn(userTurn);

        // Verificar si todas las firmas están completas
        const requiredSignatures = sessionData.requiredSigners.filter(s => s.required);
        const completedRequiredSignatures = sessionData.completedSignatures.filter(
          sig => requiredSignatures.some(req => req.id === sig.signerId && sig.status === 'completed')
        );

        if (completedRequiredSignatures.length === requiredSignatures.length) {
          setStep('completed');
          onAllSignaturesComplete(sessionData.completedSignatures);
          if (pollInterval) {
            clearInterval(pollInterval);
            setPollInterval(null);
          }
        }
      }
    } catch (error) {
      console.error('Error checking signature status:', error);
    }
  };

  const startPollingStatus = () => {
    if (pollInterval) {
      clearInterval(pollInterval);
    }
    
    const interval = setInterval(() => {
      checkSignatureStatus();
    }, 5000) as unknown as number; // Verificar cada 5 segundos
    
    setPollInterval(interval);
  };

  const handleMySignature = () => {
    if (!canSign || !isMyTurn) {
      Alert.alert('Error', 'No es su turno para firmar o no tiene permisos');
      return;
    }
    setShowSignatureModal(true);
  };

  const onSignatureComplete = async (signatureData: any) => {
    setShowSignatureModal(false);
    await checkSignatureStatus();
    
    Alert.alert(
      'Firma Completada',
      'Su firma ha sido registrada exitosamente. Esperando a los demás firmantes.',
      [{ text: 'OK' }]
    );
  };

  const shareSignatureLink = async () => {
    try {
      // En una implementación real, aquí usarías el Share API de React Native
      // o copiarías al clipboard
      Alert.alert(
        'Enlace de Firma',
        `Comparte este enlace con los firmantes:\n\n${shareableLink}`,
        [
          { text: 'Copiar', onPress: () => {
            // Implementar copia al clipboard
            console.log('Copying to clipboard:', shareableLink);
          }},
          { text: 'Cerrar' }
        ]
      );
    } catch (error) {
      console.error('Error sharing link:', error);
    }
  };

  const getSignerStatus = (signer: SignerInfo): 'pending' | 'completed' | 'current' => {
    const signature = completedSignatures.find(sig => sig.signerId === signer.id);
    if (signature && signature.status === 'completed') {
      return 'completed';
    }
    if (session?.currentSignerId === signer.id) {
      return 'current';
    }
    return 'pending';
  };

  const getStatusIcon = (status: 'pending' | 'completed' | 'current') => {
    switch (status) {
      case 'completed':
        return <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />;
      case 'current':
        return <Ionicons name="time" size={24} color="#FF9800" />;
      default:
        return <Ionicons name="ellipse-outline" size={24} color="#666" />;
    }
  };

  const renderSignerItem = ({ item: signer }: { item: SignerInfo }) => {
    const status = getSignerStatus(signer);
    const signature = completedSignatures.find(sig => sig.signerId === signer.id);
    
    return (
      <View style={styles.signerItem}>
        <View style={styles.signerInfo}>
          {getStatusIcon(status)}
          <View style={styles.signerDetails}>
            <Text style={styles.signerName}>
              {signer.firstName} {signer.lastName}
            </Text>
            <Text style={styles.signerEmail}>{signer.email}</Text>
            {signer.role && (
              <Text style={styles.signerRole}>{signer.role}</Text>
            )}
          </View>
        </View>
        
        <View style={styles.signerStatus}>
          {status === 'completed' && signature && (
            <Text style={styles.completedTime}>
              {new Date(signature.timestamp).toLocaleString()}
            </Text>
          )}
          {status === 'current' && (
            <Text style={styles.currentStatus}>Firmando...</Text>
          )}
          {signer.required && (
            <View style={styles.requiredBadge}>
              <Text style={styles.requiredText}>Requerido</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderSetupStep = () => (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="people" size={48} color="#007AFF" />
        <Text style={styles.title}>Firmas Múltiples</Text>
        <Text style={styles.subtitle}>{documentTitle}</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.sectionTitle}>Firmantes Requeridos</Text>
        
        <FlatList
          data={requiredSigners}
          renderItem={renderSignerItem}
          keyExtractor={(item) => item.id.toString()}
          scrollEnabled={false}
        />

        <View style={styles.infoContainer}>
          <Ionicons name="information-circle" size={20} color="#007AFF" />
          <Text style={styles.infoText}>
            Se creará una sesión de firma que permitirá a cada persona firmar
            desde su propio dispositivo. La sesión expira en 24 horas.
            Cada firmante deberá ingresar su propia contraseña para confirmar su firma.
          </Text>
        </View>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelButtonText}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.continueButton}
          onPress={setupMultipleSignature}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.continueButtonText}>Iniciar Proceso</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderWaitingStep = () => (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="hourglass" size={48} color="#007AFF" />
        <Text style={styles.title}>Proceso de Firmas</Text>
        <Text style={styles.subtitle}>Esperando firmas de los participantes</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>
            {completedSignatures.filter(s => s.status === 'completed').length} de{' '}
            {requiredSigners.filter(s => s.required).length} firmas completadas
          </Text>
          
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill,
                {
                  width: `${(
                    (completedSignatures.filter(s => s.status === 'completed').length /
                    requiredSigners.filter(s => s.required).length) * 100
                  )}%`
                }
              ]}
            />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Estado de Firmantes</Text>
        
        <FlatList
          data={requiredSigners}
          renderItem={renderSignerItem}
          keyExtractor={(item) => item.id.toString()}
          scrollEnabled={false}
        />

        {isMyTurn && canSign && (
          <TouchableOpacity
            style={styles.signButton}
            onPress={handleMySignature}
          >
            <Ionicons name="create" size={20} color="white" />
            <Text style={styles.signButtonText}>Es mi turno - Firmar Ahora</Text>
          </TouchableOpacity>
        )}

        <View style={styles.shareContainer}>
          <Text style={styles.shareTitle}>Compartir con Firmantes</Text>
          <TouchableOpacity
            style={styles.shareButton}
            onPress={shareSignatureLink}
          >
            <Ionicons name="share" size={20} color="#007AFF" />
            <Text style={styles.shareButtonText}>Compartir Enlace</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelButtonText}>Cancelar Proceso</Text>
        </TouchableOpacity>
        {allowPartialCompletion && completedSignatures.length > 0 && (
          <TouchableOpacity
            style={styles.partialCompleteButton}
            onPress={() => onAllSignaturesComplete(completedSignatures)}
          >
            <Text style={styles.partialCompleteButtonText}>Finalizar Parcial</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );

  const renderCompletedStep = () => (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="checkmark-circle" size={64} color="#4CAF50" />
        <Text style={styles.title}>Firmas Completadas</Text>
        <Text style={styles.subtitle}>Todas las firmas han sido registradas</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.completedInfo}>
          <Text style={styles.completedText}>
            El documento ha sido firmado por todos los participantes requeridos.
            Todas las firmas tienen validez legal.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Firmas Registradas</Text>
        
        <FlatList
          data={requiredSigners.filter(signer => 
            completedSignatures.some(sig => sig.signerId === signer.id && sig.status === 'completed')
          )}
          renderItem={renderSignerItem}
          keyExtractor={(item) => item.id.toString()}
          scrollEnabled={false}
        />
      </View>

      <TouchableOpacity
        style={styles.downloadButton}
        onPress={() => {
          // TODO: Implementar descarga de comprobante consolidado
          Alert.alert('Info', 'Función de descarga en desarrollo');
        }}
      >
        <Ionicons name="download" size={20} color="white" />
        <Text style={styles.downloadButtonText}>Descargar Comprobante</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  if (loading && step === 'setup') {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Configurando proceso de firmas...</Text>
      </View>
    );
  }

  return (
    <>
      {step === 'setup' && renderSetupStep()}
      {step === 'waiting' && renderWaitingStep()}
      {step === 'completed' && renderCompletedStep()}

      <Modal
        visible={showSignatureModal}
        animationType="slide"
        onRequestClose={() => setShowSignatureModal(false)}
      >
        <DigitalSignature
          documentId={documentId}
          documentTitle={documentTitle}
          acceptanceText={acceptanceText}
          onSignatureComplete={onSignatureComplete}
          onCancel={() => setShowSignatureModal(false)}
          requiresVisualSignature={true}
        />
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
    marginBottom: 16,
    marginTop: 20,
  },
  signerItem: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  signerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  signerDetails: {
    marginLeft: 12,
    flex: 1,
  },
  signerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  signerEmail: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  signerRole: {
    fontSize: 12,
    color: '#007AFF',
    marginTop: 2,
  },
  signerStatus: {
    alignItems: 'flex-end',
  },
  completedTime: {
    fontSize: 12,
    color: '#4CAF50',
    marginBottom: 4,
  },
  currentStatus: {
    fontSize: 12,
    color: '#FF9800',
    fontWeight: '500',
    marginBottom: 4,
  },
  requiredBadge: {
    backgroundColor: '#FF5722',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  requiredText: {
    fontSize: 10,
    color: 'white',
    fontWeight: '500',
  },
  infoContainer: {
    flexDirection: 'row',
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#1976D2',
    marginLeft: 8,
    lineHeight: 20,
  },
  progressContainer: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  progressText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 4,
  },
  signButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    marginTop: 20,
  },
  signButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  shareContainer: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  shareTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  shareButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  completedInfo: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 20,
  },
  completedText: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
    textAlign: 'center',
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
  partialCompleteButton: {
    flex: 1,
    backgroundColor: '#FF9800',
    padding: 16,
    borderRadius: 8,
    marginLeft: 10,
    alignItems: 'center',
  },
  partialCompleteButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
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
});