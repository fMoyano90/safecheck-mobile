import React, { useEffect } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Link, Tabs, useRouter } from 'expo-router';
import { Pressable, ActivityIndicator, View } from 'react-native';

import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { useAuth } from '@/contexts/auth-context';

// You can explore the built-in icon families and icons on the web at https://icons.expo.fyi/
function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={28} style={{ marginBottom: -3 }} {...props} />;
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  // Verificar autenticación
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading]);

  const ProfileButton = () => (
    <Link href="/modal" asChild>
      <Pressable>
        {({ pressed }) => (
          <FontAwesome
            name="user-circle"
            size={25}
            color={Colors[colorScheme ?? 'light'].text}
            style={{ marginRight: 15, opacity: pressed ? 0.5 : 1 }}
          />
        )}
      </Pressable>
    </Link>
  );

  // Mostrar loading mientras verifica autenticación
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#ff6d00" />
      </View>
    );
  }

  // No mostrar las tabs si no está autenticado
  if (!isAuthenticated) {
    return null;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.NucleoGestor.secondary, // Azul principal Núcleo Gestor
        // Disable the static render of the header on web
        // to prevent a hydration error in React Navigation v6.
        headerShown: useClientOnlyValue(false, true),
        headerRight: () => <ProfileButton />,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ color }) => <TabBarIcon name="home" color={color} />,
        }}
      />
      <Tabs.Screen
        name="recurring-activities"
        options={{
          title: 'Recurrentes',
          tabBarIcon: ({ color }) => <TabBarIcon name="repeat" color={color} />,
        }}
      />
      <Tabs.Screen
        name="pending-signatures"
        options={{
          title: 'Firmas',
          tabBarIcon: ({ color }) => <TabBarIcon name="edit" color={color} />,
        }}
      />
      <Tabs.Screen
        name="scheduled"
        options={{
          title: 'Programadas',
          tabBarIcon: ({ color }) => <TabBarIcon name="calendar" color={color} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Historial',
          tabBarIcon: ({ color }) => <TabBarIcon name="history" color={color} />,
        }}
      />
    </Tabs>
  );
}
