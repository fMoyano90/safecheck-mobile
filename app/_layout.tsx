import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { AuthProvider } from '@/contexts/auth-context';
import { NotificationProvider } from '@/contexts/notification-context';
import { ConnectivityProvider } from '@/components/providers/ConnectivityProvider';
import { ThemeProvider as AppThemeProvider } from '@/contexts/theme-context';
import { OfflineSystem } from '@/lib/offline';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: 'login',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
      
      // Inicializar sistema offline
      OfflineSystem.initialize()
        .then(() => {
          console.log('✅ Sistema offline listo');
        })
        .catch((error) => {
          console.error('❌ Error inicializando sistema offline:', error);
        });
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <AppThemeProvider>
      <AuthProvider>
        <ConnectivityProvider defaultEnvironment="mining">
          <NotificationProvider>
            <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
              <Stack>
                <Stack.Screen name="login" options={{ headerShown: false }} />
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="modal" options={{ presentation: 'modal', headerShown: false }} />
                <Stack.Screen name="notifications" options={{ headerShown: false }} />
                <Stack.Screen name="notification-settings" options={{ headerShown: false }} />
                <Stack.Screen name="connectivity-settings" options={{ headerShown: true, title: 'Conectividad' }} />
                <Stack.Screen name="theme-settings" options={{ headerShown: true, title: 'Tema' }} />
              </Stack>
            </ThemeProvider>
          </NotificationProvider>
        </ConnectivityProvider>
      </AuthProvider>
    </AppThemeProvider>
  );
}
