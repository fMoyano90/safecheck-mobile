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
import { useRouter } from 'expo-router';

export default function PendingSignatures() {
  const { user } = useAuth();
  const router = useRouter();
  const {
    signatures,
    statistics,
    loading,
    refreshing,
    error,
    refresh,
    getPriorityColor,
    getPriorityLabel,
    markAsViewed,
  } = usePendingSignatures();

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'critical': return 'alert-circle';
      case 'high': return 'warning';
      case 'medium': return 'information-circle';
      default: return 'checkmark-circle';
    }
  };

  const handleViewDocument = (signature: any) => {
    // Marcar como visto
    markAsViewed(signature.id);
    
    // Navegar a la vista del documento
    router.push({
      pathname: '/document-viewer',
      params: {
        documentId: signature.documentId,
        signatureId: signature.id,
        title: signature.documentTitle,
        content: JSON.stringify(signature.documentContent),
        fields: JSON.stringify(signature.documentFields),
      },
    });
  };

  const handleSignDocument = (signature: any) => {
    // Marcar como visto
    markAsViewed(signature.id);
    
    // Navegar a la pantalla de firma
    router.push({
      pathname: '/signature-process',
      params: {
        signatureId: signature.id,
        documentId: signature.documentId,
        documentTitle: signature.documentTitle,
        requiresVisualSignature: signature.metadata?.requiresVisualSignature || false,
      },
    });
  };

  const renderSignatureItem = ({ item }: { item: PendingSignature }) => {
    const isExpiring = item.priority === 'high' || item.priority === 'critical';
    const isCritical = item.priority === 'critical';
    
    return (
      <View
        style={[
          styles.signatureCard,
          !item.isViewed && styles.unreadCard,
          isExpiring && styles.expiringCard,
          isCritical && styles.criticalCard,
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={styles.titleContainer}>
            <Text style={styles.documentTitle} numberOfLines={2}>
              {item.documentTitle}
            </Text>
            {!item.isViewed && <View style={styles.unreadDot} />}
          </View>
          
          <View style={styles.priorityContainer}>
            <Ionicons
              name={getPriorityIcon(item.priority)}
              size={16}
              color={getPriorityColor(item.priority)}
            />
          </View>
        </View>
        
        <View style={styles.cardContent}>
          <View style={styles.infoRow}>
             <Ionicons name="person-outline" size={14} color="#666" />
             <Text style={styles.infoText}>
               {item.requestedBy.name}
             </Text>
           </View>
          
          <View style={styles.infoRow}>
            <Ionicons name="document-outline" size={14} color="#666" />
            <Text style={styles.infoText}>
              {item.documentType === 'template' ? 'Plantilla' : 'Documento personalizado'}
            </Text>
          </View>
          
          {item.expiresAt && (
            <View style={styles.infoRow}>
              <Ionicons name="time-outline" size={14} color="#666" />
              <Text style={[styles.infoText, isExpiring && styles.expiringText]}>
                Vence: {formatDate(item.expiresAt)}
              </Text>
            </View>
          )}
        </View>
        
        <View style={styles.cardFooter}>
          <Text style={styles.createdDate}>
            Creado: {formatDate(item.createdAt)}
          </Text>
          
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.viewButton}
              onPress={() => handleViewDocument(item)}
            >
              <Ionicons name="eye-outline" size={16} color="#007AFF" />
              <Text style={styles.viewButtonText}>Ver</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.signButton}
              onPress={() => handleSignDocument(item)}
            >
              <Ionicons name="create-outline" size={16} color="#fff" />
              <Text style={styles.signButtonText}>Firmar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.title}>Firmas Pendientes</Text>
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
        data={signatures || []}
        renderItem={renderSignatureItem}
        keyExtractor={(item) => item.id.toString()}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} />
        }
        contentContainerStyle={(signatures || []).length === 0 ? styles.emptyContainer : undefined}
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
  criticalCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#FF3B30',
  },
  priorityContainer: {
    marginLeft: 8,
  },
  expiringText: {
    color: '#FF8800',
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#007AFF',
    backgroundColor: '#fff',
  },
  viewButtonText: {
    color: '#007AFF',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  signButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#007AFF',
  },
  signButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
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