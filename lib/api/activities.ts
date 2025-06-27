import { apiRequest } from './config';

// Tipos para actividades
export interface Activity {
  id: number;
  userId: number;
  templateIds: number[];
  contractId?: number;
  assignedDate: string;
  dueDate: string;
  completedDate?: string;
  status: 'pending' | 'completed' | 'approved' | 'rejected' | 'overdue';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  observations?: string;
  assignedById: number;
  reviewedById?: number;
  reviewedDate?: string;
  reviewNotes?: string;
  formData?: Record<string, any>;
  activityName?: string;
  location?: string;
  createdAt: string;
  updatedAt: string;
  
  // Relaciones populadas por el backend
  user?: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    position?: string;
  };
  templates?: Array<{
    id: number;
    name: string;
    description?: string;
    type: string;
    categoryId?: number;
    category?: {
      id: number;
      name: string;
      color?: string;
    };
  }>;
  contract?: {
    id: number;
    name: string;
    description?: string;
  };
  assignedBy?: {
    id: number;
    firstName: string;
    lastName: string;
  };
}

export interface CompleteActivityRequest {
  formData: Record<string, any>;
}

// API functions para actividades
export const activitiesApi = {
  // Obtener todas las actividades del usuario actual
  getMyActivities: async (params?: {
    status?: Activity['status'];
    priority?: Activity['priority'];
    startDate?: string;
    endDate?: string;
  }): Promise<Activity[]> => {
    // Primero obtenemos la información del usuario autenticado para saber su ID
    const profile = await apiRequest<any>('/api/v1/auth/profile');
    const userId = profile.id;
    
    // Usar el endpoint específico del usuario para asegurar que solo vemos sus actividades
    const activities = await apiRequest<Activity[]>(`/api/v1/activities/user/${userId}`);
    
    // Aplicar filtros localmente si se proporcionan
    let filteredActivities = activities;
    
    if (params) {
      if (params.status) {
        filteredActivities = filteredActivities.filter(a => a.status === params.status);
      }
      if (params.priority) {
        filteredActivities = filteredActivities.filter(a => a.priority === params.priority);
      }
      if (params.startDate) {
        const startDate = new Date(params.startDate);
        filteredActivities = filteredActivities.filter(a => new Date(a.assignedDate) >= startDate);
      }
      if (params.endDate) {
        const endDate = new Date(params.endDate);
        filteredActivities = filteredActivities.filter(a => new Date(a.assignedDate) <= endDate);
      }
    }
    
    return filteredActivities;
  },

  // Obtener actividades de un usuario específico (para supervisores/admins)
  getByUser: async (userId: number): Promise<Activity[]> => {
    return apiRequest<Activity[]>(`/api/v1/activities/user/${userId}`);
  },

  // Obtener una actividad específica
  getById: async (id: number): Promise<Activity> => {
    return apiRequest<Activity>(`/api/v1/activities/${id}`);
  },

  // Completar una actividad
  complete: async (id: number, data: CompleteActivityRequest): Promise<Activity> => {
    return apiRequest<Activity>(`/api/v1/activities/${id}/complete`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  // Obtener actividades próximas (siguientes 7 días)
  getUpcoming: async (): Promise<Activity[]> => {
    const today = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(today.getDate() + 7);
    
    return activitiesApi.getMyActivities({
      status: 'pending',
      startDate: today.toISOString(),
      endDate: nextWeek.toISOString(),
    });
  },

  // Obtener actividades del día de hoy
  getToday: async (): Promise<Activity[]> => {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    
    return activitiesApi.getMyActivities({
      startDate: startOfDay.toISOString(),
      endDate: endOfDay.toISOString(),
    });
  },

  // Obtener actividades completadas de hoy
  getTodayCompleted: async (): Promise<Activity[]> => {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    
    return activitiesApi.getMyActivities({
      status: 'completed',
      startDate: startOfDay.toISOString(),
      endDate: endOfDay.toISOString(),
    });
  },

  // Obtener actividades para mañana
  getTomorrow: async (): Promise<Activity[]> => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const startOfTomorrow = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());
    const endOfTomorrow = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate() + 1);
    
    return activitiesApi.getMyActivities({
      status: 'pending',
      startDate: startOfTomorrow.toISOString(),
      endDate: endOfTomorrow.toISOString(),
    });
  },
}; 