import { apiClient } from '../lib/api/config';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

interface SasTokenResponse {
  uploadUrl: string;
  blobName: string;
  finalUrl: string;
  expiresAt: string;
}

interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export class AzureUploadService {
  /**
   * Genera un SAS token para upload directo a Azure Storage
   */
  static async generateSasToken(
    fileName: string,
    contentType: string,
  ): Promise<SasTokenResponse> {
    try {
      const response = await apiClient.post<SasTokenResponse>('/upload/sas-token', {
        fileName,
        contentType,
      });
      return response.data.data as SasTokenResponse;
    } catch (error) {
      console.error('Error generando SAS token:', error);
      throw new Error('No se pudo generar el token de acceso para subir la imagen');
    }
  }

  /**
   * Sube un archivo directamente a Azure Storage usando SAS token
   */
  static async uploadToAzure(
    uploadUrl: string,
    fileUri: string,
    contentType: string,
    onProgress?: (progress: UploadProgress) => void,
  ): Promise<void> {
    try {
      // Leer el archivo como blob
      const response = await fetch(fileUri);
      const blob = await response.blob();

      // Crear XMLHttpRequest para tener control del progreso
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        // Configurar el progreso
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable && onProgress) {
            const progress: UploadProgress = {
              loaded: event.loaded,
              total: event.total,
              percentage: Math.round((event.loaded / event.total) * 100),
            };
            onProgress(progress);
          }
        });

        // Configurar eventos de finalización
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Error en upload: ${xhr.status} ${xhr.statusText}`));
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Error de red durante el upload'));
        });

        xhr.addEventListener('timeout', () => {
          reject(new Error('Timeout durante el upload'));
        });

        // Configurar la petición
        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', contentType);
        xhr.setRequestHeader('x-ms-blob-type', 'BlockBlob');
        xhr.timeout = 300000; // 5 minutos de timeout

        // Enviar el archivo
        xhr.send(blob);
      });
    } catch (error) {
      console.error('Error subiendo archivo a Azure:', error);
      throw new Error('Error subiendo la imagen. Inténtalo de nuevo.');
    }
  }

  /**
   * Comprime una imagen antes de subirla
   */
  static async compressImage(
    fileUri: string,
    maxWidth = 1920,
    maxHeight = 1080,
    quality = 0.8,
  ): Promise<string> {
    try {
      const result = await manipulateAsync(
        fileUri,
        [
          {
            resize: {
              width: maxWidth,
              height: maxHeight,
            },
          },
        ],
        {
          compress: quality,
          format: SaveFormat.JPEG,
        },
      );

      return result.uri;
    } catch (error) {
      console.error('Error comprimiendo imagen:', error);
      // Si falla la compresión, devolver la URI original
      return fileUri;
    }
  }

  /**
   * Proceso completo: comprimir y subir imagen
   */
  static async uploadImage(
    fileUri: string,
    fileName: string,
    onProgress?: (progress: UploadProgress) => void,
  ): Promise<string> {
    try {

      // 1. Comprimir la imagen
      const compressedUri = await this.compressImage(fileUri);

      // 2. Generar SAS token
      const sasToken = await this.generateSasToken(fileName, 'image/jpeg');

      // 3. Subir a Azure Storage
      await this.uploadToAzure(
        sasToken.uploadUrl,
        compressedUri,
        'image/jpeg',
        onProgress,
      );

      return sasToken.finalUrl;
    } catch (error) {
      console.error('❌ Error en upload completo:', error);
      throw error;
    }
  }

  /**
   * Sube múltiples imágenes en paralelo
   */
  static async uploadMultipleImages(
    fileUris: string[],
    onProgress?: (index: number, progress: UploadProgress) => void,
  ): Promise<string[]> {
    try {

      const uploadPromises = fileUris.map(async (uri, index) => {
        const fileName = `image_${Date.now()}_${index}.jpg`;
        return this.uploadImage(uri, fileName, (progress) => {
          if (onProgress) {
            onProgress(index, progress);
          }
        });
      });

      const results = await Promise.all(uploadPromises);
      return results;
    } catch (error) {
      console.error('❌ Error subiendo múltiples imágenes:', error);
      throw error;
    }
  }
}