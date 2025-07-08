import { useState, useEffect } from 'react';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useCameraPermissions } from 'expo-camera';

export interface PermissionStatus {
  camera: boolean;
  location: boolean;
  mediaLibrary: boolean;
  granted: boolean;
}

export const usePermissions = () => {
  const [permissions, setPermissions] = useState<PermissionStatus>({
    camera: false,
    location: false,
    mediaLibrary: false,
    granted: false,
  });
  const [loading, setLoading] = useState(true);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const checkPermissions = async () => {
    try {
      // Verificar permisos de cámara
      const cameraStatus = cameraPermission?.granted || false;

      // Verificar permisos de ubicación
      const locationStatus = await Location.getForegroundPermissionsAsync();
      const locationGranted = locationStatus.granted;

      // Verificar permisos de galería
      const mediaStatus = await ImagePicker.getMediaLibraryPermissionsAsync();
      const mediaGranted = mediaStatus.granted;

      const newPermissions = {
        camera: cameraStatus,
        location: locationGranted,
        mediaLibrary: mediaGranted,
        granted: cameraStatus && locationGranted && mediaGranted,
      };

      setPermissions(newPermissions);
      setLoading(false);
    } catch (error) {
      console.error('Error checking permissions:', error);
      setLoading(false);
    }
  };

  const requestAllPermissions = async () => {
    try {
      const requests = [];

      // Solicitar permisos de cámara
      if (!cameraPermission?.granted) {
        requests.push(requestCameraPermission());
      }

      // Solicitar permisos de ubicación
      if (!permissions.location) {
        requests.push(Location.requestForegroundPermissionsAsync());
      }

      // Solicitar permisos de galería
      if (!permissions.mediaLibrary) {
        requests.push(ImagePicker.requestMediaLibraryPermissionsAsync());
      }

      await Promise.all(requests);
      await checkPermissions();
    } catch (error) {
      console.error('Error requesting permissions:', error);
    }
  };

  const requestCameraPermissionOnly = async () => {
    try {
      if (!cameraPermission?.granted) {
        await requestCameraPermission();
      }
      await checkPermissions();
    } catch (error) {
      console.error('Error requesting camera permission:', error);
    }
  };

  const requestLocationPermissionOnly = async () => {
    try {
      await Location.requestForegroundPermissionsAsync();
      await checkPermissions();
    } catch (error) {
      console.error('Error requesting location permission:', error);
    }
  };

  const requestMediaLibraryPermissionOnly = async () => {
    try {
      await ImagePicker.requestMediaLibraryPermissionsAsync();
      await checkPermissions();
    } catch (error) {
      console.error('Error requesting media library permission:', error);
    }
  };

  useEffect(() => {
    checkPermissions();
  }, [cameraPermission]);

  return {
    permissions,
    loading,
    checkPermissions,
    requestAllPermissions,
    requestCameraPermissionOnly,
    requestLocationPermissionOnly,
    requestMediaLibraryPermissionOnly,
  };
}; 