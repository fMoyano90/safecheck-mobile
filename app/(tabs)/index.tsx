import {
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  SafeAreaView,
} from "react-native";
import { Text, View } from "@/components/Themed";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/auth-context";
import {
  activitiesApi,
  type Activity,
  recurringActivitiesApi,
  type RecurringActivity,
} from "@/lib/api";
import React, { useState, useEffect, useRef } from "react";
import FormButton from "@/components/activities/FormButton";
import ActivityDetailsModal from "@/components/activities/ActivityDetailsModal";
import { AppState } from "react-native";
import { useAutoRefresh } from "../../hooks/useAutoRefresh";
import { RefreshIndicator } from "../../components/ui/RefreshIndicator";
import { SubtleRefreshIndicator } from "../../components/ui/SubtleRefreshIndicator";
import { documentsApi } from "@/lib/api";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import {
  offlineActivitiesApi,
  offlineStorage,
  useOfflineStatus,
} from "@/lib/offline";

// Tipos locales para el componente
type LocalActivity = {
  id: number;
  time: string;
  title: string;
  location: string;
  type: string;
  priority: string;
  status: string;
  assignedDate: string;
  date: string;
};

type QuickAction = {
  id: string;
  title: string;
  description: string;
  icon: string;
  route: string;
  color: string;
};

// Función para convertir Activity del backend a LocalActivity para mostrar
const convertToLocalActivity = (activity: Activity): LocalActivity => {
  const assignedDate = new Date(activity.assignedDate);
  const time = assignedDate.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  // Determinar el título basado en activityName, templates o valor por defecto
  let title = "Actividad";

  // Prioridad 1: usar activityName si está disponible
  if (activity.activityName && activity.activityName.trim()) {
    title = activity.activityName;
  }
  // Prioridad 2: usar nombres de templates si no hay activityName
  else if (activity.templates && activity.templates.length > 0) {
    if (activity.templates.length === 1) {
      title = activity.templates[0].name;
    } else {
      title = `${activity.templates[0].name} (+${
        activity.templates.length - 1
      } más)`;
    }
  }
  // Prioridad 3: mantener "Actividad" como valor por defecto

  // Determinar tipo basado en la categoría del template
  let type = "task";
  if (
    activity.templates &&
    activity.templates.length > 0 &&
    activity.templates[0].category
  ) {
    const categoryName = activity.templates[0].category.name.toLowerCase();
    if (
      categoryName.includes("inspección") ||
      categoryName.includes("inspection")
    )
      type = "inspection";
    else if (
      categoryName.includes("capacitación") ||
      categoryName.includes("training")
    )
      type = "training";
    else if (
      categoryName.includes("evaluación") ||
      categoryName.includes("evaluation")
    )
      type = "evaluation";
    else if (
      categoryName.includes("reunión") ||
      categoryName.includes("meeting")
    )
      type = "meeting";
  }

  return {
    id: activity.id,
    time,
    title,
    location:
      activity.location ||
      activity.contract?.name ||
      "Ubicación no especificada",
    type,
    priority: activity.priority,
    status: activity.status,
    assignedDate: activity.assignedDate,
    date: `${assignedDate.getFullYear()}-${String(assignedDate.getMonth() + 1).padStart(2, '0')}-${String(assignedDate.getDate()).padStart(2, '0')}`,
  };
};

// Función para convertir RecurringActivity del backend a LocalActivity para mostrar
const convertRecurringToLocalActivity = (
  recurringActivity: RecurringActivity
): LocalActivity => {
  // Para actividades recurrentes, no hay hora específica
  const time = "Diario";

  // Título basado en el template
  let title = "Actividad Recurrente";
  if (recurringActivity.template) {
    title = recurringActivity.template.name;
  }

  // Determinar tipo basado en la categoría del template
  let type = "recurring";
  if (recurringActivity.template?.category) {
    const categoryName = recurringActivity.template.category.name.toLowerCase();
    if (
      categoryName.includes("inspección") ||
      categoryName.includes("inspection")
    )
      type = "inspection";
    else if (
      categoryName.includes("capacitación") ||
      categoryName.includes("training")
    )
      type = "training";
    else if (
      categoryName.includes("evaluación") ||
      categoryName.includes("evaluation")
    )
      type = "evaluation";
    else if (
      categoryName.includes("reunión") ||
      categoryName.includes("meeting")
    )
      type = "meeting";
  }

  return {
    id: recurringActivity.id,
    time,
    title,
    location: recurringActivity.template?.category?.name || "Sin categoría",
    type,
    priority: "medium", // Las actividades recurrentes no tienen prioridad definida
    status: recurringActivity.status === "active" ? "pending" : "completed",
    assignedDate: new Date().toISOString(), // Para actividades recurrentes, usar fecha actual
    date: (() => {
      const today = new Date();
      return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    })(),
  };
};

