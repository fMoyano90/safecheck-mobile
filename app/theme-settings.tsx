import React from 'react';
import { StyleSheet, ScrollView, SafeAreaView } from 'react-native';
import { Stack } from 'expo-router';
import { Text, View } from '@/components/Themed';
import { ThemeSettings } from '@/components/settings/ThemeSettings';
import { useTheme, ThemeMode } from '@/contexts/theme-context';

/**
 * Pantalla de configuración de tema
 * Permite a los usuarios cambiar entre modo claro, oscuro y sistema
 */
export default function ThemeSettingsScreen() {
  const { themeMode, isDark } = useTheme();

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen 
        options={{
          title: 'Configuración de Tema',
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
          <Text style={styles.title}>Configuración de Tema</Text>
          <Text style={styles.subtitle}>
            Personaliza la apariencia de la aplicación según tus preferencias
          </Text>
        </View>

        <View style={styles.currentConfigContainer}>
          <Text style={styles.currentConfigTitle}>Configuración Actual</Text>
          <View style={styles.configItem}>
            <Text style={styles.configLabel}>Tema:</Text>
            <Text style={styles.configValue}>
              {themeMode === 'light' ? 'Claro' : 
               themeMode === 'dark' ? 'Oscuro' : 'Sistema'}
            </Text>
          </View>
          <View style={styles.configItem}>
            <Text style={styles.configLabel}>Estado:</Text>
            <Text style={styles.configValue}>
              {isDark ? 'Modo Oscuro' : 'Modo Claro'}
            </Text>
          </View>
        </View>

        <ThemeSettings />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 20,
  },
  header: {
    padding: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
  },
  currentConfigContainer: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  currentConfigTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  configItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  configLabel: {
    fontSize: 16,
    color: '#666',
  },
  configValue: {
    fontSize: 16,
    fontWeight: '600',
  },
});