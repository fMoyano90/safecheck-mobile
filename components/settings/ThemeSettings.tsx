import React from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, ThemeMode } from '@/contexts/theme-context';
import { Text, View } from '@/components/Themed';
import { useThemeColors } from '@/hooks/useThemeColors';

interface ThemeSettingsProps {
  onThemeChange?: (mode: ThemeMode) => void;
}

export function ThemeSettings({ onThemeChange }: ThemeSettingsProps) {
  const { themeMode, isDark, setThemeMode, toggleTheme } = useTheme();
  const colors = useThemeColors();

  const handleThemeChange = async (mode: ThemeMode) => {
    await setThemeMode(mode);
    onThemeChange?.(mode);
  };

  const getThemeDescription = (mode: ThemeMode) => {
    switch (mode) {
      case 'light':
        return 'Tema claro para mejor visibilidad durante el día';
      case 'dark':
        return 'Tema oscuro para reducir la fatiga visual';
      case 'system':
        return 'Seguir la configuración del sistema';
      default:
        return '';
    }
  };

  const getThemeIcon = (mode: ThemeMode) => {
    switch (mode) {
      case 'light':
        return 'sunny-outline';
      case 'dark':
        return 'moon-outline';
      case 'system':
        return 'settings-outline';
      default:
        return 'settings-outline';
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Configuración de Tema</Text>
      <Text style={styles.subtitle}>
        Personaliza la apariencia de la aplicación según tus preferencias
      </Text>

      {/* Estado actual */}
      <View style={styles.currentThemeContainer}>
        <Text style={styles.currentThemeTitle}>Tema Actual</Text>
        <View style={[styles.currentThemeCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
          <Ionicons 
            name={getThemeIcon(themeMode)} 
            size={24} 
            color={colors.text} 
          />
          <View style={styles.currentThemeInfo}>
            <Text style={styles.currentThemeName}>
              {themeMode === 'light' ? 'Claro' : 
               themeMode === 'dark' ? 'Oscuro' : 'Sistema'}
            </Text>
            <Text style={styles.currentThemeDescription}>
              {getThemeDescription(themeMode)}
            </Text>
          </View>
        </View>
      </View>

      {/* Opciones de tema */}
      <View style={styles.optionsContainer}>
        <Text style={styles.sectionTitle}>Opciones de Tema</Text>
        
        {(['light', 'dark', 'system'] as ThemeMode[]).map((mode) => (
          <TouchableOpacity
            key={mode}
            style={[
              styles.themeOption,
              { backgroundColor: colors.cardBackground, borderColor: colors.border },
              themeMode === mode && { backgroundColor: colors.accentLight + '20', borderColor: colors.accent },
            ]}
            onPress={() => handleThemeChange(mode)}
          >
            <View style={styles.themeOptionHeader}>
              <Ionicons
                name={getThemeIcon(mode) as any}
                size={24}
                color={themeMode === mode ? colors.accent : colors.textSecondary}
              />
              <Text
                style={[
                  styles.themeOptionTitle,
                  themeMode === mode && styles.themeOptionTitleActive,
                ]}
              >
                {mode === 'light' ? 'Claro' : 
                 mode === 'dark' ? 'Oscuro' : 'Sistema'}
              </Text>
              {themeMode === mode && (
                <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
              )}
            </View>
            <Text style={styles.themeOptionDescription}>
              {getThemeDescription(mode)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Toggle rápido */}
      <View style={styles.quickToggleContainer}>
        <Text style={styles.sectionTitle}>Cambio Rápido</Text>
        <View style={[styles.quickToggleCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
          <View style={styles.quickToggleInfo}>
            <Text style={styles.quickToggleTitle}>
              Alternar entre Claro/Oscuro
            </Text>
            <Text style={styles.quickToggleDescription}>
              Cambia rápidamente entre tema claro y oscuro
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.quickToggleButton, { backgroundColor: isDark ? colors.accent : colors.toggleBackground }]}
            onPress={toggleTheme}
          >
            <Ionicons 
              name={isDark ? 'sunny' : 'moon'} 
              size={20} 
              color={isDark ? '#fff' : colors.text} 
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 24,
  },
  currentThemeContainer: {
    marginBottom: 24,
  },
  currentThemeTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  currentThemeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  currentThemeInfo: {
    marginLeft: 12,
    flex: 1,
  },
  currentThemeName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  currentThemeDescription: {
    fontSize: 14,
    opacity: 0.7,
  },
  optionsContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  themeOption: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  themeOptionActive: {
    // Los colores se aplican dinámicamente
  },
  themeOptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  themeOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
    flex: 1,
  },
  themeOptionTitleActive: {
    // Los colores se aplican dinámicamente
  },
  themeOptionDescription: {
    fontSize: 14,
    marginLeft: 36,
    opacity: 0.7,
  },
  quickToggleContainer: {
    marginBottom: 24,
  },
  quickToggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  quickToggleInfo: {
    flex: 1,
  },
  quickToggleTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  quickToggleDescription: {
    fontSize: 14,
    opacity: 0.7,
  },
  quickToggleButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
}); 