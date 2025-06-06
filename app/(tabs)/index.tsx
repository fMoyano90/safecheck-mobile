import { StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text, View } from '@/components/Themed';
import FontAwesome from '@expo/vector-icons/FontAwesome';

// Tipos
type Activity = {
  id: number;
  time: string;
  title: string;
  location: string;
  type: string;
  priority: string;
  status: string;
};

// Datos maquetados para las actividades del día (IDs únicos para evitar conflictos)
const todayActivities: Activity[] = [
  { id: 1001, time: '09:00', title: 'Inspección de Seguridad Área A', location: 'Planta Principal', type: 'inspection', priority: 'high', status: 'pending' },
  { id: 1002, time: '11:30', title: 'Capacitación en Uso de EPP', location: 'Sala de Conferencias', type: 'training', priority: 'medium', status: 'pending' },
  { id: 1003, time: '14:00', title: 'Evaluación de Riesgos Proyecto X', location: 'Oficina Central', type: 'evaluation', priority: 'high', status: 'pending' },
  { id: 1004, time: '16:00', title: 'Reunión de Seguimiento Semanal', location: 'Sala de Juntas', type: 'meeting', priority: 'low', status: 'pending' }
];

const completedActivities: Activity[] = [
  { id: 1005, time: '08:00', title: 'Revisión de Protocolos Matutinos', location: 'Área de Control', type: 'inspection', priority: 'medium', status: 'completed' },
  { id: 1006, time: '12:00', title: 'Simulacro de Evacuación', location: 'Edificio Principal', type: 'training', priority: 'high', status: 'completed' }
];

export default function HomeScreen() {
  const currentDate = new Date();
  const dateString = currentDate.toLocaleDateString('es-ES', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

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
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.homeHeader}>
        <Text style={styles.greeting}>¡Buenos días, Juan Carlos!</Text>
        <Text style={styles.dateText}>{dateString}</Text>
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

      {/* Próximas actividades */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <FontAwesome name="clock-o" size={20} color="#2196F3" />
          <Text style={styles.sectionTitle}>Próximas Actividades</Text>
        </View>
        
        {todayActivities.map((activity) => (
          <TouchableOpacity key={activity.id} style={styles.homeActivityCard}>
            <View style={styles.homeActivityHeader}>
              <View style={styles.activityTime}>
                <Text style={styles.timeText}>{activity.time}</Text>
              </View>
              <View style={styles.activityContent}>
                <Text style={styles.activityTitle}>{activity.title}</Text>
                <View style={styles.activityDetails}>
                  <FontAwesome name="map-marker" size={12} color="#666" />
                  <Text style={styles.locationText}>{activity.location}</Text>
                </View>
              </View>
              <View style={styles.activityIcons}>
                <View style={[styles.priorityIndicator, { backgroundColor: getPriorityColor(activity.priority) }]} />
                <FontAwesome 
                  name={getActivityIcon(activity.type)} 
                  size={16} 
                  color={getActivityColor(activity.type)} 
                />
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Actividades completadas */}
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
});
