# Sistema Offline para SafetyTech Mobile

## 🎯 Objetivo

Este sistema permite que la aplicación SafetyTech Mobile funcione completamente offline en entornos mineros con baja conectividad, guardando todas las acciones localmente y sincronizándolas automáticamente cuando se recupere la conexión.

## 🏗️ Arquitectura del Sistema

### Componentes Principales

1. **NetworkManager** (`lib/offline/network-manager.ts`)
   - Detecta el estado de conectividad en tiempo real
   - Evalúa la calidad de la conexión (fuerte/débil)
   - Notifica cambios de conectividad

2. **OfflineStorage** (`lib/offline/storage.ts`)
   - Almacenamiento local estructurado usando AsyncStorage y FileSystem
   - Manejo de actividades, documentos, plantillas y borradores
   - Cola de sincronización persistente

3. **SyncManager** (`lib/offline/sync-manager.ts`)
   - Sincronización automática cuando se recupera la conexión
   - Procesamiento en lotes con reintentos automáticos
   - Gestión de prioridades en la cola de sincronización

4. **OfflineApi** (`lib/offline/offline-api.ts`)
   - Wrapper que intercepta las API calls automáticamente
   - Cache inteligente para datos de lectura
   - Manejo transparente de operaciones offline

5. **OfflineSystem** (`lib/offline/index.ts`)
   - Inicialización y orquestación de todos los componentes
   - Hook de React para el estado offline
   - Gestión del ciclo de vida del sistema

## 🚀 Características Implementadas

### ✅ Funcionalidad Offline Completa
- **Actividades**: Se pueden completar offline y se sincronizan automáticamente
- **Formularios**: Guardado automático como borradores, envío offline
- **Plantillas**: Cache local para uso sin conexión
- **Documentos**: Creación y almacenamiento local con sincronización posterior

### ✅ Sincronización Inteligente
- **Automática**: Se activa cuando se detecta conexión
- **Por lotes**: Procesa múltiples elementos eficientemente
- **Con reintentos**: Reintenta automáticamente los elementos fallidos
- **Priorizada**: Sistema de prioridades (alta/media/baja)

### ✅ Cache Inteligente
- **Datos de lectura**: Cache automático con expiración configurable
- **Fallback offline**: Usa cache cuando no hay conexión
- **Limpieza automática**: Elimina cache expirado automáticamente

### ✅ Gestión de Borradores
- **Autoguardado**: Guarda progreso automáticamente
- **Recuperación**: Carga borradores al reabrir formularios
- **Limpieza**: Elimina borradores al completar exitosamente

### ✅ UI Consciente del Estado Offline
- **Indicador visual**: Barra de estado que muestra conectividad
- **Mensajes contextuales**: Informa al usuario sobre el estado offline
- **Sincronización manual**: Botón para forzar sincronización

## 📱 Uso en la Aplicación

### Inicialización Automática
El sistema se inicializa automáticamente al abrir la aplicación:

```typescript
// En app/_layout.tsx
import { OfflineSystem } from '@/lib/offline';

// Se inicializa automáticamente
OfflineSystem.initialize();
```

### Hook para Estado Offline
```typescript
import { useOfflineStatus } from '@/lib/offline';

function MyComponent() {
  const { 
    isOnline, 
    hasStrongConnection, 
    syncStatus, 
    canMakeRequests 
  } = useOfflineStatus();

  // Usar el estado para adaptar la UI
}
```

### API Offline Transparente
```typescript
import { offlineActivitiesApi, offlineDocumentsApi } from '@/lib/offline';

// Funciona automáticamente online y offline
const activities = await offlineActivitiesApi.getMyActivities();
await offlineActivitiesApi.complete(activityId, formData);
```

### Componente de Estado
```typescript
import { OfflineStatusBar } from '@/components/ui/OfflineStatusBar';

// Muestra estado de conectividad y sincronización
<OfflineStatusBar />
```

## 🛠️ Configuración

### Opciones del Sistema
```typescript
// Configuración en sync-manager.ts
const config = {
  maxRetries: 3,           // Máximo de reintentos por operación
  retryDelay: 5000,        // Delay entre reintentos (ms)
  syncInterval: 30000,     // Intervalo de sincronización (ms)
  batchSize: 10,           // Elementos por lote
};
```

### Opciones de Cache
```typescript
// Cache configurable por endpoint
{
  enableCache: true,       // Activar cache
  cacheTimeout: 30,        // Timeout en minutos
  priority: 'medium',      // Prioridad de sincronización
  allowOfflineExecution: true // Permitir ejecución offline
}
```

## 📊 Monitoreo y Estadísticas

### Estado del Sistema
```typescript
const status = await OfflineSystem.getSystemStatus();
// {
//   network: { isConnected, hasStrongConnection, type },
//   storage: { totalActivities, pendingSyncItems, storageSizeKB },
//   syncQueue: { pending, failed, total },
//   cache: { entries, sizeKB, oldestEntry }
// }
```

### Logs del Sistema
El sistema genera logs detallados con emojis para fácil identificación:
- 🌐 NetworkManager
- 💾 OfflineStorage
- 🔄 SyncManager
- 📡 OfflineApi
- 📱 Modo offline
- ✅ Éxito
- ❌ Error
- ⚠️ Advertencia

## 🔧 Mantenimiento

### Limpieza Manual
```typescript
// Limpiar todo el sistema
await OfflineSystem.reset();

// Limpiar solo cache
await offlineApi.clearCache();

// Limpiar cola de sincronización
await syncManager.clearQueue();
```

### Gestión de Errores
```typescript
// Reintentar elementos fallidos
await syncManager.retryFailedItems();

// Estado de la cola
const queueStatus = await syncManager.getQueueStatus();
```

## 🚨 Consideraciones Importantes

### Almacenamiento Local
- Los datos se almacenan en AsyncStorage (persistente)
- Los archivos se guardan en el directorio de documentos
- El sistema limpia automáticamente datos expirados

### Sincronización
- Solo se ejecuta cuando hay conexión
- Respeta la calidad de conexión (no sincroniza con conexión muy débil)
- Los elementos fallidos se reintentan automáticamente

### Seguridad
- Los tokens de autenticación se manejan normalmente
- Los datos offline se almacenan sin encriptación adicional
- La sincronización respeta los permisos del usuario

### Performance
- El cache reduce las llamadas a la API
- La sincronización en lotes optimiza el uso de red
- Los borradores evitan pérdida de trabajo

## 🎉 Beneficios para Entornos Mineros

1. **Continuidad Operacional**: Trabajo ininterrumpido sin conexión
2. **Reducción de Pérdida de Datos**: Todo se guarda localmente
3. **Sincronización Automática**: No requiere intervención manual
4. **Optimización de Ancho de Banda**: Cache inteligente y sincronización eficiente
5. **Experiencia de Usuario Mejorada**: Feedback claro del estado offline

## 📈 Próximas Mejoras

- [ ] Compresión de datos para optimizar almacenamiento
- [ ] Encriptación de datos offline sensibles
- [ ] Sincronización selectiva por prioridad de datos
- [ ] Métricas avanzadas de uso offline
- [ ] Configuración por usuario de políticas de cache 