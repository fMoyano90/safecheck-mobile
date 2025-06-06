import { StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text, View } from '@/components/Themed';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useState } from 'react';

type Activity = {
  id: number;
  time: string;
  title: string;
  location: string;
  duration: string;
  type: string;
  status: string;
};

type WeeklyActivities = {
  [key: string]: Activity[];
};

const weeklyActivities: WeeklyActivities = {
  'Lunes 16': [
    { id: 2001, time: '09:00', title: 'Inspección de Seguridad Área A', location: 'Planta Principal', duration: '2h', type: 'inspection', status: 'completed' },
    { id: 2002, time: '14:00', title: 'Capacitación en EPP', location: 'Sala de Conferencias', duration: '1.5h', type: 'training', status: 'completed' }
  ],
  'Martes 17': [
    { id: 2003, time: '10:00', title: 'Evaluación de Riesgos Proyecto B', location: 'Oficina Central', duration: '3h', type: 'evaluation', status: 'completed' }
  ],
  'Miércoles 18': [
    { id: 2004, time: '09:00', title: 'Inspección Rutinaria', location: 'Almacén Principal', duration: '1h', type: 'inspection', status: 'completed' },
    { id: 2005, time: '11:30', title: 'Taller de Prevención', location: 'Área de Producción', duration: '2h', type: 'training', status: 'completed' },
    { id: 2006, time: '14:00', title: 'Evaluación Proyecto X', location: 'Planta Norte', duration: '2.5h', type: 'evaluation', status: 'completed' },
    { id: 2007, time: '16:00', title: 'Reunión de Seguimiento', location: 'Sala de Juntas', duration: '1h', type: 'meeting', status: 'completed' }
  ],
  'Jueves 19': [
    { id: 2008, time: '08:30', title: 'Auditoría de Cumplimiento', location: 'Todas las Áreas', duration: '4h', type: 'inspection', status: 'pending' },
    { id: 2009, time: '15:00', title: 'Simulacro de Emergencia', location: 'Edificio Principal', duration: '2h', type: 'training', status: 'pending' }
  ],
  'Viernes 20': [
    { id: 2010, time: '10:00', title: 'Revisión de Protocolos', location: 'Oficina Técnica', duration: '3h', type: 'evaluation', status: 'pending' }
  ]
};

