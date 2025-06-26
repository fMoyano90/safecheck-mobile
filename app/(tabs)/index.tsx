import { StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text, View } from '@/components/Themed';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';

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

type QuickAction = {
  id: string;
  title: string;
  description: string;
  icon: string;
  route: string;
  color: string;
};

// Datos maquetados para las actividades del día
const todayActivities: Activity[] = [
  { id: 1001, time: '09:00', title: 'Inspección de Seguridad Área A', location: 'Planta Principal', type: 'inspection', priority: 'high', status: 'pending' },
  { id: 1002, time: '11:30', title: 'Capacitación en Uso de EPP', location: 'Sala de Conferencias', type: 'training', priority: 'medium', status: 'pending' },
  { id: 1003, time: '14:00', title: 'Evaluación de Riesgos Proyecto X', location: 'Oficina Central', type: 'evaluation', priority: 'high', status: 'pending' },
];

const completedActivities: Activity[] = [
  { id: 1005, time: '08:00', title: 'Revisión de Protocolos Matutinos', location: 'Área de Control', type: 'inspection', priority: 'medium', status: 'completed' },
  { id: 1006, time: '12:00', title: 'Simulacro de Evacuación', location: 'Edificio Principal', type: 'training', priority: 'high', status: 'completed' }
];

export default function HomeScreen() {
  const router = useRouter();
  const currentDate = new Date();
  const dateString = currentDate.toLocaleDateString('es-ES', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

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

      {/* Actividades recurrentes frecuentes */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <FontAwesome name="star" size={20} color="#FFC107" />
          <Text style={styles.sectionTitle}>Actividades Más Utilizadas</Text>
        </View>
        
        {frequentActivities.map((activity) => (
          <TouchableOpacity 
            key={activity.id} 
            style={styles.recurringActivityCard}
            onPress={() => router.push('/recurring-activities')}
          >
            <View style={styles.recurringActivityContent}>
              <Text style={styles.recurringActivityTitle}>{activity.name}</Text>
              <Text style={styles.recurringActivityStatus}>
                {activity.category} • Última vez: {new Date(activity.lastUsed).toLocaleDateString('es-ES')}
              </Text>
            </View>
            <FontAwesome name="chevron-right" size={14} color="#94A3B8" />
          </TouchableOpacity>
        ))}
        
        <TouchableOpacity 
          style={styles.viewAllButton}
          onPress={() => router.push('/recurring-activities')}
        >
          <Text style={styles.viewAllText}>Ver todas las actividades recurrentes</Text>
          <FontAwesome name="arrow-right" size={14} color="#0891B2" />
        </TouchableOpacity>
      </View>

      {/* Próximas actividades */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <FontAwesome name="clock-o" size={20} color="#2196F3" />
          <Text style={styles.sectionTitle}>Próximas Actividades</Text>
        </View>
        
        {todayActivities.slice(0, 3).map((activity) => (
          <TouchableOpacity 
            key={activity.id} 
            style={styles.homeActivityCard}
            onPress={() => router.push('/scheduled')}
          >
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
        
        {todayActivities.length > 3 && (
          <TouchableOpacity 
            style={styles.viewAllButton}
            onPress={() => router.push('/scheduled')}
          >
            <Text style={styles.viewAllText}>Ver todas las actividades programadas</Text>
            <FontAwesome name="arrow-right" size={14} color="#0891B2" />
          </TouchableOpacity>
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
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
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
});
