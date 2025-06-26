import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import FormRenderer from '../../components/forms/FormRenderer';
import useFormTemplates from '../../hooks/useFormTemplates';

interface RecurringActivity {
  id: string;
  name: string;
  description?: string;
  category: string;
  frequency: string;
  estimatedTime: number;
  requiresSignature: boolean;
  requiresPhotos: boolean;
  lastCompleted?: string;
  priority: 'low' | 'medium' | 'high';
}

export default function RecurringActivitiesScreen() {
  const router = useRouter();
  const {
    loading,
    error,
    getCategories,
    getTemplatesByCategory,
    getTemplatePreview,
    submitForm,
  } = useFormTemplates();

  const [activities, setActivities] = useState<RecurringActivity[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Datos mockup para actividades recurrentes
  const mockActivities: RecurringActivity[] = [
    {
      id: '1',
      name: 'Inspección de Seguridad Diaria',
      description: 'Revisión general de condiciones de seguridad en el área de trabajo',
      category: 'Inspecciones',
      frequency: 'Según necesidad',
      estimatedTime: 15,
      requiresSignature: true,
      requiresPhotos: true,
      lastCompleted: '2024-01-15',
      priority: 'high',
    },
    {
      id: '2',
      name: 'Verificación de EPP',
      description: 'Control del estado y uso correcto del equipo de protección personal',
      category: 'EPP',
      frequency: 'Diaria',
      estimatedTime: 10,
      requiresSignature: false,
      requiresPhotos: true,
      lastCompleted: '2024-01-15',
      priority: 'medium',
    },
    {
      id: '3',
      name: 'Inspección de Herramientas',
      description: 'Revisión del estado y funcionamiento de herramientas de trabajo',
      category: 'Herramientas',
      frequency: 'Semanal',
      estimatedTime: 30,
      requiresSignature: true,
      requiresPhotos: true,
      lastCompleted: '2024-01-10',
      priority: 'medium',
    },
    {
      id: '4',
      name: 'Evaluación de Riesgos del Área',
      description: 'Identificación y evaluación de riesgos potenciales en el área de trabajo',
      category: 'Evaluaciones',
      frequency: 'Cuando sea necesario',
      estimatedTime: 45,
      requiresSignature: true,
      requiresPhotos: false,
      lastCompleted: '2024-01-01',
      priority: 'high',
    },
    {
      id: '5',
      name: 'Limpieza y Orden (5S)',
      description: 'Verificación del cumplimiento de las 5S en el área de trabajo',
      category: 'Orden y Limpieza',
      frequency: 'Diaria',
      estimatedTime: 20,
      requiresSignature: false,
      requiresPhotos: true,
      lastCompleted: '2024-01-15',
      priority: 'low',
    },
    {
      id: '6',
      name: 'Reporte de Incidente',
      description: 'Formulario para reportar cualquier incidente de seguridad',
      category: 'Reportes',
      frequency: 'Cuando ocurra',
      estimatedTime: 10,
      requiresSignature: true,
      requiresPhotos: true,
      priority: 'high',
    },
    {
      id: '7',
      name: 'Solicitud de Mantenimiento',
      description: 'Solicitar reparación o mantenimiento de equipos',
      category: 'Mantenimiento',
      frequency: 'Según necesidad',
      estimatedTime: 5,
      requiresSignature: false,
      requiresPhotos: true,
      priority: 'medium',
    },
  ];

  useEffect(() => {
    loadActivities();
  }, []);

  const loadActivities = async () => {
    try {
      // En una implementación real, aquí cargarías las actividades recurrentes del usuario desde la API
      setActivities(mockActivities);
    } catch (err) {
      Alert.alert('Error', 'No se pudieron cargar las actividades recurrentes');
    }
  };

  const startActivity = async (activity: RecurringActivity) => {
    try {
      // En una implementación real, aquí cargarías el formulario correspondiente
      const templateData = await getTemplatePreview(activity.id);
      setSelectedActivity(templateData);
      setShowForm(true);
    } catch (err) {
      Alert.alert('Error', 'No se pudo cargar el formulario de la actividad');
    }
  };

  const handleSubmitForm = async (responses: any) => {
    try {
      const submission = {
        templateId: selectedActivity.id,
        responses,
        metadata: {
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString(),
          deviceInfo: 'React Native App',
          activityType: 'recurring',
        },
      };

      await submitForm(submission);
      
      Alert.alert(
        'Éxito',
        'Actividad completada correctamente',
        [
          {
            text: 'OK',
            onPress: () => {
              setShowForm(false);
              setSelectedActivity(null);
              loadActivities(); // Recargar para actualizar fechas
            },
          },
        ]
      );
    } catch (err) {
      Alert.alert('Error', 'No se pudo completar la actividad');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadActivities();
    setRefreshing(false);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return '#F44336';
      case 'medium':
        return '#FF9800';
      case 'low':
        return '#4CAF50';
      default:
        return '#9E9E9E';
    }
  };

  const getFrequencyIcon = (frequency: string) => {
    switch (frequency.toLowerCase()) {
      case 'diaria':
        return 'calendar';
      case 'semanal':
        return 'calendar-outline';
      case 'quincenal':
        return 'calendar-clear-outline';
      case 'mensual':
        return 'calendar-number-outline';
      default:
        return 'calendar';
    }
  };

  const getFrequencyBadgeColor = (frequency: string) => {
    switch (frequency.toLowerCase()) {
      case 'diaria':
        return '#3B82F6';
      case 'semanal':
        return '#8B5CF6';
      case 'según necesidad':
      case 'cuando sea necesario':
      case 'cuando ocurra':
        return '#10B981';
      default:
        return '#6B7280';
    }
  };

  const renderActivity = ({ item }: { item: RecurringActivity }) => (
    <TouchableOpacity
      style={styles.activityCard}
      onPress={() => startActivity(item)}
    >
      <View style={styles.activityHeader}>
        <View style={styles.activityTitle}>
          <Text style={styles.activityName}>{item.name}</Text>
          <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(item.priority) }]}>
            <Text style={styles.priorityText}>{item.priority.toUpperCase()}</Text>
          </View>
        </View>
      </View>

      {item.description && (
        <Text style={styles.activityDescription}>{item.description}</Text>
      )}

      <View style={styles.activityDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="folder-outline" size={16} color="#64748B" />
          <Text style={styles.detailText}>{item.category}</Text>
        </View>
        
        <View style={styles.detailRow}>
          <Ionicons name="refresh-outline" size={16} color="#64748B" />
          <Text style={styles.detailText}>{item.frequency}</Text>
        </View>

        <View style={styles.detailRow}>
          <Ionicons name="time-outline" size={16} color="#64748B" />
          <Text style={styles.detailText}>{item.estimatedTime} min</Text>
        </View>
      </View>

      <View style={styles.requirementsRow}>
        <View style={[styles.frequencyBadge, { backgroundColor: getFrequencyBadgeColor(item.frequency) }]}>
          <Text style={styles.frequencyText}>{item.frequency}</Text>
        </View>
        {item.requiresSignature && (
          <View style={styles.requirement}>
            <Ionicons name="create-outline" size={14} color="#0891B2" />
            <Text style={styles.requirementText}>Firma</Text>
          </View>
        )}
        {item.requiresPhotos && (
          <View style={styles.requirement}>
            <Ionicons name="camera-outline" size={14} color="#0891B2" />
            <Text style={styles.requirementText}>Fotos</Text>
          </View>
        )}
      </View>

      {item.lastCompleted && (
        <View style={styles.activityFooter}>
          <Text style={styles.lastCompletedText}>
            Última vez realizada: {new Date(item.lastCompleted).toLocaleDateString('es-ES')}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  if (showForm && selectedActivity) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              setShowForm(false);
              setSelectedActivity(null);
            }}
          >
            <Ionicons name="arrow-back" size={24} color="#0891B2" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Completar Actividad</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.formContainer}>
          <Text style={styles.formTitle}>{selectedActivity.name}</Text>
          <Text style={styles.formDescription}>
            Formulario para completar la actividad recurrente
          </Text>
          {/* Aquí iría el FormRenderer real cuando esté disponible */}
          <TouchableOpacity
            style={styles.completeButton}
            onPress={handleSubmitForm}
          >
            <Text style={styles.completeButtonText}>Completar Actividad</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Actividades Recurrentes</Text>
        <Text style={styles.headerSubtitle}>
          Formularios disponibles para realizar cuando los necesites
        </Text>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#0891B2" />
          <Text style={styles.loadingText}>Cargando actividades...</Text>
        </View>
      ) : (
        <FlatList
          data={activities}
          renderItem={renderActivity}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#0891B2']}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: 'white',
    padding: 20,
    paddingTop: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#64748b',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#64748B',
    fontSize: 16,
  },
  listContainer: {
    padding: 16,
  },
  activityCard: {
    backgroundColor: 'white',
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    borderLeftWidth: 4,
    borderLeftColor: '#e2e8f0',
  },
  frequencyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  frequencyText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
  },
  activityHeader: {
    marginBottom: 8,
  },
  activityTitle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  activityName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    flex: 1,
    marginRight: 8,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  priorityText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
  activityDescription: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 12,
    lineHeight: 20,
  },
  activityDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 4,
  },
  detailText: {
    fontSize: 12,
    color: '#64748b',
    marginLeft: 4,
  },
  requirementsRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  requirement: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  requirementText: {
    fontSize: 11,
    color: '#0891B2',
    marginLeft: 4,
    fontWeight: '500',
  },
  activityFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  lastCompletedText: {
    fontSize: 12,
    color: '#64748b',
    fontStyle: 'italic',
  },
  backButton: {
    padding: 8,
  },
  placeholder: {
    width: 40,
  },
  formContainer: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  formTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 8,
    textAlign: 'center',
  },
  formDescription: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 32,
  },
  completeButton: {
    backgroundColor: '#0891B2',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  completeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
}); 