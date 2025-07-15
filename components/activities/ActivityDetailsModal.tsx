import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

interface ActivityTemplate {
  id: number;
  name: string;
  description?: string;
  status: 'pending' | 'submitted' | 'approved' | 'rejected';
}

interface ActivityDetails {
  id: number;
  assignedDate: string;
  dueDate: string;
  status: 'pending' | 'completed' | 'approved' | 'rejected' | 'overdue';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  contract?: {
    name: string;
  };
  assignedBy?: {
    firstName: string;
    lastName: string;
  };
  templates: ActivityTemplate[];
  observations?: string;
  reviewNotes?: string;
  location?: string;
}

interface ActivityDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  activity: ActivityDetails | null;
  onCompleteActivity: (activityId: number) => Promise<void>;
  onRefresh?: () => void;
}

const ActivityDetailsModal: React.FC<ActivityDetailsModalProps> = ({
  visible,
  onClose,
  activity,
  onCompleteActivity,
  onRefresh,
}) => {
  const [isCompleting, setIsCompleting] = useState(false);

  if (!activity) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#ff6d00'; // Núcleo Gestor Orange
      case 'submitted': return '#0066cc'; // Núcleo Gestor Blue
      case 'completed': return '#10B981';
      case 'approved': return '#059669';
      case 'rejected': return '#EF4444';
      case 'overdue': return '#DC2626';
      default: return '#6B7280';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Pendiente';
      case 'submitted': return 'Enviado';
      case 'completed': return 'Completada';
      case 'approved': return 'Aprobada';
      case 'rejected': return 'Rechazada';
      case 'overdue': return 'Vencida';
      default: return status;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return '#DC2626';
      case 'high': return '#EF4444';
      case 'medium': return '#ff6d00'; // Núcleo Gestor Orange
      case 'low': return '#10B981';
      default: return '#6B7280';
    }
  };

  const getPriorityText = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'Urgente';
      case 'high': return 'Alta';
      case 'medium': return 'Media';
      case 'low': return 'Baja';
      default: return priority;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const allFormsSubmitted = activity.templates.every(
    template => template.status === 'submitted' || template.status === 'approved'
  );

  const canCompleteActivity = (activity.status === 'pending' || activity.status === 'overdue') && allFormsSubmitted;

  const handleOpenForm = (templateId: number) => {
    router.push(`/form-demo?activityId=${activity.id}&activityType=scheduled&templateId=${templateId}`);
    onClose();
  };

  const handleCompleteActivity = async () => {
    if (!canCompleteActivity) return;

    Alert.alert(
      'Completar Actividad',
      '¿Estás seguro de que deseas marcar esta actividad como completada? Todos los formularios han sido enviados.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Completar',
          style: 'default',
          onPress: async () => {
            setIsCompleting(true);
            try {
              await onCompleteActivity(activity.id);
              onRefresh?.();
              onClose();
            } catch (error) {
              Alert.alert('Error', 'No se pudo completar la actividad. Inténtalo de nuevo.');
            } finally {
              setIsCompleting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#2c3e50" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Detalles de Actividad</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Estado y Prioridad */}
          <View style={styles.statusContainer}>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(activity.status) }]}>
              <Text style={styles.statusText}>{getStatusText(activity.status)}</Text>
            </View>
            <View style={[styles.priorityBadge, { borderColor: getPriorityColor(activity.priority) }]}>
              <Text style={[styles.priorityText, { color: getPriorityColor(activity.priority) }]}>
                {getPriorityText(activity.priority)}
              </Text>
            </View>
          </View>

          {/* Información General */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Información General</Text>
            
            {activity.contract && (
              <View style={styles.infoRow}>
                <Ionicons name="document-text-outline" size={20} color="#ff6d00" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Contrato</Text>
                  <Text style={styles.infoValue}>{activity.contract.name}</Text>
                </View>
              </View>
            )}

            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={20} color="#ff6d00" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Ubicación</Text>
                <Text style={styles.infoValue}>{activity.location || 'Sin especificar'}</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <Ionicons name="calendar-outline" size={20} color="#ff6d00" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Fecha Asignada</Text>
                <Text style={styles.infoValue}>{formatDate(activity.assignedDate)}</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <Ionicons name="time-outline" size={20} color="#ff6d00" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Fecha Límite</Text>
                <Text style={styles.infoValue}>{formatDate(activity.dueDate)}</Text>
              </View>
            </View>

            {activity.assignedBy && (
              <View style={styles.infoRow}>
                <Ionicons name="person-outline" size={20} color="#ff6d00" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Asignado por</Text>
                  <Text style={styles.infoValue}>{activity.assignedBy.firstName} {activity.assignedBy.lastName}</Text>
                </View>
              </View>
            )}
          </View>

          {/* Formularios */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Formularios ({activity.templates.length})
            </Text>
            
            {activity.templates.map((template, index) => (
              <View key={template.id} style={styles.templateCard}>
                <View style={styles.templateHeader}>
                  <View style={styles.templateInfo}>
                    <Text style={styles.templateName}>{template.name}</Text>
                    {template.description && (
                      <Text style={styles.templateDescription}>{template.description}</Text>
                    )}
                  </View>
                  <View style={[styles.templateStatus, { backgroundColor: getStatusColor(template.status) }]}>
                    <Text style={styles.templateStatusText}>{getStatusText(template.status)}</Text>
                  </View>
                </View>

                <View style={styles.templateActions}>
                  {template.status === 'pending' && (
                    <TouchableOpacity
                      style={styles.openFormButton}
                      onPress={() => handleOpenForm(template.id)}
                    >
                      <Ionicons name="document-text" size={16} color="white" />
                      <Text style={styles.openFormButtonText}>Abrir Formulario</Text>
                    </TouchableOpacity>
                  )}
                  
                  {template.status === 'rejected' && (
                    <TouchableOpacity
                      style={[styles.openFormButton, styles.retryButton]}
                      onPress={() => handleOpenForm(template.id)}
                    >
                      <Ionicons name="refresh" size={16} color="white" />
                      <Text style={styles.openFormButtonText}>Reintentar</Text>
                    </TouchableOpacity>
                  )}

                  {(template.status === 'submitted' || template.status === 'approved') && (
                    <View style={styles.completedIndicator}>
                      <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                      <Text style={styles.completedText}>
                        {template.status === 'approved' ? 'Aprobado' : 'Enviado'}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>

          {/* Observaciones */}
          {activity.observations && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Observaciones</Text>
              <Text style={styles.observationsText}>{activity.observations}</Text>
            </View>
          )}

          {/* Notas de Revisión */}
          {activity.reviewNotes && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Notas de Revisión</Text>
              <Text style={styles.reviewNotesText}>{activity.reviewNotes}</Text>
            </View>
          )}
        </ScrollView>

        {/* Botón de Completar */}
        {canCompleteActivity && (
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.completeButton, isCompleting && styles.completeButtonDisabled]}
              onPress={handleCompleteActivity}
              disabled={isCompleting}
            >
              {isCompleting ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Ionicons name="checkmark-circle" size={20} color="white" />
              )}
              <Text style={styles.completeButtonText}>
                {isCompleting ? 'Completando...' : 'Marcar como Completada'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e8ed',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  statusContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  priorityBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 2,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  priorityText: {
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#7f8c8d',
    marginBottom: 4,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 16,
    color: '#2c3e50',
    fontWeight: '600',
  },
  templateCard: {
    borderWidth: 1,
    borderColor: '#e1e8ed',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    backgroundColor: '#fafbfc',
  },
  templateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  templateInfo: {
    flex: 1,
    marginRight: 12,
  },
  templateName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 4,
  },
  templateDescription: {
    fontSize: 14,
    color: '#7f8c8d',
  },
  templateStatus: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  templateStatusText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
  },
  templateActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  openFormButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0066cc', // Núcleo Gestor Blue
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    shadowColor: '#0066cc',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  retryButton: {
    backgroundColor: '#EF4444',
    shadowColor: '#EF4444',
  },
  openFormButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  completedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  completedText: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '600',
  },
  observationsText: {
    fontSize: 15,
    color: '#34495e',
    lineHeight: 22,
  },
  reviewNotesText: {
    fontSize: 15,
    color: '#34495e',
    lineHeight: 22,
    backgroundColor: '#fff3cd',
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#ff6d00', // Núcleo Gestor Orange
  },
  footer: {
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
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#ff6d00', // Núcleo Gestor Orange
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#ff6d00',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  completeButtonDisabled: {
    backgroundColor: '#9CA3AF',
    shadowColor: '#9CA3AF',
  },
  completeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default ActivityDetailsModal;