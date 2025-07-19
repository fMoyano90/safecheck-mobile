import { useTheme } from '@/contexts/theme-context';

export function useThemeColors() {
  const { isDark } = useTheme();

  return {
    isDark,
    // Colores de fondo
    background: isDark ? '#1a1a1a' : '#ffffff',
    cardBackground: isDark ? '#2d2d2d' : '#f8f9fa',
    surfaceBackground: isDark ? '#3d3d3d' : '#ffffff',
    
    // Colores de texto
    text: isDark ? '#ffffff' : '#000000',
    textSecondary: isDark ? '#cccccc' : '#666666',
    textMuted: isDark ? '#999999' : '#999999',
    
    // Colores de borde
    border: isDark ? '#404040' : '#e9ecef',
    borderLight: isDark ? '#505050' : '#f0f0f0',
    
    // Colores de estado
    primary: '#007bff',
    success: '#28a745',
    warning: '#ffc107',
    error: '#dc3545',
    info: '#17a2b8',
    
    // Colores de acento
    accent: isDark ? '#4dabf7' : '#007bff',
    accentLight: isDark ? '#74c0fc' : '#339af0',
    
    // Colores de toggle
    toggleBackground: isDark ? '#404040' : '#e9ecef',
    toggleActive: '#007bff',
  };
} 