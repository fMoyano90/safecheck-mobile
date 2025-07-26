import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/auth-context";
import { ApiError } from "@/lib/api";

export default function LoginScreen() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Redirigir si ya está autenticado
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      router.replace("/(tabs)");
    }
  }, [isAuthenticated, authLoading]);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Por favor ingresa tu email y contraseña");
      return;
    }

    if (!email.includes("@")) {
      Alert.alert("Error", "Por favor ingresa un email válido");
      return;
    }

    if (password.length < 6) {
      Alert.alert("Error", "La contraseña debe tener al menos 6 caracteres");
      return;
    }

    setIsLoading(true);
    try {
      await login({ email: email.toLowerCase().trim(), password });
      // El AuthContext manejará la navegación
      router.replace("/(tabs)");
    } catch (error) {
      console.error("Login error:", error);

      let errorMessage = "Ocurrió un error al iniciar sesión";

      if (error instanceof ApiError) {
        switch (error.status) {
          case 401:
            errorMessage = "Email o contraseña incorrectos";
            break;
          case 403:
            errorMessage = "Tu cuenta está inactiva. Contacta al administrador";
            break;
          case 0:
            errorMessage =
              "Error de conexión. Verifica tu internet y que el servidor esté funcionando";
            break;
          case 500:
            errorMessage = "Error del servidor. Intenta más tarde";
            break;
          default:
            errorMessage = error.message || errorMessage;
        }
      }

      Alert.alert("Error de autenticación", errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <View style={styles.logoWrapper}>
              <Image
                source={require("@/assets/images/logo.webp")}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
          </View>
        </View>

        <View style={styles.formContainer}>
          <Text style={styles.welcomeTitle}>¡Bienvenido!</Text>
          <Text style={styles.welcomeSubtitle}>
            Inicia sesión para continuar
          </Text>

          <View style={styles.inputContainer}>
            <View style={styles.inputWrapper}>
              <Ionicons
                name="mail-outline"
                size={20}
                color="#737373"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="#a3a3a3"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputWrapper}>
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color="#737373"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Contraseña"
                placeholderTextColor="#a3a3a3"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons
                  name={showPassword ? "eye-outline" : "eye-off-outline"}
                  size={20}
                  color="#737373"
                />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity style={styles.forgotPassword}>
            <Text style={styles.forgotPasswordText}>
              ¿Olvidaste tu contraseña?
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.loginButton,
              (isLoading || authLoading) && styles.loginButtonDisabled,
            ]}
            onPress={handleLogin}
            disabled={isLoading || authLoading}
          >
            {isLoading || authLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.loginButtonText}>Iniciar Sesión</Text>
            )}
          </TouchableOpacity>


        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            ¿Necesitas ayuda? Contacta al administrador
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5", // neutral-50
  },
  keyboardContainer: {
    flex: 1,
    justifyContent: "space-between",
  },
  header: {
    alignItems: "center",
    paddingTop: 60,
    paddingBottom: 40,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  logoWrapper: {
    marginBottom: 8,
  },
  logo: {
    width: 180,
    height: 80,
  },

  appSubtitle: {
    fontSize: 14,
    color: "#737373", // neutral-500
    textAlign: "center",
  },
  formContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#505759", // neutral-800
    marginBottom: 8,
    textAlign: "center",
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: "#737373", // neutral-500
    marginBottom: 32,
    textAlign: "center",
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 12,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#505759", // neutral-800
  },
  eyeIcon: {
    padding: 4,
  },
  forgotPassword: {
    alignSelf: "flex-end",
    marginBottom: 32,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: "#1565c0", // blue-500
    fontWeight: "500",
  },
  loginButton: {
    backgroundColor: "#ff6d00", // brand-500
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  loginButtonDisabled: {
    backgroundColor: "#a3a3a3", // neutral-400
  },
  loginButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },

  footer: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    alignItems: "center",
    zIndex: -1,
  },
  footerText: {
    fontSize: 14,
    color: "#737373", // neutral-500
    textAlign: "center",
  },
});