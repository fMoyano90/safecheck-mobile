import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import DocumentContentRenderer from '@/components/forms/DocumentContentRenderer';
export default function DocumentViewer() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  const [loading, setLoading] = useState(true);
  const [documentContent, setDocumentContent] = useState<any>(null);
  const [documentFields, setDocumentFields] = useState<any>(null);

  const {
    documentId,
    signatureId,
    title,
    content,
    fields,
  } = params;

  useEffect(() => {
    loadDocumentData();
  }, []);

  const loadDocumentData = async () => {
    try {
      setLoading(true);
      
      // Parsear el contenido del documento
      if (content && content !== 'undefined') {
        setDocumentContent(JSON.parse(content as string));
      }
      
      // Parsear los campos del documento
      if (fields && fields !== 'undefined') {
        setDocumentFields(JSON.parse(fields as string));
      }
      
    } catch (error) {
      console.error('Error loading document data:', error);
      Alert.alert('Error', 'No se pudo cargar el documento');
    } finally {
      setLoading(false);
    }
  };

  const handleGoToSign = () => {
    router.push({
      pathname: '/signature-process',
      params: {
        signatureId,
        documentId,
        documentTitle: title,
      },
    });
  };

  const renderDocumentContent = () => {
    return (
      <DocumentContentRenderer 
        documentContent={documentContent}
        documentFields={documentFields}
      />
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Cargando documento...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        
        <TouchableOpacity
          style={styles.signButton}
          onPress={handleGoToSign}
        >
          <Ionicons name="create-outline" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {renderDocumentContent()}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.signButtonLarge}
          onPress={handleGoToSign}
        >
          <Ionicons name="create-outline" size={20} color="#fff" />
          <Text style={styles.signButtonText}>Proceder a Firmar</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e5e9',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  signButton: {
    backgroundColor: '#007AFF',
    padding: 8,
    borderRadius: 8,
    marginLeft: 8,
  },
  content: {
    flex: 1,
    backgroundColor: '#fff',
  },

  footer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e1e5e9',
  },
  signButtonLarge: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  signButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});