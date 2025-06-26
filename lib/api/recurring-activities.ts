import { apiRequest } from './config';

// Tipos para actividades recurrentes
export interface RecurringActivity {
  id: number;
  userId: number;
  templateId: number;
  status: 'active' | 'inactive' | 'paused';
  assignedDate: string;
  lastCompleted?: string;
  completionCount: number;
  assignedById: number;
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
  template?: {
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
  };
  assignedBy?: {
    id: number;
    firstName: string;
    lastName: string;
  };
}

export interface CreateRecurringActivityRequest {
  userId: number;
  templateId: number;
  assignedDate?: string;
}

export interface UpdateRecurringActivityRequest {
  status?: RecurringActivity['status'];
  assignedDate?: string;
}

// API functions para actividades recurrentes
export const recurringActivitiesApi = {
  // Obtener todas las actividades recurrentes del usuario actual
  getMyRecurringActivities: async (params?: {
    status?: RecurringActivity['status'];
    templateId?: number;
    categoryId?: number;
    type?: string;
  }): Promise<RecurringActivity[]> => {
    // Primero obtenemos la información del usuario autenticado para saber su ID
    const profile = await apiRequest<any>('/api/v1/auth/profile');
    const userId = profile.id;
    
    // Usar el endpoint específico del usuario para asegurar que solo vemos sus actividades recurrentes
    const activities = await apiRequest<RecurringActivity[]>(`/api/v1/recurring-activities/user/${userId}`);
    
    // Aplicar filtros localmente si se proporcionan
    let filteredActivities = activities;
    
    if (params) {
      if (params.status) {
        filteredActivities = filteredActivities.filter(a => a.status === params.status);
      }
      if (params.templateId) {
        filteredActivities = filteredActivities.filter(a => a.templateId === params.templateId);
      }
      if (params.categoryId && params.categoryId > 0) {
        filteredActivities = filteredActivities.filter(a => 
          a.template?.categoryId === params.categoryId
        );
      }
      if (params.type) {
        filteredActivities = filteredActivities.filter(a => 
          a.template?.type === params.type
        );
      }
    }
    
    return filteredActivities;
  },

  // Obtener actividades recurrentes de un usuario específico (para supervisores/admins)
  getByUser: async (userId: number): Promise<RecurringActivity[]> => {
    return apiRequest<RecurringActivity[]>(`/api/v1/recurring-activities/user/${userId}`);
  },

  // Obtener una actividad recurrente específica
  getById: async (id: number): Promise<RecurringActivity> => {
    return apiRequest<RecurringActivity>(`/api/v1/recurring-activities/${id}`);
  },

  // Crear nueva actividad recurrente (solo admins/supervisores)
  create: async (data: CreateRecurringActivityRequest): Promise<RecurringActivity> => {
    return apiRequest<RecurringActivity>('/api/v1/recurring-activities', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Actualizar actividad recurrente (solo admins/supervisores)
  update: async (id: number, data: UpdateRecurringActivityRequest): Promise<RecurringActivity> => {
    return apiRequest<RecurringActivity>(`/api/v1/recurring-activities/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Eliminar actividad recurrente (solo admins/supervisores)
  delete: async (id: number): Promise<void> => {
    return apiRequest<void>(`/api/v1/recurring-activities/${id}`, {
      method: 'DELETE',
    });
  },

  // Obtener actividades recurrentes activas
  getActive: async (): Promise<RecurringActivity[]> => {
    return recurringActivitiesApi.getMyRecurringActivities({
      status: 'active',
    });
  },

  // Obtener tipos disponibles
  getAvailableTypes: async (): Promise<Array<{ type: string; count: number }>> => {
    return apiRequest<Array<{ type: string; count: number }>>('/api/v1/recurring-activities/types');
  },

  // Obtener categorías disponibles
  getAvailableCategories: async (): Promise<Array<{ categoryId: number; categoryName: string; count: number }>> => {
    return apiRequest<Array<{ categoryId: number; categoryName: string; count: number }>>('/api/v1/recurring-activities/categories');
  },
}; 