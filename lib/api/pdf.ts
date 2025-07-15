import { tokenManager } from './config';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3030';

export const pdfApi = {
  /**
   * Descarga el PDF de una actividad desde el backend
   */
  async downloadActivityPdf(activityId: string): Promise<void> {
    try {
      const token = await tokenManager.getAccessToken();
      if (!token) {
        Alert.alert('Error', 'No estás autenticado. Por favor, inicia sesión.');
        return;
      }

      // Crear la URL para descargar el PDF
      const response = await fetch(`${API_BASE_URL}/api/v1/activities/${activityId}/pdf`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error al generar PDF: ${response.status} - ${errorText}`);
      }

      // Obtener el blob del PDF
      const blob = await response.blob();
      
      // Convertir blob a base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const base64 = reader.result as string;
          resolve(base64.split(',')[1]); // Remover el prefijo data:application/pdf;base64,
        };
        reader.onerror = reject;
      });
      
      reader.readAsDataURL(blob);
      const base64Data = await base64Promise;

      // Definir la ruta del archivo
      const fileName = `actividad-${activityId}.pdf`;
      const fileUri = FileSystem.documentDirectory + fileName;

      // Escribir el archivo
      await FileSystem.writeAsStringAsync(fileUri, base64Data, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Compartir el archivo
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Descargar PDF de Actividad',
        });
      } else {
        Alert.alert(
          'PDF Descargado',
          `El archivo se ha guardado en: ${fileUri}`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error downloading PDF:', error);
      Alert.alert(
        'Error',
        'No se pudo descargar el PDF. Por favor, inténtalo de nuevo.',
        [{ text: 'OK' }]
      );
      throw error;
    }
  },
};