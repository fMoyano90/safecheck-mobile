import { useColorScheme as useNativeColorScheme } from 'react-native';

export function useColorScheme() {
  const colorScheme = useNativeColorScheme();
  return colorScheme ?? 'light'; // Siempre devolver 'light' como fallback
}
