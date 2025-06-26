import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Switch,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Question {
  id: string;
  text: string;
  type: string;
  required: boolean;
  description?: string;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}

interface Section {
  id: string;
  title: string;
  description?: string;
  questions: Question[];
  order: number;
}

interface FormTemplate {
  id: string;
  name: string;
  description?: string;
  type: string;
  sections: Section[];
  metadata: {
    totalQuestions: number;
    estimatedTime: number;
    requiresSignature: boolean;
    requiresPhotos: boolean;
  };
}

interface FormResponse {
  [questionId: string]: any;
}

interface FormRendererProps {
  template: FormTemplate;
  onSubmit: (responses: FormResponse) => void;
  onSave?: (responses: FormResponse) => void;
  initialValues?: FormResponse;
}

const FormRenderer: React.FC<FormRendererProps> = ({
  template,
  onSubmit,
  onSave,
  initialValues = {},
}) => {
  const [responses, setResponses] = useState<FormResponse>(initialValues);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [errors, setErrors] = useState<{ [questionId: string]: string }>({});

  const currentSection = template.sections[currentSectionIndex];
  const isLastSection = currentSectionIndex === template.sections.length - 1;
  const isFirstSection = currentSectionIndex === 0;

  useEffect(() => {
    setResponses(initialValues);
  }, [initialValues]);

  const updateResponse = (questionId: string, value: any) => {
    setResponses(prev => ({
      ...prev,
      [questionId]: value,
    }));
    
    // Clear error if exists
    if (errors[questionId]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[questionId];
        return newErrors;
      });
    }
  };

  const validateSection = (section: Section): boolean => {
    const newErrors: { [questionId: string]: string } = {};
    let isValid = true;

    section.questions.forEach(question => {
      if (question.required && !responses[question.id]) {
        newErrors[question.id] = 'Esta pregunta es obligatoria';
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  };

  const handleNext = () => {
    if (validateSection(currentSection)) {
      if (isLastSection) {
        handleSubmit();
      } else {
        setCurrentSectionIndex(prev => prev + 1);
      }
    }
  };

  const handleBack = () => {
    if (!isFirstSection) {
      setCurrentSectionIndex(prev => prev - 1);
    }
  };

  const handleSubmit = () => {
    // Validate all sections
    let allValid = true;
    template.sections.forEach(section => {
      if (!validateSection(section)) {
        allValid = false;
      }
    });

    if (allValid) {
      onSubmit(responses);
    } else {
      Alert.alert('Error', 'Por favor completa todos los campos obligatorios');
    }
  };

  const handleSave = () => {
    if (onSave) {
      onSave(responses);
    }
  };

  const getCompletionPercentage = (): number => {
    const totalQuestions = template.metadata.totalQuestions;
    const answeredQuestions = Object.keys(responses).length;
    return totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 0;
  };

  const renderQuestion = (question: Question) => {
    const hasError = !!errors[question.id];
    const value = responses[question.id];

    return (
      <View key={question.id} style={[styles.questionContainer, hasError && styles.questionError]}>
        <View style={styles.questionHeader}>
          <Text style={styles.questionText}>
            {question.text}
            {question.required && <Text style={styles.required}> *</Text>}
          </Text>
          {question.description && (
            <Text style={styles.questionDescription}>{question.description}</Text>
          )}
        </View>

        {renderQuestionInput(question, value)}

        {hasError && (
          <Text style={styles.errorText}>{errors[question.id]}</Text>
        )}
      </View>
    );
  };

  const renderQuestionInput = (question: Question, value: any) => {
    switch (question.type) {
      case 'text_input':
        return (
          <TextInput
            style={styles.textInput}
            value={value || ''}
            onChangeText={(text) => updateResponse(question.id, text)}
            placeholder={question.placeholder}
            placeholderTextColor="#9CA3AF"
          />
        );

      case 'text_area':
        return (
          <TextInput
            style={[styles.textInput, styles.textArea]}
            value={value || ''}
            onChangeText={(text) => updateResponse(question.id, text)}
            placeholder={question.placeholder}
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={4}
          />
        );

      case 'number':
        return (
          <TextInput
            style={styles.textInput}
            value={value?.toString() || ''}
            onChangeText={(text) => updateResponse(question.id, parseFloat(text) || text)}
            placeholder={question.placeholder}
            placeholderTextColor="#9CA3AF"
            keyboardType="numeric"
          />
        );

      case 'boolean':
        return (
          <View style={styles.booleanContainer}>
            <TouchableOpacity
              style={[
                styles.booleanOption,
                value === true && styles.booleanOptionSelected,
              ]}
              onPress={() => updateResponse(question.id, true)}
            >
              <Ionicons
                name={value === true ? "checkmark-circle" : "ellipse-outline"}
                size={24}
                color={value === true ? "#10B981" : "#9CA3AF"}
              />
              <Text style={[
                styles.booleanText,
                value === true && styles.booleanTextSelected,
              ]}>
                Sí
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.booleanOption,
                value === false && styles.booleanOptionSelected,
              ]}
              onPress={() => updateResponse(question.id, false)}
            >
              <Ionicons
                name={value === false ? "checkmark-circle" : "ellipse-outline"}
                size={24}
                color={value === false ? "#EF4444" : "#9CA3AF"}
              />
              <Text style={[
                styles.booleanText,
                value === false && styles.booleanTextSelected,
              ]}>
                No
              </Text>
            </TouchableOpacity>
          </View>
        );

      case 'single_choice':
        return (
          <View style={styles.optionsContainer}>
            {question.options?.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.optionItem,
                  value === option.value && styles.optionItemSelected,
                ]}
                onPress={() => updateResponse(question.id, option.value)}
              >
                <Ionicons
                  name={value === option.value ? "radio-button-on" : "radio-button-off"}
                  size={24}
                  color={value === option.value ? "#0891B2" : "#9CA3AF"}
                />
                <Text style={[
                  styles.optionText,
                  value === option.value && styles.optionTextSelected,
                ]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        );

      case 'multiple_choice':
        const selectedValues = Array.isArray(value) ? value : [];
        return (
          <View style={styles.optionsContainer}>
            {question.options?.map((option) => {
              const isSelected = selectedValues.includes(option.value);
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.optionItem,
                    isSelected && styles.optionItemSelected,
                  ]}
                  onPress={() => {
                    let newValues;
                    if (isSelected) {
                      newValues = selectedValues.filter(v => v !== option.value);
                    } else {
                      newValues = [...selectedValues, option.value];
                    }
                    updateResponse(question.id, newValues);
                  }}
                >
                  <Ionicons
                    name={isSelected ? "checkbox" : "square-outline"}
                    size={24}
                    color={isSelected ? "#0891B2" : "#9CA3AF"}
                  />
                  <Text style={[
                    styles.optionText,
                    isSelected && styles.optionTextSelected,
                  ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        );

      case 'photo':
        return (
          <TouchableOpacity
            style={styles.photoButton}
            onPress={() => {
              // TODO: Implement camera functionality
              Alert.alert('Foto', 'Función de cámara próximamente');
            }}
          >
            <Ionicons name="camera" size={32} color="#0891B2" />
            <Text style={styles.photoButtonText}>
              {value ? 'Cambiar Foto' : 'Tomar Foto'}
            </Text>
          </TouchableOpacity>
        );

      case 'signature':
        return (
          <TouchableOpacity
            style={styles.signatureButton}
            onPress={() => {
              // TODO: Implement signature functionality
              Alert.alert('Firma', 'Función de firma próximamente');
            }}
          >
            <Ionicons name="create" size={32} color="#0891B2" />
            <Text style={styles.signatureButtonText}>
              {value ? 'Cambiar Firma' : 'Agregar Firma'}
            </Text>
          </TouchableOpacity>
        );

      default:
        return (
          <TextInput
            style={styles.textInput}
            value={value || ''}
            onChangeText={(text) => updateResponse(question.id, text)}
            placeholder={question.placeholder}
            placeholderTextColor="#9CA3AF"
          />
        );
    }
  };

  const progressPercentage = getCompletionPercentage();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.formTitle}>{template.name}</Text>
        {template.description && (
          <Text style={styles.formDescription}>{template.description}</Text>
        )}
        
        {/* Progress */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View 
              style={[styles.progressFill, { width: `${progressPercentage}%` }]} 
            />
          </View>
          <Text style={styles.progressText}>
            {progressPercentage}% completado
          </Text>
        </View>

        {/* Section Info */}
        <View style={styles.sectionInfo}>
          <Text style={styles.sectionTitle}>
            {currentSection.title} ({currentSectionIndex + 1}/{template.sections.length})
          </Text>
          {currentSection.description && (
            <Text style={styles.sectionDescription}>{currentSection.description}</Text>
          )}
        </View>
      </View>

      {/* Questions */}
      <ScrollView style={styles.questionsContainer} showsVerticalScrollIndicator={false}>
        {currentSection.questions.map(renderQuestion)}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.buttonContainer}>
          {!isFirstSection && (
            <TouchableOpacity style={styles.secondaryButton} onPress={handleBack}>
              <Ionicons name="chevron-back" size={20} color="#0891B2" />
              <Text style={styles.secondaryButtonText}>Anterior</Text>
            </TouchableOpacity>
          )}

          {onSave && (
            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <Ionicons name="bookmark-outline" size={20} color="#6B7280" />
              <Text style={styles.saveButtonText}>Guardar</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.primaryButton} onPress={handleNext}>
            <Text style={styles.primaryButtonText}>
              {isLastSection ? 'Enviar' : 'Siguiente'}
            </Text>
            <Ionicons 
              name={isLastSection ? "checkmark" : "chevron-forward"} 
              size={20} 
              color="#FFFFFF" 
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  formTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 8,
  },
  formDescription: {
    fontSize: 16,
    color: '#64748B',
    marginBottom: 16,
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#0891B2',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
  sectionInfo: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#64748B',
  },
  questionsContainer: {
    flex: 1,
    padding: 20,
  },
  questionContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  questionError: {
    borderColor: '#EF4444',
  },
  questionHeader: {
    marginBottom: 16,
  },
  questionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  required: {
    color: '#EF4444',
  },
  questionDescription: {
    fontSize: 14,
    color: '#64748B',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1E293B',
    backgroundColor: '#FFFFFF',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  booleanContainer: {
    flexDirection: 'row',
    gap: 16,
  },
  booleanOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    gap: 8,
    flex: 1,
  },
  booleanOptionSelected: {
    borderColor: '#0891B2',
    backgroundColor: '#F0F9FF',
  },
  booleanText: {
    fontSize: 16,
    color: '#64748B',
    fontWeight: '500',
  },
  booleanTextSelected: {
    color: '#0891B2',
  },
  optionsContainer: {
    gap: 8,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    gap: 12,
  },
  optionItemSelected: {
    borderColor: '#0891B2',
    backgroundColor: '#F0F9FF',
  },
  optionText: {
    fontSize: 16,
    color: '#64748B',
    flex: 1,
  },
  optionTextSelected: {
    color: '#0891B2',
    fontWeight: '500',
  },
  photoButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#0891B2',
    borderStyle: 'dashed',
    backgroundColor: '#F0F9FF',
  },
  photoButtonText: {
    fontSize: 16,
    color: '#0891B2',
    fontWeight: '500',
    marginTop: 8,
  },
  signatureButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#0891B2',
    borderStyle: 'dashed',
    backgroundColor: '#F0F9FF',
  },
  signatureButtonText: {
    fontSize: 16,
    color: '#0891B2',
    fontWeight: '500',
    marginTop: 8,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    marginTop: 8,
  },
  footer: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0891B2',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    gap: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#0891B2',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    gap: 8,
  },
  secondaryButtonText: {
    color: '#0891B2',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  saveButtonText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default FormRenderer; 