import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { activitiesApi, type Activity, documentsApi } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import ActivityDetailsModal from '@/components/activities/ActivityDetailsModal';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { RefreshIndicator } from '../../components/ui/RefreshIndicator';

// Configurar localización en español
LocaleConfig.locales['es'] = {
  monthNames: [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ],
  monthNamesShort: [
    'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
    'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
  ],
  dayNames: [
    'Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'
  ],
  dayNamesShort: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
  today: 'Hoy'
};
LocaleConfig.defaultLocale = 'es';

interface ScheduledActivity {
  id: number;
  title: string;
  description?: string;
  date: string;
  time: string;
  location: string;
  type: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'completed' | 'approved' | 'rejected' | 'overdue';
  assignedBy?: string;
  estimatedDuration?: number;
  dueDate?: string;
  templates?: string[];
}

type ViewMode = 'agenda' | 'calendar';

export default function ScheduledActivitiesScreen() {
  const { user, isLoading } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('agenda');
  const [activities, setActivities] = useState<ScheduledActivity[]>([]);
  // Usar fecha local para evitar problemas de zona horaria
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  });
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [rawActivities, setRawActivities] = useState<Activity[]>([]);
  const [overdueCollapsed, setOverdueCollapsed] = useState(false);

  // Función helper para crear fecha local desde string YYYY-MM-DD
  const createLocalDate = (dateString: string) => {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day); // month - 1 porque los meses en JS van de 0-11
  };

  // Función para convertir Activity del backend a ScheduledActivity
  const convertToScheduledActivity = (activity: Activity): ScheduledActivity => {
    const assignedDate = new Date(activity.assignedDate);
    const time = assignedDate.toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
    // Usar la fecha local en lugar de UTC para evitar desfases de zona horaria
    const date = `${assignedDate.getFullYear()}-${String(assignedDate.getMonth() + 1).padStart(2, '0')}-${String(assignedDate.getDate()).padStart(2, '0')}`;
    
    // Título basado en activityName, templates o valor por defecto
    let title = 'Actividad';
    let templates: string[] = [];
    
    // Prioridad 1: usar activityName si está disponible
    if (activity.activityName && activity.activityName.trim()) {
      title = activity.activityName;
    }
    // Prioridad 2: usar templates expandidos si no hay activityName
    else if (activity.templates && activity.templates.length > 0) {
      // Templates expandidos
      if (activity.templates.length === 1) {
        title = activity.templates[0].name;
      } else {
        title = `${activity.templates[0].name} (+${activity.templates.length - 1} más)`;
      }
      templates = activity.templates.map(t => t.name);
    }
    // Prioridad 3: mantener "Actividad" como valor por defecto (no usar templateIds para generar títulos genéricos)
    
    // Solo llenar el array de templates si tenemos templates reales
    if (activity.templates && activity.templates.length > 0) {
      templates = activity.templates.map(t => t.name);
    } else if (activity.templateIds && activity.templateIds.length > 0) {
      // Solo para el array de templates, no para el título
      templates = activity.templateIds.map(id => `Formulario ${id}`);
    }
    
    // Determinar tipo basado en la categoría del template
    let type = 'task';
    if (activity.templates && activity.templates.length > 0 && activity.templates[0].category) {
      const categoryName = activity.templates[0].category.name.toLowerCase();
      if (categoryName.includes('inspección') || categoryName.includes('inspection')) type = 'inspection';
      else if (categoryName.includes('capacitación') || categoryName.includes('training')) type = 'training';
      else if (categoryName.includes('evaluación') || categoryName.includes('evaluation')) type = 'evaluation';
      else if (categoryName.includes('reunión') || categoryName.includes('meeting')) type = 'meeting';
    } else if (activity.templateIds && activity.templateIds.length > 0) {
      // Si solo tenemos templateIds, usar tipo genérico
      type = 'calendar';
    }
    
    return {
      id: activity.id,
      title,
      description: activity.observations || 'Sin descripción adicional',
      date,
      time,
      location: activity.location || activity.contract?.name || 'Ubicación no especificada',
      type,
      priority: activity.priority,
      status: activity.status,
      assignedBy: activity.assignedBy ? `${activity.assignedBy.firstName} ${activity.assignedBy.lastName}` : undefined,
      dueDate: activity.dueDate,
      templates,
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
      // Cargar todas las actividades del usuario
      const userActivities = await activitiesApi.getMyActivities();
      
      // Guardar actividades sin procesar para el modal
      setRawActivities(userActivities);
      
      // Convertir a formato ScheduledActivity y ordenar por fecha
      const scheduledActivities = userActivities
        .map(convertToScheduledActivity)
        .sort((a, b) => new Date(a.date + ' ' + a.time).getTime() - new Date(b.date + ' ' + b.time).getTime());
      
      setActivities(scheduledActivities);
    } catch (err) {
      console.error('Error loading activities:', err);
      setActivities([]);
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh desactivado, solo refresh manual
  const {} = useAutoRefresh({
    refreshFunction: loadActivities,
    interval: 120000, // 2 minutos
    enabled: false, // Desactivar auto-refresh completamente
  });
  
  // Estado manual para el indicador de refresh
  const [hasUpdates, setHasUpdates] = useState(false);
  const clearUpdates = () => setHasUpdates(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadActivities();
    setRefreshing(false);
  };

  const handleActivityPress = async (scheduledActivity: ScheduledActivity) => {
    // Encontrar la actividad completa en rawActivities
    const fullActivity = rawActivities.find(a => a.id === scheduledActivity.id);
    if (fullActivity) {

      
      // Cargar los templates usando los templateIds
      let templates: Array<{id: number, name: string, description: string, status: 'pending'}> = [];
      if (fullActivity.templateIds && fullActivity.templateIds.length > 0) {
        try {
          // Obtener el template real del primer templateId
          const templateData = await documentsApi.getActivityTemplate(fullActivity.id);
          
          templates = fullActivity.templateIds.map((templateId, index) => ({
            id: templateId,
            name: index === 0 ? templateData.name : `Template ${templateId}`,
            description: index === 0 ? (templateData.description || 'Formulario asignado a esta actividad') : 'Formulario asignado a esta actividad',
            status: 'pending' as const,
          }));
        } catch (error) {
          console.error('Error cargando template:', error);
          // Fallback: usar los nombres que ya tenemos
          templates = fullActivity.templateIds.map((templateId, index) => ({
            id: templateId,
            name: scheduledActivity.templates?.[index] || scheduledActivity.title || `Template ${templateId}`,
            description: 'Formulario asignado a esta actividad',
            status: 'pending' as const,
          }));
        }
      }
      
      // Convertir a formato del modal
      const activityForModal = {
        ...fullActivity,
        templates: templates,
      };
      

      
      setSelectedActivity(activityForModal);
      setModalVisible(true);
    }
  };

  const handleCompleteActivity = async (activityId: number) => {
    try {
      await activitiesApi.complete(activityId, { formData: {} });
      Alert.alert('Éxito', 'Actividad marcada como completada');
      await loadActivities(); // Recargar datos
    } catch (error) {
      console.error('Error completing activity:', error);
      throw error;
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'inspection': return 'search';
      case 'training': return 'school';
      case 'evaluation': return 'document-text';
      case 'meeting': return 'people';
      default: return 'calendar';
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'inspection': return '#1565c0'; // blue-500
      case 'training': return '#1976d2'; // blue-700
      case 'evaluation': return '#ff834d'; // brand-400
      case 'meeting': return '#42a5f5'; // blue-400
      default: return '#737373'; // neutral-500
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return '#DC2626'; // Rojo urgente
      case 'high': return '#EF4444';   // Rojo alto
      case 'medium': return '#ff6d00'; // Naranja Núcleo Gestor
      case 'low': return '#10B981';    // Verde bajo
      default: return '#6B7280';       // Gris por defecto
    }
  };

  const getPriorityText = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'URGENTE';
      case 'high': return 'ALTA';
      case 'medium': return 'MEDIA';
      case 'low': return 'BAJA';
      default: return priority.toUpperCase();
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#ff6d00';
      case 'completed': return '#10B981';
      case 'approved': return '#059669';
      case 'rejected': return '#EF4444';
      case 'overdue': return '#DC2626';
      default: return '#6B7280';
    }
  };

  const getActivitiesForDate = (date: string) => {
    return activities.filter(activity => activity.date === date);
  };

  const getMarkedDates = () => {
    const marked: { [key: string]: any } = {};
    
    activities.forEach(activity => {
      const dateKey = activity.date;
      if (!marked[dateKey]) {
        marked[dateKey] = { dots: [] };
      }
      
      // Agregar punto basado en la prioridad
      const priorityColor = getPriorityColor(activity.priority);
      marked[dateKey].dots.push({
        color: priorityColor,
        selectedDotColor: 'white',
      });
    });

    // Marcar la fecha seleccionada
    if (marked[selectedDate]) {
      marked[selectedDate].selected = true;
      marked[selectedDate].selectedColor = '#ff6d00';
    } else {
      marked[selectedDate] = {
        selected: true,
        selectedColor: '#ff6d00',
      };
    }

    return marked;
  };

  const renderActivityCard = (activity: ScheduledActivity) => (
    <TouchableOpacity 
      key={activity.id} 
      style={styles.activityCard}
      onPress={() => handleActivityPress(activity)}
    >
      <View style={styles.activityHeader}>
        <View style={styles.activityTime}>
          <Text style={styles.timeText}>{activity.time}</Text>
          <Text style={styles.durationText}>{activity.estimatedDuration} min</Text>
          <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(activity.priority) }]}>
            <Text style={styles.priorityText}>{getPriorityText(activity.priority)}</Text>
          </View>
        </View>
        <View style={styles.activityContent}>
          <Text style={styles.activityTitle}>{activity.title}</Text>
          {activity.description && (
            <Text style={styles.activityDescription}>{activity.description}</Text>
          )}
          <View style={styles.activityDetails}>
            <View style={styles.detailRow}>
              <Ionicons name="location-outline" size={14} color="#737373" />
              <Text style={styles.locationText}>{activity.location}</Text>
            </View>
            {activity.assignedBy && (
              <View style={styles.detailRow}>
                <Ionicons name="person-outline" size={14} color="#737373" />
                <Text style={styles.assignedText}>Asignado por: {activity.assignedBy}</Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.activityIcons}>
          <Ionicons 
            name={getActivityIcon(activity.type)} 
            size={20} 
            color={getActivityColor(activity.type)} 
          />
          <View style={[styles.statusIndicator, { backgroundColor: getStatusColor(activity.status) }]} />
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderAgendaView = () => {
    const today = (() => {
      const todayDate = new Date();
      return `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}-${String(todayDate.getDate()).padStart(2, '0')}`;
    })();
    const todayActivities = getActivitiesForDate(today);
    const overdueActivities = activities.filter(activity => activity.date < today && (activity.status === 'pending' || activity.status === 'overdue'));
    const upcomingActivities = activities.filter(activity => activity.date > today).slice(0, 10);
    const totalOverdueCount = overdueActivities.length;

    // Función para obtener el texto de tiempo relativo para actividades vencidas
    const getOverdueTimeText = (activityDate: string) => {
      const today = new Date();
      const activityDateObj = createLocalDate(activityDate);
      const diffTime = today.getTime() - activityDateObj.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) {
        return 'Ayer';
      } else if (diffDays > 1) {
        return `Hace ${diffDays} días`;
      } else {
        return 'Hoy';
      }
    };

    return (
      <ScrollView 
        style={styles.agendaContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#ff6d00']}
          />
        }

      >
        {/* Actividades vencidas */}
        {overdueActivities.length > 0 && (
          <View style={styles.section}>
            <View style={styles.overdueAlert}>
              <Ionicons name="warning" size={16} color="#ffffff" />
              <Text style={styles.overdueAlertText}>
                Tienes {totalOverdueCount} actividad{totalOverdueCount !== 1 ? 'es' : ''} vencida{totalOverdueCount !== 1 ? 's' : ''} pendiente{totalOverdueCount !== 1 ? 's' : ''}
              </Text>
            </View>
            <TouchableOpacity 
              style={styles.collapsibleSectionHeader}
              onPress={() => setOverdueCollapsed(!overdueCollapsed)}
            >
              <View style={styles.sectionHeader}>
                <Ionicons name="alert-circle" size={20} color="#dc2626" />
                <Text style={styles.sectionTitle}>Actividades Vencidas ({totalOverdueCount})</Text>
              </View>
              <Ionicons 
                name={overdueCollapsed ? "chevron-down" : "chevron-up"} 
                size={20} 
                color="#dc2626" 
              />
            </TouchableOpacity>
            {!overdueCollapsed && (
              <View>
                {overdueActivities.map(activity => (
                  <View key={activity.id} style={styles.overdueActivity}>
                    <View style={styles.overdueTimeContainer}>
                      <Text style={styles.overdueLabel}>{getOverdueTimeText(activity.date)}</Text>
                      <Text style={styles.overdueTime}>{activity.time}</Text>
                    </View>
                    {renderActivityCard(activity)}
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Actividades de hoy */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="today" size={20} color="#ff6d00" />
            <Text style={styles.sectionTitle}>Hoy ({todayActivities.length})</Text>
          </View>
          {todayActivities.length > 0 ? (
            todayActivities.map(renderActivityCard)
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No tienes actividades programadas para hoy</Text>
            </View>
          )}
        </View>

        {/* Próximas actividades */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="calendar-outline" size={20} color="#ff6d00" />
            <Text style={styles.sectionTitle}>Próximas Actividades</Text>
          </View>
          {upcomingActivities.length > 0 ? (
            upcomingActivities.map(activity => (
              <View key={activity.id} style={styles.upcomingActivity}>
                <Text style={styles.upcomingDate}>
                  {createLocalDate(activity.date).toLocaleDateString('es-ES', { 
                    weekday: 'short', 
                    month: 'short', 
                    day: 'numeric' 
                  })}
                </Text>
                {renderActivityCard(activity)}
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No tienes actividades programadas próximamente</Text>
            </View>
          )}
        </View>
      </ScrollView>
    );
  };

  const renderCalendarView = () => {
    const selectedActivities = getActivitiesForDate(selectedDate);

    return (
      <View style={styles.calendarContainer}>
        <Calendar
          current={selectedDate}
          onDayPress={(day) => setSelectedDate(day.dateString)}
          markedDates={getMarkedDates()}
          firstDay={1} // Empezar el lunes (0 = domingo, 1 = lunes)
          hideExtraDays={true} // Ocultar días de otros meses
          disableMonthChange={false}
          hideArrows={false}
          hideDayNames={false}
          showWeekNumbers={false}
          onPressArrowLeft={subtractMonth => subtractMonth()}
          onPressArrowRight={addMonth => addMonth()}
          disableArrowLeft={false}
          disableArrowRight={false}
          theme={{
            backgroundColor: '#ffffff',
            calendarBackground: '#ffffff',
            textSectionTitleColor: '#505759', // neutral-800
            textSectionTitleDisabledColor: '#d4d4d4', // neutral-300
            selectedDayBackgroundColor: '#ff6d00', // brand-500
            selectedDayTextColor: '#ffffff',
            todayTextColor: '#ff6d00', // brand-500
            dayTextColor: '#505759', // neutral-800
            textDisabledColor: '#d4d4d4', // neutral-300
            dotColor: '#ff6d00', // brand-500
            selectedDotColor: '#ffffff',
            arrowColor: '#ff6d00', // brand-500
            disabledArrowColor: '#d4d4d4', // neutral-300
            monthTextColor: '#505759', // neutral-800
            indicatorColor: '#ff6d00', // brand-500
            textDayFontFamily: 'System',
            textMonthFontFamily: 'System',
            textDayHeaderFontFamily: 'System',
            textDayFontWeight: '400',
            textMonthFontWeight: '600',
            textDayHeaderFontWeight: '500',
            textDayFontSize: 16,
            textMonthFontSize: 18,
            textDayHeaderFontSize: 13,
            agendaDayTextColor: '#505759', // neutral-800
            agendaDayNumColor: '#505759', // neutral-800
            agendaTodayColor: '#ff6d00', // brand-500
            agendaKnobColor: '#ff6d00' // brand-500
          }}

        />
        
        <ScrollView 
          style={styles.selectedDateActivities}

        >
          <Text style={styles.selectedDateTitle}>
            Actividades para {createLocalDate(selectedDate).toLocaleDateString('es-ES', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </Text>
          
          {selectedActivities.length > 0 ? (
            selectedActivities.map(renderActivityCard)
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No hay actividades programadas para esta fecha</Text>
            </View>
          )}
        </ScrollView>
      </View>
    );
  };

  // Mostrar loading si el usuario se está autenticando o cargando actividades
  if (isLoading || loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#ff6d00" />
          <Text style={styles.loadingText}>
            {isLoading ? 'Verificando autenticación...' : 'Cargando actividades programadas...'}
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
          <Text style={styles.emptyText}>Necesitas iniciar sesión para ver tus actividades programadas</Text>
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
        <Text style={styles.headerTitle}>Actividades Programadas</Text>
        <View style={styles.viewToggle}>
          <TouchableOpacity
            style={[styles.toggleButton, viewMode === 'agenda' && styles.activeToggle]}
            onPress={() => setViewMode('agenda')}
          >
            <Ionicons 
              name="list" 
              size={20} 
              color={viewMode === 'agenda' ? '#ffffff' : '#737373'} 
            />
            <Text style={[styles.toggleText, viewMode === 'agenda' && styles.activeToggleText]}>
              Agenda
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, viewMode === 'calendar' && styles.activeToggle]}
            onPress={() => setViewMode('calendar')}
          >
            <Ionicons 
              name="calendar" 
              size={20} 
              color={viewMode === 'calendar' ? '#ffffff' : '#737373'} 
            />
            <Text style={[styles.toggleText, viewMode === 'calendar' && styles.activeToggleText]}>
              Calendario
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {viewMode === 'agenda' ? renderAgendaView() : renderCalendarView()}

      {/* Modal de detalles de actividad */}
      <ActivityDetailsModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        activity={selectedActivity}
        onCompleteActivity={handleCompleteActivity}
        onRefresh={loadActivities}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5', // neutral-50
  },
  header: {
    backgroundColor: 'white',
    padding: 20,
    paddingTop: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5', // neutral-200
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#505759', // neutral-800
    marginBottom: 12,
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0', // neutral-100
    borderRadius: 8,
    padding: 4,
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  activeToggle: {
    backgroundColor: '#ff6d00', // brand-500
  },
  toggleText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '500',
    color: '#737373', // neutral-500
  },
  activeToggleText: {
    color: '#ffffff',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#737373', // neutral-500
    fontSize: 16,
  },
  agendaContainer: {
    flex: 1,
  },
  calendarContainer: {
    flex: 1,
  },
  section: {
    padding: 16,
    paddingBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#505759', // neutral-800
    marginLeft: 8,
  },
  activityCard: {
    backgroundColor: 'white',
    marginBottom: 8,
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
  },
  activityHeader: {
    flexDirection: 'row',
  },
  activityTime: {
    alignItems: 'center',
    marginRight: 12,
    minWidth: 60,
  },
  timeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#505759', // neutral-800
  },
  durationText: {
    fontSize: 11,
    color: '#737373', // neutral-500
    marginTop: 2,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#505759', // neutral-800
    marginBottom: 4,
  },
  activityDescription: {
    fontSize: 14,
    color: '#737373', // neutral-500
    marginBottom: 8,
    lineHeight: 20,
  },
  activityDetails: {
    gap: 4,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    fontSize: 12,
    color: '#737373', // neutral-500
    marginLeft: 4,
  },
  assignedText: {
    fontSize: 12,
    color: '#737373', // neutral-500
    marginLeft: 4,
  },
  activityIcons: {
    alignItems: 'center',
    gap: 8,
  },
  statusIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  upcomingActivity: {
    marginBottom: 12,
  },
  upcomingDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ff6d00', // brand-500
    marginBottom: 4,
    textTransform: 'capitalize',
  },
  selectedDateActivities: {
    flex: 1,
    padding: 16,
  },
  selectedDateTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#505759', // neutral-800
    marginBottom: 12,
    textTransform: 'capitalize',
  },
  emptyState: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#737373', // neutral-500
    textAlign: 'center',
  },
  priorityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 4,
    alignSelf: 'center',
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
  },
  // Estilos para actividades vencidas
  overdueActivity: {
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#dc2626',
    paddingLeft: 8,
  },
  overdueAlert: {
    backgroundColor: '#dc2626',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  overdueAlertText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  overdueTimeContainer: {
    marginBottom: 4,
  },
  overdueLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#dc2626',
    textTransform: 'uppercase',
  },
  overdueTime: {
    fontSize: 14,
    fontWeight: '600',
    color: '#dc2626',
  },
  collapsibleSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginBottom: 8,
  },
});