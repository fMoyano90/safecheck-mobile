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
import { useAuth } from '@/contexts/auth-context';
import { documentsApi, type DocumentResponse } from '@/lib/api';
import { FieldRenderer } from '@/components/forms/FieldRenderer';
import { PdfDownloadButton } from '@/components/PdfDownloadButton';

type FilterType = 'all' | 'pending' | 'approved' | 'rejected';

export default function HistoryScreen() {
  const { user, isLoading } = useAuth();
  const [documents, setDocuments] = useState<DocumentResponse[]>([]);
  const [filteredDocuments, setFilteredDocuments] = useState<DocumentResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('all');
  const [selectedDocument, setSelectedDocument] = useState<DocumentResponse | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  useEffect(() => {
    if (user && !isLoading) {
      loadDocuments();
    }
  }, [user, isLoading]);

  useEffect(() => {
    filterDocuments();
  }, [documents, selectedFilter]);

  const loadDocuments = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const myDocuments = await documentsApi.getMyDocuments();
      setDocuments(myDocuments);
    } catch (err) {
      console.error('Error loading documents:', err);
    } finally {
      setLoading(false);
    }
  };

  const filterDocuments = () => {
    let filtered = documents;

    if (selectedFilter !== 'all') {
      filtered = documents.filter(doc => doc.status === selectedFilter);
    }

    setFilteredDocuments(filtered);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDocuments();
    setRefreshing(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#ff6d00'; // Naranja Núcleo Gestor - Pendiente de revisión
      case 'approved':
        return '#4CAF50'; // Verde - Aprobado
      case 'rejected':
        return '#F44336'; // Rojo - Rechazado
      case 'draft':
        return '#9E9E9E'; // Gris - Borrador
      default:
        return '#9E9E9E';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Pendiente de Revisión';
      case 'approved':
        return 'Aprobado';
      case 'rejected':
        return 'Rechazado';
      case 'draft':
        return 'Borrador';
      default:
        return status;
    }
  };

  const getActivityTypeText = (activityType?: string) => {
    switch (activityType) {
      case 'scheduled':
        return 'Programada';
      case 'recurring':
        return 'Recurrente';
      default:
        return 'N/A';
    }
  };

  const openDocumentDetail = (document: DocumentResponse) => {
    setSelectedDocument(document);
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

  const renderDocument = ({ item }: { item: DocumentResponse }) => (
    <TouchableOpacity
      style={styles.documentCard}
      onPress={() => openDocumentDetail(item)}
    >
      <View style={styles.documentHeader}>
        <View style={styles.documentInfo}>
          <Text style={styles.documentTitle}>{item.title}</Text>
          <Text style={styles.documentDescription}>
            {item.description || 'Sin descripción'}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
        </View>
      </View>

      <View style={styles.documentDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="calendar-outline" size={14} color="#64748B" />
          <Text style={styles.detailText}>
            {new Date(item.createdAt).toLocaleDateString('es-ES')} a las{' '}
            {new Date(item.createdAt).toLocaleTimeString('es-ES', { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Ionicons name="document-text-outline" size={14} color="#64748B" />
          <Text style={styles.detailText}>
            Tipo: {getActivityTypeText(item.activityType)}
          </Text>
        </View>

        {item.activityId && (
          <View style={styles.detailRow}>
            <Ionicons name="link-outline" size={14} color="#64748B" />
            <Text style={styles.detailText}>
              Actividad #{item.activityId}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.documentFooter}>
        <View style={styles.documentFeatures}>
          <Ionicons name="document-text" size={16} color="#0066cc" />
          {item.metadata?.hasPhotos && (
            <Ionicons name="camera" size={14} color="#0066cc" />
          )}
          {item.metadata?.hasSignatures && (
            <Ionicons name="create" size={14} color="#0066cc" />
          )}
        </View>
        
        <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
      </View>
    </TouchableOpacity>
  );

  const renderDetailModal = () => {
    if (!selectedDocument) return null;

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
            <Text style={styles.modalTitle}>Detalle del Documento</Text>
            {selectedDocument?.activityId && (
              <PdfDownloadButton 
                activityId={selectedDocument.activityId}
                variant="icon"
                size="medium"
              />
            )}
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.detailSection}>
              <Text style={styles.detailTitle}>{selectedDocument.title}</Text>
              <View style={[
                styles.statusBadge, 
                { backgroundColor: getStatusColor(selectedDocument.status) }
              ]}>
                <Text style={styles.statusText}>
                  {getStatusText(selectedDocument.status)}
                </Text>
              </View>
            </View>

            {selectedDocument.description && (
              <View style={styles.detailSection}>
                <Text style={styles.sectionLabel}>Descripción</Text>
                <Text style={styles.sectionText}>{selectedDocument.description}</Text>
              </View>
            )}

            <View style={styles.detailSection}>
              <Text style={styles.sectionLabel}>Información General</Text>
              <View style={styles.infoGrid}>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Fecha Enviado</Text>
                  <Text style={styles.infoValue}>
                    {new Date(selectedDocument.createdAt).toLocaleDateString('es-ES')}
                  </Text>
                </View>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Hora</Text>
                  <Text style={styles.infoValue}>
                    {new Date(selectedDocument.createdAt).toLocaleTimeString('es-ES', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </Text>
                </View>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Tipo de Actividad</Text>
                  <Text style={styles.infoValue}>
                    {getActivityTypeText(selectedDocument.activityType)}
                  </Text>
                </View>
                {selectedDocument.activityId && (
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>ID Actividad</Text>
                    <Text style={styles.infoValue}>#{selectedDocument.activityId}</Text>
                  </View>
                )}
              </View>
            </View>

            {selectedDocument.rejectionReason && (
              <View style={styles.detailSection}>
                <Text style={styles.sectionLabel}>Motivo de Rechazo</Text>
                <Text style={[styles.sectionText, { color: '#F44336' }]}>
                  {selectedDocument.rejectionReason}
                </Text>
              </View>
            )}

            {selectedDocument.metadata && (
              <View style={styles.detailSection}>
                <Text style={styles.sectionLabel}>Características</Text>
                <View style={styles.featuresContainer}>
                  <View style={styles.featureItem}>
                    <Ionicons 
                      name={selectedDocument.metadata.hasPhotos ? "camera" : "camera-outline"} 
                      size={20} 
                      color={selectedDocument.metadata.hasPhotos ? "#0066cc" : "#94A3B8"} 
                    />
                    <Text style={[
                      styles.featureText,
                      selectedDocument.metadata.hasPhotos && styles.activeFeature
                    ]}>
                      Fotos {selectedDocument.metadata.hasPhotos ? 'incluidas' : 'no incluidas'}
                    </Text>
                  </View>
                  <View style={styles.featureItem}>
                    <Ionicons 
                      name={selectedDocument.metadata.hasSignatures ? "create" : "create-outline"} 
                      size={20} 
                      color={selectedDocument.metadata.hasSignatures ? "#0066cc" : "#94A3B8"} 
                    />
                    <Text style={[
                      styles.featureText,
                      selectedDocument.metadata.hasSignatures && styles.activeFeature
                    ]}>
                      Firma {selectedDocument.metadata.hasSignatures ? 'incluida' : 'no incluida'}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {selectedDocument.fields && Object.keys(selectedDocument.fields).length > 0 && (
              <View style={styles.detailSection}>
                <Text style={styles.sectionLabel}>Datos del Formulario</Text>
                {Object.entries(selectedDocument.fields).map(([key, value]) => (
                  <FieldRenderer key={key} fieldKey={key} value={value} />
                ))}
              </View>
            )}

            {selectedDocument.activityId && (
              <View style={styles.detailSection}>
                <Text style={styles.sectionLabel}>Acciones</Text>
                <PdfDownloadButton 
                  activityId={selectedDocument.activityId}
                  variant="button"
                  size="large"
                />
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    );
  };

  // Mostrar loading si el usuario se está autenticando
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#ff6d00" />
          <Text style={styles.loadingText}>Verificando autenticación...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Si no hay usuario autenticado, mostrar mensaje
  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>
            Necesitas iniciar sesión para ver tu historial de documentos
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const getFilterCount = (filter: FilterType) => {
    if (filter === 'all') return documents.length;
    return documents.filter(doc => doc.status === filter).length;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Historial de Documentos</Text>
        <Text style={styles.headerSubtitle}>
          Formularios que has enviado ({filteredDocuments.length})
        </Text>
      </View>

      <View style={styles.filterContainer}>
        {renderFilterButton('all', `Todos (${getFilterCount('all')})`)}
        {renderFilterButton('pending', `Pendientes (${getFilterCount('pending')})`)}
        {renderFilterButton('approved', `Aprobados (${getFilterCount('approved')})`)}
        {renderFilterButton('rejected', `Rechazados (${getFilterCount('rejected')})`)}
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#ff6d00" />
          <Text style={styles.loadingText}>Cargando documentos...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredDocuments}
          renderItem={renderDocument}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#0066cc']}
            />
          }
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={48} color="#94A3B8" />
              <Text style={styles.emptyTitle}>No hay documentos</Text>
              <Text style={styles.emptyText}>
                {selectedFilter === 'all' 
                  ? 'No has enviado ningún documento aún'
                  : `No tienes documentos con estado "${getStatusText(selectedFilter)}"`
                }
              </Text>
            </View>
          }
        />
      )}

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
    marginRight: 8,
  },
  activeFilterButton: {
    backgroundColor: '#0066cc',
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
  documentCard: {
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
  documentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  documentInfo: {
    flex: 1,
  },
  documentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 2,
  },
  documentDescription: {
    fontSize: 14,
    color: '#64748b',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
  documentDetails: {
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
  documentFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  documentFeatures: {
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
  downloadButton: {
    padding: 4,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
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
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fieldLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginRight: 8,
  },
  fieldValue: {
    fontSize: 14,
    color: '#374151',
  },
});