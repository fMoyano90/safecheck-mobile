import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import SignatureCanvas from "react-native-signature-canvas";
import { useAuth } from "../../contexts/auth-context";
import { useOfflineStatus } from "../../lib/offline";
import {
  signatureOfflineManager,
  useOfflineSignatures,
  MiningSignatureType,
  OfflineSignature,
} from "../../lib/offline/signature-offline";
import { apiRequest } from "../../lib/api/config";

interface DigitalSignatureMiningProps {
  documentId: number;
  documentTitle: string;
  acceptanceText: string;
  onSignatureComplete: (result: SignatureResult) => void;
  onCancel: () => void;
  requiresVisualSignature?: boolean;
  miningType?: MiningSignatureType;
  priority?: "critical" | "high" | "medium";
  allowOfflineMode?: boolean;
}

interface SignatureResult {
  signatureId: string;
  status: "completed" | "completed_offline" | "pending_sync";
  timestamp: string;
  willSyncWhenOnline?: boolean;
  offlineSignature?: OfflineSignature;
}

type SignatureStep = "review" | "signature" | "otp" | "completed";

const { width: screenWidth } = Dimensions.get("window");

export const DigitalSignatureMining: React.FC<DigitalSignatureMiningProps> = ({
  documentId,
  documentTitle,
  acceptanceText,
  onSignatureComplete,
  onCancel,
  requiresVisualSignature = false,
  miningType = MiningSignatureType.DAILY_REPORT,
  priority = "medium",
  allowOfflineMode = true,
}) => {
  const { user } = useAuth();
  const { isOnline, hasStrongConnection } = useOfflineStatus();
  const {
    stats: offlineStats,
    createSignature,
    syncSignatures,
  } = useOfflineSignatures();

  const [step, setStep] = useState<SignatureStep>("review");
  const [loading, setLoading] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [visualSignature, setVisualSignature] = useState<string>("");
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [signatureData, setSignatureData] = useState<any>(null);
  const [forceOfflineMode, setForceOfflineMode] = useState(false);
  const [locationStatus, setLocationStatus] = useState<
    "checking" | "valid" | "invalid"
  >("checking");

  // Determinar si usar modo offline
  const shouldUseOfflineMode =
    !isOnline ||
    forceOfflineMode ||
    (allowOfflineMode && !hasStrongConnection && priority === "critical");

  useEffect(() => {
    checkLocationStatus();
  }, []);

  const checkLocationStatus = async () => {
    try {
      setLocationStatus("checking");
      // Simular validación de ubicación en área minera
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setLocationStatus("valid");
    } catch (error) {
      setLocationStatus("invalid");
    }
  };

  const handleAcceptanceChange = (value: boolean) => {
    setAccepted(value);
  };

  const proceedToSignature = () => {
    if (!accepted) {
      Alert.alert("Error", "Debe aceptar los términos para continuar");
      return;
    }

    if (locationStatus === "invalid") {
      Alert.alert(
        "Ubicación Inválida",
        "No se encuentra en el área minera autorizada para firmar documentos.",
        [{ text: "OK" }]
      );
      return;
    }

    if (requiresVisualSignature) {
      setShowSignatureModal(true);
    } else {
      initiateSignature();
    }
  };

  const onSignatureOK = (signature: string) => {
    setVisualSignature(signature);
    setShowSignatureModal(false);
    initiateSignature();
  };

  const onSignatureClear = () => {
    setVisualSignature("");
  };

  const initiateSignature = async () => {
    try {
      setLoading(true);

      if (shouldUseOfflineMode) {
        await completeOfflineSignature();
      } else {
        await initiateOnlineSignature();
      }
    } catch (error) {
      console.error("Error initiating signature:", error);
      Alert.alert(
        "Error",
        shouldUseOfflineMode
          ? "No se pudo completar la firma offline"
          : "No se pudo iniciar el proceso de firma"
      );
    } finally {
      setLoading(false);
    }
  };

  const completeOfflineSignature = async () => {
    try {
      if (!user) {
        throw new Error('Usuario no encontrado');
      }

      const offlineSignature = await createSignature({
        documentId,
        userId: user.id,
        acceptanceText,
        requiresVisualSignature,
        visualSignature: visualSignature || undefined,
        miningType,
      });

      const result: SignatureResult = {
        signatureId: offlineSignature.id,
        status: "completed_offline",
        timestamp: offlineSignature.createdAt,
        willSyncWhenOnline: true,
        offlineSignature,
      };

      setStep("completed");
      onSignatureComplete(result);

      // Mostrar notificación de éxito offline
      Alert.alert(
        "Firma Completada Offline",
        `La firma se ha guardado localmente y se sincronizará automáticamente cuando haya conexión.\n\nPrioridad: ${priority.toUpperCase()}`,
        [{ text: "OK" }]
      );
    } catch (error) {
      throw new Error(`Error en firma offline: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const initiateOnlineSignature = async () => {
    try {
      const signatureRequest = {
        documentId,
        acceptanceText,
        signatureMethod: requiresVisualSignature
          ? "digital_signature"
          : "acceptance_checkbox",
        visualSignature: visualSignature || undefined,
        miningType,
        priority,
        signatureType: 'simple',
      };

      const response: any = await apiRequest("/api/v1/digital-signatures/initiate", {
        method: "POST",
        body: JSON.stringify(signatureRequest),
      });

      if (response.success) {
        setSignatureData(response.data);
        setStep("otp");
      } else {
        throw new Error(response.message || "Error al iniciar firma");
      }
    } catch (error) {
      // Si falla online y se permite offline, intentar offline
      if (allowOfflineMode) {
        Alert.alert(
          "Conexión Fallida",
          "No se pudo conectar al servidor. ¿Desea completar la firma en modo offline?",
          [
            { text: "Cancelar", style: "cancel" },
            {
              text: "Continuar Offline",
              onPress: async () => {
                setForceOfflineMode(true);
                await completeOfflineSignature();
              },
            },
          ]
        );
      } else {
        throw error;
      }
    }
  };

  const verifyOtpAndComplete = async () => {
    if (!otpCode || otpCode.length !== 6) {
      Alert.alert("Error", "Ingrese un código OTP válido de 6 dígitos");
      return;
    }

    try {
      setLoading(true);

      const response: any = await apiRequest(
        "/api/v1/digital-signatures/verify-otp",
        {
          method: "POST",
          body: JSON.stringify({
            signatureId: signatureData.signatureId,
            otpCode,
          }),
        }
      );

      if (response.success) {
        const result: SignatureResult = {
          signatureId: response.data.signatureId,
          status: "completed",
          timestamp: response.data.timestamp,
        };

        setStep("completed");
        onSignatureComplete(result);
      } else {
        Alert.alert("Error", response.message || "Código OTP inválido");
      }
    } catch (error) {
      console.error("Error verifying OTP:", error);
      Alert.alert("Error", "No se pudo verificar el código OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleSyncNow = async () => {
    try {
      setLoading(true);
      const result = await syncSignatures();
      Alert.alert(
        "Sincronización Completada",
        `Sincronizadas: ${result.synced}\nFallidas: ${result.failed}`,
        [{ text: "OK" }]
      );
    } catch (error) {
      Alert.alert("Error", "No se pudo sincronizar las firmas");
    } finally {
      setLoading(false);
    }
  };

  const renderConnectionStatus = () => (
    <View style={styles.connectionStatus}>
      <View style={styles.statusRow}>
        <Ionicons
          name={isOnline ? "wifi" : "wifi"}
          size={16}
          color={isOnline ? "#4CAF50" : "#ff6b35"}
        />
        <Text
          style={[
            styles.statusText,
            { color: isOnline ? "#4CAF50" : "#ff6b35" },
          ]}
        >
          {isOnline ? "Conectado" : "Sin conexión"}
        </Text>
      </View>

      <View style={styles.statusRow}>
        <Ionicons
          name={locationStatus === "valid" ? "location" : "location"}
          size={16}
          color={locationStatus === "valid" ? "#4CAF50" : "#ff6b35"}
        />
        <Text
          style={[
            styles.statusText,
            { color: locationStatus === "valid" ? "#4CAF50" : "#ff6b35" },
          ]}
        >
          {locationStatus === "checking"
            ? "Verificando..."
            : locationStatus === "valid"
            ? "Área autorizada"
            : "Área no autorizada"}
        </Text>
      </View>

      {shouldUseOfflineMode && (
        <View style={styles.offlineIndicator}>
          <Ionicons name="cloud-offline" size={16} color="#ff6b35" />
          <Text style={styles.offlineText}>Modo Offline Activo</Text>
        </View>
      )}
    </View>
  );

  const renderOfflineStats = () => {
    if (offlineStats.pending === 0 && offlineStats.critical === 0) return null;

    return (
      <View style={styles.offlineStats}>
        <Text style={styles.offlineStatsTitle}>
          Firmas Pendientes de Sincronización
        </Text>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{offlineStats.pending}</Text>
            <Text style={styles.statLabel}>Pendientes</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: "#F44336" }]}>
              {offlineStats.critical}
            </Text>
            <Text style={styles.statLabel}>Críticas</Text>
          </View>
          <TouchableOpacity style={styles.syncButton} onPress={handleSyncNow}>
            <Ionicons name="sync" size={14} color="white" />
            <Text style={styles.syncButtonText}>Sincronizar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderMiningTypeInfo = () => (
    <View style={styles.miningInfo}>
      <View style={styles.miningTypeRow}>
        <Ionicons name="hammer" size={20} color="#FF9800" />
        <Text style={styles.miningTypeText}>
          {getMiningTypeLabel(miningType)}
        </Text>
        <View
          style={[
            styles.priorityBadge,
            { backgroundColor: getPriorityColor(priority) },
          ]}
        >
          <Text style={styles.priorityText}>{priority.toUpperCase()}</Text>
        </View>
      </View>
    </View>
  );

  const renderReviewStep = () => (
    <ScrollView style={styles.container}>
      {renderConnectionStatus()}
      {renderOfflineStats()}
      {renderMiningTypeInfo()}

      <View style={styles.content}>
        <Text style={styles.title}>Revisión del Documento</Text>
        <Text style={styles.documentTitle}>{documentTitle}</Text>

        <View style={styles.acceptanceSection}>
          <Text style={styles.acceptanceTitle}>Términos y Condiciones</Text>
          <Text style={styles.acceptanceText}>{acceptanceText}</Text>

          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => handleAcceptanceChange(!accepted)}
          >
            <Ionicons
              name={accepted ? "checkbox" : "square-outline"}
              size={24}
              color={accepted ? "#4CAF50" : "#666"}
            />
            <Text style={styles.checkboxText}>
              Acepto los términos y condiciones
            </Text>
          </TouchableOpacity>
        </View>

        {requiresVisualSignature && (
          <View style={styles.signatureInfo}>
            <Ionicons name="create" size={20} color="#2196F3" />
            <Text style={styles.signatureInfoText}>
              Se requiere firma visual para este documento
            </Text>
          </View>
        )}
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelButtonText}>Cancelar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.continueButton, !accepted && styles.disabledButton]}
          onPress={proceedToSignature}
          disabled={!accepted || locationStatus !== "valid"}
        >
          {loading ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <Text style={styles.continueButtonText}>
              {requiresVisualSignature ? "Firmar" : "Continuar"}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderOtpStep = () => (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Verificación OTP</Text>
        <Text style={styles.subtitle}>
          Ingrese el código de 6 dígitos enviado a su email
        </Text>

        <TextInput
          style={styles.otpInput}
          value={otpCode}
          onChangeText={setOtpCode}
          placeholder="000000"
          keyboardType="numeric"
          maxLength={6}
          autoFocus
        />
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelButtonText}>Cancelar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.continueButton,
            otpCode.length !== 6 && styles.disabledButton,
          ]}
          onPress={verifyOtpAndComplete}
          disabled={otpCode.length !== 6 || loading}
        >
          {loading ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <Text style={styles.continueButtonText}>Verificar</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderCompletedStep = () => (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.successIcon}>
          <Ionicons name="checkmark-circle" size={80} color="#4CAF50" />
        </View>

        <Text style={styles.successTitle}>Firma Completada</Text>
        <Text style={styles.successSubtitle}>
          {shouldUseOfflineMode
            ? "La firma se ha guardado localmente y se sincronizará automáticamente"
            : "El documento ha sido firmado exitosamente"}
        </Text>

        {shouldUseOfflineMode && (
          <View style={styles.offlineSuccessInfo}>
            <Ionicons name="cloud-upload" size={24} color="#FF9800" />
            <Text style={styles.offlineSuccessText}>
              Se sincronizará cuando haya conexión estable
            </Text>
          </View>
        )}
      </View>
    </View>
  );

  const renderSignatureModal = () => (
    <Modal visible={showSignatureModal} animationType="slide">
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Firma Digital</Text>
          <TouchableOpacity onPress={() => setShowSignatureModal(false)}>
            <Ionicons name="close" size={24} color="#666" />
          </TouchableOpacity>
        </View>

        <SignatureCanvas
          onOK={onSignatureOK}
          onClear={onSignatureClear}
          descriptionText="Firme en el área de abajo"
          clearText="Limpiar"
          confirmText="Confirmar"
          webStyle={signatureStyle}
        />
      </View>
    </Modal>
  );

  // Funciones auxiliares
  const getMiningTypeLabel = (type: MiningSignatureType): string => {
    const labels = {
      [MiningSignatureType.SAFETY_INSPECTION]: "Inspección de Seguridad",
      [MiningSignatureType.EQUIPMENT_CHECK]: "Verificación de Equipos",
      [MiningSignatureType.INCIDENT_REPORT]: "Reporte de Incidente",
      [MiningSignatureType.SHIFT_HANDOVER]: "Cambio de Turno",
      [MiningSignatureType.EMERGENCY_PROCEDURE]: "Procedimiento de Emergencia",
      [MiningSignatureType.DAILY_REPORT]: "Reporte Diario",
    };
    return labels[type] || "Documento Minero";
  };

  const getPriorityColor = (priorityLevel: "critical" | "high" | "medium"): string => {
    const colors = {
      critical: "#F44336",
      high: "#FF9800",
      medium: "#4CAF50",
    };
    return colors[priorityLevel] || "#4CAF50";
  };

  return (
    <View style={styles.wrapper}>
      {step === "review" && renderReviewStep()}
      {step === "otp" && renderOtpStep()}
      {step === "completed" && renderCompletedStep()}
      {renderSignatureModal()}
    </View>
  );
};

const signatureStyle = `
  .m-signature-pad {
    box-shadow: none;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
  }
  .m-signature-pad--body {
    border: none;
  }
  .m-signature-pad--footer {
    display: none;
  }
`;

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  container: {
    flex: 1,
  },
  connectionStatus: {
    backgroundColor: "white",
    padding: 12,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  statusText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: "500",
  },
  offlineIndicator: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff3e0",
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
  },
  offlineText: {
    marginLeft: 8,
    fontSize: 12,
    color: "#ff6b35",
    fontWeight: "500",
  },
  offlineStats: {
    backgroundColor: "white",
    padding: 12,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  offlineStatsTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
    color: "#333",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  statItem: {
    alignItems: "center",
    marginRight: 20,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FF9800",
  },
  statLabel: {
    fontSize: 12,
    color: "#666",
  },
  syncButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2196F3",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    marginLeft: "auto",
  },
  syncButtonText: {
    color: "white",
    fontSize: 12,
    fontWeight: "500",
    marginLeft: 4,
  },
  miningInfo: {
    backgroundColor: "white",
    padding: 12,
    marginBottom: 8,
  },
  miningTypeRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  miningTypeText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    flex: 1,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  priorityText: {
    color: "white",
    fontSize: 10,
    fontWeight: "bold",
  },
  content: {
    flex: 1,
    padding: 20,
    backgroundColor: "white",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#333",
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 20,
    textAlign: "center",
  },
  documentTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 20,
    color: "#2196F3",
  },
  acceptanceSection: {
    marginBottom: 20,
  },
  acceptanceTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 10,
    color: "#333",
  },
  acceptanceText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#666",
    marginBottom: 15,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  checkboxText: {
    marginLeft: 10,
    fontSize: 14,
    color: "#333",
  },
  signatureInfo: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e3f2fd",
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  signatureInfoText: {
    marginLeft: 8,
    fontSize: 14,
    color: "#1976d2",
  },
  otpInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 15,
    fontSize: 18,
    textAlign: "center",
    letterSpacing: 5,
    marginBottom: 20,
  },
  buttonContainer: {
    flexDirection: "row",
    padding: 20,
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  cancelButton: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    marginRight: 10,
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 16,
    color: "#666",
    fontWeight: "500",
  },
  continueButton: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    backgroundColor: "#4CAF50",
    marginLeft: 10,
    alignItems: "center",
  },
  continueButtonText: {
    fontSize: 16,
    color: "white",
    fontWeight: "600",
  },
  disabledButton: {
    backgroundColor: "#ccc",
  },
  successIcon: {
    alignItems: "center",
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 10,
    color: "#4CAF50",
  },
  successSubtitle: {
    fontSize: 16,
    textAlign: "center",
    color: "#666",
    marginBottom: 20,
  },
  offlineSuccessInfo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff3e0",
    padding: 12,
    borderRadius: 8,
  },
  offlineSuccessText: {
    marginLeft: 8,
    fontSize: 14,
    color: "#ff6b35",
    fontWeight: "500",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "white",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
});

export default DigitalSignatureMining;
