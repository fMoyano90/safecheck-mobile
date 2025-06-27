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
import { recurringActivitiesApi, type RecurringActivity as APIRecurringActivity } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import FormButton from '@/components/activities/FormButton';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { RefreshIndicator } from '../../components/ui/RefreshIndicator';

interface RecurringActivity {
  id: number;
  name: string;
  description?: string;
  category: string;
  frequency: string;
  estimatedTime: number;
  requiresSignature: boolean;
  requiresPhotos: boolean;
  lastCompleted?: string;
  templates?: string[];
  status?: string;
  contract?: string;
}

export default function RecurringActivitiesScreen() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const {
    loading: formLoading,
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
  const [loading, setLoading] = useState(false);



  // Función para convertir APIRecurringActivity a RecurringActivity local
  const convertToRecurringActivity = (activity: APIRecurringActivity): RecurringActivity => {
    // Determinar categoría basada en template
    let category = 'General';
    let templates: string[] = [];
    if (activity.template) {
      // Usar la categoría del template
      if (activity.template.category) {
        category = activity.template.category.name;
      }
      templates = [activity.template.name];
    }

    // Título basado en el template
    let name = 'Actividad Recurrente';
    if (activity.template) {
      name = activity.template.name;
    }

    // Determinar frecuencia basada en el tipo del template
    let frequency = 'Según necesidad';
    if (activity.template?.type) {
      switch (activity.template.type.toLowerCase()) {
        case 'daily': frequency = 'Diaria'; break;
        case 'weekly': frequency = 'Semanal'; break;
        case 'monthly': frequency = 'Mensual'; break;
        case 'inspection': frequency = 'Diaria'; break;
        case 'report': frequency = 'Según necesidad'; break;
        default: frequency = 'Según necesidad';
      }
    }

    return {
      id: activity.id,
      name,
      description: activity.template?.description || 'Sin descripción adicional',
      category,
      frequency,
      estimatedTime: 30, // Valor por defecto
      requiresSignature: false,
      requiresPhotos: false,
      lastCompleted: activity.lastCompleted,
      templates,
      status: activity.status,
    };
  };

  useEffect(() => {
    if (user && !isLoading) {
      loadActivities();
    }
  }, [user, isLoading]);

  const loadActivities = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Cargar actividades recurrentes del usuario
      const userRecurringActivities = await recurringActivitiesApi.getMyRecurringActivities();
      
      // Convertir a formato local
      const convertedActivities = userRecurringActivities.map(convertToRecurringActivity);
      
      setActivities(convertedActivities);
    } catch (err) {
      console.error('Error loading recurring activities:', err);
      Alert.alert('Error', 'No se pudieron cargar las actividades recurrentes');
      setActivities([]);
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh inteligente de actividades
  const { recordInteraction, hasUpdates, clearUpdates } = useAutoRefresh({
    refreshFunction: loadActivities,
    interval: 120000, // 2 minutos cuando hay actividad
    backgroundInterval: 300000, // 5 minutos cuando no hay actividad
    enabled: !!user && !isLoading,
    pauseOnInteraction: true,
  });

  const startActivity = async (activity: RecurringActivity) => {
    try {
      // En una implementación real, aquí cargarías el formulario correspondiente
      const templateData = await getTemplatePreview(activity.id.toString());
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

  const getFrequencyIcon = (frequency: string) => {
    switch (frequency.toLowerCase()) {
      case 'diaria':
      case 'daily':
        return 'calendar';
      case 'semanal':
      case 'weekly':
        return 'calendar-outline';
      case 'mensual':
      case 'monthly':
        return 'calendar-clear';
      default:
        return 'refresh';
    }
  };

  const getFrequencyBadgeColor = (frequency: string) => {
    switch (frequency.toLowerCase()) {
      case 'diaria':
      case 'daily':
        return '#EF4444';
      case 'semanal':
      case 'weekly':
        return '#F59E0B';
      case 'mensual':
      case 'monthly':
        return '#10B981';
      default:
        return '#6B7280';
    }
  };

  const renderActivity = ({ item }: { item: RecurringActivity }) => (
    <View style={styles.activityCard}>
      <View style={styles.activityHeader}>
        <View style={styles.activityTitle}>
          <Text style={styles.activityName}>{item.name}</Text>
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

      <View style={styles.activityActions}>
        <FormButton
          activityId={item.id}
          activityType="recurring"
          activityName={item.name}
          size="medium"
          variant="primary"
        />
      </View>
    </View>
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

  // Mostrar loading si el usuario se está autenticando o cargando actividades
  if (isLoading || loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#0891B2" />
          <Text style={styles.loadingText}>
            {isLoading ? 'Verificando autenticación...' : 'Cargando actividades recurrentes...'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Si no hay usuario autenticado, mostrar mensaje
  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>Necesitas iniciar sesión para ver tus actividades recurrentes</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <RefreshIndicator
        visible={hasUpdates}
        onRefresh={() => {
          clearUpdates();
          onRefresh();
        }}
        message="Nuevas actividades disponibles"
      />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Actividades Recurrentes</Text>
        <Text style={styles.headerSubtitle}>
          Formularios disponibles para realizar cuando los necesites
        </Text>
      </View>

      <FlatList
        data={activities}
        renderItem={renderActivity}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={[
          styles.listContainer,
          activities.length === 0 && styles.emptyContainer
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#0891B2']}
          />
        }
        onScrollBeginDrag={recordInteraction}
        onTouchStart={recordInteraction}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="repeat-outline" size={64} color="#94A3B8" />
            <Text style={styles.emptyTitle}>Sin actividades recurrentes</Text>
            <Text style={styles.emptyText}>
              No tienes actividades recurrentes asignadas en este momento.
            </Text>
          </View>
        }
      />
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 32,
  },
  activityActions: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
}); 