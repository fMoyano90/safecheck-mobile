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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Calendar } from 'react-native-calendars';

interface ScheduledActivity {
  id: string;
  title: string;
  description?: string;
  date: string;
  time: string;
  location: string;
  type: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in_progress' | 'completed';
  assignedBy?: string;
  estimatedDuration: number;
}

type ViewMode = 'agenda' | 'calendar';

export default function ScheduledActivitiesScreen() {
  const [viewMode, setViewMode] = useState<ViewMode>('agenda');
  const [activities, setActivities] = useState<ScheduledActivity[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Datos mockup para actividades programadas
  const mockActivities: ScheduledActivity[] = [
    {
      id: '1',
      title: 'Inspección de Seguridad Área A',
      description: 'Revisión completa de protocolos de seguridad en el área de producción A',
      date: '2024-01-16',
      time: '09:00',
      location: 'Planta Principal - Área A',
      type: 'inspection',
      priority: 'high',
      status: 'pending',
      assignedBy: 'Supervisor Carlos Mendez',
      estimatedDuration: 60,
    },
    {
      id: '2',
      title: 'Capacitación en Uso de EPP',
      description: 'Sesión de entrenamiento sobre el uso correcto del equipo de protección personal',
      date: '2024-01-16',
      time: '11:30',
      location: 'Sala de Conferencias B',
      type: 'training',
      priority: 'medium',
      status: 'pending',
      assignedBy: 'Jefe de Seguridad Ana García',
      estimatedDuration: 90,
    },
    {
      id: '3',
      title: 'Evaluación de Riesgos Proyecto X',
      description: 'Análisis de riesgos para el nuevo proyecto de expansión',
      date: '2024-01-16',
      time: '14:00',
      location: 'Oficina Central - Sala 203',
      type: 'evaluation',
      priority: 'high',
      status: 'pending',
      assignedBy: 'Director de Operaciones Luis Torres',
      estimatedDuration: 120,
    },
  ];

  useEffect(() => {
    loadActivities();
  }, []);

  const loadActivities = async () => {
    setLoading(true);
    try {
      // En una implementación real, aquí cargarías las actividades programadas del usuario desde la API
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simular carga
      setActivities(mockActivities);
    } catch (err) {
      console.error('Error loading activities:', err);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadActivities();
    setRefreshing(false);
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
      case 'inspection': return '#2196F3';
      case 'training': return '#9C27B0';
      case 'evaluation': return '#FF5722';
      case 'meeting': return '#4CAF50';
      default: return '#9E9E9E';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return '#F44336';
      case 'medium': return '#FF9800';
      case 'low': return '#4CAF50';
      default: return '#9E9E9E';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return '#4CAF50';
      case 'in_progress':
        return '#FF9800';
      case 'pending':
        return '#2196F3';
      default:
        return '#9E9E9E';
    }
  };

  const getActivitiesForDate = (date: string) => {
    return activities.filter(activity => activity.date === date);
  };

  const getMarkedDates = () => {
    const marked: any = {};
    activities.forEach(activity => {
      marked[activity.date] = {
        marked: true,
        dotColor: getActivityColor(activity.type),
      };
    });
    
    // Marcar la fecha seleccionada
    if (marked[selectedDate]) {
      marked[selectedDate].selected = true;
      marked[selectedDate].selectedColor = '#0891B2';
    } else {
      marked[selectedDate] = {
        selected: true,
        selectedColor: '#0891B2',
      };
    }
    
    return marked;
  };

  const renderActivityCard = (activity: ScheduledActivity) => (
    <TouchableOpacity key={activity.id} style={styles.activityCard}>
      <View style={styles.activityHeader}>
        <View style={styles.activityTime}>
          <Text style={styles.timeText}>{activity.time}</Text>
          <Text style={styles.durationText}>{activity.estimatedDuration} min</Text>
        </View>
        <View style={styles.activityContent}>
          <Text style={styles.activityTitle}>{activity.title}</Text>
          {activity.description && (
            <Text style={styles.activityDescription}>{activity.description}</Text>
          )}
          <View style={styles.activityDetails}>
            <View style={styles.detailRow}>
              <Ionicons name="location-outline" size={14} color="#64748B" />
              <Text style={styles.locationText}>{activity.location}</Text>
            </View>
            {activity.assignedBy && (
              <View style={styles.detailRow}>
                <Ionicons name="person-outline" size={14} color="#64748B" />
                <Text style={styles.assignedText}>Asignado por: {activity.assignedBy}</Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.activityIcons}>
          <View style={[styles.priorityIndicator, { backgroundColor: getPriorityColor(activity.priority) }]} />
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
    const today = new Date().toISOString().split('T')[0];
    const todayActivities = getActivitiesForDate(today);
    const upcomingActivities = activities.filter(activity => activity.date > today).slice(0, 10);

    return (
      <ScrollView 
        style={styles.agendaContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#0891B2']}
          />
        }
      >
        {/* Actividades de hoy */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="today" size={20} color="#0891B2" />
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
            <Ionicons name="calendar-outline" size={20} color="#0891B2" />
            <Text style={styles.sectionTitle}>Próximas Actividades</Text>
          </View>
          {upcomingActivities.length > 0 ? (
            upcomingActivities.map(activity => (
              <View key={activity.id} style={styles.upcomingActivity}>
                <Text style={styles.upcomingDate}>
                  {new Date(activity.date).toLocaleDateString('es-ES', { 
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
          theme={{
            backgroundColor: '#ffffff',
            calendarBackground: '#ffffff',
            textSectionTitleColor: '#b6c1cd',
            selectedDayBackgroundColor: '#0891B2',
            selectedDayTextColor: '#ffffff',
            todayTextColor: '#0891B2',
            dayTextColor: '#2d4150',
            textDisabledColor: '#d9e1e8',
            dotColor: '#00adf5',
            selectedDotColor: '#ffffff',
            arrowColor: '#0891B2',
            disabledArrowColor: '#d9e1e8',
            monthTextColor: '#0891B2',
            indicatorColor: '#0891B2',
            textDayFontWeight: '300',
            textMonthFontWeight: 'bold',
            textDayHeaderFontWeight: '300',
            textDayFontSize: 16,
            textMonthFontSize: 16,
            textDayHeaderFontSize: 13
          }}
        />
        
        <ScrollView style={styles.selectedDateActivities}>
          <Text style={styles.selectedDateTitle}>
            Actividades para {new Date(selectedDate).toLocaleDateString('es-ES', { 
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

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#0891B2" />
          <Text style={styles.loadingText}>Cargando actividades programadas...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
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
              color={viewMode === 'agenda' ? '#ffffff' : '#64748b'} 
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
              color={viewMode === 'calendar' ? '#ffffff' : '#64748b'} 
            />
            <Text style={[styles.toggleText, viewMode === 'calendar' && styles.activeToggleText]}>
              Calendario
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {viewMode === 'agenda' ? renderAgendaView() : renderCalendarView()}
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
    marginBottom: 12,
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
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
    backgroundColor: '#0891B2',
  },
  toggleText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '500',
    color: '#64748b',
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
    color: '#64748B',
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
    color: '#1e293b',
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
    color: '#1e293b',
  },
  durationText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  activityDescription: {
    fontSize: 14,
    color: '#64748b',
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
    color: '#64748b',
    marginLeft: 4,
  },
  assignedText: {
    fontSize: 12,
    color: '#64748b',
    marginLeft: 4,
  },
  activityIcons: {
    alignItems: 'center',
    gap: 8,
  },
  priorityIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
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
    color: '#0891B2',
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
    color: '#1e293b',
    marginBottom: 12,
    textTransform: 'capitalize',
  },
  emptyState: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
}); 