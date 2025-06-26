import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  Modal,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface CompletedActivity {
  id: string;
  title: string;
  description?: string;
  type: string;
  category: string;
  completedDate: string;
  completedTime: string;
  location: string;
  duration: number;
  priority: 'low' | 'medium' | 'high';
  assignedBy?: string;
  observations?: string;
  hasPhotos: boolean;
  hasSigned: boolean;
  score?: number;
}

type FilterType = 'all' | 'today' | 'week' | 'month';

export default function HistoryScreen() {
  const [activities, setActivities] = useState<CompletedActivity[]>([]);
  const [filteredActivities, setFilteredActivities] = useState<CompletedActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('all');
  const [selectedActivity, setSelectedActivity] = useState<CompletedActivity | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Datos mockup para actividades completadas
  const mockActivities: CompletedActivity[] = [
    {
      id: '1',
      title: 'Inspección de Seguridad Área A',
      description: 'Revisión completa de protocolos de seguridad',
      type: 'inspection',
      category: 'Inspecciones',
      completedDate: '2024-01-15',
      completedTime: '09:30',
      location: 'Planta Principal - Área A',
      duration: 65,
      priority: 'high',
      assignedBy: 'Supervisor Carlos Mendez',
      observations: 'Se encontraron algunas deficiencias menores que fueron corregidas.',
      hasPhotos: true,
      hasSigned: true,
      score: 85,
    },
    {
      id: '2',
      title: 'Verificación de EPP',
      description: 'Control del estado y uso correcto del equipo de protección personal',
      type: 'verification',
      category: 'EPP',
      completedDate: '2024-01-15',
      completedTime: '11:45',
      location: 'Área de Vestuarios',
      duration: 15,
      priority: 'medium',
      assignedBy: 'Jefe de Seguridad Ana García',
      observations: 'Todo el personal cumple con el uso correcto del EPP.',
      hasPhotos: true,
      hasSigned: false,
      score: 95,
    },
    {
      id: '3',
      title: 'Limpieza y Orden (5S)',
      description: 'Verificación del cumplimiento de las 5S en el área de trabajo',
      type: 'evaluation',
      category: 'Orden y Limpieza',
      completedDate: '2024-01-14',
      completedTime: '16:20',
      location: 'Área de Producción B',
      duration: 25,
      priority: 'low',
      assignedBy: 'Coordinador de Calidad Luis Morales',
      observations: 'Excelente cumplimiento de los estándares 5S.',
      hasPhotos: true,
      hasSigned: true,
      score: 92,
    },
    {
      id: '4',
      title: 'Capacitación en Primeros Auxilios',
      description: 'Sesión de entrenamiento en técnicas básicas de primeros auxilios',
      type: 'training',
      category: 'Capacitaciones',
      completedDate: '2024-01-12',
      completedTime: '14:00',
      location: 'Sala de Conferencias A',
      duration: 120,
      priority: 'medium',
      assignedBy: 'Especialista en Seguridad María González',
      observations: 'Participación activa y comprensión completa de los procedimientos.',
      hasPhotos: false,
      hasSigned: true,
      score: 88,
    },
    {
      id: '5',
      title: 'Inspección de Herramientas',
      description: 'Revisión del estado y funcionamiento de herramientas de trabajo',
      type: 'inspection',
      category: 'Herramientas',
      completedDate: '2024-01-10',
      completedTime: '08:15',
      location: 'Almacén de Herramientas',
      duration: 45,
      priority: 'medium',
      assignedBy: 'Técnico en Seguridad Pedro López',
      observations: 'Se retiraron 3 herramientas defectuosas para mantenimiento.',
      hasPhotos: true,
      hasSigned: true,
      score: 90,
    },
  ];

  useEffect(() => {
    loadActivities();
  }, []);

  useEffect(() => {
    filterActivities();
  }, [activities, selectedFilter]);

  const loadActivities = async () => {
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setActivities(mockActivities);
    } catch (err) {
      console.error('Error loading activities:', err);
    } finally {
      setLoading(false);
    }
  };

  const filterActivities = () => {
    const now = new Date();
    let filtered = activities;

    switch (selectedFilter) {
      case 'today':
        const today = now.toISOString().split('T')[0];
        filtered = activities.filter(activity => activity.completedDate === today);
        break;
      case 'week':
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        filtered = activities.filter(activity => 
          new Date(activity.completedDate) >= weekAgo
        );
        break;
      case 'month':
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        filtered = activities.filter(activity => 
          new Date(activity.completedDate) >= monthAgo
        );
        break;
      default:
        filtered = activities;
    }

    setFilteredActivities(filtered.sort((a, b) => 
      new Date(b.completedDate + ' ' + b.completedTime).getTime() - 
      new Date(a.completedDate + ' ' + a.completedTime).getTime()
    ));
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
      case 'verification': return 'checkmark-circle';
      default: return 'calendar';
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'inspection': return '#2196F3';
      case 'training': return '#9C27B0';
      case 'evaluation': return '#FF5722';
      case 'verification': return '#4CAF50';
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

  const getScoreColor = (score?: number) => {
    if (!score) return '#9E9E9E';
    if (score >= 90) return '#4CAF50';
    if (score >= 70) return '#FF9800';
    return '#F44336';
  };

  const openActivityDetail = (activity: CompletedActivity) => {
    setSelectedActivity(activity);
    setShowDetailModal(true);
  };

  const renderFilterButton = (filter: FilterType, label: string) => (
    <TouchableOpacity
      key={filter}
      style={[
        styles.filterButton,
        selectedFilter === filter && styles.activeFilterButton
      ]}
      onPress={() => setSelectedFilter(filter)}
    >
      <Text style={[
        styles.filterText,
        selectedFilter === filter && styles.activeFilterText
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderActivity = ({ item }: { item: CompletedActivity }) => (
    <TouchableOpacity
      style={styles.activityCard}
      onPress={() => openActivityDetail(item)}
    >
      <View style={styles.activityHeader}>
        <View style={styles.activityInfo}>
          <Text style={styles.activityTitle}>{item.title}</Text>
          <Text style={styles.activityCategory}>{item.category}</Text>
        </View>
        <View style={styles.activityMeta}>
          <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(item.priority) }]}>
            <Text style={styles.priorityText}>{item.priority.toUpperCase()}</Text>
          </View>
          {item.score && (
            <View style={[styles.scoreBadge, { backgroundColor: getScoreColor(item.score) }]}>
              <Text style={styles.scoreText}>{item.score}%</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.activityDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="calendar-outline" size={14} color="#64748B" />
          <Text style={styles.detailText}>
            {new Date(item.completedDate).toLocaleDateString('es-ES')} a las {item.completedTime}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Ionicons name="location-outline" size={14} color="#64748B" />
          <Text style={styles.detailText}>{item.location}</Text>
        </View>

        <View style={styles.detailRow}>
          <Ionicons name="time-outline" size={14} color="#64748B" />
          <Text style={styles.detailText}>{item.duration} minutos</Text>
        </View>
      </View>

      <View style={styles.activityFooter}>
        <View style={styles.activityFeatures}>
          <Ionicons 
            name={getActivityIcon(item.type)} 
            size={16} 
            color={getActivityColor(item.type)} 
          />
          {item.hasPhotos && (
            <Ionicons name="camera" size={14} color="#0891B2" />
          )}
          {item.hasSigned && (
            <Ionicons name="create" size={14} color="#0891B2" />
          )}
        </View>
        
        <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
      </View>
    </TouchableOpacity>
  );

  const renderDetailModal = () => {
    if (!selectedActivity) return null;

    return (
      <Modal
        visible={showDetailModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowDetailModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowDetailModal(false)}
            >
              <Ionicons name="close" size={24} color="#64748B" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Detalle de Actividad</Text>
            <View style={styles.placeholder} />
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.detailSection}>
              <Text style={styles.detailTitle}>{selectedActivity.title}</Text>
              <Text style={styles.detailSubtitle}>{selectedActivity.category}</Text>
            </View>

            {selectedActivity.description && (
              <View style={styles.detailSection}>
                <Text style={styles.sectionLabel}>Descripción</Text>
                <Text style={styles.sectionText}>{selectedActivity.description}</Text>
              </View>
            )}

            <View style={styles.detailSection}>
              <Text style={styles.sectionLabel}>Información General</Text>
              <View style={styles.infoGrid}>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Fecha Completada</Text>
                  <Text style={styles.infoValue}>
                    {new Date(selectedActivity.completedDate).toLocaleDateString('es-ES')}
                  </Text>
                </View>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Hora</Text>
                  <Text style={styles.infoValue}>{selectedActivity.completedTime}</Text>
                </View>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Duración</Text>
                  <Text style={styles.infoValue}>{selectedActivity.duration} min</Text>
                </View>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Ubicación</Text>
                  <Text style={styles.infoValue}>{selectedActivity.location}</Text>
                </View>
              </View>
            </View>

            {selectedActivity.assignedBy && (
              <View style={styles.detailSection}>
                <Text style={styles.sectionLabel}>Asignado por</Text>
                <Text style={styles.sectionText}>{selectedActivity.assignedBy}</Text>
              </View>
            )}

            {selectedActivity.observations && (
              <View style={styles.detailSection}>
                <Text style={styles.sectionLabel}>Observaciones</Text>
                <Text style={styles.sectionText}>{selectedActivity.observations}</Text>
              </View>
            )}

            <View style={styles.detailSection}>
              <Text style={styles.sectionLabel}>Características</Text>
              <View style={styles.featuresContainer}>
                <View style={styles.featureItem}>
                  <Ionicons 
                    name={selectedActivity.hasPhotos ? "camera" : "camera-outline"} 
                    size={20} 
                    color={selectedActivity.hasPhotos ? "#0891B2" : "#94A3B8"} 
                  />
                  <Text style={[
                    styles.featureText,
                    selectedActivity.hasPhotos && styles.activeFeature
                  ]}>
                    Fotos {selectedActivity.hasPhotos ? 'incluidas' : 'no requeridas'}
                  </Text>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons 
                    name={selectedActivity.hasSigned ? "create" : "create-outline"} 
                    size={20} 
                    color={selectedActivity.hasSigned ? "#0891B2" : "#94A3B8"} 
                  />
                  <Text style={[
                    styles.featureText,
                    selectedActivity.hasSigned && styles.activeFeature
                  ]}>
                    Firma {selectedActivity.hasSigned ? 'realizada' : 'no requerida'}
                  </Text>
                </View>
              </View>
            </View>

            {selectedActivity.score && (
              <View style={styles.detailSection}>
                <Text style={styles.sectionLabel}>Puntuación</Text>
                <View style={styles.scoreContainer}>
                  <Text style={[styles.scoreValue, { color: getScoreColor(selectedActivity.score) }]}>
                    {selectedActivity.score}%
                  </Text>
                  <Text style={styles.scoreDescription}>
                    {selectedActivity.score >= 90 ? 'Excelente' : 
                     selectedActivity.score >= 70 ? 'Bueno' : 'Necesita mejora'}
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#0891B2" />
          <Text style={styles.loadingText}>Cargando historial...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Historial de Actividades</Text>
        <Text style={styles.headerSubtitle}>
          Actividades que has completado ({filteredActivities.length})
        </Text>
      </View>

      <View style={styles.filterContainer}>
        {renderFilterButton('all', 'Todas')}
        {renderFilterButton('today', 'Hoy')}
        {renderFilterButton('week', 'Semana')}
        {renderFilterButton('month', 'Mes')}
      </View>

      <FlatList
        data={filteredActivities}
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
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={48} color="#94A3B8" />
            <Text style={styles.emptyTitle}>No hay actividades</Text>
            <Text style={styles.emptyText}>
              No se encontraron actividades completadas para el filtro seleccionado
            </Text>
          </View>
        }
      />

      {renderDetailModal()}
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
  filterContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
  },
  activeFilterButton: {
    backgroundColor: '#0891B2',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748b',
  },
  activeFilterText: {
    color: 'white',
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
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  activityInfo: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 2,
  },
  activityCategory: {
    fontSize: 14,
    color: '#64748b',
  },
  activityMeta: {
    flexDirection: 'row',
    gap: 6,
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
  scoreBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  scoreText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
  activityDetails: {
    marginBottom: 12,
    gap: 6,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    fontSize: 12,
    color: '#64748b',
    marginLeft: 6,
  },
  activityFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  activityFeatures: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 12,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    maxWidth: 250,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  closeButton: {
    padding: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
  },
  placeholder: {
    width: 32,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  detailSection: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  detailTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 4,
  },
  detailSubtitle: {
    fontSize: 16,
    color: '#64748b',
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  sectionText: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  infoItem: {
    flex: 1,
    minWidth: '45%',
  },
  infoLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  featuresContainer: {
    gap: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureText: {
    fontSize: 14,
    color: '#94A3B8',
    marginLeft: 8,
  },
  activeFeature: {
    color: '#374151',
    fontWeight: '500',
  },
  scoreContainer: {
    alignItems: 'center',
  },
  scoreValue: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  scoreDescription: {
    fontSize: 14,
    color: '#64748b',
  },
}); 