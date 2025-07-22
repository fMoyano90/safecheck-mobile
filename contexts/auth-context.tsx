import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { authApi, tokenManager, LoginRequest, LoginResponse, UpdateProfileRequest, ChangePasswordRequest } from '@/lib/api';

interface User {
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
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (data: UpdateProfileRequest) => Promise<void>;
  changePassword: (data: ChangePasswordRequest) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Verificar si el usuario ya está autenticado al cargar la app
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      setIsLoading(true);
      const isAuth = await tokenManager.isAuthenticated();
      
      if (isAuth) {
        // Intentar obtener los datos del usuario desde el storage local
        const userData = await tokenManager.getUserData();
        if (userData) {
          setUser(userData);
          setIsAuthenticated(true);
        } else {
          // Si no hay datos locales, intentar obtenerlos del servidor
          await refreshProfile();
        }
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
      setUser(null);
      setIsAuthenticated(false);
      await tokenManager.clearTokens();
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (credentials: LoginRequest) => {
    try {
      setIsLoading(true);
      const response = await authApi.login(credentials);
      
      // Guardar tokens
      await tokenManager.setTokens(response.accessToken, response.refreshToken);
      
      // Guardar datos del usuario
      await tokenManager.setUserData(response.user);
      
      setUser(response.user);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      setIsLoading(true);
      
      // Intentar logout en el servidor
      try {
        await authApi.logout();
      } catch (error) {
        console.warn('Error during server logout:', error);
        // Continuar con el logout local aunque falle el servidor
      }
      
      // Limpiar datos locales
      await tokenManager.clearTokens();
      setUser(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshProfile = async () => {
    try {
      const userData = await authApi.me();
      await tokenManager.setUserData(userData);
      setUser(userData);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Error refreshing profile:', error);
      // Si falla obtener el perfil, probablemente el token expiró
      await logout();
      throw error;
    }
  };

  const updateProfile = async (data: UpdateProfileRequest) => {
    try {
      const updatedUser = await authApi.updateProfile(data);
      await tokenManager.setUserData(updatedUser);
      setUser(updatedUser);
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  };

  const changePassword = async (data: ChangePasswordRequest) => {
    try {
      await authApi.changePassword(data);
    } catch (error) {
      console.error('Error changing password:', error);
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated,
    login,
    logout,
    refreshProfile,
    updateProfile,
    changePassword,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}