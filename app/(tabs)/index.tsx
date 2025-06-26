import { StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { Text, View } from '@/components/Themed';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { activitiesApi, type Activity, recurringActivitiesApi, type RecurringActivity } from '@/lib/api';
import React, { useState, useEffect } from 'react';
import FormButton from '@/components/activities/FormButton';

// Tipos locales para el componente
type LocalActivity = {
  id: number;
  time: string;
  title: string;
  location: string;
  type: string;
  priority: string;
  status: string;
};

type QuickAction = {
  id: string;
  title: string;
  description: string;
  icon: string;
  route: string;
  color: string;
};

// Función para convertir Activity del backend a LocalActivity para mostrar
const convertToLocalActivity = (activity: Activity): LocalActivity => {
  const assignedDate = new Date(activity.assignedDate);
  const time = assignedDate.toLocaleTimeString('es-ES', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  });
  
  // Determinar el título basado en los templates
  let title = 'Actividad';
  if (activity.templates && activity.templates.length > 0) {
    if (activity.templates.length === 1) {
      title = activity.templates[0].name;
    } else {
      title = `${activity.templates[0].name} (+${activity.templates.length - 1} más)`;
    }
  }
  
  // Determinar tipo basado en la categoría del template
  let type = 'task';
  if (activity.templates && activity.templates.length > 0 && activity.templates[0].category) {
    const categoryName = activity.templates[0].category.name.toLowerCase();
    if (categoryName.includes('inspección') || categoryName.includes('inspection')) type = 'inspection';
    else if (categoryName.includes('capacitación') || categoryName.includes('training')) type = 'training';
    else if (categoryName.includes('evaluación') || categoryName.includes('evaluation')) type = 'evaluation';
    else if (categoryName.includes('reunión') || categoryName.includes('meeting')) type = 'meeting';
  }
  
  return {
    id: activity.id,
    time,
    title,
    location: activity.contract?.name || 'Ubicación no especificada',
    type,
    priority: activity.priority,
    status: activity.status,
  };
};

// Función para convertir RecurringActivity del backend a LocalActivity para mostrar
const convertRecurringToLocalActivity = (recurringActivity: RecurringActivity): LocalActivity => {
  // Para actividades recurrentes, no hay hora específica
  const time = 'Diario';
  
  // Título basado en el template
  let title = 'Actividad Recurrente';
  if (recurringActivity.template) {
    title = recurringActivity.template.name;
  }
  
  // Determinar tipo basado en la categoría del template
  let type = 'recurring';
  if (recurringActivity.template?.category) {
    const categoryName = recurringActivity.template.category.name.toLowerCase();
    if (categoryName.includes('inspección') || categoryName.includes('inspection')) type = 'inspection';
    else if (categoryName.includes('capacitación') || categoryName.includes('training')) type = 'training';
    else if (categoryName.includes('evaluación') || categoryName.includes('evaluation')) type = 'evaluation';
    else if (categoryName.includes('reunión') || categoryName.includes('meeting')) type = 'meeting';
  }
  
  return {
    id: recurringActivity.id,
    time,
    title,
    location: recurringActivity.template?.category?.name || 'Sin categoría',
    type,
    priority: 'medium', // Las actividades recurrentes no tienen prioridad definida
    status: recurringActivity.status === 'active' ? 'pending' : 'completed',
  };
};

