import { StyleSheet, ScrollView, TouchableOpacity, Modal, Alert, Image } from 'react-native';
import { Text, View } from '@/components/Themed';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useState } from 'react';

// Tipos
type Activity = {
  id: number;
  time: string;
  title: string;
  type: string;
  status: string;
  description?: string;
  location?: string;
  duration?: string;
  priority?: string;
  assignedTo?: string;
  formId?: string;
};

type MonthlyActivities = {
  [key: string]: Activity[];
};

// Datos maquetados para las actividades del mes actual
const monthlyActivities: MonthlyActivities = {
  // Junio 2025 - Actividades actuales
  '2025-06-01': [
    { id: 201, time: '09:00', title: 'Reunión Inicio Mes', type: 'meeting', status: 'completed' }
  ],
  '2025-06-02': [
    { id: 202, time: '08:00', title: 'Inspección Rutinaria', type: 'inspection', status: 'completed' },
    { id: 203, time: '14:00', title: 'Capacitación Básica', type: 'training', status: 'completed' }
  ],
  '2025-06-03': [
    { id: 204, time: '10:00', title: 'Evaluación Mensual', type: 'evaluation', status: 'completed' },
    { id: 205, time: '15:30', title: 'Reunión Equipo', type: 'meeting', status: 'completed' }
  ],
  '2025-06-04': [
    { id: 206, time: '09:30', title: 'Inspección Área B', type: 'inspection', status: 'completed' }
  ],
  '2025-06-05': [
    { id: 207, time: '11:00', title: 'Taller Prevención', type: 'training', status: 'completed' },
    { id: 208, time: '14:00', title: 'Evaluación Riesgos', type: 'evaluation', status: 'completed' },
    { id: 209, time: '16:30', title: 'Inspección Final', type: 'inspection', status: 'completed' }
  ],
  '2025-06-06': [
    { 
      id: 210, 
      time: '08:30', 
      title: 'Viernes de Seguridad', 
      type: 'meeting', 
      status: 'pending',
      description: 'Reunión semanal para revisar temas de seguridad, incidentes de la semana y acciones correctivas.',
      location: 'Sala de Juntas Principal',
      duration: '90 minutos',
      priority: 'high',
      assignedTo: 'Juan Carlos Pérez',
      formId: 'meeting-form'
    },
    { 
      id: 211, 
      time: '13:00', 
      title: 'Capacitación EPP', 
      type: 'training', 
      status: 'pending',
      description: 'Capacitación sobre el uso correcto de Equipos de Protección Personal para nuevos empleados.',
      location: 'Sala de Capacitación B',
      duration: '2 horas',
      priority: 'medium',
      assignedTo: 'Juan Carlos Pérez',
      formId: 'training-form'
    },
    { 
      id: 212, 
      time: '16:00', 
      title: 'Reunión Semanal', 
      type: 'meeting', 
      status: 'pending',
      description: 'Reunión de coordinación semanal con supervisores de área.',
      location: 'Oficina de Coordinación',
      duration: '60 minutos',
      priority: 'low',
      assignedTo: 'Juan Carlos Pérez',
      formId: 'meeting-form'
    }
  ],
  '2025-06-09': [
    { 
      id: 213, 
      time: '09:00', 
      title: 'Inspección Semanal', 
      type: 'inspection', 
      status: 'pending',
      description: 'Inspección rutinaria de seguridad en todas las áreas de producción y almacenes.',
      location: 'Planta Principal - Todas las áreas',
      duration: '3 horas',
      priority: 'high',
      assignedTo: 'Juan Carlos Pérez',
      formId: 'inspection-form'
    },
    { 
      id: 214, 
      time: '11:30', 
      title: 'Evaluación Proceso', 
      type: 'evaluation', 
      status: 'pending',
      description: 'Evaluación de riesgos del nuevo proceso de manipulación de materiales.',
      location: 'Área de Manipulación',
      duration: '2.5 horas',
      priority: 'high',
      assignedTo: 'Juan Carlos Pérez',
      formId: 'evaluation-form'
    },
    { 
      id: 215, 
      time: '15:00', 
      title: 'Reunión Supervisores', 
      type: 'meeting', 
      status: 'pending',
      description: 'Reunión mensual con supervisores para revisar métricas de seguridad.',
      location: 'Sala de Juntas A',
      duration: '2 horas',
      priority: 'medium',
      assignedTo: 'Juan Carlos Pérez',
      formId: 'meeting-form'
    }
  ],
  '2025-06-10': [
    { 
      id: 216, 
      time: '10:00', 
      title: 'Capacitación Avanzada', 
      type: 'training', 
      status: 'pending',
      description: 'Capacitación avanzada en uso de equipos especializados.',
      location: 'Aula Magna',
      duration: '4 horas',
      priority: 'high',
      assignedTo: 'Juan Carlos Pérez',
      formId: 'training-form'
    },
    { 
      id: 217, 
      time: '14:30', 
      title: 'Reporte de Incidente', 
      type: 'incident', 
      status: 'pending',
      description: 'Investigación y documentación de incidente reportado en el área de producción. Requiere evidencia fotográfica.',
      location: 'Área de Producción - Línea 3',
      duration: '2 horas',
      priority: 'high',
      assignedTo: 'Juan Carlos Pérez',
      formId: 'incident-form'
    }
  ],
  '2025-06-11': [
    { id: 218, time: '08:00', title: 'Evaluación Trimestral', type: 'evaluation', status: 'pending' },
    { id: 219, time: '12:00', title: 'Almuerzo Seguridad', type: 'meeting', status: 'pending' },
    { id: 220, time: '16:00', title: 'Inspección Nocturna', type: 'inspection', status: 'pending' }
  ],
  '2025-06-12': [
    { id: 221, time: '09:30', title: 'Simulacro Evacuación', type: 'training', status: 'pending' },
    { id: 222, time: '14:00', title: 'Reunión Mensual', type: 'meeting', status: 'pending' }
  ],
  '2025-06-13': [
    { id: 223, time: '09:00', title: 'Inspección Área A', type: 'inspection', status: 'pending' },
    { id: 224, time: '14:00', title: 'Capacitación EPP', type: 'training', status: 'pending' }
  ],
  '2025-06-16': [
    { id: 225, time: '10:00', title: 'Evaluación Riesgos', type: 'evaluation', status: 'pending' },
    { id: 226, time: '15:30', title: 'Reunión Comité', type: 'meeting', status: 'pending' }
  ],
  '2025-06-17': [
    { id: 227, time: '09:00', title: 'Inspección Área A', type: 'inspection', status: 'pending' },
    { id: 228, time: '11:30', title: 'Capacitación EPP', type: 'training', status: 'pending' },
    { id: 229, time: '14:00', title: 'Evaluación Proyecto X', type: 'evaluation', status: 'pending' },
    { id: 230, time: '16:00', title: 'Reunión Seguridad', type: 'meeting', status: 'pending' }
  ],
  '2025-06-18': [
    { id: 231, time: '08:30', title: 'Auditoría Cumplimiento', type: 'inspection', status: 'pending' },
    { id: 232, time: '15:00', title: 'Simulacro Emergencia', type: 'training', status: 'pending' }
  ],
  '2025-06-19': [
    { id: 233, time: '10:00', title: 'Revisión Protocolos', type: 'evaluation', status: 'pending' },
    { id: 234, time: '14:30', title: 'Reunión Semanal', type: 'meeting', status: 'pending' }
  ],
  '2025-06-20': [
    { id: 235, time: '09:00', title: 'Inspección Semanal', type: 'inspection', status: 'pending' },
    { id: 236, time: '13:00', title: 'Taller Seguridad', type: 'training', status: 'pending' },
    { id: 237, time: '16:00', title: 'Evaluación Anual', type: 'evaluation', status: 'pending' }
  ],
  '2025-06-23': [
    { id: 238, time: '08:00', title: 'Inspección Matutina', type: 'inspection', status: 'pending' },
    { id: 239, time: '11:00', title: 'Capacitación Nueva', type: 'training', status: 'pending' },
    { id: 240, time: '14:30', title: 'Reunión Directiva', type: 'meeting', status: 'pending' }
  ],
  '2025-06-24': [
    { id: 241, time: '09:30', title: 'Evaluación Final', type: 'evaluation', status: 'pending' },
    { id: 242, time: '15:00', title: 'Inspección Área C', type: 'inspection', status: 'pending' }
  ],
  '2025-06-26': [
    { id: 243, time: '10:00', title: 'Capacitación Especial', type: 'training', status: 'pending' },
    { id: 244, time: '13:30', title: 'Reunión Proyecto', type: 'meeting', status: 'pending' },
    { id: 245, time: '16:30', title: 'Inspección Cierre', type: 'inspection', status: 'pending' }
  ],
  '2025-06-27': [
    { id: 246, time: '08:30', title: 'Evaluación Semanal', type: 'evaluation', status: 'pending' },
    { id: 247, time: '12:00', title: 'Almuerzo Trabajo', type: 'meeting', status: 'pending' }
  ],
  '2025-06-30': [
    { id: 248, time: '09:00', title: 'Inspección Fin Mes', type: 'inspection', status: 'pending' },
    { id: 249, time: '14:00', title: 'Capacitación Cierre', type: 'training', status: 'pending' },
    { id: 250, time: '17:00', title: 'Reunión Fin de Mes', type: 'meeting', status: 'pending' }
  ],
  
  // Diciembre 2024 - Actividades históricas
  '2024-12-01': [
    { id: 101, time: '09:00', title: 'Reunión Inicio Mes', type: 'meeting', status: 'completed' }
  ],
  '2024-12-02': [
    { id: 102, time: '08:00', title: 'Inspección Rutinaria', type: 'inspection', status: 'completed' },
    { id: 103, time: '14:00', title: 'Capacitación Básica', type: 'training', status: 'completed' }
  ],
  '2024-12-03': [
    { id: 104, time: '10:00', title: 'Evaluación Mensual', type: 'evaluation', status: 'completed' },
    { id: 105, time: '15:30', title: 'Reunión Equipo', type: 'meeting', status: 'completed' }
  ],
  '2024-12-04': [
    { id: 106, time: '09:30', title: 'Inspección Área B', type: 'inspection', status: 'completed' }
  ],
  '2024-12-05': [
    { id: 107, time: '11:00', title: 'Taller Prevención', type: 'training', status: 'completed' },
    { id: 108, time: '14:00', title: 'Evaluación Riesgos', type: 'evaluation', status: 'completed' },
    { id: 109, time: '16:30', title: 'Inspección Final', type: 'inspection', status: 'completed' }
  ],
  '2024-12-06': [
    { id: 110, time: '08:30', title: 'Viernes de Seguridad', type: 'meeting', status: 'completed' },
    { id: 111, time: '13:00', title: 'Capacitación EPP', type: 'training', status: 'completed' }
  ],
  '2024-12-09': [
    { id: 112, time: '09:00', title: 'Inspección Semanal', type: 'inspection', status: 'completed' },
    { id: 113, time: '11:30', title: 'Evaluación Proceso', type: 'evaluation', status: 'completed' },
    { id: 114, time: '15:00', title: 'Reunión Supervisores', type: 'meeting', status: 'completed' }
  ],
  '2024-12-10': [
    { id: 115, time: '10:00', title: 'Capacitación Avanzada', type: 'training', status: 'completed' },
    { id: 116, time: '14:30', title: 'Inspección Calidad', type: 'inspection', status: 'completed' }
  ],
  '2024-12-11': [
    { id: 117, time: '08:00', title: 'Evaluación Trimestral', type: 'evaluation', status: 'completed' },
    { id: 118, time: '12:00', title: 'Almuerzo Seguridad', type: 'meeting', status: 'completed' },
    { id: 119, time: '16:00', title: 'Inspección Nocturna', type: 'inspection', status: 'completed' }
  ],
  '2024-12-12': [
    { id: 120, time: '09:30', title: 'Simulacro Evacuación', type: 'training', status: 'completed' },
    { id: 121, time: '14:00', title: 'Reunión Mensual', type: 'meeting', status: 'completed' }
  ],
  '2024-12-13': [
    { id: 1, time: '09:00', title: 'Inspección Área A', type: 'inspection', status: 'completed' },
    { id: 2, time: '14:00', title: 'Capacitación EPP', type: 'training', status: 'completed' }
  ],
  '2024-12-16': [
    { id: 3, time: '10:00', title: 'Evaluación Riesgos', type: 'evaluation', status: 'completed' },
    { id: 122, time: '15:30', title: 'Reunión Comité', type: 'meeting', status: 'completed' }
  ],
  '2024-12-17': [
    { id: 4, time: '09:00', title: 'Inspección Área A', type: 'inspection', status: 'completed' },
    { id: 5, time: '11:30', title: 'Capacitación EPP', type: 'training', status: 'completed' },
    { id: 6, time: '14:00', title: 'Evaluación Proyecto X', type: 'evaluation', status: 'completed' },
    { id: 7, time: '16:00', title: 'Reunión Seguridad', type: 'meeting', status: 'completed' }
  ],
  '2024-12-18': [
    { id: 8, time: '08:30', title: 'Auditoría Cumplimiento', type: 'inspection', status: 'pending' },
    { id: 9, time: '15:00', title: 'Simulacro Emergencia', type: 'training', status: 'pending' }
  ],
  '2024-12-19': [
    { id: 10, time: '10:00', title: 'Revisión Protocolos', type: 'evaluation', status: 'pending' },
    { id: 123, time: '14:30', title: 'Reunión Semanal', type: 'meeting', status: 'pending' }
  ],
  '2024-12-20': [
    { id: 11, time: '09:00', title: 'Inspección Semanal', type: 'inspection', status: 'pending' },
    { id: 12, time: '13:00', title: 'Taller Seguridad', type: 'training', status: 'pending' },
    { id: 124, time: '16:00', title: 'Evaluación Anual', type: 'evaluation', status: 'pending' }
  ],
  '2024-12-23': [
    { id: 125, time: '08:00', title: 'Inspección Matutina', type: 'inspection', status: 'pending' },
    { id: 126, time: '11:00', title: 'Capacitación Nueva', type: 'training', status: 'pending' },
    { id: 127, time: '14:30', title: 'Reunión Directiva', type: 'meeting', status: 'pending' }
  ],
  '2024-12-24': [
    { id: 128, time: '09:30', title: 'Evaluación Final', type: 'evaluation', status: 'pending' },
    { id: 129, time: '15:00', title: 'Inspección Área C', type: 'inspection', status: 'pending' }
  ],
  '2024-12-26': [
    { id: 130, time: '10:00', title: 'Capacitación Especial', type: 'training', status: 'pending' },
    { id: 131, time: '13:30', title: 'Reunión Proyecto', type: 'meeting', status: 'pending' },
    { id: 132, time: '16:30', title: 'Inspección Cierre', type: 'inspection', status: 'pending' }
  ],
  '2024-12-27': [
    { id: 133, time: '08:30', title: 'Evaluación Semanal', type: 'evaluation', status: 'pending' },
    { id: 134, time: '12:00', title: 'Almuerzo Trabajo', type: 'meeting', status: 'pending' }
  ],
  '2024-12-30': [
    { id: 135, time: '09:00', title: 'Inspección Lunes', type: 'inspection', status: 'pending' },
    { id: 136, time: '14:00', title: 'Capacitación Semanal', type: 'training', status: 'pending' },
    { id: 137, time: '17:00', title: 'Reunión Cierre', type: 'meeting', status: 'pending' }
  ],
  '2024-12-31': [
    { id: 138, time: '10:30', title: 'Evaluación Proceso', type: 'evaluation', status: 'pending' },
    { id: 139, time: '15:30', title: 'Inspección Final', type: 'inspection', status: 'pending' },
    { id: 140, time: '17:00', title: 'Reunión Fin de Año', type: 'meeting', status: 'pending' }
  ]
};

