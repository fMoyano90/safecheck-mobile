import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useOfflineStatus } from '../../hooks/useOfflineStatus';
import { useOfflineSignatures, MiningSignatureType } from '../../lib/offline/signature-offline';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface SignatureDashboardProps {
  onCreateSignature?: () => void;
  onViewSignature?: (signatureId: string) => void;
}

const { width: screenWidth } = Dimensions.get('window');

export const SignatureDashboard: React.FC<SignatureDashboardProps> = ({
  onCreateSignature,
  onViewSignature,
}) => {
  const {
    isOnline,
    hasStrongConnection,
    connectionType,
    connectionSpeed,
    signalStrength,
    isInMiningArea,
    offlineDuration,
    shouldUseOfflineMode,
  } = useOfflineStatus({ miningEnvironmentMode: true });

  const {
    signatures,
    stats,
    loading,
    syncSignatures,
  } = useOfflineSignatures();

  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'all' | MiningSignatureType>('all');
  const [syncing, setSyncing] = useState(false);

  const filteredSignatures = selectedFilter === 'all' 
    ? signatures 
    : signatures.filter(sig => sig.miningType === selectedFilter);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      if (isOnline && hasStrongConnection) {
        await syncSignatures();
      }
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleSyncAll = async () => {
    if (!isOnline) {
      Alert.alert('Sin Conexión', 'No hay conexión a internet para sincronizar.');
      return;
    }

    if (!hasStrongConnection) {
      Alert.alert(
        'Conexión Débil',
        'La conexión es débil. ¿Desea intentar sincronizar de todas formas?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Continuar', onPress: performSync },
        ]
      );
      return;
    }

    await performSync();
  };

  const performSync = async () => {
    try {
      setSyncing(true);
      const result = await syncSignatures();
      
      Alert.alert(
        'Sincronización Completada',
        `Exitosas: ${result.synced}\nFallidas: ${result.failed}`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      Alert.alert('Error', 'No se pudo completar la sincronización');
    } finally {
      setSyncing(false);
    }
  };

  const handleDeleteSignature = (signatureId: string) => {
    Alert.alert(
      'Eliminar Firma',
      '¿Está seguro de que desea eliminar esta firma? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            // TODO: Implement signature deletion
            console.log('Delete signature:', signatureId);
          },
        },
      ]
    );
  };

  const getConnectionStatusColor = () => {
    if (!isOnline) return '#F44336';
    if (hasStrongConnection) return '#4CAF50';
    return '#FF9800';
  };

  const getConnectionStatusText = () => {
    if (!isOnline) return 'Sin conexión';
    if (hasStrongConnection) return 'Conexión fuerte';
    return 'Conexión débil';
  };

  const getMiningTypeIcon = (type: MiningSignatureType) => {
    const icons = {
      [MiningSignatureType.SAFETY_INSPECTION]: 'shield-checkmark',
      [MiningSignatureType.EQUIPMENT_CHECK]: 'construct',
      [MiningSignatureType.INCIDENT_REPORT]: 'warning',
      [MiningSignatureType.SHIFT_HANDOVER]: 'people',
      [MiningSignatureType.EMERGENCY_PROCEDURE]: 'alert-circle',
      [MiningSignatureType.DAILY_REPORT]: 'document-text',
    };
    return icons[type] || 'document';
  };

  const getMiningTypeLabel = (type: MiningSignatureType) => {
    const labels = {
      [MiningSignatureType.SAFETY_INSPECTION]: 'Inspección de Seguridad',
      [MiningSignatureType.EQUIPMENT_CHECK]: 'Verificación de Equipos',
      [MiningSignatureType.INCIDENT_REPORT]: 'Reporte de Incidente',
      [MiningSignatureType.SHIFT_HANDOVER]: 'Cambio de Turno',
      [MiningSignatureType.EMERGENCY_PROCEDURE]: 'Procedimiento de Emergencia',
      [MiningSignatureType.DAILY_REPORT]: 'Reporte Diario',
    };
    return labels[type] || 'Documento';
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      critical: '#F44336',
      high: '#FF9800',
      medium: '#4CAF50',
    };
    return colors[priority] || '#4CAF50';
  };

  const renderConnectionStatus = () => (
    <View style={styles.statusCard}>
      <View style={styles.statusHeader}>
        <Ionicons name="wifi" size={24} color={getConnectionStatusColor()} />
        <Text style={styles.statusTitle}>Estado de Conexión</Text>
      </View>
      
      <View style={styles.statusGrid}>
        <View style={styles.statusItem}>
          <Text style={styles.statusLabel}>Estado</Text>
          <Text style={[styles.statusValue, { color: getConnectionStatusColor() }]}>
            {getConnectionStatusText()}
          </Text>
        </View>
        
        <View style={styles.statusItem}>
          <Text style={styles.statusLabel}>Tipo</Text>
          <Text style={styles.statusValue}>{connectionType || 'N/A'}</Text>
        </View>
        
        <View style={styles.statusItem}>
          <Text style={styles.statusLabel}>Velocidad</Text>
          <Text style={styles.statusValue}>
            {connectionSpeed ? `${connectionSpeed.toFixed(1)} Mbps` : 'N/A'}
          </Text>
        </View>
        
        <View style={styles.statusItem}>
          <Text style={styles.statusLabel}>Señal</Text>
          <Text style={styles.statusValue}>
            {signalStrength ? `${signalStrength}%` : 'N/A'}
          </Text>
        </View>
      </View>
      
      <View style={styles.locationStatus}>
        <Ionicons 
          name={isInMiningArea ? 'location' : 'location' as any} 
          size={16} 
          color={isInMiningArea ? '#4CAF50' : '#F44336'} 
        />
        <Text style={[styles.locationText, { color: isInMiningArea ? '#4CAF50' : '#F44336' }]}>
          {isInMiningArea ? 'En área minera autorizada' : 'Fuera del área autorizada'}
        </Text>
      </View>
      
      {!isOnline && offlineDuration > 0 && (
        <View style={styles.offlineIndicator}>
          <Ionicons name="time" size={16} color="#FF9800" />
          <Text style={styles.offlineText}>
            Sin conexión por {Math.floor(offlineDuration / 60)}m {offlineDuration % 60}s
          </Text>
        </View>
      )}
    </View>
  );

  const renderStats = () => (
    <View style={styles.statsCard}>
      <Text style={styles.cardTitle}>Estadísticas de Firmas</Text>
      
      <View style={styles.statsGrid}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: '#FF9800' }]}>{stats.pending}</Text>
          <Text style={styles.statLabel}>Pendientes</Text>
        </View>
        
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: '#F44336' }]}>{stats.critical}</Text>
          <Text style={styles.statLabel}>Críticas</Text>
        </View>
        
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: '#4CAF50' }]}>{stats.synced}</Text>
          <Text style={styles.statLabel}>Sincronizadas</Text>
        </View>
      </View>
      
      {stats.pending > 0 && (
        <TouchableOpacity 
          style={[styles.syncButton, !isOnline && styles.disabledButton]} 
          onPress={handleSyncAll}
          disabled={!isOnline || syncing}
        >
          {syncing ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <>
              <Ionicons name="sync" size={16} color="white" />
              <Text style={styles.syncButtonText}>Sincronizar Todo</Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );

  const renderFilterTabs = () => (
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false} 
      style={styles.filterContainer}
    >
      <TouchableOpacity
        style={[styles.filterTab, selectedFilter === 'all' && styles.activeFilterTab]}
        onPress={() => setSelectedFilter('all')}
      >
        <Text style={[styles.filterText, selectedFilter === 'all' && styles.activeFilterText]}>
          Todas
        </Text>
      </TouchableOpacity>
      
      {Object.values(MiningSignatureType).map((type) => (
        <TouchableOpacity
          key={type}
          style={[styles.filterTab, selectedFilter === type && styles.activeFilterTab]}
          onPress={() => setSelectedFilter(type)}
        >
          <Ionicons 
            name={getMiningTypeIcon(type) as any} 
            size={16} 
            color={selectedFilter === type ? 'white' : '#666'} 
          />
          <Text style={[styles.filterText, selectedFilter === type && styles.activeFilterText]}>
            {getMiningTypeLabel(type).split(' ')[0]}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderSignatureItem = (signature: any) => (
    <TouchableOpacity
      key={signature.id}
      style={styles.signatureItem}
      onPress={() => onViewSignature?.(signature.id)}
    >
      <View style={styles.signatureHeader}>
        <View style={styles.signatureTypeContainer}>
          <Ionicons 
            name={getMiningTypeIcon(signature.miningType) as any} 
            size={20} 
            color="#2196F3" 
          />
          <Text style={styles.signatureType}>
            {getMiningTypeLabel(signature.miningType)}
          </Text>
        </View>
        
        <View style={styles.signatureActions}>
          <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(signature.priority) }]}>
            <Text style={styles.priorityText}>{signature.priority.toUpperCase()}</Text>
          </View>
          
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDeleteSignature(signature.id)}
          >
            <Ionicons name="trash" size={16} color="#F44336" />
          </TouchableOpacity>
        </View>
      </View>
      
      <Text style={styles.signatureDocument} numberOfLines={2}>
        {signature.documentTitle || `Documento ${signature.documentId}`}
      </Text>
      
      <View style={styles.signatureFooter}>
        <View style={styles.signatureTime}>
          <Ionicons name="time" size={14} color="#666" />
          <Text style={styles.timeText}>
            {formatDistanceToNow(new Date(signature.createdAt), { 
              addSuffix: true, 
              locale: es 
            })}
          </Text>
        </View>
        
        <View style={[styles.statusBadge, { 
          backgroundColor: signature.synced ? '#E8F5E8' : '#FFF3E0' 
        }]}>
          <Ionicons 
            name={signature.synced ? 'checkmark-circle' : 'cloud-upload'} 
            size={12} 
            color={signature.synced ? '#4CAF50' : '#FF9800'} 
          />
          <Text style={[styles.statusText, { 
            color: signature.synced ? '#4CAF50' : '#FF9800' 
          }]}>
            {signature.synced ? 'Sincronizada' : 'Pendiente'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderSignaturesList = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Cargando firmas...</Text>
        </View>
      );
    }

    if (filteredSignatures.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="document-outline" size={64} color="#ccc" />
          <Text style={styles.emptyTitle}>No hay firmas</Text>
          <Text style={styles.emptySubtitle}>
            {selectedFilter === 'all' 
              ? 'No se han creado firmas aún'
              : `No hay firmas de tipo ${getMiningTypeLabel(selectedFilter as MiningSignatureType)}`
            }
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.signaturesList}>
        {filteredSignatures.map(renderSignatureItem)}
      </View>
    );
  };

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {renderConnectionStatus()}
      {renderStats()}
      {renderFilterTabs()}
      {renderSignaturesList()}
      
      {onCreateSignature && (
        <TouchableOpacity style={styles.createButton} onPress={onCreateSignature}>
          <Ionicons name="add" size={24} color="white" />
          <Text style={styles.createButtonText}>Nueva Firma</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  statusCard: {
    backgroundColor: 'white',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
    color: '#333',
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statusItem: {
    width: '48%',
    marginBottom: 12,
  },
  statusLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  statusValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  locationStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    padding: 8,
    backgroundColor: '#f8f9fa',
    borderRadius: 6,
  },
  locationText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  offlineIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    padding: 8,
    backgroundColor: '#fff3e0',
    borderRadius: 6,
  },
  offlineText: {
    marginLeft: 8,
    fontSize: 12,
    color: '#FF9800',
    fontWeight: '500',
  },
  statsCard: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    color: '#333',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
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
    marginTop: 4,
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2196F3',
    padding: 12,
    borderRadius: 8,
  },
  syncButtonText: {
    color: 'white',
    fontWeight: '600',
    marginLeft: 8,
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  filterContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    backgroundColor: 'white',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  activeFilterTab: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  filterText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  activeFilterText: {
    color: 'white',
    fontWeight: '500',
  },
  signaturesList: {
    paddingHorizontal: 16,
  },
  signatureItem: {
    backgroundColor: 'white',
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  signatureHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  signatureTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  signatureType: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    color: '#333',
  },
  signatureActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 8,
  },
  priorityText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  deleteButton: {
    padding: 4,
  },
  signatureDocument: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  signatureFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  signatureTime: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '500',
    marginLeft: 4,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  createButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default SignatureDashboard;