export default function HomeScreen() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [todayActivities, setTodayActivities] = useState<LocalActivity[]>([]);
  const [completedActivities, setCompletedActivities] = useState<LocalActivity[]>([]);
  const [upcomingActivities, setUpcomingActivities] = useState<Activity[]>([]);
  const [recurringActivities, setRecurringActivities] = useState<RecurringActivity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  const currentDate = new Date();
  const dateString = currentDate.toLocaleDateString('es-ES', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  // Determinar el saludo según la hora
  const getGreeting = () => {
    const hour = currentDate.getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 18) return 'Buenas tardes';
    return 'Buenas noches';
  };

  // Obtener el nombre del usuario
  const getUserName = () => {
    if (!user) return 'Usuario';
    
    const firstName = user.firstName || '';
    const lastName = user.lastName || '';
    
    // Si tiene ambos nombres, usar solo el primer nombre
    if (firstName && lastName) {
      return firstName;
    }
    
    // Si solo tiene uno, usar ese
    if (firstName) return firstName;
    if (lastName) return lastName;
    
    // Si no tiene nombres, extraer del email
    if (user.email) {
      const emailName = user.email.split('@')[0];
      return emailName.charAt(0).toUpperCase() + emailName.slice(1);
    }
    
    return 'Usuario';
  };

  // Cargar actividades cuando el usuario esté autenticado
  useEffect(() => {
    if (user && !isLoading) {
      loadActivities();
    }
  }, [user, isLoading]);

  const loadActivities = async () => {
    if (!user) return;
    
    try {
      setLoadingActivities(true);
      
      // Cargar actividades y actividades recurrentes en paralelo
      const [upcomingActivities, todayCompleted, recurring] = await Promise.all([
        activitiesApi.getUpcoming().then(activities => 
          activities.filter(a => a.status === 'pending')
        ),
        activitiesApi.getTodayCompleted(),
        recurringActivitiesApi.getActive(),
      ]);
      
      // Convertir las actividades próximas a formato local para mostrar
      setTodayActivities(upcomingActivities.map(convertToLocalActivity));
      setCompletedActivities(todayCompleted.map(convertToLocalActivity));
      setUpcomingActivities(upcomingActivities);
      setRecurringActivities(recurring);
      
    } catch (error) {
      console.error('Error loading activities:', error);
      // En caso de error, mostrar datos vacíos pero no fallar la app
      setTodayActivities([]);
      setCompletedActivities([]);
      setUpcomingActivities([]);
      setRecurringActivities([]);
    } finally {
      setLoadingActivities(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadActivities();
    setRefreshing(false);
  };

  // Mostrar loading si aún se están cargando los datos del usuario
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0891B2" />
        <Text style={styles.loadingText}>Cargando dashboard...</Text>
      </View>
    );
  }

  // Actividades recurrentes más utilizadas
  const frequentActivities = [
    { id: 'r1', name: 'Inspección de Seguridad Diaria', category: 'Inspecciones', lastUsed: '2024-01-15' },
    { id: 'r2', name: 'Verificación de EPP', category: 'EPP', lastUsed: '2024-01-15' },
    { id: 'r3', name: 'Reporte de Incidente', category: 'Reportes', lastUsed: '2024-01-12' },
  ];

  // Acciones rápidas
  const quickActions: QuickAction[] = [
    {
      id: 'recurring',
      title: 'Actividades Recurrentes',
      description: 'Ver formularios disponibles',
      icon: 'repeat',
      route: '/recurring-activities',
      color: '#9C27B0',
    },
    {
      id: 'scheduled',
      title: 'Actividades Programadas',
      description: 'Ver agenda y calendario',
      icon: 'calendar',
      route: '/scheduled',
      color: '#2196F3',
    },
    {
      id: 'history',
      title: 'Historial',
      description: 'Actividades completadas',
      icon: 'history',
      route: '/history',
      color: '#4CAF50',
    },
  ];

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'inspection':
        return 'search';
      case 'training':
        return 'graduation-cap';
      case 'evaluation':
        return 'clipboard';
      case 'meeting':
        return 'users';
      default:
        return 'calendar';
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'inspection':
        return '#2196F3';
      case 'training':
        return '#9C27B0';
      case 'evaluation':
        return '#FF5722';
      case 'meeting':
        return '#4CAF50';
      default:
        return '#9E9E9E';
    }
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

  const totalActivities = todayActivities.length + completedActivities.length;
  const pendingActivities = todayActivities.length;
  const completedCount = completedActivities.length;

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.homeHeader}>
        <Text style={styles.greeting}>¡{getGreeting()}, {getUserName()}!</Text>
        <Text style={styles.dateText}>{dateString}</Text>
        {user?.role && (
          <Text style={styles.roleText}>{user.role}</Text>
        )}
      </View>

      {/* Estadísticas del día */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{totalActivities}</Text>
          <Text style={styles.statLabel}>Total del día</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: '#FF9800' }]}>{pendingActivities}</Text>
          <Text style={styles.statLabel}>Pendientes</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: '#4CAF50' }]}>{completedCount}</Text>
          <Text style={styles.statLabel}>Completadas</Text>
        </View>
      </View>

      {/* Acciones rápidas */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <FontAwesome name="bolt" size={20} color="#FF6B35" />
          <Text style={styles.sectionTitle}>Acciones Rápidas</Text>
        </View>
        
        <View style={styles.quickActionsGrid}>
          {quickActions.map((action) => (
            <TouchableOpacity
              key={action.id}
              style={[styles.quickActionCard, { borderLeftColor: action.color }]}
              onPress={() => router.push(action.route as any)}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: action.color + '20' }]}>
                <FontAwesome name={action.icon as any} size={24} color={action.color} />
              </View>
              <View style={styles.quickActionContent}>
                <Text style={styles.quickActionTitle}>{action.title}</Text>
                <Text style={styles.quickActionDescription}>{action.description}</Text>
              </View>
              <FontAwesome name="chevron-right" size={16} color="#94A3B8" />
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Actividades recurrentes */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <FontAwesome name="refresh" size={20} color="#FF9800" />
          <Text style={styles.sectionTitle}>Actividades Recurrentes</Text>
        </View>
        
        {loadingActivities ? (
          <View style={styles.activityLoadingContainer}>
            <ActivityIndicator size="small" color="#0891B2" />
            <Text style={styles.activityLoadingText}>Cargando actividades recurrentes...</Text>
          </View>
        ) : recurringActivities.length > 0 ? (
          <>
            {recurringActivities.slice(0, 3).map((recurringActivity) => {
              const localActivity = convertRecurringToLocalActivity(recurringActivity);
              return (
                <View 
                  key={recurringActivity.id} 
                  style={[styles.homeActivityCard, styles.recurringActivityCard]}
                >
                  <View style={styles.homeActivityHeader}>
                    <View style={styles.activityTime}>
                      <Text style={styles.timeText}>{localActivity.time}</Text>
                    </View>
                    <View style={styles.activityContent}>
                      <Text style={styles.activityTitle}>{localActivity.title}</Text>
                      <View style={styles.activityDetails}>
                        <FontAwesome 
                          name={getActivityIcon(localActivity.type)} 
                          size={12} 
                          color={getActivityColor(localActivity.type)} 
                        />
                        <Text style={styles.locationText}>{localActivity.location}</Text>
                      </View>
                      {recurringActivity.completionCount > 0 && (
                        <Text style={styles.completionCount}>
                          Completada {recurringActivity.completionCount} {recurringActivity.completionCount === 1 ? 'vez' : 'veces'}
                        </Text>
                      )}
                    </View>
                    <View style={styles.activityActions}>
                      <FormButton
                        activityId={recurringActivity.id}
                        activityType="recurring"
                        activityName={localActivity.title}
                        size="small"
                        variant="primary"
                      />
                    </View>
                  </View>
                </View>
              );
            })}
            
            <TouchableOpacity 
              style={styles.viewAllButton}
              onPress={() => router.push('/recurring-activities')}
            >
              <Text style={styles.viewAllText}>Ver todas las actividades recurrentes</Text>
              <FontAwesome name="arrow-right" size={12} color="#0891B2" />
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.emptyStateContainer}>
            <FontAwesome name="refresh" size={48} color="#94A3B8" />
            <Text style={styles.emptyStateTitle}>No hay actividades recurrentes</Text>
            <Text style={styles.emptyStateText}>Las actividades recurrentes son tareas que realizas regularmente</Text>
          </View>
        )}
      </View>

      {/* Próximas actividades */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <FontAwesome name="clock-o" size={20} color="#2196F3" />
          <Text style={styles.sectionTitle}>Próximas Actividades</Text>
        </View>
        
        {loadingActivities ? (
          <View style={styles.activityLoadingContainer}>
            <ActivityIndicator size="small" color="#0891B2" />
            <Text style={styles.activityLoadingText}>Cargando actividades...</Text>
          </View>
        ) : todayActivities.length > 0 ? (
          <>
            {/* Mostrar actividades próximas organizadas por día */}
            {todayActivities.slice(0, 5).map((activity, index) => {
              // Determinar si es hoy, mañana o futuro
              const activityDate = new Date(upcomingActivities[index]?.assignedDate);
              const today = new Date();
              const tomorrow = new Date(today);
              tomorrow.setDate(today.getDate() + 1);
              
              let dateLabel = '';
              let additionalStyle = {};
              
              if (activityDate.toDateString() === today.toDateString()) {
                dateLabel = 'Hoy';
                additionalStyle = styles.todayActivity;
              } else if (activityDate.toDateString() === tomorrow.toDateString()) {
                dateLabel = 'Mañana';
                additionalStyle = styles.tomorrowActivity;
              } else {
                dateLabel = activityDate.toLocaleDateString('es-ES', { 
                  weekday: 'short', 
                  day: 'numeric',
                  month: 'short'
                });
                additionalStyle = styles.futureActivity;
              }
              
              return (
                <TouchableOpacity 
                  key={activity.id} 
                  style={[styles.homeActivityCard, additionalStyle]}
                  onPress={() => router.push('/scheduled')}
                >
                  <View style={styles.homeActivityHeader}>
                    <View style={styles.activityTimeWithDate}>
                      <Text style={styles.dateLabel}>{dateLabel}</Text>
                      <Text style={styles.timeText}>{activity.time}</Text>
                    </View>
                    <View style={styles.activityContent}>
                      <Text style={styles.activityTitle}>{activity.title}</Text>
                      <View style={styles.activityDetails}>
                        <FontAwesome 
                          name={getActivityIcon(activity.type)} 
                          size={12} 
                          color={getActivityColor(activity.type)} 
                        />
                        <Text style={styles.locationText}>{activity.location}</Text>
                      </View>
                    </View>
                    <View style={styles.activityIcons}>
                      <View 
                        style={[
                          styles.priorityIndicator, 
                          { backgroundColor: getPriorityColor(activity.priority) }
                        ]} 
                      />
                      <FontAwesome name="chevron-right" size={14} color="#ccc" />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
            
            <TouchableOpacity 
              style={styles.viewAllButton}
              onPress={() => router.push('/scheduled')}
            >
              <Text style={styles.viewAllText}>Ver todas las programadas</Text>
              <FontAwesome name="arrow-right" size={12} color="#0891B2" />
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.emptyStateContainer}>
            <FontAwesome name="calendar-o" size={48} color="#94A3B8" />
            <Text style={styles.emptyStateTitle}>No hay actividades próximas</Text>
            <Text style={styles.emptyStateText}>Revisa tus actividades programadas o realiza actividades recurrentes</Text>
            <TouchableOpacity 
              style={styles.emptyStateButton}
              onPress={() => router.push('/recurring-activities')}
            >
              <Text style={styles.emptyStateButtonText}>Ver Actividades Recurrentes</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Actividades completadas hoy */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <FontAwesome name="check-circle" size={20} color="#4CAF50" />
          <Text style={styles.sectionTitle}>Completadas Hoy</Text>
        </View>
        
        {completedActivities.map((activity) => (
          <View key={activity.id} style={[styles.homeActivityCard, styles.completedCard]}>
            <View style={styles.homeActivityHeader}>
              <View style={styles.activityTime}>
                <Text style={[styles.timeText, styles.completedText]}>{activity.time}</Text>
              </View>
              <View style={styles.activityContent}>
                <Text style={[styles.activityTitle, styles.completedText]}>{activity.title}</Text>
                <View style={styles.activityDetails}>
                  <FontAwesome name="map-marker" size={12} color="#999" />
                  <Text style={[styles.locationText, styles.completedText]}>{activity.location}</Text>
                </View>
              </View>
              <View style={styles.activityIcons}>
                <FontAwesome name="check-circle" size={16} color="#4CAF50" />
              </View>
            </View>
          </View>
        ))}

        {completedActivities.length > 0 && (
          <TouchableOpacity 
            style={styles.viewAllButton}
            onPress={() => router.push('/history')}
          >
            <Text style={styles.viewAllText}>Ver historial completo</Text>
            <FontAwesome name="arrow-right" size={14} color="#0891B2" />
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  homeHeader: {
    backgroundColor: 'white',
    padding: 20,
    paddingTop: 50,
    paddingBottom: 40,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'black',
    marginBottom: 5,
  },
  dateText: {
    fontSize: 16,
    color: 'rgba(0, 0, 0, 0.8)',
    textTransform: 'capitalize',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'white',
    marginHorizontal: 15,
    marginTop: -20,
    borderRadius: 10,
    paddingVertical: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  statCard: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
    textAlign: 'center',
  },
  section: {
    backgroundColor: 'white',
    margin: 15,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 10,
  },
  homeActivityCard: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  completedCard: {
    opacity: 0.7,
  },
  homeActivityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityTime: {
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginRight: 15,
  },
  timeText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  activityDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 5,
  },
  activityIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priorityIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  completedText: {
    color: '#999',
    textDecorationLine: 'line-through',
  },
  quickActionsGrid: {
    gap: 12,
  },
  quickActionCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    borderLeftWidth: 4,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  quickActionContent: {
    flex: 1,
  },
  quickActionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 2,
  },
  quickActionDescription: {
    fontSize: 14,
    color: '#64748b',
  },
  recurringActivityCard: {
    borderLeftWidth: 3,
    borderLeftColor: '#FF9800',
  },

  recurringActivityContent: {
    flex: 1,
  },
  recurringActivityTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 2,
  },
  recurringActivityStatus: {
    fontSize: 12,
    color: '#64748b',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  viewAllText: {
    fontSize: 14,
    color: '#0891B2',
    fontWeight: '500',
    marginRight: 6,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#64748b',
  },
  roleText: {
    fontSize: 14,
    color: '#0891B2',
    fontWeight: '500',
    marginTop: 4,
  },
  activityLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 8,
  },
  activityLoadingText: {
    fontSize: 14,
    color: '#64748b',
  },
  tomorrowSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  tomorrowTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 8,
    paddingHorizontal: 15,
  },
  tomorrowActivity: {
    backgroundColor: '#f8fafc',
  },
  todayActivity: {
    backgroundColor: '#fff7ed',
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
  },
  futureActivity: {
    backgroundColor: '#f1f5f9',
  },
  activityTimeWithDate: {
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginRight: 15,
    alignItems: 'center',
  },
  dateLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  emptyStateContainer: {
    alignItems: 'center',
    padding: 32,
    gap: 12,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#64748b',
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyStateButton: {
    backgroundColor: '#0891B2',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 8,
  },
  emptyStateButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  completionCount: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
    fontStyle: 'italic',
  },
  activityActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