export default function AgendaScreen() {
  const [filter, setFilter] = useState('all');
  const [expandedDays, setExpandedDays] = useState<string[]>(['Jueves 19']);

  const toggleDay = (day: string) => {
    setExpandedDays(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day)
        : [...prev, day]
    );
  };

  const getFilteredActivities = (activities: Activity[]) => {
    switch (filter) {
      case 'pending':
        return activities.filter(a => a.status === 'pending');
      case 'completed':
        return activities.filter(a => a.status === 'completed');
      default:
        return activities;
    }
  };

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

  const totalActivities = Object.values(weeklyActivities).flat().length;
  const completedActivities = Object.values(weeklyActivities).flat().filter(a => a.status === 'completed').length;
  const pendingActivities = totalActivities - completedActivities;

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.agendaHeader}>
        <View style={styles.headerContent}>
          <FontAwesome name="list-ul" size={24} color="white" />
          <Text style={styles.agendaHeaderTitle}>Agenda Semanal</Text>
        </View>
        <Text style={styles.headerSubtitle}>16 - 20 Diciembre 2024</Text>
      </View>

      {/* Resumen de la semana */}
      <View style={styles.weekSummary}>
        <Text style={styles.summaryTitle}>Resumen de la Semana</Text>
        <View style={styles.summaryStats}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{totalActivities}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: '#4CAF50' }]}>{completedActivities}</Text>
            <Text style={styles.statLabel}>Completadas</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: '#FF9800' }]}>{pendingActivities}</Text>
            <Text style={styles.statLabel}>Pendientes</Text>
          </View>
        </View>
      </View>

      {/* Filtros */}
      <View style={styles.filtersContainer}>
        <Text style={styles.filtersTitle}>Filtros Rápidos</Text>
        <View style={styles.filters}>
          {[
            { key: 'all', label: 'Todas', color: '#666' },
            { key: 'pending', label: 'Pendientes', color: '#FF9800' },
            { key: 'completed', label: 'Completadas', color: '#4CAF50' }
          ].map(filterOption => (
            <TouchableOpacity
              key={filterOption.key}
              style={[
                styles.filterButton,
                filter === filterOption.key && styles.activeFilter,
                filter === filterOption.key && { backgroundColor: filterOption.color }
              ]}
              onPress={() => setFilter(filterOption.key)}
            >
              <Text style={[
                styles.filterText,
                filter === filterOption.key && styles.activeFilterText
              ]}>
                {filterOption.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Agenda por días */}
      <View style={styles.agenda}>
        {Object.entries(weeklyActivities).map(([day, activities]) => {
          const filteredActivities = getFilteredActivities(activities);
          const isExpanded = expandedDays.includes(day);
          
          if (filteredActivities.length === 0) {
            return null;
          }

          return (
            <View key={day} style={styles.dayContainer}>
              <TouchableOpacity
                style={styles.dayHeader}
                onPress={() => toggleDay(day)}
              >
                <View style={styles.dayHeaderLeft}>
                  <Text style={styles.dayTitle}>{day}</Text>
                  <View style={styles.dayStats}>
                    <Text style={styles.dayStatsText}>
                      {filteredActivities.length} actividad{filteredActivities.length !== 1 ? 'es' : ''}
                    </Text>
                  </View>
                </View>
                <FontAwesome 
                  name={isExpanded ? 'chevron-up' : 'chevron-down'} 
                  size={16} 
                  color="#666" 
                />
              </TouchableOpacity>

              {isExpanded && (
                <View style={styles.dayActivities}>
                  {filteredActivities.map((activity) => (
                    <View key={activity.id} style={styles.agendaActivityCard}>
                      <View style={styles.agendaActivityHeader}>
                        <View style={styles.activityTimeContainer}>
                          <Text style={styles.activityTime}>{activity.time}</Text>
                          <View style={[
                            styles.activityTypeIndicator,
                            { backgroundColor: getActivityColor(activity.type) }
                          ]} />
                        </View>
                        <View style={styles.activityStatusBadge}>
                          <FontAwesome 
                            name={activity.status === 'completed' ? 'check-circle' : 'clock-o'} 
                            size={16} 
                            color={activity.status === 'completed' ? '#4CAF50' : '#FF9800'} 
                          />
                        </View>
                      </View>
                      
                      <View style={styles.activityContent}>
                        <Text style={[
                          styles.activityTitle,
                          activity.status === 'completed' && styles.completedActivity
                        ]}>
                          {activity.title}
                        </Text>
                        
                        <View style={styles.activityDetails}>
                          <View style={styles.activityDetailItem}>
                            <FontAwesome name="map-marker" size={12} color="#666" />
                            <Text style={styles.activityDetailText}>{activity.location}</Text>
                          </View>
                          <View style={styles.activityDetailItem}>
                            <FontAwesome name="clock-o" size={12} color="#666" />
                            <Text style={styles.activityDetailText}>{activity.duration}</Text>
                          </View>
                          <View style={styles.activityDetailItem}>
                            <FontAwesome 
                              name={getActivityIcon(activity.type)} 
                              size={12} 
                              color={getActivityColor(activity.type)} 
                            />
                            <Text style={[
                              styles.activityDetailText,
                              { color: getActivityColor(activity.type) }
                            ]}>
                              {activity.type === 'inspection' ? 'Inspección' :
                               activity.type === 'training' ? 'Capacitación' :
                               activity.type === 'evaluation' ? 'Evaluación' : 'Reunión'}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  agendaHeader: {
    backgroundColor: 'white',
    padding: 20,
    paddingTop: 40,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  agendaHeaderTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'black',
    marginLeft: 10,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(0, 0, 0, 0.8)',
    marginLeft: 44,
  },
  weekSummary: {
    backgroundColor: 'white',
    margin: 15,
    padding: 20,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  summaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
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
  },
  filtersContainer: {
    backgroundColor: 'white',
    marginHorizontal: 15,
    marginBottom: 15,
    padding: 15,
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
  filtersTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  filters: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  filterButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    minWidth: 80,
    alignItems: 'center',
  },
  activeFilter: {
    backgroundColor: '#2196F3',
  },
  filterText: {
    fontSize: 12,
    color: '#666',
  },
  activeFilterText: {
    color: 'white',
    fontWeight: 'bold',
  },
  agenda: {
    paddingHorizontal: 15,
  },
  dayContainer: {
    backgroundColor: 'white',
    marginBottom: 10,
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
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
  },
  dayHeaderLeft: {
    flex: 1,
  },
  dayTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  dayStats: {
    marginTop: 5,
  },
  dayStatsText: {
    fontSize: 12,
    color: '#666',
  },
  dayActivities: {
    paddingHorizontal: 15,
    paddingBottom: 15,
  },
  agendaActivityCard: {
    backgroundColor: '#f9f9f9',
    padding: 15,
    marginBottom: 10,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  agendaActivityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  activityTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityTime: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginRight: 10,
  },
  activityTypeIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  activityStatusBadge: {
    padding: 5,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  completedActivity: {
    color: '#666',
    textDecorationLine: 'line-through',
  },
  activityDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  activityDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 15,
    marginBottom: 5,
  },
  activityDetailText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 5,
  },
}); 