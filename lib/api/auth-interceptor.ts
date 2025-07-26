import { ApiError } from './config';

// Tipo para el callback de manejo de errores de autenticación
type AuthErrorHandler = (error: ApiError) => void;

// Variable global para almacenar el handler de errores de autenticación
let globalAuthErrorHandler: AuthErrorHandler | null = null;

/**
 * Registra un handler global para errores de autenticación
 * Este será llamado cuando se detecte un error 401 o token expirado
 */
export function setGlobalAuthErrorHandler(handler: AuthErrorHandler) {
  globalAuthErrorHandler = handler;
}

/**
 * Limpia el handler global de errores de autenticación
 */
export function clearGlobalAuthErrorHandler() {
  globalAuthErrorHandler = null;
}

/**
 * Maneja errores de autenticación usando el handler global registrado
 */
export function handleGlobalAuthError(error: ApiError) {
  if (globalAuthErrorHandler && (error.status === 401 || error.message.includes('Sesión expirada'))) {
    console.log('🔄 Interceptor detectó error de autenticación, ejecutando handler global');
    globalAuthErrorHandler(error);
  }
}

/**
 * Verifica si hay un handler global registrado
 */
export function hasGlobalAuthErrorHandler(): boolean {
  return globalAuthErrorHandler !== null;
}