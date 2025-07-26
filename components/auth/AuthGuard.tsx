import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '@/contexts/auth-context';
import useAuthRedirect from '@/hooks/useAuthRedirect';

interface AuthGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Componente que protege rutas requiriendo autenticación
 * Redirige automáticamente al login si el usuario no está autenticado
 */
export function AuthGuard({ children, fallback }: AuthGuardProps) {
  const { isLoading } = useAuth();
  const { shouldShowContent } = useAuthRedirect();

  // Mostrar loading mientras verifica autenticación
  if (isLoading) {
    return (
      fallback || (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#ff6d00" />
        </View>
      )
    );
  }

  // No mostrar contenido si no está autenticado (el hook maneja la redirección)
  if (!shouldShowContent) {
    return null;
  }

  return <>{children}</>;
}

export default AuthGuard;