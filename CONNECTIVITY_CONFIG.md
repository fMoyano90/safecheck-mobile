# Sistema de Configuración de Conectividad para Entornos Mineros

## 🎯 Objetivo

Este sistema permite personalizar cómo la aplicación móvil maneja los mensajes de conectividad según el entorno de trabajo, especialmente diseñado para entornos mineros con baja conectividad donde los mensajes constantes de conexión perdida pueden ser molestos para los usuarios.

## 🏗️ Arquitectura

### Componentes Principales

1. **ConnectivityConfig** - Configuración centralizada
2. **ConnectivityProvider** - Proveedor de contexto React
3. **useConnectivityConfig** - Hook para manejar configuración
4. **ConnectivitySettings** - Componente de interfaz para configuración

## 🚀 Configuraciones Predefinidas

### Entorno Minero (Por Defecto)
```typescript
{
  silentMode: true,                    // No mostrar alertas de conexión
  showOnlyIndicator: true,             // Solo mostrar ícono discreto
  hideReconnectionMessages: true,      // Ocultar mensajes de reconexión
  hideSyncAlerts: false,              // Mantener alertas de sincronización importantes
  notificationCooldown: 300000,       // 5 minutos entre notificaciones
  environment: 'mining'
}
```

### Entorno de Campo
```typescript
{
  silentMode: false,
  showOnlyIndicator: true,
  hideReconnectionMessages: true,
  hideSyncAlerts: false,
  notificationCooldown: 120000,       // 2 minutos
  environment: 'field'
}
```

### Entorno de Oficina
```typescript
{
  silentMode: false,
  showOnlyIndicator: false,
  hideReconnectionMessages: false,
  hideSyncAlerts: false,
  notificationCooldown: 30000,        // 30 segundos
  environment: 'office'
}
```

## 📱 Implementación

### 1. Configurar el Proveedor

En tu componente raíz de la aplicación:

```typescript
import { ConnectivityProvider } from '@/components/providers/ConnectivityProvider';

function App() {
  return (
    <ConnectivityProvider defaultEnvironment="mining">
      {/* Tu aplicación */}
    </ConnectivityProvider>
  );
}
```

### 2. Usar la Configuración en Componentes

```typescript
import { useConnectivitySettings } from '@/hooks/useConnectivityConfig';

function MyComponent() {
  const { 
    isSilentMode, 
    showOnlyIndicator, 
    shouldShowConnectionNotification 
  } = useConnectivitySettings();

  // Usar la configuración para adaptar el comportamiento
  if (isSilentMode) {
    return null; // No mostrar nada
  }

  if (showOnlyIndicator) {
    return <SimpleIcon />; // Mostrar solo ícono
  }

  return <FullStatusBar />; // Mostrar barra completa
}
```

### 3. Agregar Pantalla de Configuración

```typescript
import { ConnectivitySettings } from '@/components/settings/ConnectivitySettings';

function SettingsScreen() {
  return (
    <View>
      <ConnectivitySettings 
        onConfigChange={(config) => {
          console.log('Configuración actualizada:', config);
        }}
      />
    </View>
  );
}
```

## 🔧 Personalización

### Cambiar Configuración Programáticamente

```typescript
import { useConnectivityConfig } from '@/hooks/useConnectivityConfig';

function useCustomConfig() {
  const { updateConfig, setEnvironment } = useConnectivityConfig();

  // Cambiar a entorno minero
  const enableMiningMode = () => {
    setEnvironment('mining');
  };

  // Configuración personalizada
  const enableCustomMode = () => {
    updateConfig({
      silentMode: true,
      showOnlyIndicator: false,
      hideReconnectionMessages: true,
    });
  };

  return { enableMiningMode, enableCustomMode };
}
```

### Verificar Configuración Antes de Mostrar Alertas

```typescript
import { connectivityConfig } from '@/lib/config/connectivity-config';

// En servicios o componentes
function showConnectionAlert() {
  if (connectivityConfig.shouldShowConnectionNotification()) {
    Alert.alert('Conexión perdida', 'Se perdió la conexión a internet');
  }
}

function showReconnectionMessage() {
  if (connectivityConfig.shouldShowReconnectionMessages()) {
    console.log('Intentando reconectar...');
  }
}
```

## 🎨 Componentes Afectados

### OfflineStatusBar
- **Modo Silencioso**: No se muestra
- **Solo Indicador**: Muestra ícono pequeño en esquina superior derecha
- **Modo Normal**: Muestra barra completa con información detallada

### NotificationService
- Respeta configuración para mensajes de conexión/desconexión WebSocket
- Oculta mensajes de reconexión según configuración
- Mantiene funcionalidad pero sin mostrar logs molestos

### NetworkManager
- Controla mensajes de conexión de red perdida/restaurada
- Aplica cooldown entre notificaciones
- Respeta modo silencioso

## 📊 Persistencia

La configuración se guarda automáticamente en `AsyncStorage` con la clave `connectivity_config` y se restaura al iniciar la aplicación.

## 🔍 Debugging

En modo desarrollo, la configuración actual se muestra en la consola:

```
📱 Configuración de conectividad activa: {
  environment: 'mining',
  silentMode: true,
  showOnlyIndicator: true,
  hideReconnectionMessages: true,
  hideSyncAlerts: false
}
```

## 🚨 Consideraciones Importantes

1. **Sincronización**: Las alertas de sincronización se mantienen activas por defecto en entorno minero, ya que son críticas para el funcionamiento offline.

2. **Indicador Visual**: Incluso en modo silencioso, se puede mostrar un indicador visual discreto para que el usuario sepa el estado de conectividad.

3. **Cooldown**: Se implementa un tiempo mínimo entre notificaciones para evitar spam de mensajes.

4. **Flexibilidad**: Los usuarios pueden cambiar entre configuraciones predefinidas o crear configuraciones personalizadas.

## 🔄 Migración

Para aplicaciones existentes:

1. Agregar el `ConnectivityProvider` en el componente raíz
2. Los componentes existentes seguirán funcionando normalmente
3. La configuración por defecto es "mining" para máxima compatibilidad con entornos de baja conectividad
4. Los usuarios pueden cambiar la configuración desde la pantalla de ajustes

## 📝 Ejemplo de Uso Completo

```typescript
// App.tsx
import { ConnectivityProvider } from '@/components/providers/ConnectivityProvider';

function App() {
  return (
    <ConnectivityProvider defaultEnvironment="mining">
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
    </ConnectivityProvider>
  );
}

// En cualquier pantalla
import { ConnectivitySettings } from '@/components/settings/ConnectivitySettings';
import { OfflineStatusBar } from '@/components/ui/OfflineStatusBar';

function MainScreen() {
  return (
    <View>
      <OfflineStatusBar /> {/* Se adapta automáticamente según configuración */}
      {/* Resto del contenido */}
    </View>
  );
}

// Pantalla de configuración
function SettingsScreen() {
  return (
    <ScrollView>
      <ConnectivitySettings />
    </ScrollView>
  );
}
```

Este sistema proporciona una solución completa y flexible para manejar la conectividad en entornos mineros, permitiendo que los usuarios trabajen sin interrupciones molestas mientras mantienen la funcionalidad esencial de la aplicación.