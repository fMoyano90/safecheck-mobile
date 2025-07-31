import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Modal,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface DocumentContentRendererProps {
  documentContent?: any;
  documentFields?: any;
}

interface ImageModalProps {
  visible: boolean;
  imageUri: string;
  onClose: () => void;
  title?: string;
}

function ImageModal({ visible, imageUri, onClose, title }: ImageModalProps) {
  const { width, height } = Dimensions.get('window');
  
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title || 'Imagen'}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          <ScrollView
            contentContainerStyle={styles.imageScrollContainer}
            maximumZoomScale={3}
            minimumZoomScale={1}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
          >
            <Image
              source={{ uri: imageUri }}
              style={[styles.fullImage, { maxWidth: width - 40, maxHeight: height - 120 }]}
              resizeMode="contain"
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function DocumentContentRenderer({ documentContent, documentFields }: DocumentContentRendererProps) {
  const [selectedImage, setSelectedImage] = useState<{ uri: string; title: string } | null>(null);

  // Debug: Log para ver qué datos están llegando
  console.log('DocumentContentRenderer - documentContent:', JSON.stringify(documentContent, null, 2));
  console.log('DocumentContentRenderer - documentFields:', JSON.stringify(documentFields, null, 2));

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  const formatSelectValue = (value: any) => {
    if (typeof value === 'object' && value !== null) {
      return value.label || value.value || JSON.stringify(value);
    }
    return String(value);
  };

  const renderAnswer = (question: any) => {
    const { answer } = question;
    const { value, metadata } = answer || {};

    switch (question.type) {
      case 'sectionHeader':
        return (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>{question.text}</Text>
            {question.content && (
              <Text style={styles.sectionHeaderContent}>{question.content}</Text>
            )}
          </View>
        );

      case 'paragraph':
        const paragraphContent = question.content || question.text;
        if (!paragraphContent || paragraphContent.trim() === '') {
          return null;
        }
        return (
          <View style={styles.paragraphContainer}>
            <Text style={styles.paragraphText}>
              {paragraphContent}
            </Text>
          </View>
        );

      case 'spacer':
        return <View style={styles.spacer} />;

      case 'select_choice':
      case 'radio':
        const selectedOption = question.options?.find((opt: any) => opt.value === value);
        return (
          <View style={styles.answerContainer}>
            <View style={styles.selectedOption}>
              <Text style={styles.selectedOptionText}>
                {selectedOption?.label || formatSelectValue(value)}
              </Text>
            </View>
          </View>
        );

      case 'checkbox':
        if (!value || (Array.isArray(value) && value.length === 0)) {
          return (
            <Text style={styles.emptyValue}>Sin selecciones</Text>
          );
        }
        
        const selectedValues = Array.isArray(value) ? value : [value];
        const selectedOptions = selectedValues.map(val => {
          const option = question.options?.find((opt: any) => opt.value === val);
          return option?.label || formatSelectValue(val);
        });
        
        return (
          <View style={styles.checkboxContainer}>
            {selectedOptions.map((optionLabel, index) => (
              <View key={index} style={styles.checkboxItem}>
                <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                <Text style={styles.checkboxText}>{optionLabel}</Text>
              </View>
            ))}
          </View>
        );

      case 'date':
        return (
          <View style={styles.answerContainer}>
            <View style={styles.dateTimeContainer}>
              <Ionicons name="calendar-outline" size={16} color="#666" />
              <Text style={styles.dateTimeText}>
                {formatDate(value)}
              </Text>
            </View>
          </View>
        );

      case 'time':
        return (
          <View style={styles.answerContainer}>
            <View style={styles.dateTimeContainer}>
              <Ionicons name="time-outline" size={16} color="#666" />
              <Text style={styles.dateTimeText}>
                {(() => {
                  try {
                    if (typeof value === 'string' && /^\d{2}:\d{2}$/.test(value)) {
                      return value;
                    }
                    const date = new Date(value);
                    return date.toLocaleTimeString('es-CL', {
                      hour: '2-digit',
                      minute: '2-digit',
                      timeZone: 'America/Santiago'
                    });
                  } catch {
                    return String(value || 'Sin respuesta');
                  }
                })()}
              </Text>
            </View>
          </View>
        );

      case 'text_input':
      case 'textarea':
        return (
          <View style={styles.textAnswerContainer}>
            <Text style={styles.textAnswerText}>{value || 'Sin respuesta'}</Text>
          </View>
        );

      case 'multiple_signature':
        return (
          <View style={styles.multipleSignatureContainer}>
            <View style={styles.multipleSignatureIcon}>
              <Ionicons name="people" size={20} color="#28a745" />
            </View>
            <Text style={styles.multipleSignatureText}>Documento con firma múltiple legalizada</Text>
          </View>
        );

      case 'photo':
        if (metadata?.photos && metadata.photos.length > 0) {
          return (
            <View style={styles.photoContainer}>
              <View style={styles.photoGrid}>
                {metadata.photos.map((photo: string, index: number) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.photoItem}
                    onPress={() => setSelectedImage({ 
                      uri: photo, 
                      title: `${question.text} - Foto ${index + 1}` 
                    })}
                  >
                    <Image
                      source={{ uri: photo }}
                      style={styles.photoThumbnail}
                      resizeMode="cover"
                    />
                    <View style={styles.photoIndex}>
                      <Text style={styles.photoIndexText}>{index + 1}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          );
        }
        return (
          <View style={styles.answerContainer}>
            <Text style={styles.emptyValue}>Sin fotos</Text>
          </View>
        );

      case 'signature':
        if (metadata?.signature) {
          return (
            <View style={styles.signatureContainer}>
              <TouchableOpacity
                style={styles.signatureItem}
                onPress={() => setSelectedImage({ 
                  uri: metadata.signature, 
                  title: `${question.text} - Firma` 
                })}
              >
                <Image
                  source={{ uri: metadata.signature }}
                  style={styles.signatureThumbnail}
                  resizeMode="contain"
                />
              </TouchableOpacity>
            </View>
          );
        }
        return (
          <View style={styles.answerContainer}>
            <Text style={styles.emptyValue}>Sin firma</Text>
          </View>
        );

      case 'location':
        if (metadata?.location) {
          const { latitude, longitude, address } = metadata.location;
          return (
            <View style={styles.locationContainer}>
              <View style={styles.locationItem}>
                <Ionicons name="location-outline" size={16} color="#666" />
                <Text style={styles.locationText}>
                  {address || `${latitude}, ${longitude}`}
                </Text>
              </View>
            </View>
          );
        }
        return (
          <View style={styles.answerContainer}>
            <Text style={styles.emptyValue}>Sin ubicación</Text>
          </View>
        );

      default:
        return (
          <View style={styles.textAnswerContainer}>
            <Text style={styles.textAnswerText}>
              {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value || 'Sin respuesta')}
            </Text>
          </View>
        );
    }
  };

  const renderDocumentContent = () => {
    // Priorizar estructura enriquecida si está disponible
    if (documentContent?.sections) {
      return (
        <View style={styles.sectionsContainer}>
          {documentContent.sections.map((section: any, sectionIndex: number) => (
            <View key={section.id || sectionIndex} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              {section.description && (
                <Text style={styles.sectionDescription}>{section.description}</Text>
              )}
              
              {section.questions.map((question: any, questionIndex: number) => (
                <View key={question.id || questionIndex} style={styles.questionContainer}>
                  {question.type !== 'sectionHeader' && question.type !== 'paragraph' && question.type !== 'spacer' && (
                    <Text style={styles.questionText}>{question.text}</Text>
                  )}
                  {renderAnswer(question)}
                </View>
              ))}
            </View>
          ))}
        </View>
      );
    }

    // Fallback para estructura anterior
    if (documentFields && Array.isArray(documentFields)) {
      return (
        <View style={styles.fieldsContainer}>
          {documentFields.map((field: any, index: number) => (
            <View key={index} style={styles.fieldItem}>
              <Text style={styles.fieldLabel}>{field.label || field.name}:</Text>
              <Text style={styles.fieldValue}>{field.value || 'Sin valor'}</Text>
            </View>
          ))}
        </View>
      );
    }

    // Si no hay estructura reconocida, mostrar como JSON
    if (documentContent) {
      return (
        <View style={styles.jsonContainer}>
          <Text style={styles.jsonText}>
            {typeof documentContent === 'string' 
              ? documentContent 
              : JSON.stringify(documentContent, null, 2)
            }
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="document-outline" size={64} color="#ccc" />
        <Text style={styles.emptyText}>No hay contenido disponible</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {renderDocumentContent()}
      
      {selectedImage && (
        <ImageModal
          visible={!!selectedImage}
          imageUri={selectedImage.uri}
          title={selectedImage.title}
          onClose={() => setSelectedImage(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  sectionsContainer: {
    gap: 20,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  questionContainer: {
    marginBottom: 16,
  },
  questionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  sectionHeader: {
    backgroundColor: '#E3F2FD',
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  sectionHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976D2',
  },
  sectionHeaderContent: {
    fontSize: 14,
    color: '#1976D2',
    marginTop: 4,
  },
  paragraphContainer: {
    backgroundColor: '#F5F5F5',
    borderLeftWidth: 4,
    borderLeftColor: '#9E9E9E',
    padding: 12,
    borderRadius: 8,
  },
  paragraphText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  spacer: {
    height: 16,
  },
  answerContainer: {
    marginTop: 4,
  },
  selectedOption: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  selectedOptionText: {
    fontSize: 14,
    color: '#1976D2',
    fontWeight: '500',
  },
  checkboxContainer: {
    gap: 8,
  },
  checkboxItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkboxText: {
    fontSize: 14,
    color: '#333',
  },
  dateTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateTimeText: {
    fontSize: 14,
    color: '#333',
  },
  textAnswerContainer: {
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E1E5E9',
  },
  textAnswerText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  photoContainer: {
    marginTop: 8,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photoItem: {
    position: 'relative',
    width: 80,
    height: 80,
  },
  photoThumbnail: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  photoIndex: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoIndexText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  signatureContainer: {
    marginTop: 8,
  },
  signatureItem: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E1E5E9',
  },
  signatureThumbnail: {
    width: '100%',
    height: 60,
  },
  locationContainer: {
    marginTop: 4,
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  emptyValue: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  multipleSignatureContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E8',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#28a745',
  },
  multipleSignatureIcon: {
    marginRight: 8,
  },
  multipleSignatureText: {
    fontSize: 14,
    color: '#28a745',
    fontWeight: '500',
    flex: 1,
  },
  fieldsContainer: {
    gap: 12,
  },
  fieldItem: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E1E5E9',
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  fieldValue: {
    fontSize: 16,
    color: '#333',
  },
  jsonContainer: {
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E1E5E9',
  },
  jsonText: {
    fontSize: 12,
    color: '#333',
    fontFamily: 'monospace',
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    minHeight: 200,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    flex: 1,
    width: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
  },
  closeButton: {
    padding: 8,
  },
  imageScrollContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    borderRadius: 8,
  },
});