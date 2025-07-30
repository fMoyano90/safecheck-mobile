import { apiRequest } from './config';

// Tipos para usuarios
export interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'supervisor' | 'worker';
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

// API functions para usuarios
export const usersApi = {
  // Obtener todos los usuarios con rol supervisor o worker
  getTeamMembers: async (): Promise<User[]> => {
    return apiRequest<User[]>('/api/v1/users/team-members');
  },

  // Obtener usuario por ID
  getUserById: async (userId: number): Promise<User> => {
    return apiRequest<User>(`/api/v1/users/${userId}`);
  },

  // Obtener todos los usuarios de la empresa
  getCompanyUsers: async (): Promise<User[]> => {
    return apiRequest<User[]>('/api/v1/users');
  },
};