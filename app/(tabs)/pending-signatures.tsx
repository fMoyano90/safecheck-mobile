import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/auth-context';
import usePendingSignatures, { PendingSignature } from '@/hooks/usePendingSignatures';

export default function PendingSignatures() {
  const { user } = useAuth();
  const {
    signatures,
    statistics,
    loading,
    refreshing,
    error,
    navigateToSignature,
    refresh,
    getPriorityColor,
    getPriorityLabel,
    formatDate,
    isExpiringSoon,
  } = usePendingSignatures();

  const renderSignatureItem = ({ item }: { item: PendingSignature }) => (
    <TouchableOpacity
      style={[
        styles.signatureCard,
        !item.isViewed && styles.unreadCard,
        isExpiringSoon(item.expiresAt) && styles.expiringCard,
      ]}
      onPress={() => navigateToSignature(item)}
    >
      <View style={styles.cardHeader}>
        <View style={styles.titleContainer}>
          <Text style={styles.documentTitle} numberOfLines={2}>
            {item.documentTitle}
          </Text>
          {!item.isViewed && <View style={styles.unreadDot} />}
        </View>
        <View style={[
          styles.priorityBadge,
          { backgroundColor: getPriorityColor(item.priority) }
        ]}>
          <Text style={styles.priorityText}>
            {getPriorityLabel(item.priority)}
          </Text>
        </View>
      </View>

      <View style={styles.cardContent}>
        <View style={styles.infoRow}>
          <Ionicons name="person-outline" size={16} color="#666" />
          <Text style={styles.infoText}>
            Solicitado por: {item.requesterName}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="document-outline" size={16} color="#666" />
          <Text style={styles.infoText}>
            Tipo: {item.documentType}
          </Text>
        </View>

        {item.metadata?.department && (
          <View style={styles.infoRow}>
            <Ionicons name="business-outline" size={16} color="#666" />
            <Text style={styles.infoText}>
              Departamento: {item.metadata.department}
            </Text>
          </View>
        )}

        <View style={styles.infoRow}>
          <Ionicons name="time-outline" size={16} color="#666" />
          <Text style={styles.infoText}>
            Vence: {formatDate(item.expiresAt)}
          </Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.createdDate}>
          Creado: {formatDate(item.createdAt)}
        </Text>
        <Ionicons name="chevron-forward" size={20} color="#666" />
      </View>
    </TouchableOpacity>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.title}>Firmas Pendientes</Text>
      
      <View style={styles.statisticsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{statistics.total}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        
        <View style={[styles.statCard, styles.criticalStat]}>
          <Text style={[styles.statNumber, styles.criticalNumber]}>
            {statistics.critical}
          </Text>
          <Text style={[styles.statLabel, styles.criticalLabel]}>Críticas</Text>
        </View>
        
        <View style={[styles.statCard, styles.expiringStat]}>
          <Text style={[styles.statNumber, styles.expiringNumber]}>
            {statistics.expiring}
          </Text>
          <Text style={[styles.statLabel, styles.expiringLabel]}>Por vencer</Text>
        </View>
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="document-text-outline" size={64} color="#ccc" />
      <Text style={styles.emptyTitle}>No hay firmas pendientes</Text>
      <Text style={styles.emptySubtitle}>
        Todas tus firmas están al día
      </Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Cargando firmas pendientes...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={signatures}
        renderItem={renderSignatureItem}
        keyExtractor={(item) => item.id.toString()}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} />
        }
        contentContainerStyle={signatures.length === 0 ? styles.emptyContainer : undefined}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  statisticsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCard: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  criticalStat: {
    backgroundColor: '#ffebee',
  },
  expiringStat: {
    backgroundColor: '#fff3e0',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  criticalNumber: {
    color: '#d32f2f',
  },
  expiringNumber: {
    color: '#f57c00',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  criticalLabel: {
    color: '#d32f2f',
  },
  expiringLabel: {
    color: '#f57c00',
  },
  signatureCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
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
  unreadCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  expiringCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#FF8800',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  titleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  documentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#007AFF',
    marginLeft: 8,
    marginTop: 4,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  priorityText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  cardContent: {
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  createdDate: {
    fontSize: 12,
    color: '#999',
  },
  emptyContainer: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
});