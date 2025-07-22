import React from 'react';
import { StyleSheet, ScrollView, SafeAreaView } from 'react-native';
import { Stack } from 'expo-router';
import { Text, View } from '@/components/Themed';
import { ConnectivitySettings } from '@/components/settings/ConnectivitySettings';
import { useConnectivityConfig } from '@/hooks/useConnectivityConfig';

/**
 * Pantalla de configuración de conectividad
 * Permite a los usuarios ajustar cómo se manejan los mensajes de conexión
 * según su entorno de trabajo (minería, oficina, campo)
 */
export default function ConnectivitySettingsScreen() {
  const { config } = useConnectivityConfig();

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen 
        options={{
          title: 'Configuración de Conectividad',
          headerShown: true,
          headerBackTitle: 'Atrás',
        }} 
      />
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Configuración de Conectividad</Text>
          <Text style={styles.subtitle}>
            Personaliza cómo se muestran los mensajes de conexión según tu entorno de trabajo
          </Text>
        </View>

        <View style={styles.currentConfigContainer}>
          <Text style={styles.currentConfigTitle}>Configuración Actual</Text>
          <View style={styles.configItem}>
            <Text style={styles.configLabel}>Entorno:</Text>
            <Text style={styles.configValue}>
              {config.environment === 'mining' ? 'Minería' : 
               config.environment === 'office' ? 'Oficina' : 
               config.environment === 'field' ? 'Campo' : 'Personalizado'}
            </Text>
          </View>
          <View style={styles.configItem}>
            <Text style={styles.configLabel}>Modo silencioso:</Text>
            <Text style={styles.configValue}>
              {config.silentMode ? 'Activado' : 'Desactivado'}
            </Text>
          </View>
          <View style={styles.configItem}>
            <Text style={styles.configLabel}>Solo indicador:</Text>
            <Text style={styles.configValue}>
              {config.showOnlyIndicator ? 'Sí' : 'No'}
            </Text>
          </View>
        </View>

        <ConnectivitySettings />

        <View style={styles.infoContainer}>
          <Text style={styles.infoTitle}>ℹ️ Información</Text>
          <Text style={styles.infoText}>
            • <Text style={styles.bold}>Entorno Minería:</Text> Oculta mensajes de conexión para evitar interrupciones en zonas de baja conectividad.
          </Text>
          <Text style={styles.infoText}>
            • <Text style={styles.bold}>Entorno Campo:</Text> Muestra solo indicadores visuales discretos.
          </Text>
          <Text style={styles.infoText}>
            • <Text style={styles.bold}>Entorno Oficina:</Text> Muestra todos los mensajes de conectividad.
          </Text>
          <Text style={styles.infoText}>
            • <Text style={styles.bold}>Personalizado:</Text> Configura cada opción individualmente.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#1a1a1a',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    lineHeight: 22,
  },
  currentConfigContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  currentConfigTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#1a1a1a',
  },
  configItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  configLabel: {
    fontSize: 16,
    color: '#666',
  },
  configValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1a1a1a',
  },
  infoContainer: {
    backgroundColor: '#e8f4fd',
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#1a1a1a',
  },
  infoText: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
    marginBottom: 8,
  },
  bold: {
    fontWeight: '600',
    color: '#1a1a1a',
  },
});