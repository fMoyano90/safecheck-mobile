import { useState, useEffect, useRef } from "react";
import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import { Platform } from "react-native";

interface OfflineStatusConfig {
  strongConnectionThreshold?: number; // Mbps
  weakConnectionThreshold?: number; // Mbps
  connectionCheckInterval?: number; // ms
  enableSpeedTest?: boolean;
  miningEnvironmentMode?: boolean;
}

interface OfflineStatus {
  isOnline: boolean;
  hasStrongConnection: boolean;
  hasWeakConnection: boolean;
  connectionType: string | null;
  connectionSpeed: number | null; // Mbps
  signalStrength: number | null; // 0-100
  isInMiningArea: boolean;
  lastConnectedAt: Date | null;
  offlineDuration: number; // seconds
  canSyncCriticalData: boolean;
  shouldUseOfflineMode: boolean;
}

const DEFAULT_CONFIG: OfflineStatusConfig = {
  strongConnectionThreshold: 2, // 2 Mbps
  weakConnectionThreshold: 0.5, // 0.5 Mbps
  connectionCheckInterval: 5000, // 5 seconds
  enableSpeedTest: true,
  miningEnvironmentMode: true,
};

export const useOfflineStatus = (
  config: OfflineStatusConfig = {}
): OfflineStatus => {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  const [status, setStatus] = useState<OfflineStatus>({
    isOnline: false,
    hasStrongConnection: false,
    hasWeakConnection: false,
    connectionType: null,
    connectionSpeed: null,
    signalStrength: null,
    isInMiningArea: false,
    lastConnectedAt: null,
    offlineDuration: 0,
    canSyncCriticalData: false,
    shouldUseOfflineMode: true,
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastConnectedRef = useRef<Date | null>(null);
  const offlineStartRef = useRef<Date | null>(null);

  useEffect(() => {
    // Listener para cambios de conectividad
    const unsubscribe = NetInfo.addEventListener(handleConnectivityChange);

    // Verificación inicial
    NetInfo.fetch().then(handleConnectivityChange);

    // Intervalo para verificaciones periódicas
    if (finalConfig.connectionCheckInterval && finalConfig.connectionCheckInterval > 0) {
      intervalRef.current = setInterval(() => {
        NetInfo.fetch().then(handleConnectivityChange);
        updateOfflineDuration();
      }, finalConfig.connectionCheckInterval) as any;
    }

    return () => {
      unsubscribe();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const handleConnectivityChange = async (state: NetInfoState) => {
    const isConnected = state.isConnected && state.isInternetReachable;

    // Actualizar referencias de tiempo
    if (isConnected && !lastConnectedRef.current) {
      lastConnectedRef.current = new Date();
      offlineStartRef.current = null;
    } else if (!isConnected && !offlineStartRef.current) {
      offlineStartRef.current = new Date();
    }

    // Evaluar calidad de conexión
    const connectionQuality = await evaluateConnectionQuality(state);

    // Verificar ubicación en área minera (simulado)
    const isInMiningArea = await checkMiningAreaLocation();

    const newStatus: OfflineStatus = {
      isOnline: isConnected ?? false,
      hasStrongConnection: connectionQuality.isStrong,
      hasWeakConnection: connectionQuality.isWeak,
      connectionType: state.type,
      connectionSpeed: connectionQuality.speed,
      signalStrength: getSignalStrength(state),
      isInMiningArea,
      lastConnectedAt: lastConnectedRef.current,
      offlineDuration: calculateOfflineDuration(),
      canSyncCriticalData: connectionQuality.canSyncCritical,
      shouldUseOfflineMode: shouldUseOfflineMode(
        isConnected ?? false,
        connectionQuality,
        isInMiningArea
      ),
    };

    setStatus(newStatus);
  };

  const evaluateConnectionQuality = async (state: NetInfoState) => {
    let speed: number | null = null;
    let isStrong = false;
    let isWeak = false;
    let canSyncCritical = false;

    if (!state.isConnected) {
      return { speed, isStrong, isWeak, canSyncCritical };
    }

    // Obtener velocidad estimada basada en el tipo de conexión
    if (state.details) {
      speed = estimateSpeedFromConnectionType(state);
    }

    // Realizar test de velocidad si está habilitado
    if (finalConfig.enableSpeedTest && state.isConnected) {
      try {
        const measuredSpeed = await performSpeedTest();
        if (measuredSpeed !== null) {
          speed = measuredSpeed;
        }
      } catch (error) {
        console.warn("Speed test failed:", error);
      }
    }

    if (speed !== null) {
      isStrong = speed >= finalConfig.strongConnectionThreshold!;
      isWeak =
        speed >= finalConfig.weakConnectionThreshold! &&
        speed < finalConfig.strongConnectionThreshold!;
      canSyncCritical = speed >= finalConfig.weakConnectionThreshold!;
    }

    return { speed, isStrong, isWeak, canSyncCritical };
  };

  const estimateSpeedFromConnectionType = (state: NetInfoState): number => {
    const type = state.type;
    const details = state.details as any;

    switch (type) {
      case "wifi":
        // Estimar basado en la fuerza de la señal WiFi
        if (details?.strength !== undefined) {
          const strength = details.strength;
          if (strength > 80) return 10; // Excelente
          if (strength > 60) return 5; // Buena
          if (strength > 40) return 2; // Regular
          return 0.5; // Débil
        }
        return 5; // Valor por defecto para WiFi

      case "cellular":
        const cellularType = details?.cellularGeneration;
        switch (cellularType) {
          case "5g":
            return 20;
          case "4g":
            return 8;
          case "3g":
            return 1;
          case "2g":
            return 0.1;
          default:
            return 2;
        }

      case "ethernet":
        return 50;

      default:
        return 1;
    }
  };

  const performSpeedTest = async (): Promise<number | null> => {
    try {
      const startTime = Date.now();
      const testUrl = "https://httpbin.org/bytes/1024"; // 1KB test

      const response = await fetch(testUrl, {
        method: "GET",
        cache: "no-cache",
      });

      if (!response.ok) {
        throw new Error("Speed test request failed");
      }

      await response.blob();
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000; // seconds
      const sizeKB = 1; // 1KB
      const speedKbps = (sizeKB * 8) / duration; // Kbps
      const speedMbps = speedKbps / 1000; // Mbps

      return Math.max(speedMbps, 0.01); // Mínimo 0.01 Mbps
    } catch (error) {
      console.warn("Speed test error:", error);
      return null;
    }
  };

  const getSignalStrength = (state: NetInfoState): number | null => {
    const details = state.details as any;

    if (state.type === "wifi" && details?.strength !== undefined) {
      return details.strength;
    }

    if (state.type === "cellular" && details?.strength !== undefined) {
      return details.strength;
    }

    return null;
  };

  const checkMiningAreaLocation = async (): Promise<boolean> => {
    // En un entorno real, esto verificaría GPS y geofencing
    // Por ahora, simulamos que siempre estamos en área minera
    try {
      // Aquí iría la lógica de geolocalización real
      // const location = await getCurrentLocation();
      // return isWithinMiningBoundaries(location);
      return true;
    } catch (error) {
      console.warn("Mining area check failed:", error);
      return false;
    }
  };

  const shouldUseOfflineMode = (
    isConnected: boolean,
    connectionQuality: any,
    isInMiningArea: boolean
  ): boolean => {
    if (!finalConfig.miningEnvironmentMode) {
      return !isConnected;
    }

    // En modo minero, usar offline si:
    // 1. No hay conexión
    // 2. La conexión es muy débil
    // 3. No estamos en área autorizada (por seguridad)
    return (
      !isConnected || !connectionQuality.canSyncCritical || !isInMiningArea
    );
  };

  const calculateOfflineDuration = (): number => {
    if (!offlineStartRef.current) {
      return 0;
    }

    const now = new Date();
    const diffMs = now.getTime() - offlineStartRef.current.getTime();
    return Math.floor(diffMs / 1000); // seconds
  };

  const updateOfflineDuration = () => {
    if (offlineStartRef.current) {
      setStatus((prev) => ({
        ...prev,
        offlineDuration: calculateOfflineDuration(),
      }));
    }
  };

  return status;
};

// Hook adicional para estadísticas de conectividad
export const useConnectivityStats = () => {
  const [stats, setStats] = useState({
    totalOfflineTime: 0,
    offlineEvents: 0,
    averageOfflineDuration: 0,
    lastSyncAttempt: null as Date | null,
    successfulSyncs: 0,
    failedSyncs: 0,
  });

  const recordOfflineEvent = (duration: number) => {
    setStats((prev) => {
      const newOfflineEvents = prev.offlineEvents + 1;
      const newTotalOfflineTime = prev.totalOfflineTime + duration;

      return {
        ...prev,
        totalOfflineTime: newTotalOfflineTime,
        offlineEvents: newOfflineEvents,
        averageOfflineDuration: newTotalOfflineTime / newOfflineEvents,
      };
    });
  };

  const recordSyncAttempt = (success: boolean) => {
    setStats((prev) => ({
      ...prev,
      lastSyncAttempt: new Date(),
      successfulSyncs: success
        ? prev.successfulSyncs + 1
        : prev.successfulSyncs,
      failedSyncs: success ? prev.failedSyncs : prev.failedSyncs + 1,
    }));
  };

  return {
    stats,
    recordOfflineEvent,
    recordSyncAttempt,
  };
};

export default useOfflineStatus;
