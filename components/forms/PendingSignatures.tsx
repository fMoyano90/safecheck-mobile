import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  Modal,
  TextInput,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { User } from '../../lib/api';
import { authApi } from '../../lib/api';
import { apiRequest } from '../../lib/api/config';

const { width: screenWidth } = Dimensions.get('window');

interface PendingSignature {
  user: User;
  status: 'pending' | 'signed' | 'current';
  signedAt?: Date;
  signature?: string;
}

interface PendingSignaturesProps {
  pendingSignatures: PendingSignature[];
  onSignatureComplete: (userId: number, signature: string) => void;
  onRemoveUser: (userId: number) => void;
  onClose: () => void;
  allowLocalSigning?: boolean;
  documentTitle?: string;
}

export const PendingSignatures: React.FC<PendingSignaturesProps> = ({
  pendingSignatures,
  onSignatureComplete,
  onRemoveUser,
  onClose,
  allowLocalSigning = true,
  documentTitle = 'Documento',
}) => {
  const [currentSigningUser, setCurrentSigningUser] = useState<User | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState('');
  const [verifyingPassword, setVerifyingPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [creatingSignature, setCreatingSignature] = useState(false);

  const getRoleColor = (role: string): string => {
    switch (role.toLowerCase()) {
      case 'supervisor':
        return '#FF9800';
      case 'worker':
        return '#4CAF50';
      case 'admin':
        return '#9C27B0';
      default:
        return '#666';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'signed':
        return <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />;
      case 'current':
        return <Ionicons name="time" size={24} color="#FF9800" />;
      case 'pending':
      default:
        return <Ionicons name="ellipse-outline" size={24} color="#ccc" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'signed':
        return 'Firmado';
      case 'current':
        return 'En turno';
      case 'pending':
      default:
        return 'Pendiente';
    }
  };

  const handleLocalSign = (user: User) => {
    setCurrentSigningUser(user);
    setPassword('');
    setAcceptedTerms(false);
    setShowPasswordModal(true);
  };

  const createAutomaticSignature = async () => {
    if (!currentSigningUser) return;

    try {
      setCreatingSignature(true);

      // Simular proceso de firma digital
      const signatureRequest = {
        documentTitle: documentTitle,
        acceptanceText: `Acepto los términos y condiciones de este documento como ${currentSigningUser.firstName} ${currentSigningUser.lastName}`,
        signatureMethod: 'acceptance_checkbox',
        userId: currentSigningUser.id,
        timestamp: new Date(),
      };

      // Simular datos de firma
      const signatureData = {
        signatureId: `sig_${Date.now()}_${currentSigningUser.id}`,
        documentHash: `hash_${Date.now()}`,
        signedAt: new Date(),
        user: currentSigningUser,
        status: 'signed' as const,
      };

      // Simular delay de procesamiento
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Llamar al callback con la firma completada
      onSignatureComplete(currentSigningUser.id, JSON.stringify(signatureData));
      
      Alert.alert('Éxito', `Firma de ${currentSigningUser.firstName} ${currentSigningUser.lastName} registrada exitosamente`);
      
      // Limpiar estados
      setShowPasswordModal(false);
      setPassword('');
      setAcceptedTerms(false);
      setCurrentSigningUser(null);
      
    } catch (error) {
      console.error('Error creating signature:', error);
      Alert.alert('Error', 'No se pudo completar la firma');
    } finally {
      setCreatingSignature(false);
    }
  };

  const verifyPasswordAndSign = async () => {
    if (!currentSigningUser || !password.trim()) {
      Alert.alert('Error', 'Por favor ingresa la contraseña');
      return;
    }

    if (!acceptedTerms) {
      Alert.alert('Error', 'Debe aceptar los términos y condiciones para continuar');
      return;
    }

    try {
      setVerifyingPassword(true);
      
      // Verificar contraseña del usuario
      const response = await authApi.verifyPassword({ password });
      
      if (response.valid) {
        // Una vez verificada la contraseña, crear la firma automáticamente
        await createAutomaticSignature();
      } else {
        Alert.alert('Error', 'Contraseña incorrecta');
      }
    } catch (error) {
      console.error('Error verifying password:', error);
      Alert.alert('Error', 'No se pudo verificar la contraseña');
    } finally {
      setVerifyingPassword(false);
    }
  };


  const handleRemoveUser = (userId: number) => {
    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que quieres remover este usuario de la lista de firmas?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Remover', style: 'destructive', onPress: () => onRemoveUser(userId) },
      ]
    );
  };

  const renderSignatureItem = ({ item }: { item: PendingSignature }) => {
    const { user, status, signedAt } = item;
    
    return (
      <View style={[
        styles.signatureItem, 
        status === 'signed' && styles.signatureItemSigned,
        status === 'current' && styles.signatureItemCurrent
      ]}>
        {/* Status indicator stripe */}
        <View style={[
          styles.statusStripe,
          { backgroundColor: status === 'signed' ? '#4CAF50' : status === 'current' ? '#FF9800' : '#E0E0E0' }
        ]} />
        
        <View style={styles.itemContent}>
          <View style={styles.userInfo}>
            <View style={[styles.avatar, { backgroundColor: getRoleColor(user.role) }]}>
              <Text style={styles.avatarText}>
                {user.firstName.charAt(0)}{user.lastName.charAt(0)}
              </Text>
              {status === 'signed' && (
                <View style={styles.avatarBadge}>
                  <Ionicons name="checkmark" size={12} color="white" />
                </View>
              )}
            </View>
            
            <View style={styles.userDetails}>
              <Text style={styles.userName}>
                {user.firstName} {user.lastName}
              </Text>
              <Text style={styles.userEmail}>{user.email}</Text>
              {user.position && (
                <Text style={styles.userPosition}>{user.position}</Text>
              )}
              
              {/* Role badge */}
              <View style={[styles.roleBadge, { backgroundColor: getRoleColor(user.role) }]}>
                <Text style={styles.roleText}>
                  {user.role === 'supervisor' ? 'Supervisor' : 'Trabajador'}
                </Text>
              </View>
            </View>
          </View>
          
          {/* Status section */}
          <View style={styles.statusSection}>
            <View style={[
              styles.statusBadge,
              { backgroundColor: status === 'signed' ? '#E8F5E8' : status === 'current' ? '#FFF3E0' : '#F5F5F5' }
            ]}>
              {getStatusIcon(status)}
              <Text style={[
                styles.statusText, 
                { color: status === 'signed' ? '#4CAF50' : status === 'current' ? '#FF9800' : '#666' }
              ]}>
                {getStatusText(status)}
              </Text>
            </View>
            
            {signedAt && (
              <View style={styles.signedTimeContainer}>
                <Ionicons name="time-outline" size={12} color="#999" />
                <Text style={styles.signedTime}>
                  {signedAt.toLocaleString('es-ES', { 
                    day: '2-digit', 
                    month: '2-digit', 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </Text>
              </View>
            )}
          </View>
          
          {/* Actions */}
          <View style={styles.actions}>
            {status === 'pending' && allowLocalSigning && (
              <TouchableOpacity
                style={styles.signButton}
                onPress={() => handleLocalSign(user)}
              >
                <Ionicons name="create-outline" size={18} color="#007AFF" />
                <Text style={styles.signButtonText}>Firmar</Text>
              </TouchableOpacity>
            )}
            
            {status === 'pending' && (
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => handleRemoveUser(user.id)}
              >
                <Ionicons name="close-circle-outline" size={20} color="#FF3B30" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  const completedCount = pendingSignatures.filter(sig => sig.status === 'signed').length;
  const totalCount = pendingSignatures.length;

  return (
    <View style={styles.container}>
      {/* Navigation Header */}
      <View style={styles.navigationHeader}>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Ionicons name="chevron-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.navigationTitle}>Gestión de Firmas</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Header mejorado */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.titleSection}>
            <Ionicons name="document-text-outline" size={24} color="#2196F3" />
            <Text style={styles.title}>Estado de Firmas</Text>
          </View>
          <View style={styles.progressSection}>
            <Text style={styles.progressNumber}>{completedCount}/{totalCount}</Text>
            <Text style={styles.progressLabel}>completadas</Text>
          </View>
        </View>
        
        {/* Barra de progreso mejorada */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }
              ]} 
            />
          </View>
          <Text style={styles.progressPercentage}>
            {totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0}%
          </Text>
        </View>
        
        {/* Status general */}
        <View style={styles.statusContainer}>
          {completedCount === totalCount && totalCount > 0 ? (
            <View style={styles.statusCompleted}>
              <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
              <Text style={styles.statusCompletedText}>Todas las firmas completadas</Text>
            </View>
          ) : (
            <View style={styles.statusPending}>
              <Ionicons name="time-outline" size={16} color="#FF9800" />
              <Text style={styles.statusPendingText}>
                {totalCount - completedCount} firma{totalCount - completedCount !== 1 ? 's' : ''} pendiente{totalCount - completedCount !== 1 ? 's' : ''}
              </Text>
            </View>
          )}
        </View>
      </View>

      <FlatList
        data={pendingSignatures}
        renderItem={renderSignatureItem}
        keyExtractor={(item) => item.user.id.toString()}
        showsVerticalScrollIndicator={false}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIcon}>
              <Ionicons name="people-outline" size={64} color="#E0E0E0" />
            </View>
            <Text style={styles.emptyTitle}>No hay firmas pendientes</Text>
            <Text style={styles.emptyText}>
              Los usuarios seleccionados aparecerán aquí para gestionar sus firmas
            </Text>
          </View>
        }
      />

      {/* Modal para verificar contraseña y términos */}
      <Modal
        visible={showPasswordModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPasswordModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.passwordModal}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Header */}
              <View style={styles.modalHeader}>
                <Ionicons name="document-text" size={32} color="#2196F3" />
                <Text style={styles.modalTitle}>Firma Digital</Text>
                <Text style={styles.modalSubtitle}>
                  Confirmación de firma para:
                </Text>
                <Text style={styles.signingAsUser}>
                  {currentSigningUser?.firstName} {currentSigningUser?.lastName}
                </Text>
              </View>

              {/* Términos y condiciones */}
              <View style={styles.termsSection}>
                <Text style={styles.termsTitle}>Términos y Condiciones</Text>
                <View style={styles.termsContainer}>
                  <Text style={styles.termsText}>
                    Al firmar este documento digitalmente, usted acepta que:
                  </Text>
                  <Text style={styles.termsBullet}>
                    • La firma digital tiene la misma validez legal que una firma manuscrita
                  </Text>
                  <Text style={styles.termsBullet}>
                    • Se registrará la fecha, hora y ubicación de la firma
                  </Text>
                  <Text style={styles.termsBullet}>
                    • La firma será vinculante y no repudiable
                  </Text>
                  <Text style={styles.termsBullet}>
                    • Acepta la responsabilidad del contenido del documento
                  </Text>
                </View>

                {/* Checkbox de aceptación */}
                <TouchableOpacity
                  style={styles.checkboxContainer}
                  onPress={() => setAcceptedTerms(!acceptedTerms)}
                >
                  <View style={[styles.checkbox, acceptedTerms && styles.checkboxChecked]}>
                    {acceptedTerms && <Ionicons name="checkmark" size={16} color="white" />}
                  </View>
                  <Text style={styles.checkboxText}>
                    Acepto los términos y condiciones de este documento
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Campo de contraseña */}
              <View style={styles.passwordSection}>
                <Text style={styles.passwordLabel}>Ingresa tu contraseña para confirmar:</Text>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Contraseña"
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                  autoFocus={false}
                />
              </View>
            </ScrollView>

            {/* Botones */}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelModalButton}
                onPress={() => {
                  setShowPasswordModal(false);
                  setPassword('');
                  setAcceptedTerms(false);
                  setCurrentSigningUser(null);
                }}
              >
                <Text style={styles.cancelModalButtonText}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.verifyButton, 
                  (verifyingPassword || creatingSignature || !password.trim() || !acceptedTerms) && styles.verifyButtonDisabled
                ]}
                onPress={verifyPasswordAndSign}
                disabled={verifyingPassword || creatingSignature || !password.trim() || !acceptedTerms}
              >
                <Text style={styles.verifyButtonText}>
                  {verifyingPassword ? 'Verificando...' : creatingSignature ? 'Firmando...' : 'Firmar Documento'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  navigationHeader: {
    backgroundColor: 'white',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F0F8FF',
  },
  navigationTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'center',
    flex: 1,
  },
  headerSpacer: {
    width: 40,
  },
  header: {
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    marginBottom: 16,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  titleSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginLeft: 8,
  },
  progressSection: {
    alignItems: 'flex-end',
  },
  progressNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  progressLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: -2,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#E3F2FD',
    borderRadius: 4,
    marginRight: 12,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2196F3',
    borderRadius: 4,
    minWidth: 8,
  },
  progressPercentage: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2196F3',
    minWidth: 35,
    textAlign: 'right',
  },
  statusContainer: {
    alignItems: 'center',
  },
  statusCompleted: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E8',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusCompletedText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '500',
    marginLeft: 6,
  },
  statusPending: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusPendingText: {
    fontSize: 14,
    color: '#FF9800',
    fontWeight: '500',
    marginLeft: 6,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  itemSeparator: {
    height: 12,
  },
  signatureItem: {
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    flexDirection: 'row',
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  signatureItemSigned: {
    borderColor: '#4CAF50',
    backgroundColor: '#FAFFFE',
  },
  signatureItemCurrent: {
    borderColor: '#FF9800',
    backgroundColor: '#FFFEF9',
  },
  statusStripe: {
    width: 4,
  },
  itemContent: {
    flex: 1,
    padding: 16,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  avatarText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  avatarBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  userDetails: {
    marginLeft: 12,
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  userPosition: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  roleText: {
    fontSize: 10,
    color: 'white',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  statusSection: {
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 4,
  },
  statusText: {
    fontSize: 12,
    marginLeft: 6,
    fontWeight: '600',
  },
  signedTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  signedTime: {
    fontSize: 11,
    color: '#999',
    marginLeft: 4,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  signButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    elevation: 1,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  signButtonText: {
    color: '#007AFF',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  removeButton: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: '#FFEBEE',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  passwordModal: {
    backgroundColor: 'white',
    borderRadius: 16,
    width: screenWidth * 0.9,
    maxWidth: 400,
    maxHeight: '80%',
  },
  modalHeader: {
    alignItems: 'center',
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1A1A1A',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  signingAsUser: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2196F3',
    textAlign: 'center',
  },
  termsSection: {
    padding: 24,
    paddingBottom: 16,
  },
  termsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  termsContainer: {
    backgroundColor: '#F8F9FA',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  termsText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
    lineHeight: 20,
  },
  termsBullet: {
    fontSize: 13,
    color: '#555',
    marginBottom: 6,
    marginLeft: 8,
    lineHeight: 18,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#2196F3',
    borderRadius: 4,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: '#2196F3',
  },
  checkboxText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    flex: 1,
  },
  passwordSection: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  passwordLabel: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
    fontWeight: '500',
  },
  passwordInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#F8F9FA',
  },
  modalButtons: {
    flexDirection: 'row',
    padding: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  cancelModalButton: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    padding: 14,
    borderRadius: 8,
    marginRight: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  cancelModalButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '500',
  },
  verifyButton: {
    flex: 1,
    backgroundColor: '#2196F3',
    padding: 14,
    borderRadius: 8,
    marginLeft: 8,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  verifyButtonDisabled: {
    backgroundColor: '#B0BEC5',
    elevation: 0,
    shadowOpacity: 0,
  },
  verifyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});