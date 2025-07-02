import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import FormRenderer from '@/components/forms/FormRenderer';
import { useActivityForm } from '@/hooks/useActivityForm';

export default function FormDemoScreen() {
  // En una implementación real, estos parámetros vendrían de la navegación
  const params = useLocalSearchParams();
  const activityId = parseInt(params.activityId as string) || 1;
  const activityType = (params.activityType as 'scheduled' | 'recurring') || 'scheduled';

  const {
    template,
    isLoading,
    isSubmitting,
    error,
    submitForm,
    saveForm,
  } = useActivityForm({
    activityId,
    activityType,
  });

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Cargando formulario...' }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ff6d00" />
          <Text style={styles.loadingText}>Cargando formulario...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !template) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Error' }} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Error al cargar</Text>
          <Text style={styles.errorText}>
            {error || 'No se pudo cargar el template del formulario'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: template.name || 'Formulario',
          headerBackTitle: 'Atrás',
        }} 
      />
      
      <FormRenderer
        template={template}
        onSubmit={submitForm}
        onSave={saveForm}
        isLoading={isSubmitting}
        initialValues={{}}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    gap: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ef4444',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 24,
  },
}); 