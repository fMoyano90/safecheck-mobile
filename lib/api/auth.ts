import { apiRequest } from './config';

// Tipos para autenticación
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
  user: {
    id: number;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    position?: string | null;
    phone?: string | null;
    emergencyContactPhone?: string | null;
    rut?: string | null;
    isActive: boolean;
    companyId?: number;
    photoUrl?: string | null;
    accountStatus?: string;
    createdAt?: string;
    updatedAt?: string;
  };
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

// API functions para autenticación
export const authApi = {
  // Iniciar sesión
  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    return apiRequest<LoginResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  },

  // Refrescar token
  refreshToken: async (data: RefreshTokenRequest): Promise<LoginResponse> => {
    return apiRequest<LoginResponse>('/api/v1/auth/refresh', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Cerrar sesión (opcional - solo limpiar tokens localmente)
  logout: async (): Promise<void> => {
    // El backend de Núcleo Gestor no parece tener endpoint de logout
    // Solo retornamos una promesa resuelta para mantener la compatibilidad
    return Promise.resolve();
  },

  // Verificar token actual y obtener perfil
  me: async (): Promise<LoginResponse['user']> => {
    return apiRequest<LoginResponse['user']>('/api/v1/auth/profile');
  },

  // Solicitar reset de contraseña
  requestPasswordReset: async (email: string): Promise<void> => {
    return apiRequest<void>('/api/v1/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  // Resetear contraseña
  resetPassword: async (token: string, newPassword: string): Promise<void> => {
    return apiRequest<void>('/api/v1/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password: newPassword }),
    });
  },
}; 