export default function HomeScreen() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [todayActivities, setTodayActivities] = useState<LocalActivity[]>([]);
  const [completedActivities, setCompletedActivities] = useState<
    LocalActivity[]
  >([]);
  const [upcomingActivities, setUpcomingActivities] = useState<Activity[]>([]);
  const [recurringActivities, setRecurringActivities] = useState<
    RecurringActivity[]
  >([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  // Hook para estado offline
  const { isOnline, hasStrongConnection } = useOfflineStatus();

  const currentDate = new Date();
  const dateString = currentDate.toLocaleDateString("es-ES", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Determinar el saludo según la hora
  const getGreeting = () => {
    const hour = currentDate.getHours();
    if (hour < 12) return "Buenos días";
    if (hour < 18) return "Buenas tardes";
    return "Buenas noches";
  };

  // Obtener el nombre del usuario
  const getUserName = () => {
    if (!user) return "Usuario";

    const firstName = user.firstName || "";
    const lastName = user.lastName || "";

    // Si tiene ambos nombres, usar solo el primer nombre
    if (firstName && lastName) {
      return firstName;
    }

    // Si solo tiene uno, usar ese
    if (firstName) return firstName;
    if (lastName) return lastName;

    // Si no tiene nombres, extraer del email
    if (user.email) {
      const emailName = user.email.split("@")[0];
      return emailName.charAt(0).toUpperCase() + emailName.slice(1);
    }

    return "Usuario";
  };

  // Cargar actividades cuando el usuario esté autenticado
  useEffect(() => {
    if (user && !isLoading) {
      loadActivities();
    }
  }, [user, isLoading]);

  const loadActivities = async () => {
    if (!user) return;

    try {
      setLoadingActivities(true);
      setIsOfflineMode(false);

      // Verificar si el sistema offline está inicializado
      const OfflineSystem = require("@/lib/offline").OfflineSystem;
      const isInitialized = OfflineSystem.isInitialized();
      console.log(`🔧 Sistema offline inicializado: ${isInitialized}`);

      if (!isInitialized) {
        console.log("⏳ Esperando inicialización del sistema offline...");
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      let allActivities: Activity[] = [];
      let todayCompleted: Activity[] = [];
      let recurring: RecurringActivity[] = [];

      console.log(
        `🔍 Estado de conexión: isOnline=${isOnline}, hasStrongConnection=${hasStrongConnection}`
      );

      if (isOnline && hasStrongConnection) {
        console.log("🔧 Cargando desde servidor...");
        // Modo online: cargar desde API y guardar en cache
        try {
          // Cargar todas las actividades del usuario (igual que scheduled.tsx)
          const [allActivities, completedActivities, recurringActivities] = await Promise.all([
            offlineActivitiesApi.getMyActivities(), // Sin filtro de status
            offlineActivitiesApi.getTodayCompleted(),
            recurringActivitiesApi.getActive(),
          ]);

          
          // Asignar directamente sin filtrado adicional complejo
          todayCompleted = completedActivities;
          recurring = recurringActivities;
          
          // Filtrar actividades por status y fecha (igual que scheduled.tsx)
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          // Actividades pendientes y vencidas
          const pendingAndOverdueActivities = allActivities.filter((activity) => 
            activity.status === "pending" || activity.status === "overdue"
          );
          
          // Separar por fecha
          const todayPendingActivities = pendingAndOverdueActivities.filter((activity) => {
            const activityDate = new Date(activity.assignedDate);
            activityDate.setHours(0, 0, 0, 0);
            return activityDate.getTime() === today.getTime();
          });
          
          const overdueActivities = pendingAndOverdueActivities.filter((activity) => {
            const activityDate = new Date(activity.assignedDate);
            activityDate.setHours(0, 0, 0, 0);
            return activityDate.getTime() < today.getTime();
          });
          
          const futurePendingActivities = pendingAndOverdueActivities.filter((activity) => {
            const activityDate = new Date(activity.assignedDate);
            activityDate.setHours(0, 0, 0, 0);
            return activityDate.getTime() > today.getTime();
          });
          
          // Combinar actividades de hoy con las vencidas para mostrar en "hoy"
          const todayAndOverdueActivities = [...todayPendingActivities, ...overdueActivities];
          
          console.log(
            `✅ Actividades cargadas: ${todayPendingActivities.length} hoy, ${overdueActivities.length} vencidas, ${futurePendingActivities.length} futuras, ${todayCompleted.length} completadas hoy, ${recurring.length} recurrentes`
          );

          // Ordenar actividades
          const sortedTodayAndOverdue = todayAndOverdueActivities.sort(
            (a, b) =>
              new Date(a.assignedDate).getTime() -
              new Date(b.assignedDate).getTime()
          );
          
          const sortedUpcoming = futurePendingActivities.sort(
            (a, b) =>
              new Date(a.assignedDate).getTime() -
              new Date(b.assignedDate).getTime()
          );

          const convertedTodayActivities = sortedTodayAndOverdue.map(convertToLocalActivity);

          setTodayActivities(convertedTodayActivities);
          setCompletedActivities(todayCompleted.map(convertToLocalActivity));
          setUpcomingActivities(sortedUpcoming);
          setRecurringActivities(recurring);
          
          // Guardar en almacenamiento offline para uso posterior
          await offlineStorage.saveActivities(allActivities);
          await offlineStorage.saveRecurringActivities(recurring);
          console.log(
            "💾 Actividades y actividades recurrentes guardadas en cache local"
          );
        } catch (error) {
          console.warn(
            "⚠️ Error cargando desde servidor, intentando cache local...",
            error
          );
          throw error; // Permitir que caiga al modo offline
        }
      } else {
        console.log(
          `❌ Sin conexión adecuada (isOnline: ${isOnline}, hasStrongConnection: ${hasStrongConnection}), usando modo offline`
        );
        throw new Error("Sin conexión, usando modo offline");
      }

      // Ya no necesitamos filtrado adicional - las actividades ya están organizadas correctamente
    } catch (error) {
      console.log("📱 Modo offline activado - cargando datos locales...");
      setIsOfflineMode(true);

      try {
        // Cargar actividades desde almacenamiento local
        const localActivities = await offlineStorage.getActivities();
        const localRecurringActivities =
          await offlineStorage.getRecurringActivities();
        console.log(
          `📱 Actividades en almacenamiento local: ${localActivities.length}`
        );
        console.log(
          `📱 Actividades recurrentes en almacenamiento local: ${localRecurringActivities.length}`
        );
        console.log(
          `📱 Datos de actividades locales:`,
          localActivities.map((item) => ({
            id: item.id,
            status: item.data?.status,
            assignedDate: item.data?.assignedDate,
          }))
        );

        const activitiesData = localActivities.map((item) => item.data);
        const recurringActivitiesData = localRecurringActivities.map(
          (item) => item.data
        );

        // Filtrar actividades por status (igual que modo online)
        const pendingAndOverdueActivities = activitiesData.filter(
          (activity) =>
            activity.status === "pending" || activity.status === "overdue"
        );
        const completedToday = activitiesData.filter((activity) => {
          const today = new Date().toDateString();
          const activityDate = new Date(activity.assignedDate).toDateString();
          return activity.status === "completed" && activityDate === today;
        });

        // Filtrar actividades recurrentes activas
        const activeRecurringActivities = recurringActivitiesData.filter(
          (activity) => activity.status === "active"
        );

        // Separar actividades por fecha (igual que en modo online)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const todayPendingActivities = pendingAndOverdueActivities.filter((activity) => {
          const activityDate = new Date(activity.assignedDate);
          activityDate.setHours(0, 0, 0, 0);
          return activityDate.getTime() === today.getTime();
        });
        
        const overdueActivities = pendingAndOverdueActivities.filter((activity) => {
          const activityDate = new Date(activity.assignedDate);
          activityDate.setHours(0, 0, 0, 0);
          return activityDate.getTime() < today.getTime();
        });
        
        const upcomingPendingActivities = pendingAndOverdueActivities.filter((activity) => {
          const activityDate = new Date(activity.assignedDate);
          activityDate.setHours(0, 0, 0, 0);
          return activityDate.getTime() > today.getTime();
        });
        
        // Combinar actividades de hoy con las vencidas para mostrar en "hoy"
        const todayAndOverdueActivities = [...todayPendingActivities, ...overdueActivities];

        // Ordenar actividades
        const sortedTodayAndOverdue = todayAndOverdueActivities.sort(
          (a, b) =>
            new Date(a.assignedDate).getTime() -
            new Date(b.assignedDate).getTime()
        );
        
        const sortedUpcoming = upcomingPendingActivities.sort(
          (a, b) =>
            new Date(a.assignedDate).getTime() -
            new Date(b.assignedDate).getTime()
        );

        const convertedTodayAndOverdue = sortedTodayAndOverdue.map(convertToLocalActivity);
        const convertedCompleted = completedToday.map(convertToLocalActivity);

        setTodayActivities(convertedTodayAndOverdue);
        setCompletedActivities(convertedCompleted);
        setUpcomingActivities(sortedUpcoming);
        setRecurringActivities(activeRecurringActivities);
      } catch (offlineError) {
        console.error("❌ Error cargando datos offline:", offlineError);
        // En último caso, mostrar datos vacíos
        setTodayActivities([]);
        setCompletedActivities([]);
        setUpcomingActivities([]);
        setRecurringActivities([]);
      }
    } finally {
      setLoadingActivities(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadActivities();
    setRefreshing(false);
  };

  const handleActivityPress = async (localActivity: LocalActivity) => {
    // Encontrar la actividad completa en upcomingActivities
    const fullActivity = upcomingActivities.find(
      (a) => a.id === localActivity.id
    );
    if (fullActivity) {
      // Cargar los templates usando los templateIds (misma lógica que scheduled.tsx)
      let templates: Array<{
        id: number;
        name: string;
        description: string;
        status: "pending";
      }> = [];
      if (fullActivity.templateIds && fullActivity.templateIds.length > 0) {
        try {
          // Obtener el template real del primer templateId
          const templateData = await documentsApi.getActivityTemplate(
            fullActivity.id
          );

          templates = fullActivity.templateIds.map((templateId, index) => ({
            id: templateId,
            name: index === 0 ? templateData.name : `Template ${templateId}`,
            description:
              index === 0
                ? templateData.description ||
                  "Formulario asignado a esta actividad"
                : "Formulario asignado a esta actividad",
            status: "pending" as const,
          }));
        } catch (error) {
          console.error("Error cargando template:", error);
          // Fallback: usar los templates expandidos si están disponibles, sino crear genéricos
          if (fullActivity.templates && fullActivity.templates.length > 0) {
            templates = fullActivity.templates.map((template) => ({
              id: template.id,
              name: template.name,
              description:
                template.description || "Formulario asignado a esta actividad",
              status: "pending" as const,
            }));
          } else {
            templates = fullActivity.templateIds.map((templateId, index) => ({
              id: templateId,
              name: localActivity.title || `Template ${templateId}`,
              description: "Formulario asignado a esta actividad",
              status: "pending" as const,
            }));
          }
        }
      } else if (fullActivity.templates && fullActivity.templates.length > 0) {
        // Si no hay templateIds pero sí templates expandidos
        templates = fullActivity.templates.map((template) => ({
          id: template.id,
          name: template.name,
          description:
            template.description || "Formulario asignado a esta actividad",
          status: "pending" as const,
        }));
      }

      // Convertir a formato del modal (idéntico a scheduled.tsx)
      const activityForModal = {
        ...fullActivity,
        templates: templates,
      };

      setSelectedActivity(activityForModal);
      setModalVisible(true);
    }
  };

  const handleCompleteActivity = async (activityId: number) => {
    try {
      if (isOnline && hasStrongConnection) {
        // Modo online: completar directamente
        await offlineActivitiesApi.complete(activityId, { formData: {} });
        Alert.alert("Éxito", "Actividad marcada como completada");
      } else {
        // Modo offline: actualizar localmente y añadir a cola de sincronización
        await offlineStorage.updateActivityStatus(activityId, {
          status: "completed",
          completedAt: new Date().toISOString(),
          formData: {},
        });
        Alert.alert(
          "Éxito",
          "Actividad completada offline. Se sincronizará cuando haya conexión."
        );
      }

      await loadActivities(); // Recargar datos
    } catch (error) {
      console.error("Error completing activity:", error);
      Alert.alert(
        "Error",
        "No se pudo completar la actividad. Inténtalo más tarde."
      );
      throw error;
    }
  };

  // Mostrar loading si aún se están cargando los datos del usuario
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff6d00" />
        <Text style={styles.loadingText}>Cargando dashboard...</Text>
      </View>
    );
  }

  // Actividades recurrentes más utilizadas
  const frequentActivities = [
    {
      id: "r1",
      name: "Inspección de Seguridad Diaria",
      category: "Inspecciones",
      lastUsed: "2024-01-15",
    },
    {
      id: "r2",
      name: "Verificación de EPP",
      category: "EPP",
      lastUsed: "2024-01-15",
    },
    {
      id: "r3",
      name: "Reporte de Incidente",
      category: "Reportes",
      lastUsed: "2024-01-12",
    },
  ];

  // Acciones rápidas
  const quickActions: QuickAction[] = [
    {
      id: "recurring",
      title: "Actividades Recurrentes",
      description: "Ver formularios disponibles",
      icon: "repeat",
      route: "/recurring-activities",
      color: "#ff6d00", // brand-500
    },
    {
      id: "scheduled",
      title: "Actividades Programadas",
      description: "Ver agenda y calendario",
      icon: "calendar",
      route: "/scheduled",
      color: "#1565c0", // blue-500
    },
    {
      id: "history",
      title: "Historial",
      description: "Actividades completadas",
      icon: "history",
      route: "/history",
      color: "#42a5f5", // blue-400
    },
  ];

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "inspection":
        return "search";
      case "training":
        return "book";
      case "evaluation":
        return "clipboard";
      case "meeting":
        return "users";
      default:
        return "calendar";
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case "inspection":
        return "#1565c0"; // blue-500
      case "training":
        return "#1976d2"; // blue-700
      case "evaluation":
        return "#ff834d"; // brand-400
      case "meeting":
        return "#42a5f5"; // blue-400
      default:
        return "#737373"; // neutral-500
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "#cc5200"; // brand-700
      case "medium":
        return "#ff6d00"; // brand-500
      case "low":
        return "#1565c0"; // blue-500
      default:
        return "#737373"; // neutral-500
    }
  };

  // Calcular actividades vencidas usando la misma lógica que scheduled.tsx
  const today = (() => {
    const todayDate = new Date();
    return `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}-${String(todayDate.getDate()).padStart(2, '0')}`;
  })();
  
  console.log('🔍 Debug - Today date string:', today);
  console.log('🔍 Debug - All todayActivities:', todayActivities.map(a => ({ id: a.id, title: a.title, date: a.date, status: a.status })));
  
  // Separar actividades vencidas de las de hoy usando todayActivities (igual que scheduled.tsx)
  const overdueActivities = todayActivities.filter(activity => {
    const activityDate = activity.date;
    const isOverdue = activityDate < today && (activity.status === 'pending' || activity.status === 'overdue');
    console.log('🔍 Debug - Checking activity for overdue:', activity.title, 'Date:', activityDate, 'Today:', today, 'Status:', activity.status, 'IsOverdue:', isOverdue);
    return isOverdue;
  });
  
  // Actividades solo de hoy (sin las vencidas)
  const todayOnlyActivities = todayActivities.filter(activity => {
    const activityDate = activity.date;
    const isToday = activityDate === today;
    console.log('🔍 Debug - Checking activity for today:', activity.title, 'Date:', activityDate, 'Today:', today, 'Status:', activity.status, 'IsToday:', isToday);
    return isToday;
  });
  
  console.log('🔍 Debug - Overdue activities found:', overdueActivities.length);
  console.log('🔍 Debug - Today only activities:', todayOnlyActivities.length);
  console.log('🔍 Debug - Upcoming activities:', upcomingActivities.length);
  
  // Calcular estadísticas correctamente (igual que scheduled.tsx)
  const totalTodayActivities = todayOnlyActivities.length + completedActivities.length; // Solo actividades de hoy
  const pendingActivities = overdueActivities.length + todayOnlyActivities.length + upcomingActivities.length; // Incluir vencidas como pendientes
  const overdueCount = overdueActivities.length;
  const completedCount = completedActivities.length;
  
  // Crear lista de actividades para mostrar en "Próximas Actividades" (incluye hoy + futuras)
  // Necesitamos las actividades originales de hoy desde todayActivities que coincidan con todayOnlyActivities
  const todayOriginalActivities = todayActivities.filter(activity => {
    const activityDate = activity.date;
    return activityDate === today;
  });
  
  // Buscar las actividades originales (Activity) correspondientes a las de hoy
  const todayActivityIds = todayOnlyActivities.map(a => a.id);
  const todayOriginalFromRaw = todayActivities.filter(localActivity => 
    todayActivityIds.includes(localActivity.id)
  );
  
  // Crear lista combinada para la sección de próximas actividades
  const activitiesForUpcomingSection = [...todayOriginalFromRaw, ...upcomingActivities].map(activity => {
    // Si es LocalActivity, necesitamos encontrar la Activity original
    if ('time' in activity) {
      // Es LocalActivity, buscar en upcomingActivities o crear una Activity mock
      const found = upcomingActivities.find(a => a.id === activity.id);
      if (found) return found;
      
      // Crear Activity mock desde LocalActivity
      return {
        id: activity.id,
        userId: 0, // Mock value
        templateIds: [],
        assignedDate: activity.assignedDate,
        dueDate: activity.assignedDate, // Usar la misma fecha como fallback
        status: activity.status as any,
        priority: activity.priority as any || 'medium',
        assignedById: 0, // Mock value
        activityName: activity.title,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        templates: [],
      } as Activity;
    }
    return activity;
  });
  
  console.log('🔍 Debug - Final counts:', { totalTodayActivities, pendingActivities, overdueCount, completedCount });
  console.log('🔍 Debug - overdueActivities for UI:', overdueActivities.length, overdueActivities.map(a => ({ id: a.id, title: a.title, date: a.date, assignedDate: a.assignedDate, status: a.status })));
  console.log('🔍 Debug - activitiesForUpcomingSection:', activitiesForUpcomingSection.length, activitiesForUpcomingSection.map(a => a ? { id: a.id, title: a.activityName, date: a.assignedDate } : null));

  // Auto-refresh inteligente de actividades
  const {
    hasUpdates,
    clearUpdates,
    pausePolling,
    resumePolling,
    isRefreshing,
  } = useAutoRefresh({
    refreshFunction: loadActivities,
    interval: 120000, // 2 minutos
    enabled: !!user && !isLoading,
    manualRefreshOnly: true, // Solo mostrar banner por notificaciones push
    onDataChanged: () => {
      console.log("📱 Nuevas actividades disponibles");
    },
  });

  return (
    <>
      <RefreshIndicator
        visible={hasUpdates}
        onRefresh={() => {
          clearUpdates();
          onRefresh();
        }}
        message="Nuevas actividades disponibles"
      />
      <SubtleRefreshIndicator visible={isRefreshing} />

      <SafeAreaView style={styles.container}>
        {/* Indicador de estado offline */}
        {(!isOnline || !hasStrongConnection) && (
          <View style={styles.offlineIndicator}>
            <Text style={styles.offlineText}>
              📱 Modo offline - Los datos se sincronizarán cuando haya conexión
            </Text>
          </View>
        )}

        <ScrollView
          style={styles.scrollView}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={loadActivities}
              colors={["#007AFF"]}
              tintColor="#007AFF"
            />
          }
        >
          {/* Header */}
          <View style={styles.homeHeader}>
            <View style={styles.headerContent}>
              <View style={styles.headerText}>
                <Text style={styles.greeting}>
                  ¡{getGreeting()}, {getUserName()}!
                </Text>
                <Text style={styles.dateText}>{dateString}</Text>
                {user?.role && <Text style={styles.roleText}>{user.role}</Text>}
              </View>
              <NotificationBell />
            </View>
          </View>

          {/* Estadísticas del día */}
          <View style={styles.statsContainer}>
            {overdueCount > 0 && (
              <View style={[styles.statCard, styles.overdueStatCard]}>
                <Text style={[styles.statNumber, { color: "#dc2626" }]}>
                  {overdueCount}
                </Text>
                <Text style={[styles.statLabel, { color: "#dc2626" }]}>Vencidas</Text>
              </View>
            )}
            <View style={styles.statCard}>
              <Text style={[styles.statNumber, { color: "#ff6d00" }]}>
                {pendingActivities}
              </Text>
              <Text style={styles.statLabel}>Pendientes</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statNumber, { color: "#1565c0" }]}>
                {completedCount}
              </Text>
              <Text style={styles.statLabel}>Completadas</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{totalTodayActivities}</Text>
              <Text style={styles.statLabel}>Total del día</Text>
            </View>
          </View>

          {/* Acciones rápidas */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <FontAwesome name="bolt" size={20} color="#ff6d00" />
              <Text style={styles.sectionTitle}>Acciones Rápidas</Text>
            </View>

            <View style={styles.quickActionsGrid}>
              {quickActions.map((action) => (
                <TouchableOpacity
                  key={action.id}
                  style={[
                    styles.quickActionCard,
                    { borderLeftColor: action.color },
                  ]}
                  onPress={() => router.push(action.route as any)}
                >
                  <View
                    style={[
                      styles.quickActionIcon,
                      { backgroundColor: action.color + "20" },
                    ]}
                  >
                    <FontAwesome
                      name={action.icon as any}
                      size={24}
                      color={action.color}
                    />
                  </View>
                  <View style={styles.quickActionContent}>
                    <Text style={styles.quickActionTitle}>{action.title}</Text>
                    <Text style={styles.quickActionDescription}>
                      {action.description}
                    </Text>
                  </View>
                  <FontAwesome name="chevron-right" size={16} color="#a3a3a3" />
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Actividades recurrentes */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <FontAwesome name="refresh" size={20} color="#ff6d00" />
              <Text style={styles.sectionTitle}>Actividades Recurrentes</Text>
            </View>

            {loadingActivities ? (
              <View style={styles.activityLoadingContainer}>
                <ActivityIndicator size="small" color="#ff6d00" />
                <Text style={styles.activityLoadingText}>
                  Cargando actividades recurrentes...
                </Text>
              </View>
            ) : recurringActivities.length > 0 ? (
              <>
                {recurringActivities.slice(0, 3).map((recurringActivity) => {
                  const localActivity =
                    convertRecurringToLocalActivity(recurringActivity);
                  return (
                    <TouchableOpacity
                      key={recurringActivity.id}
                      style={[
                        styles.homeActivityCard,
                        styles.recurringActivityCard,
                      ]}
                      onPress={() => {
                        // Para actividades recurrentes, crear un objeto similar al modal
                        const activityForModal = {
                          id: recurringActivity.id,
                          assignedDate: recurringActivity.assignedDate,
                          dueDate: new Date(
                            Date.now() + 24 * 60 * 60 * 1000
                          ).toISOString(), // Mañana
                          status:
                            recurringActivity.status === "active"
                              ? "pending"
                              : "completed",
                          priority: "medium",
                          assignedBy: recurringActivity.assignedBy,
                          templates: recurringActivity.template
                            ? [
                                {
                                  id: recurringActivity.template.id,
                                  name: recurringActivity.template.name,
                                  description:
                                    recurringActivity.template.description,
                                  status: "pending" as const,
                                },
                              ]
                            : [],
                          observations: `Actividad recurrente - Completada ${recurringActivity.completionCount} veces`,
                        };
                        setSelectedActivity(activityForModal);
                        setModalVisible(true);
                      }}
                    >
                      <View style={styles.homeActivityHeader}>
                        <View style={styles.activityTime}>
                          <Text style={styles.timeText}>
                            {localActivity.time}
                          </Text>
                        </View>
                        <View style={styles.activityContent}>
                          <Text style={styles.activityTitle}>
                            {localActivity.title}
                          </Text>
                          <View style={styles.activityDetails}>
                            <FontAwesome
                              name={getActivityIcon(localActivity.type)}
                              size={12}
                              color={getActivityColor(localActivity.type)}
                            />
                            <Text style={styles.locationText}>
                              {localActivity.location}
                            </Text>
                          </View>
                          {recurringActivity.completionCount > 0 && (
                            <Text style={styles.completionCount}>
                              Completada {recurringActivity.completionCount}{" "}
                              {recurringActivity.completionCount === 1
                                ? "vez"
                                : "veces"}
                            </Text>
                          )}
                        </View>
                        <View style={styles.activityActions}>
                          <FormButton
                            activityId={recurringActivity.id}
                            activityType="recurring"
                            activityName={localActivity.title}
                            size="small"
                            variant="primary"
                          />
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}

                <TouchableOpacity
                  style={styles.viewAllButtonOrange}
                  onPress={() => router.push("/recurring-activities")}
                >
                  <Text style={styles.viewAllTextOrange}>
                    Ver todas las actividades recurrentes
                  </Text>
                  <FontAwesome name="arrow-right" size={12} color="#ff6d00" />
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.emptyStateContainer}>
                <FontAwesome name="refresh" size={48} color="#94A3B8" />
                <Text style={styles.emptyStateTitle}>
                  No hay actividades recurrentes
                </Text>
                <Text style={styles.emptyStateText}>
                  Las actividades recurrentes son tareas que realizas
                  regularmente
                </Text>
              </View>
            )}
          </View>

          {/* Actividades */}
          {loadingActivities ? (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <FontAwesome name="clock-o" size={20} color="#1565c0" />
                <Text style={styles.sectionTitle}>Cargando Actividades</Text>
              </View>
              <View style={styles.activityLoadingContainer}>
                <ActivityIndicator size="small" color="#ff6d00" />
                <Text style={styles.activityLoadingText}>
                  Cargando actividades...
                </Text>
              </View>
            </View>
          ) : (
            <>
              {/* Actividades Vencidas */}
              {overdueActivities.length > 0 ? (
                  <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                      <FontAwesome name="exclamation-triangle" size={20} color="#dc2626" />
                      <Text style={[styles.sectionTitle, { color: '#dc2626' }]}>Actividades Vencidas</Text>
                    </View>
                    
                    <View style={styles.overdueAlert}>
                      <FontAwesome name="warning" size={16} color="#dc2626" />
                      <Text style={styles.overdueAlertText}>
                        Tienes {overdueActivities.length} actividad{overdueActivities.length > 1 ? 'es' : ''} vencida{overdueActivities.length > 1 ? 's' : ''}. Es importante completarlas lo antes posible.
                      </Text>
                    </View>

                    {overdueActivities.slice(0, 3).map((activity) => {
                      const activityDate = activity.assignedDate ? activity.assignedDate.split('T')[0] : activity.date;
                      const todayDate = new Date();
                      const activityDateObj = new Date(activityDate);
                      
                      const daysDiff = Math.floor((todayDate.getTime() - activityDateObj.getTime()) / (1000 * 60 * 60 * 24));
                      const dateLabel = daysDiff === 1 ? "Ayer" : `Hace ${daysDiff} días`;

                      return (
                        <TouchableOpacity
                          key={activity.id}
                          style={[styles.homeActivityCard, styles.overdueActivity]}
                          onPress={() => handleActivityPress(activity)}
                        >
                          <View style={styles.homeActivityHeader}>
                            <View style={[styles.activityTimeWithDate, styles.overdueTimeContainer]}>
                              <Text style={[styles.dateLabel, styles.overdueLabel]}>{dateLabel}</Text>
                              <Text style={[styles.timeText, styles.overdueTime]}>{activity.time}</Text>
                            </View>
                            <View style={styles.activityContent}>
                              <Text style={styles.activityTitle}>
                                {activity.title}
                              </Text>
                              <View style={styles.activityDetails}>
                                <FontAwesome
                                  name={getActivityIcon(activity.type)}
                                  size={12}
                                  color={getActivityColor(activity.type)}
                                />
                                <Text style={styles.locationText}>
                                  {activity.location}
                                </Text>
                              </View>
                            </View>
                            <View style={styles.activityIcons}>
                              <FontAwesome
                                name="exclamation-circle"
                                size={16}
                                color="#dc2626"
                              />
                              <FontAwesome
                                name="chevron-right"
                                size={14}
                                color="#ccc"
                              />
                            </View>
                          </View>
                        </TouchableOpacity>
                      );
                    })}

                    {overdueActivities.length > 3 && (
                      <TouchableOpacity
                        style={styles.viewAllButtonRed}
                        onPress={() => router.push("/scheduled")}
                      >
                        <Text style={styles.viewAllTextRed}>
                          Ver todas las vencidas ({overdueActivities.length} total)
                        </Text>
                        <FontAwesome name="arrow-right" size={12} color="#dc2626" />
                      </TouchableOpacity>
                    )}
                  </View>
                ) : null}

              {/* Próximas Actividades */}
              {activitiesForUpcomingSection.length > 0 ? (
                  <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                      <FontAwesome name="clock-o" size={20} color="#1565c0" />
                      <Text style={styles.sectionTitle}>Próximas Actividades</Text>
                    </View>

                    {activitiesForUpcomingSection.slice(0, 4).map((fullActivity) => {
                      const activity = convertToLocalActivity(fullActivity);
                      const activityDate = new Date(fullActivity.assignedDate);
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const tomorrow = new Date(today);
                      tomorrow.setDate(today.getDate() + 1);

                      let dateLabel = "";
                      let additionalStyle = {};

                      if (activityDate.toDateString() === today.toDateString()) {
                        dateLabel = "Hoy";
                        additionalStyle = styles.todayActivity;
                      } else if (activityDate.toDateString() === tomorrow.toDateString()) {
                        dateLabel = "Mañana";
                        additionalStyle = styles.tomorrowActivity;
                      } else {
                        dateLabel = activityDate.toLocaleDateString("es-ES", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                        });
                        additionalStyle = styles.futureActivity;
                      }

                      return (
                        <TouchableOpacity
                          key={activity.id}
                          style={[styles.homeActivityCard, additionalStyle]}
                          onPress={() => handleActivityPress(activity)}
                        >
                          <View style={styles.homeActivityHeader}>
                            <View style={styles.activityTimeWithDate}>
                              <Text style={styles.dateLabel}>{dateLabel}</Text>
                              <Text style={styles.timeText}>{activity.time}</Text>
                            </View>
                            <View style={styles.activityContent}>
                              <Text style={styles.activityTitle}>
                                {activity.title}
                              </Text>
                              <View style={styles.activityDetails}>
                                <FontAwesome
                                  name={getActivityIcon(activity.type)}
                                  size={12}
                                  color={getActivityColor(activity.type)}
                                />
                                <Text style={styles.locationText}>
                                  {activity.location}
                                </Text>
                              </View>
                            </View>
                            <View style={styles.activityIcons}>
                              <View
                                style={[
                                  styles.priorityIndicator,
                                  {
                                    backgroundColor: getPriorityColor(activity.priority),
                                  },
                                ]}
                              />
                              <FontAwesome
                                name="chevron-right"
                                size={14}
                                color="#ccc"
                              />
                            </View>
                          </View>
                        </TouchableOpacity>
                      );
                    })}

                    <TouchableOpacity
                      style={styles.viewAllButton}
                      onPress={() => router.push("/scheduled")}
                    >
                      <Text style={styles.viewAllText}>
                        Ver todas las programadas{" "}
                        {activitiesForUpcomingSection.length > 4
                          ? `(${activitiesForUpcomingSection.length} total)`
                          : ""}
                      </Text>
                      <FontAwesome name="arrow-right" size={12} color="#0066cc" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                      <FontAwesome name="clock-o" size={20} color="#1565c0" />
                      <Text style={styles.sectionTitle}>Próximas Actividades</Text>
                    </View>
                    <View style={styles.emptyStateContainer}>
                      <FontAwesome name="calendar-o" size={48} color="#94A3B8" />
                      <Text style={styles.emptyStateTitle}>
                        No hay actividades programadas
                      </Text>
                      <Text style={styles.emptyStateText}>
                        No tienes actividades pendientes por realizar
                      </Text>
                      <TouchableOpacity
                        style={styles.emptyStateButton}
                        onPress={() => router.push("/recurring-activities")}
                      >
                        <Text style={styles.emptyStateButtonText}>
                          Ver Actividades Recurrentes
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
            </>
          )}

          {/* Actividades completadas hoy */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <FontAwesome name="check-circle" size={20} color="#4CAF50" />
              <Text style={styles.sectionTitle}>Completadas Hoy</Text>
            </View>

            {completedActivities.map((activity) => (
              <View
                key={activity.id}
                style={[styles.homeActivityCard, styles.completedCard]}
              >
                <View style={styles.homeActivityHeader}>
                  <View style={styles.activityTime}>
                    <Text style={[styles.timeText, styles.completedText]}>
                      {activity.time}
                    </Text>
                  </View>
                  <View style={styles.activityContent}>
                    <Text style={[styles.activityTitle, styles.completedText]}>
                      {activity.title}
                    </Text>
                    <View style={styles.activityDetails}>
                      <FontAwesome name="map-marker" size={12} color="#999" />
                      <Text style={[styles.locationText, styles.completedText]}>
                        {activity.location}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.activityIcons}>
                    <FontAwesome
                      name="check-circle"
                      size={16}
                      color="#4CAF50"
                    />
                  </View>
                </View>
              </View>
            ))}

            {completedActivities.length > 0 && (
              <TouchableOpacity
                style={styles.viewAllButton}
                onPress={() => router.push("/history")}
              >
                <Text style={styles.viewAllText}>Ver historial completo</Text>
                <FontAwesome name="arrow-right" size={14} color="#0066cc" />
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* Modal de detalles de actividad */}
      <ActivityDetailsModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        activity={selectedActivity}
        onCompleteActivity={handleCompleteActivity}
        onRefresh={loadActivities}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5", // neutral-50
  },
  scrollView: {
    flex: 1,
  },
  homeHeader: {
    backgroundColor: "white",
    padding: 20,
    paddingTop: 50,
    paddingBottom: 40,
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  headerText: {
    flex: 1,
  },
  greeting: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#505759", // neutral-800
    marginBottom: 5,
  },
  dateText: {
    fontSize: 16,
    color: "#737373", // neutral-500
    textTransform: "capitalize",
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "white",
    marginHorizontal: 15,
    marginTop: -20,
    borderRadius: 10,
    paddingVertical: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  statCard: {
    alignItems: "center",
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1565c0", // blue-500
  },
  statLabel: {
    fontSize: 12,
    color: "#737373", // neutral-500
    marginTop: 5,
    textAlign: "center",
  },
  section: {
    backgroundColor: "white",
    margin: 15,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#505759", // neutral-800
    marginLeft: 10,
  },
  homeActivityCard: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#f5f5f5",
  },
  completedCard: {
    opacity: 0.7,
  },
  homeActivityHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  activityTime: {
    backgroundColor: "#f8f9fa",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginRight: 15,
  },
  timeText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#505759", // neutral-800
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#505759", // neutral-800
    marginBottom: 5,
  },
  activityDetails: {
    flexDirection: "row",
    alignItems: "center",
  },
  locationText: {
    fontSize: 12,
    color: "#737373", // neutral-500
    marginLeft: 5,
  },
  activityIcons: {
    flexDirection: "row",
    alignItems: "center",
  },
  priorityIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  completedText: {
    color: "#999",
    textDecorationLine: "line-through",
  },
  quickActionsGrid: {
    gap: 12,
  },
  quickActionCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    borderLeftWidth: 4,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  quickActionContent: {
    flex: 1,
  },
  quickActionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#505759", // neutral-800
    marginBottom: 2,
  },
  quickActionDescription: {
    fontSize: 14,
    color: "#737373", // neutral-500
  },
  recurringActivityCard: {
    borderLeftWidth: 3,
    borderLeftColor: "#ff6d00", // brand-500
  },

  recurringActivityContent: {
    flex: 1,
  },
  recurringActivityTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#505759", // neutral-800
    marginBottom: 2,
  },
  recurringActivityStatus: {
    fontSize: 12,
    color: "#737373", // neutral-500
  },
  viewAllButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f0f8ff", // Azul muy claro
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  viewAllText: {
    fontSize: 14,
    color: "#0066cc", // Azul Núcleo Gestor
    fontWeight: "500",
    marginRight: 6,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5", // neutral-50
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: "#737373", // neutral-500
  },
  roleText: {
    fontSize: 14,
    color: "#1565c0", // blue-500
    fontWeight: "500",
    marginTop: 4,
  },
  activityLoadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    gap: 8,
  },
  activityLoadingText: {
    fontSize: 14,
    color: "#737373", // neutral-500
  },
  tomorrowSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  tomorrowTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#737373", // neutral-500
    marginBottom: 8,
    paddingHorizontal: 15,
  },
  tomorrowActivity: {
    backgroundColor: "#f8fafc",
  },
  todayActivity: {
    backgroundColor: "#fff5f0", // brand-50
    borderLeftWidth: 3,
    borderLeftColor: "#ff6d00", // brand-500
  },
  futureActivity: {
    backgroundColor: "#f1f5f9",
  },
  activityTimeWithDate: {
    backgroundColor: "#f8f9fa",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginRight: 15,
    alignItems: "center",
  },
  dateLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#737373", // neutral-500
    textTransform: "uppercase",
  },
  emptyStateContainer: {
    alignItems: "center",
    padding: 32,
    gap: 12,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#737373", // neutral-500
    textAlign: "center",
  },
  emptyStateText: {
    fontSize: 14,
    color: "#a3a3a3", // neutral-400
    textAlign: "center",
    lineHeight: 20,
  },
  emptyStateButton: {
    backgroundColor: "#ff6d00", // brand-500
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 8,
  },
  emptyStateButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "500",
  },
  completionCount: {
    fontSize: 12,
    color: "#737373", // neutral-500
    marginTop: 4,
    fontStyle: "italic",
  },
  activityActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  viewAllButtonOrange: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff5f0", // Naranja muy claro
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  viewAllTextOrange: {
    fontSize: 14,
    color: "#ff6d00", // Naranja Núcleo Gestor
    fontWeight: "500",
    marginRight: 6,
  },
  offlineIndicator: {
    backgroundColor: "#fef3c7",
    borderBottomWidth: 1,
    borderBottomColor: "#f59e0b",
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  offlineText: {
    fontSize: 12,
    color: "#92400e",
    textAlign: "center",
    fontWeight: "500",
  },
  // Estilos para actividades vencidas
  overdueActivity: {
    backgroundColor: "#fef2f2", // red-50
    borderLeftWidth: 3,
    borderLeftColor: "#dc2626", // red-600
    borderWidth: 1,
    borderColor: "#fecaca", // red-200
  },
  overdueAlert: {
    backgroundColor: "#fee2e2", // red-100
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#dc2626", // red-600
  },
  overdueAlertText: {
    fontSize: 14,
    color: "#991b1b", // red-800
    fontWeight: "500",
    flex: 1,
    lineHeight: 20,
  },
  overdueTimeContainer: {
    backgroundColor: "#fee2e2", // red-100
    borderColor: "#fecaca", // red-200
    borderWidth: 1,
  },
  overdueLabel: {
    color: "#991b1b", // red-800
    fontWeight: "700",
  },
  overdueTime: {
    color: "#dc2626", // red-600
    fontWeight: "600",
  },
  viewAllButtonRed: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fee2e2", // red-100
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#fecaca", // red-200
  },
  viewAllTextRed: {
    fontSize: 14,
    color: "#dc2626", // red-600
    fontWeight: "600",
    marginRight: 6,
  },
  overdueStatCard: {
    backgroundColor: "#fee2e2", // red-100
    borderWidth: 1,
    borderColor: "#fecaca", // red-200
    borderLeftWidth: 4,
    borderLeftColor: "#dc2626", // red-600
  },
});
