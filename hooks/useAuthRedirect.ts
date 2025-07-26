import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';

/**
 * Hook personalizado para manejar la redirección automática al login
 * cuando el usuario no está autenticado o el token expira
 */
export function useAuthRedirect() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Solo redirigir si no está cargando y no está autenticado
    if (!isLoading && !isAuthenticated) {
      console.log('🔄 Redirigiendo al login - usuario no autenticado');
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  return {
    isAuthenticated,
    isLoading,
    shouldShowContent: isAuthenticated && !isLoading
  };
}

export default useAuthRedirect;