import AsyncStorage from '@react-native-async-storage/async-storage';

// Configuración base para llamadas a la API
// Para desarrollo local usar: http://localhost:3030
// Para emulador Android: http://10.0.2.2:3030  
// Para dispositivo físico: usar IP local ej: http://192.168.1.X:3030
// Para producción: https://web-production-aefcf.up.railway.app
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://web-production-aefcf.up.railway.app';

export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: any) {
    super(message);
    this.name = 'ApiError';
  }
}

// Funciones para manejar tokens en React Native
export const tokenManager = {
  getAccessToken: async (): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem('auth_token');
    } catch (error) {
      console.error('Error getting access token:', error);
      return null;
    }
  },

  getRefreshToken: async (): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem('refresh_token');
    } catch (error) {
      console.error('Error getting refresh token:', error);
      return null;
    }
  },

  setTokens: async (accessToken: string, refreshToken: string): Promise<void> => {
    try {
      await AsyncStorage.setItem('auth_token', accessToken);
      await AsyncStorage.setItem('refresh_token', refreshToken);
    } catch (error) {
      console.error('Error setting tokens:', error);
    }
  },

  clearTokens: async (): Promise<void> => {
    try {
      await AsyncStorage.multiRemove(['auth_token', 'refresh_token', 'user_data']);
    } catch (error) {
      console.error('Error clearing tokens:', error);
    }
  },

  setUserData: async (userData: any): Promise<void> => {
    try {
      await AsyncStorage.setItem('user_data', JSON.stringify(userData));
    } catch (error) {
      console.error('Error setting user data:', error);
    }
  },

  getUserData: async (): Promise<any | null> => {
    try {
      const userData = await AsyncStorage.getItem('user_data');
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      console.error('Error getting user data:', error);
      return null;
    }
  },

  isAuthenticated: async (): Promise<boolean> => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      return !!token;
    } catch (error) {
      console.error('Error checking authentication:', error);
      return false;
    }
  }
};

// Función base para hacer requests
export async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  // Agregar prefijo /api/v1 si no está presente
  const fullEndpoint = endpoint.startsWith('/api/v1') ? endpoint : `/api/v1${endpoint}`;
  const url = `${API_BASE_URL}${fullEndpoint}`;
  
  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Agregar token de autenticación si está disponible
  const token = await tokenManager.getAccessToken();
  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  const config: RequestInit = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, config);
    
    // Si el token expiró (401), intentar renovarlo
    if (response.status === 401 && token) {
      const refreshToken = await tokenManager.getRefreshToken();
      if (refreshToken) {
        try {
          // Intentar renovar el token
          const refreshResponse = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ refreshToken }),
          });

          if (refreshResponse.ok) {
            const refreshData = await refreshResponse.json();
            // Extraer data si está envuelto
            const tokenData = refreshData.data || refreshData;
            const { accessToken, refreshToken: newRefreshToken } = tokenData;
            await tokenManager.setTokens(accessToken, newRefreshToken);
            
            // Reintentar la request original con el nuevo token
            config.headers = {
              ...config.headers,
              'Authorization': `Bearer ${accessToken}`,
            };
            const retryResponse = await fetch(url, config);
            
            if (!retryResponse.ok) {
              const retryErrorData = await retryResponse.text();
              console.error('❌ Retry failed after token refresh:', retryErrorData);
              throw new ApiError(retryResponse.status, 'Error después de renovar token', retryErrorData);
            }
            
            const retryData = await retryResponse.json();
            // Extraer data si está envuelto
            if (retryData && typeof retryData === 'object' && 'success' in retryData && 'data' in retryData) {
              return retryData.data;
            }
            return retryData;
          } else {
            console.error('❌ Token refresh failed');
            // Si no se pudo renovar, limpiar tokens
            await tokenManager.clearTokens();
            throw new ApiError(401, 'Sesión expirada');
          }
        } catch (refreshError) {
          console.error('❌ Token refresh error:', refreshError);
          await tokenManager.clearTokens();
          throw new ApiError(401, 'Sesión expirada');
        }
      } else {
        console.error('❌ No refresh token available');
        throw new ApiError(401, 'No autenticado');
      }
    }
    
    if (!response.ok) {
      let errorMessage = 'Error en la request';
      let errorDetails = null;
      
      try {
        const errorText = await response.text();
        console.error('❌ API Error Response:', errorText);
        
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorData.error || errorMessage;
          errorDetails = errorData;
        } catch {
          errorMessage = errorText || response.statusText || errorMessage;
          errorDetails = errorText;
        }
      } catch (parseError) {
        console.error('❌ Error parsing error response:', parseError);
        errorMessage = response.statusText || errorMessage;
      }
      
      throw new ApiError(response.status, errorMessage, errorDetails);
    }

    const responseText = await response.text();
    
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (parseError) {
      console.error('❌ Error parsing JSON response:', parseError);
      throw new ApiError(500, 'Respuesta inválida del servidor', responseText);
    }
    
    // Si la respuesta tiene la estructura {success: true, data: ...}, extraer solo data
    if (responseData && typeof responseData === 'object' && 'success' in responseData && 'data' in responseData) {
      return responseData.data;
    }
    
    return responseData;
  } catch (error) {
    console.error('❌ API Request failed:', error);
    
    if (error instanceof ApiError) {
      throw error;
    }
    
    // Error de red o conexión
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new ApiError(0, 'Error de conexión - Verifica que el servidor esté funcionando', error.message);
    }
    
    throw new ApiError(500, 'Error interno del servidor', error);
  }
}

// Cliente API simplificado para compatibilidad
export const apiClient = {
  get: async <T>(endpoint: string) => {
    const data = await apiRequest<T>(endpoint, { method: 'GET' });
    return { data: { success: true, data } };
  },
  post: async <T>(endpoint: string, body?: any) => {
    const data = await apiRequest<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
    return { data: { success: true, data, message: 'Operación exitosa' } };
  },
  delete: async <T>(endpoint: string, options?: { data?: any }) => {
    const data = await apiRequest<T>(endpoint, {
      method: 'DELETE',
      body: options?.data ? JSON.stringify(options.data) : undefined,
    });
    return { data: { success: true, data, message: 'Operación exitosa' } };
  },
};