const currentDate = new Date();
const currentMonth = currentDate.getMonth(); // Mes actual
const currentYear = currentDate.getFullYear(); // Año actual

const monthNames = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const dayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function getDaysInMonth(month: number, year: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(month: number, year: number) {
  // getDay() retorna 0=domingo, 1=lunes, etc.
  // Necesitamos convertir para que 0=lunes, 1=martes, etc.
  const jsDay = new Date(year, month, 1).getDay();
  return jsDay === 0 ? 6 : jsDay - 1; // Domingo se convierte en 6, el resto se resta 1
}

function formatDateKey(day: number, month: number, year: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getActivityColor(type: string, status: string) {
  const isCompleted = status === 'completed';
  switch (type) {
    case 'inspection':
      return isCompleted ? '#E3F2FD' : '#2196F3';
    case 'training':
      return isCompleted ? '#F3E5F5' : '#9C27B0';
    case 'evaluation':
      return isCompleted ? '#FFF3E0' : '#FF5722';
    case 'meeting':
      return isCompleted ? '#E8F5E8' : '#4CAF50';
    case 'incident':
      return isCompleted ? '#FFEBEE' : '#F44336';
    default:
      return isCompleted ? '#F5F5F5' : '#9E9E9E';
  }
}

function getActivityTextColor(type: string, status: string) {
  const isCompleted = status === 'completed';
  if (isCompleted) {
    return '#666';
  }
  switch (type) {
    case 'inspection':
      return '#1976D2';
    case 'training':
      return '#7B1FA2';
    case 'evaluation':
      return '#E64A19';
    case 'meeting':
      return '#388E3C';
    case 'incident':
      return '#C62828';
    default:
      return '#616161';
  }
}

function truncateText(text: string, maxLength: number = 10) {
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

// Componente de formulario dinámico
function FormComponent({ 
  activity, 
  onSubmit, 
  onCancel 
}: { 
  activity: Activity; 
  onSubmit: () => void; 
  onCancel: () => void; 
}) {
  const [formData, setFormData] = useState<any>({});
  const [photos, setPhotos] = useState<string[]>([]);

  const updateFormData = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleTakePhoto = async () => {
    // Simulamos la captura de una foto
    Alert.alert(
      'Seleccionar Foto',
      'Elige una opción para agregar la foto:',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Cámara', onPress: () => simulatePhotoCapture('camera') },
        { text: 'Galería', onPress: () => simulatePhotoCapture('gallery') }
      ]
    );
  };

  const simulatePhotoCapture = (source: 'camera' | 'gallery') => {
    // Simulamos una foto capturada agregando una URL fake
    const mockPhotoUrl = `https://via.placeholder.com/400x300/cccccc/666666?text=${source === 'camera' ? 'Foto+Cámara' : 'Foto+Galería'}+${photos.length + 1}`;
    setPhotos(prev => [...prev, mockPhotoUrl]);
    Alert.alert('Éxito', `Foto agregada desde ${source === 'camera' ? 'cámara' : 'galería'}`);
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    // Validación para formularios que requieren fotos
    if (activity.formId === 'incident-form' && photos.length === 0) {
      Alert.alert(
        'Fotos Requeridas',
        'Este formulario requiere al menos una foto de evidencia antes de poder completar la actividad.',
        [{ text: 'Entendido' }]
      );
      return;
    }

    Alert.alert(
      'Confirmar Ejecución',
      '¿Estás seguro de que deseas completar esta actividad?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Confirmar', onPress: onSubmit }
      ]
    );
  };

  const renderFormFields = () => {
    switch (activity.formId) {
      case 'inspection-form':
        return (
          <View>
            <Text style={formStyles.sectionTitle}>Formulario de Inspección</Text>
            
            <View style={formStyles.fieldGroup}>
              <Text style={formStyles.fieldLabel}>Área inspeccionada</Text>
              <Text style={formStyles.fieldValue}>{activity.location}</Text>
            </View>

            <View style={formStyles.fieldGroup}>
              <Text style={formStyles.fieldLabel}>Estado general</Text>
              <View style={formStyles.radioGroup}>
                {['Excelente', 'Bueno', 'Regular', 'Deficiente'].map((option) => (
                  <TouchableOpacity 
                    key={option} 
                    style={[
                      formStyles.radioOption,
                      formData.status === option && formStyles.radioSelected
                    ]}
                    onPress={() => updateFormData('status', option)}
                  >
                    <Text style={[
                      formStyles.radioText,
                      formData.status === option && formStyles.radioTextSelected
                    ]}>
                      {option}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={formStyles.fieldGroup}>
              <Text style={formStyles.fieldLabel}>Observaciones</Text>
              <Text style={formStyles.textInput}>
                Escriba aquí sus observaciones...
              </Text>
            </View>

            <View style={formStyles.fieldGroup}>
              <Text style={formStyles.fieldLabel}>Fotografías ({photos.length})</Text>
              <TouchableOpacity style={formStyles.photoButton} onPress={handleTakePhoto}>
                <FontAwesome name="camera" size={20} color="#666" />
                <Text style={formStyles.photoButtonText}>Agregar fotografías</Text>
              </TouchableOpacity>
              
              {photos.length > 0 && (
                <View style={formStyles.photosContainer}>
                  {photos.map((photo, index) => (
                    <View key={index} style={formStyles.photoItem}>
                      <Image source={{ uri: photo }} style={formStyles.photoPreview} />
                      <TouchableOpacity 
                        style={formStyles.removePhotoButton}
                        onPress={() => removePhoto(index)}
                      >
                        <FontAwesome name="times" size={12} color="white" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        );

      case 'training-form':
        return (
          <View>
            <Text style={formStyles.sectionTitle}>Formulario de Capacitación</Text>
            
            <View style={formStyles.fieldGroup}>
              <Text style={formStyles.fieldLabel}>Tema de capacitación</Text>
              <Text style={formStyles.fieldValue}>{activity.title}</Text>
            </View>

            <View style={formStyles.fieldGroup}>
              <Text style={formStyles.fieldLabel}>Número de participantes</Text>
              <Text style={formStyles.textInput}>0</Text>
            </View>

            <View style={formStyles.fieldGroup}>
              <Text style={formStyles.fieldLabel}>Material entregado</Text>
              <View style={formStyles.checkboxGroup}>
                {['Manual', 'Presentación', 'Video', 'Certificado'].map((material) => (
                  <TouchableOpacity 
                    key={material} 
                    style={formStyles.checkboxOption}
                    onPress={() => {
                      const materials = formData.materials || [];
                      const updated = materials.includes(material) 
                        ? materials.filter((m: string) => m !== material)
                        : [...materials, material];
                      updateFormData('materials', updated);
                    }}
                  >
                    <FontAwesome 
                      name={formData.materials?.includes(material) ? "check-square" : "square-o"} 
                      size={20} 
                      color="#2196F3" 
                    />
                    <Text style={formStyles.checkboxText}>{material}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={formStyles.fieldGroup}>
              <Text style={formStyles.fieldLabel}>Evaluación</Text>
              <Text style={formStyles.textInput}>
                Resultados de la evaluación...
              </Text>
            </View>

            <View style={formStyles.fieldGroup}>
              <Text style={formStyles.fieldLabel}>Fotos de la Capacitación ({photos.length})</Text>
              <TouchableOpacity style={formStyles.photoButton} onPress={handleTakePhoto}>
                <FontAwesome name="camera" size={20} color="#666" />
                <Text style={formStyles.photoButtonText}>Agregar fotos de la sesión</Text>
              </TouchableOpacity>
              
              {photos.length > 0 && (
                <View style={formStyles.photosContainer}>
                  {photos.map((photo, index) => (
                    <View key={index} style={formStyles.photoItem}>
                      <Image source={{ uri: photo }} style={formStyles.photoPreview} />
                      <TouchableOpacity 
                        style={formStyles.removePhotoButton}
                        onPress={() => removePhoto(index)}
                      >
                        <FontAwesome name="times" size={12} color="white" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        );

      case 'evaluation-form':
        return (
          <View>
            <Text style={formStyles.sectionTitle}>Formulario de Evaluación</Text>
            
            <View style={formStyles.fieldGroup}>
              <Text style={formStyles.fieldLabel}>Proceso evaluado</Text>
              <Text style={formStyles.fieldValue}>{activity.description}</Text>
            </View>

            <View style={formStyles.fieldGroup}>
              <Text style={formStyles.fieldLabel}>Nivel de riesgo identificado</Text>
              <View style={formStyles.riskLevels}>
                {[
                  { level: 'Bajo', color: '#4CAF50' },
                  { level: 'Medio', color: '#FF9800' },
                  { level: 'Alto', color: '#F44336' },
                  { level: 'Crítico', color: '#9C27B0' }
                ].map(({ level, color }) => (
                  <TouchableOpacity 
                    key={level}
                    style={[
                      formStyles.riskButton,
                      { borderColor: color },
                      formData.riskLevel === level && { backgroundColor: color }
                    ]}
                    onPress={() => updateFormData('riskLevel', level)}
                  >
                    <Text style={[
                      formStyles.riskText,
                      { color: formData.riskLevel === level ? 'white' : color }
                    ]}>
                      {level}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={formStyles.fieldGroup}>
              <Text style={formStyles.fieldLabel}>Medidas recomendadas</Text>
              <Text style={formStyles.textInput}>
                Escriba las medidas recomendadas...
              </Text>
            </View>
          </View>
        );

      case 'incident-form':
        return (
          <View>
            <Text style={formStyles.sectionTitle}>Formulario de Reporte de Incidente</Text>
            
            <View style={formStyles.fieldGroup}>
              <Text style={formStyles.fieldLabel}>Tipo de incidente</Text>
              <View style={formStyles.radioGroup}>
                {['Accidente', 'Casi accidente', 'Condición insegura', 'Acto inseguro'].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      formStyles.radioOption,
                      formData.incidentType === type && formStyles.radioSelected
                    ]}
                    onPress={() => updateFormData('incidentType', type)}
                  >
                    <Text style={[
                      formStyles.radioText,
                      formData.incidentType === type && formStyles.radioTextSelected
                    ]}>
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={formStyles.fieldGroup}>
              <Text style={formStyles.fieldLabel}>Descripción del incidente</Text>
              <Text style={formStyles.textInput}>
                Describa detalladamente lo ocurrido...
              </Text>
            </View>

            <View style={formStyles.fieldGroup}>
              <Text style={formStyles.fieldLabel}>Área donde ocurrió</Text>
              <Text style={formStyles.fieldValue}>{activity.location}</Text>
            </View>

            <View style={formStyles.fieldGroup}>
              <Text style={formStyles.fieldLabel}>Personas involucradas</Text>
              <Text style={formStyles.textInput}>
                Nombres de las personas involucradas...
              </Text>
            </View>

            <View style={formStyles.fieldGroup}>
              <Text style={formStyles.fieldLabel}>Lesiones reportadas</Text>
              <View style={formStyles.radioGroup}>
                {['Sin lesiones', 'Lesiones leves', 'Lesiones graves', 'Fatalidad'].map((injury) => (
                  <TouchableOpacity
                    key={injury}
                    style={[
                      formStyles.radioOption,
                      formData.injuries === injury && formStyles.radioSelected
                    ]}
                    onPress={() => updateFormData('injuries', injury)}
                  >
                    <Text style={[
                      formStyles.radioText,
                      formData.injuries === injury && formStyles.radioTextSelected
                    ]}>
                      {injury}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={formStyles.fieldGroup}>
              <Text style={formStyles.fieldLabel}>
                Fotos de Evidencia ({photos.length}) 
                <Text style={{ color: '#F44336', fontSize: 12 }}> * Requerido</Text>
              </Text>
              <TouchableOpacity style={formStyles.photoButton} onPress={handleTakePhoto}>
                <FontAwesome name="camera" size={20} color="#666" />
                <Text style={formStyles.photoButtonText}>Agregar fotos de evidencia</Text>
              </TouchableOpacity>
              
              {photos.length > 0 && (
                <View style={formStyles.photosContainer}>
                  {photos.map((photo, index) => (
                    <View key={index} style={formStyles.photoItem}>
                      <Image source={{ uri: photo }} style={formStyles.photoPreview} />
                      <TouchableOpacity 
                        style={formStyles.removePhotoButton}
                        onPress={() => removePhoto(index)}
                      >
                        <FontAwesome name="times" size={12} color="white" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>

            <View style={formStyles.fieldGroup}>
              <Text style={formStyles.fieldLabel}>Acciones inmediatas tomadas</Text>
              <Text style={formStyles.textInput}>
                Describa las acciones inmediatas...
              </Text>
            </View>

            <View style={formStyles.fieldGroup}>
              <Text style={formStyles.fieldLabel}>Medidas preventivas recomendadas</Text>
              <Text style={formStyles.textInput}>
                Qué medidas se pueden tomar para prevenir futuros incidentes...
              </Text>
            </View>
          </View>
        );

      case 'meeting-form':
        return (
          <View>
            <Text style={formStyles.sectionTitle}>Formulario de Reunión</Text>
            
            <View style={formStyles.fieldGroup}>
              <Text style={formStyles.fieldLabel}>Tema de reunión</Text>
              <Text style={formStyles.fieldValue}>{activity.title}</Text>
            </View>

            <View style={formStyles.fieldGroup}>
              <Text style={formStyles.fieldLabel}>Asistentes</Text>
              <Text style={formStyles.textInput}>
                Lista de asistentes...
              </Text>
            </View>

            <View style={formStyles.fieldGroup}>
              <Text style={formStyles.fieldLabel}>Puntos tratados</Text>
              <Text style={formStyles.textInput}>
                Resumen de puntos tratados...
              </Text>
            </View>

            <View style={formStyles.fieldGroup}>
              <Text style={formStyles.fieldLabel}>Acuerdos y compromisos</Text>
              <Text style={formStyles.textInput}>
                Acuerdos alcanzados...
              </Text>
            </View>
          </View>
        );

      default:
        return (
          <View>
            <Text style={formStyles.sectionTitle}>Formulario Genérico</Text>
            <View style={formStyles.fieldGroup}>
              <Text style={formStyles.fieldLabel}>Comentarios</Text>
              <Text style={formStyles.textInput}>
                Escriba sus comentarios...
              </Text>
            </View>
          </View>
        );
    }
  };

  return (
    <View style={formStyles.container}>
      {renderFormFields()}
      
      <View style={formStyles.buttonContainer}>
        <TouchableOpacity style={formStyles.cancelButton} onPress={onCancel}>
          <Text style={formStyles.cancelButtonText}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={formStyles.submitButton} onPress={handleSubmit}>
          <FontAwesome name="check" size={16} color="white" />
          <Text style={formStyles.submitButtonText}>Completar Actividad</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const formStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  fieldGroup: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  fieldValue: {
    fontSize: 14,
    color: '#666',
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
  },
  textInput: {
    fontSize: 14,
    color: '#666',
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    minHeight: 80,
  },
  radioGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  radioOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: 'white',
  },
  radioSelected: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  radioText: {
    fontSize: 14,
    color: '#666',
  },
  radioTextSelected: {
    color: 'white',
  },
  checkboxGroup: {
    gap: 12,
  },
  checkboxOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkboxText: {
    fontSize: 14,
    color: '#333',
  },
  riskLevels: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  riskButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 2,
    backgroundColor: 'white',
  },
  riskText: {
    fontSize: 14,
    fontWeight: '600',
  },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
    backgroundColor: '#f8f9fa',
    gap: 8,
  },
  photoButtonText: {
    fontSize: 14,
    color: '#666',
  },
  photosContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
    gap: 10,
  },
  photoItem: {
    position: 'relative',
    width: 100,
    height: 100,
  },
  photoPreview: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  removePhotoButton: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#F44336',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 32,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: 'white',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  submitButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#4CAF50',
    gap: 8,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
});

export default function CalendarScreen() {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [displayMonth, setDisplayMonth] = useState(currentMonth);
  const [displayYear, setDisplayYear] = useState(currentYear);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);

  const daysInMonth = getDaysInMonth(displayMonth, displayYear);
  const firstDay = getFirstDayOfMonth(displayMonth, displayYear);

  const goToPreviousMonth = () => {
    if (displayMonth === 0) {
      setDisplayMonth(11);
      setDisplayYear(displayYear - 1);
    } else {
      setDisplayMonth(displayMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (displayMonth === 11) {
      setDisplayMonth(0);
      setDisplayYear(displayYear + 1);
    } else {
      setDisplayMonth(displayMonth + 1);
    }
  };

  const goToToday = () => {
    setDisplayMonth(currentMonth);
    setDisplayYear(currentYear);
  };

  const handleActivityPress = (activity: Activity) => {
    if (activity.status === 'pending') {
      setSelectedActivity(activity);
      setShowActivityModal(true);
    }
  };

  const handleExecuteActivity = () => {
    setShowActivityModal(false);
    setShowFormModal(true);
  };

  const handleFormSubmit = () => {
    setShowFormModal(false);
    setSelectedActivity(null);
    Alert.alert(
      'Actividad Completada',
      'La actividad ha sido ejecutada exitosamente.',
      [{ text: 'OK' }]
    );
  };

  const closeModals = () => {
    setShowActivityModal(false);
    setShowFormModal(false);
    setSelectedActivity(null);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return '#F44336';
      case 'medium':
        return '#FF9800';
      case 'low':
        return '#4CAF50';
      default:
        return '#9E9E9E';
    }
  };

  // Crear array de días del calendario con días del mes anterior y siguiente
  const calendarDays: { day: number; isCurrentMonth: boolean }[] = [];
  
  // Días del mes anterior (espacios en blanco)
  const prevMonth = displayMonth === 0 ? 11 : displayMonth - 1;
  const prevYear = displayMonth === 0 ? displayYear - 1 : displayYear;
  const daysInPrevMonth = getDaysInMonth(prevMonth, prevYear);
  
  for (let i = 0; i < firstDay; i++) {
    calendarDays.push({ 
      day: daysInPrevMonth - firstDay + 1 + i, 
      isCurrentMonth: false 
    });
  }
  
  // Días del mes actual
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push({ day, isCurrentMonth: true });
  }
  
  // Días del mes siguiente para completar la última semana
  const remainingCells = 42 - calendarDays.length; // 6 semanas x 7 días = 42
  for (let day = 1; day <= remainingCells; day++) {
    calendarDays.push({ day, isCurrentMonth: false });
  }

  const selectedActivities = selectedDate ? monthlyActivities[selectedDate] || [] : [];

  return (
    <ScrollView style={styles.container}>
      {/* Header del calendario */}
      <View style={styles.calendarHeader}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={goToPreviousMonth} style={styles.navButton}>
            <FontAwesome name="chevron-left" size={16} color="black" />
          </TouchableOpacity>
          
          <View style={styles.titleContainer}>
            <FontAwesome name="calendar" size={16} color="black" />
            <Text style={styles.calendarHeaderTitle}>
              {monthNames[displayMonth]} {displayYear}
            </Text>
          </View>
          
          <TouchableOpacity onPress={goToNextMonth} style={styles.navButton}>
            <FontAwesome name="chevron-right" size={16} color="black" />
          </TouchableOpacity>
        </View>
        
        <TouchableOpacity onPress={goToToday} style={styles.todayButton}>
          <Text style={styles.todayButtonText}>Ir a Hoy</Text>
        </TouchableOpacity>
      </View>

      {/* Días de la semana */}
      <View style={styles.daysHeader}>
        {dayNames.map((day) => (
          <View key={day} style={styles.dayHeaderCell}>
            <Text style={styles.dayHeaderText}>{day}</Text>
          </View>
        ))}
      </View>

      {/* Calendario estilo Google Calendar */}
      <View style={styles.calendar}>
        {Array.from({ length: Math.ceil(calendarDays.length / 7) }, (_, weekIndex) => (
          <View key={weekIndex} style={styles.week}>
            {calendarDays.slice(weekIndex * 7, (weekIndex + 1) * 7).map((dayData, dayIndex) => {
              const { day, isCurrentMonth } = dayData;
              
              // Solo procesar actividades para días del mes actual
              const dateKey = isCurrentMonth ? formatDateKey(day, displayMonth, displayYear) : '';
              const dayActivities = isCurrentMonth ? (monthlyActivities[dateKey] || []) : [];
              const isToday = isCurrentMonth && day === currentDate.getDate() && 
                            displayMonth === currentDate.getMonth() && 
                            displayYear === currentDate.getFullYear();
              const isSelected = isCurrentMonth && selectedDate === dateKey;

              return (
                <TouchableOpacity
                  key={`${weekIndex}-${dayIndex}`}
                  style={[
                    styles.dayCell,
                    !isCurrentMonth && styles.adjacentMonthCell,
                    isToday && styles.todayCell,
                    isSelected && styles.selectedCell
                  ]}
                  onPress={isCurrentMonth ? () => setSelectedDate(isSelected ? null : dateKey) : undefined}
                  disabled={!isCurrentMonth}
                >
                  {/* Número del día */}
                  <Text style={[
                    styles.dayNumber,
                    !isCurrentMonth && styles.adjacentMonthNumber,
                    isToday && styles.todayNumber,
                    isSelected && styles.selectedNumber
                  ]}>
                    {day}
                  </Text>

                  {/* Actividades del día (solo para días del mes actual) */}
                  {isCurrentMonth && (
                    <View style={styles.activitiesInDay}>
                      {dayActivities.slice(0, 3).map((activity: Activity) => (
                        <TouchableOpacity
                          key={activity.id} 
                          style={[
                            styles.activityInDay,
                            { backgroundColor: getActivityColor(activity.type, activity.status) }
                          ]}
                          onPress={() => handleActivityPress(activity)}
                          disabled={activity.status === 'completed'}
                        >
                          <Text 
                            style={[
                              styles.activityText,
                              { color: getActivityTextColor(activity.type, activity.status) },
                              activity.status === 'completed' && styles.completedActivityText
                            ]}
                            numberOfLines={1}
                          >
                            {activity.time} {truncateText(activity.title)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                      
                      {/* Indicador de más actividades */}
                      {dayActivities.length > 3 && (
                        <Text style={styles.moreActivitiesText}>
                          +{dayActivities.length - 3} más
                        </Text>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>

      {/* Detalle del día seleccionado */}
      {selectedDate && (
        <View style={styles.selectedDateSection}>
          <View style={styles.selectedDateHeader}>
            <FontAwesome name="calendar-check-o" size={20} color="#2196F3" />
            <Text style={styles.selectedDateTitle}>
              {selectedDate.split('-')[2]} de {monthNames[parseInt(selectedDate.split('-')[1]) - 1]}
            </Text>
          </View>
          
          {selectedActivities.length > 0 ? (
            selectedActivities.map((activity: Activity) => (
              <TouchableOpacity 
                key={activity.id} 
                style={styles.activityDetailCard}
                onPress={() => handleActivityPress(activity)}
                disabled={activity.status === 'completed'}
              >
                <View style={styles.activityDetailHeader}>
                  <View style={[
                    styles.activityTypeIndicator,
                    { backgroundColor: getActivityColor(activity.type, activity.status) }
                  ]} />
                  <Text style={styles.activityDetailTime}>{activity.time}</Text>
                  <View style={styles.activityStatusBadge}>
                    <FontAwesome 
                      name={activity.status === 'completed' ? 'check-circle' : 'clock-o'} 
                      size={12} 
                      color={activity.status === 'completed' ? '#4CAF50' : '#FF9800'} 
                    />
                    <Text style={[
                      styles.activityStatusText,
                      { color: activity.status === 'completed' ? '#4CAF50' : '#FF9800' }
                    ]}>
                      {activity.status === 'completed' ? 'Completada' : 'Pendiente'}
                    </Text>
                  </View>
                </View>
                <Text style={[
                  styles.activityDetailTitle,
                  activity.status === 'completed' && styles.completedActivityTitle
                ]}>
                  {activity.title}
                </Text>
                {activity.status === 'pending' && (
                  <View style={styles.tapToExecuteHint}>
                    <FontAwesome name="hand-pointer-o" size={12} color="#666" />
                    <Text style={styles.tapToExecuteText}>Toca para ejecutar</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.noActivitiesContainer}>
              <FontAwesome name="calendar-times-o" size={40} color="#ccc" />
              <Text style={styles.noActivitiesText}>
                No hay actividades programadas para este día
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Leyenda de colores */}
      <View style={styles.legend}>
        <Text style={styles.legendTitle}>Tipos de Actividades</Text>
        <View style={styles.legendGrid}>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: '#2196F3' }]} />
            <Text style={styles.legendText}>Inspección</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: '#9C27B0' }]} />
            <Text style={styles.legendText}>Capacitación</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: '#FF5722' }]} />
            <Text style={styles.legendText}>Evaluación</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: '#4CAF50' }]} />
            <Text style={styles.legendText}>Reunión</Text>
          </View>
        </View>
      </View>

      {/* Modal de detalles de actividad */}
      <Modal
        visible={showActivityModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeModals}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Detalles de Actividad</Text>
            <TouchableOpacity onPress={closeModals} style={styles.closeButton}>
              <FontAwesome name="times" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          {selectedActivity && (
            <ScrollView style={styles.modalContent}>
              <View style={styles.activityInfoCard}>
                <View style={styles.activityInfoHeader}>
                  <View style={[
                    styles.activityTypeIndicator,
                    { backgroundColor: getActivityColor(selectedActivity.type, selectedActivity.status) }
                  ]} />
                  <View style={styles.activityInfoTitle}>
                    <Text style={styles.activityInfoTitleText}>{selectedActivity.title}</Text>
                    <Text style={styles.activityInfoSubtitle}>
                      {selectedActivity.time} • {selectedActivity.duration}
                    </Text>
                  </View>
                  {selectedActivity.priority && (
                    <View style={[
                      styles.priorityBadge,
                      { backgroundColor: getPriorityColor(selectedActivity.priority) }
                    ]}>
                      <Text style={styles.priorityText}>
                        {selectedActivity.priority === 'high' ? 'Alta' : 
                         selectedActivity.priority === 'medium' ? 'Media' : 'Baja'}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.activityInfoDetails}>
                  <View style={styles.activityInfoRow}>
                    <FontAwesome name="info-circle" size={16} color="#666" />
                    <Text style={styles.activityInfoLabel}>Descripción:</Text>
                  </View>
                  <Text style={styles.activityInfoText}>{selectedActivity.description}</Text>

                  <View style={styles.activityInfoRow}>
                    <FontAwesome name="map-marker" size={16} color="#666" />
                    <Text style={styles.activityInfoLabel}>Ubicación:</Text>
                  </View>
                  <Text style={styles.activityInfoText}>{selectedActivity.location}</Text>

                  <View style={styles.activityInfoRow}>
                    <FontAwesome name="user" size={16} color="#666" />
                    <Text style={styles.activityInfoLabel}>Asignado a:</Text>
                  </View>
                  <Text style={styles.activityInfoText}>{selectedActivity.assignedTo}</Text>

                  <View style={styles.activityInfoRow}>
                    <FontAwesome name="file-text-o" size={16} color="#666" />
                    <Text style={styles.activityInfoLabel}>Tipo de actividad:</Text>
                  </View>
                  <Text style={styles.activityInfoText}>
                    {selectedActivity.type === 'inspection' ? 'Inspección' :
                     selectedActivity.type === 'training' ? 'Capacitación' :
                     selectedActivity.type === 'evaluation' ? 'Evaluación' :
                     selectedActivity.type === 'incident' ? 'Reporte de Incidente' : 'Reunión'}
                  </Text>
                </View>

                <TouchableOpacity 
                  style={styles.executeButton} 
                  onPress={handleExecuteActivity}
                >
                  <FontAwesome name="play-circle" size={20} color="white" />
                  <Text style={styles.executeButtonText}>Ejecutar Actividad</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* Modal de formulario */}
      <Modal
        visible={showFormModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeModals}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              Formulario - {selectedActivity?.title}
            </Text>
            <TouchableOpacity onPress={closeModals} style={styles.closeButton}>
              <FontAwesome name="times" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {selectedActivity && (
              <FormComponent 
                activity={selectedActivity} 
                onSubmit={handleFormSubmit}
                onCancel={closeModals}
              />
            )}
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    color: 'black',
  },
  calendarHeader: {
    backgroundColor: 'white',
    color: 'black',
    paddingHorizontal: 15,
    paddingTop: 45,
    paddingBottom: 15,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  navButton: {
    padding: 8,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  todayButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'center',
  },
  todayButtonText: {
    color: 'black',
    fontSize: 13,
    fontWeight: '600',
  },
  calendarHeaderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'black',
    marginLeft: 6,
  },
  daysHeader: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingVertical: 8,
  },
  dayHeaderCell: {
    flex: 1,
    alignItems: 'center',
  },
  dayHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  calendar: {
    backgroundColor: 'white',
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginHorizontal: 10,
    borderRadius: 8,
    overflow: 'hidden',
  },
  week: {
    flexDirection: 'row',
  },
  emptyDay: {
    flex: 1,
    height: 100,
    backgroundColor: 'white',
    borderWidth: 0.5,
    borderColor: '#e0e0e0',
  },
  dayCell: {
    flex: 1,
    height: 100,
    borderWidth: 0.5,
    borderColor: '#e0e0e0',
    backgroundColor: 'white',
    padding: 4,
  },
  adjacentMonthCell: {
    backgroundColor: '#f8f8f8',
    opacity: 0.5,
  },
  todayCell: {
    backgroundColor: '#FFF3E0',
    borderColor: '#FF9800',
    borderWidth: 2,
  },
  selectedCell: {
    backgroundColor: '#E3F2FD',
    borderColor: '#2196F3',
    borderWidth: 2,
  },
  dayNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 2,
  },
  adjacentMonthNumber: {
    color: '#ccc',
  },
  todayNumber: {
    color: '#FF9800',
    fontWeight: 'bold',
  },
  selectedNumber: {
    color: '#2196F3',
    fontWeight: 'bold',
  },
  activitiesInDay: {
    flex: 1,
  },
  activityInDay: {
    marginBottom: 1,
    paddingHorizontal: 3,
    paddingVertical: 2,
    borderRadius: 3,
    marginHorizontal: 1,
  },
  activityText: {
    fontSize: 9,
    fontWeight: '500',
    lineHeight: 11,
  },
  completedActivityText: {
    textDecorationLine: 'line-through',
    opacity: 0.7,
  },
  moreActivitiesText: {
    fontSize: 7,
    color: '#666',
    textAlign: 'center',
    marginTop: 1,
    fontStyle: 'italic',
  },
  selectedDateSection: {
    backgroundColor: 'white',
    margin: 15,
    marginTop: 0,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  selectedDateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  selectedDateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 10,
  },
  activityDetailCard: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  activityDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  activityTypeIndicator: {
    width: 4,
    height: 20,
    borderRadius: 2,
    marginRight: 10,
  },
  activityDetailTime: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    minWidth: 50,
  },
  activityStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
  },
  activityStatusText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  activityDetailTitle: {
    fontSize: 16,
    color: '#333',
    marginLeft: 14,
  },
  tapToExecuteHint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginLeft: 14,
  },
  tapToExecuteText: {
    fontSize: 11,
    color: '#666',
    marginLeft: 4,
    fontStyle: 'italic',
  },
  completedActivityTitle: {
    color: '#666',
    textDecorationLine: 'line-through',
  },
  noActivitiesContainer: {
    alignItems: 'center',
    padding: 30,
  },
  noActivitiesText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 10,
    fontStyle: 'italic',
  },
  legend: {
    backgroundColor: 'white',
    margin: 15,
    padding: 15,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
    elevation: 3,
  },
  legendTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  legendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '48%',
    marginBottom: 8,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 2,
    marginRight: 8,
  },
  legendText: {
    fontSize: 12,
    color: '#666',
  },
  // Estilos para modales
  modalContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 8,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  activityInfoCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  activityInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  activityInfoTitle: {
    flex: 1,
    marginLeft: 12,
  },
  activityInfoTitleText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  activityInfoSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  priorityText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: 'white',
  },
  activityInfoDetails: {
    marginBottom: 24,
  },
  activityInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 4,
  },
  activityInfoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  activityInfoText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginLeft: 24,
  },
  executeButton: {
    backgroundColor: '#2196F3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  executeButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
    marginLeft: 8,
  },
}); 