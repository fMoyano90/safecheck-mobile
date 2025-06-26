import { useState, useEffect } from 'react';

const API_BASE_URL = 'http://localhost:3030/api/v1'; // Cambiar por la URL de producción

interface Question {
  id: string;
  text: string;
  type: string;
  required: boolean;
  description?: string;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}

interface Section {
  id: string;
  title: string;
  description?: string;
  questions: Question[];
  order: number;
}

interface FormTemplate {
  id: string;
  name: string;
  description?: string;
  type: string;
  sections: Section[];
  metadata: {
    totalQuestions: number;
    estimatedTime: number;
    requiresSignature: boolean;
    requiresPhotos: boolean;
  };
}

interface FormResponse {
  [questionId: string]: any;
}

interface FormSubmission {
  templateId: string;
  responses: FormResponse;
  metadata: {
    startTime: string;
    endTime: string;
    deviceInfo?: string;
    location?: {
      latitude: number;
      longitude: number;
    };
  };
}

export const useFormTemplates = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAuthToken = async (): Promise<string | null> => {
    // TODO: Implementar lógica de autenticación
    // Esto debería obtener el token desde AsyncStorage o similar
    return 'your-auth-token';
  };

  const apiRequest = async (endpoint: string, options: RequestInit = {}) => {
    try {
      const token = await getAuthToken();
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
          ...options.headers,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (err) {
      console.error('API request failed:', err);
      throw err;
    }
  };

  const getTemplatePreview = async (templateId: string): Promise<FormTemplate> => {
    setLoading(true);
    setError(null);
    
    try {
      const template = await apiRequest(`/templates/${templateId}/preview`);
      return template;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al cargar la plantilla';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getTemplatesByCategory = async (categoryId: string): Promise<FormTemplate[]> => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiRequest(`/templates?categoryId=${categoryId}&isActive=true`);
      return response.templates || response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al cargar las plantillas';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getTemplatesByType = async (type: string): Promise<FormTemplate[]> => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiRequest(`/templates?type=${type}&isActive=true`);
      return response.templates || response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al cargar las plantillas';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const submitForm = async (submission: FormSubmission): Promise<void> => {
    setLoading(true);
    setError(null);
    
    try {
      await apiRequest('/form-submissions', {
        method: 'POST',
        body: JSON.stringify(submission),
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al enviar el formulario';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const saveDraft = async (templateId: string, responses: FormResponse): Promise<void> => {
    setLoading(true);
    setError(null);
    
    try {
      await apiRequest('/form-drafts', {
        method: 'POST',
        body: JSON.stringify({
          templateId,
          responses,
          savedAt: new Date().toISOString(),
        }),
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al guardar el borrador';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getDrafts = async (): Promise<any[]> => {
    setLoading(true);
    setError(null);
    
    try {
      const drafts = await apiRequest('/form-drafts');
      return drafts;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al cargar los borradores';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getCategories = async (): Promise<any[]> => {
    setLoading(true);
    setError(null);
    
    try {
      const categories = await apiRequest('/categories?isActive=true');
      return categories;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al cargar las categorías';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getCategoriesByFormType = async (formType: string): Promise<any[]> => {
    setLoading(true);
    setError(null);
    
    try {
      const categories = await apiRequest(`/categories/form-type/${formType}`);
      return categories;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al cargar las categorías';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    getTemplatePreview,
    getTemplatesByCategory,
    getTemplatesByType,
    submitForm,
    saveDraft,
    getDrafts,
    getCategories,
    getCategoriesByFormType,
  };
};

export default useFormTemplates; 