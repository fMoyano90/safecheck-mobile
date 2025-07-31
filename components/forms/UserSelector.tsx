import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usersApi, User } from '../../lib/api';
import { authApi, LoginResponse } from '../../lib/api';
import { ApiError } from '../../lib/api/config';

interface UserSelectorProps {
  visible: boolean;
  onClose: () => void;
  onUsersSelected: (users: User[]) => void;
  selectedUsers: User[];
  title?: string;
  subtitle?: string;
  allowMultiple?: boolean;
}

export const UserSelector: React.FC<UserSelectorProps> = ({
  visible,
  onClose,
  onUsersSelected,
  selectedUsers,
  title = 'Seleccionar Usuarios',
  subtitle = 'Selecciona los usuarios que deben firmar el documento',
  allowMultiple = true,
}) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<LoginResponse['user'] | null>(null);
  const [initialSelectedUsers, setInitialSelectedUsers] = useState<User[]>([]);

  const loadCurrentUser = async () => {
    try {
      const user = await authApi.me();
      setCurrentUser(user);
    } catch (error) {
      console.error('Error loading current user:', error);
    }
  };

  const loadUsers = async () => {
    try {
      setLoading(true);
      
      // Intentar primero con team members
      try {
        const teamMembers = await usersApi.getTeamMembers();
        setUsers(teamMembers);
        return;
      } catch (teamError) {
        console.log('Team members endpoint failed, trying company users...');
        
        // Si falla team members, intentar con company users
        try {
          const companyUsers = await usersApi.getCompanyUsers();
          // Filtrar solo supervisores y trabajadores
          const filteredUsers = companyUsers.filter(user => 
            user.role === 'supervisor' || user.role === 'worker'
          );
          setUsers(filteredUsers);
          return;
        } catch (companyError) {
          throw companyError; // Re-lanzar el último error
        }
      }
    } catch (error) {
      console.error('Error loading users:', error);
      
      // Si es un error 403, mostrar mensaje específico
      if (error instanceof ApiError && error.status === 403) {
        Alert.alert(
          'Permisos insuficientes', 
          'No tienes permisos para ver los usuarios. Contacta al administrador para obtener acceso.',
          [
            {
              text: 'Cerrar',
              onPress: () => onClose()
            }
          ]
        );
      } else {
        Alert.alert('Error', 'No se pudieron cargar los usuarios');
      }
    } finally {
      setLoading(false);
    }
  };

  const filterUsers = useCallback(() => {
    let filtered = users;
    
    // Filtrar por texto de búsqueda
    if (searchText.trim()) {
      const search = searchText.toLowerCase();
      filtered = filtered.filter(user => 
        user.firstName.toLowerCase().includes(search) ||
        user.lastName.toLowerCase().includes(search) ||
        user.email.toLowerCase().includes(search) ||
        (user.position && user.position.toLowerCase().includes(search))
      );
    }
    
    // Excluir al usuario actual
    if (currentUser) {
      filtered = filtered.filter(user => user.id !== currentUser.id);
    }
    
    setFilteredUsers(filtered);
  }, [users, searchText, currentUser]);

  useEffect(() => {
    if (visible) {
      loadUsers();
      loadCurrentUser();
      // Capturar los usuarios inicialmente seleccionados
      setInitialSelectedUsers([...selectedUsers]);
    }
  }, [visible]);

  useEffect(() => {
    filterUsers();
  }, [filterUsers]);

  const isUserSelected = useCallback((user: User): boolean => {
    return selectedUsers.some(selected => selected.id === user.id);
  }, [selectedUsers]);

  const toggleUserSelection = useCallback((user: User) => {
    if (allowMultiple) {
      if (isUserSelected(user)) {
        // Remover usuario
        const newSelection = selectedUsers.filter(selected => selected.id !== user.id);
        onUsersSelected(newSelection);
      } else {
        // Agregar usuario
        onUsersSelected([...selectedUsers, user]);
      }
    } else {
      // Solo un usuario
      if (isUserSelected(user)) {
        onUsersSelected([]);
      } else {
        onUsersSelected([user]);
      }
    }
  }, [allowMultiple, selectedUsers, onUsersSelected, isUserSelected]);

  const getNewUsersCount = () => {
    const initialIds = initialSelectedUsers.map(user => user.id);
    const newUsers = selectedUsers.filter(user => !initialIds.includes(user.id));
    return newUsers.length;
  };

  const handleConfirm = () => {
    const newUsersCount = getNewUsersCount();
    
    if (newUsersCount === 0) {
      Alert.alert('Atención', 'Debes seleccionar al menos un usuario nuevo');
      return;
    }
    
    // Llamar al callback con todos los usuarios seleccionados
    onUsersSelected(selectedUsers);
    
    // Cerrar el modal después de confirmar
    onClose();
  };

  const getRoleColor = (role: string): string => {
    switch (role.toLowerCase()) {
      case 'supervisor':
        return '#FF9800';
      case 'worker':
        return '#4CAF50';
      case 'admin':
        return '#9C27B0';
      default:
        return '#666';
    }
  };

  const getRoleLabel = (role: string): string => {
    switch (role.toLowerCase()) {
      case 'supervisor':
        return 'Supervisor';
      case 'worker':
        return 'Trabajador';
      case 'admin':
        return 'Administrador';
      default:
        return role;
    }
  };

  const renderUserItem = useCallback(({ item: user }: { item: User }) => {
    const isSelected = isUserSelected(user);
    
    return (
      <TouchableOpacity
        style={[styles.userItem, isSelected && styles.userItemSelected]}
        onPress={() => toggleUserSelection(user)}
      >
        <View style={styles.userInfo}>
          <View style={[styles.avatar, { backgroundColor: getRoleColor(user.role) }]}>
            <Text style={styles.avatarText}>
              {user.firstName.charAt(0)}{user.lastName.charAt(0)}
            </Text>
          </View>
          
          <View style={styles.userDetails}>
            <Text style={styles.userName}>
              {user.firstName} {user.lastName}
            </Text>
            <Text style={styles.userEmail}>{user.email}</Text>
            {user.position && (
              <Text style={styles.userPosition}>{user.position}</Text>
            )}
            <View style={[styles.roleBadge, { backgroundColor: getRoleColor(user.role) }]}>
              <Text style={styles.roleText}>{getRoleLabel(user.role)}</Text>
            </View>
          </View>
        </View>
        
        <View style={styles.selectionIndicator}>
          {isSelected ? (
            <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
          ) : (
            <Ionicons name="ellipse-outline" size={24} color="#ccc" />
          )}
        </View>
      </TouchableOpacity>
    );
  }, [isUserSelected, toggleUserSelection]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color="#666" />
          </TouchableOpacity>
          
          <View style={styles.headerContent}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>
        </View>

        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar usuarios..."
            value={searchText}
            onChangeText={setSearchText}
          />
        </View>

        {getNewUsersCount() > 0 && (
          <View style={styles.selectedContainer}>
            <Text style={styles.selectedTitle}>
              Nuevos usuarios ({getNewUsersCount()})
            </Text>
            <Text style={styles.selectedNames}>
              {selectedUsers
                .filter(user => !initialSelectedUsers.map(u => u.id).includes(user.id))
                .map(user => `${user.firstName} ${user.lastName}`)
                .join(', ')
              }
            </Text>
          </View>
        )}

        <View style={styles.content}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>Cargando usuarios...</Text>
            </View>
          ) : (
            <FlatList
              data={filteredUsers}
              renderItem={renderUserItem}
              keyExtractor={(item) => item.id.toString()}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="people-outline" size={48} color="#ccc" />
                  <Text style={styles.emptyText}>
                    {searchText ? 'No se encontraron usuarios' : 'No hay usuarios disponibles'}
                  </Text>
                </View>
              }
            />
          )}
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>Cancelar</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.confirmButton, getNewUsersCount() === 0 && styles.confirmButtonDisabled]} 
            onPress={handleConfirm}
            disabled={getNewUsersCount() === 0}
          >
            <Text style={[styles.confirmButtonText, getNewUsersCount() === 0 && styles.confirmButtonTextDisabled]}>
              {getNewUsersCount() === 0 
                ? 'Confirmar' 
                : `Confirmar (${getNewUsersCount()} nuevo${getNewUsersCount() !== 1 ? 's' : ''})`
              }
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    backgroundColor: 'white',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    flexDirection: 'row',
    alignItems: 'center',
  },
  closeButton: {
    padding: 8,
  },
  headerContent: {
    flex: 1,
    marginLeft: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  searchContainer: {
    backgroundColor: 'white',
    margin: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
  },
  selectedContainer: {
    backgroundColor: '#E3F2FD',
    margin: 16,
    marginTop: 0,
    padding: 12,
    borderRadius: 8,
  },
  selectedTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1976D2',
    marginBottom: 4,
  },
  selectedNames: {
    fontSize: 14,
    color: '#1976D2',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  userItem: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    flexDirection: 'row',
    alignItems: 'center',
  },
  userItemSelected: {
    borderColor: '#4CAF50',
    backgroundColor: '#f8fff8',
  },
  userInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  userDetails: {
    marginLeft: 12,
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  userPosition: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginTop: 4,
  },
  roleText: {
    fontSize: 10,
    color: 'white',
    fontWeight: '500',
  },
  selectionIndicator: {
    marginLeft: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginRight: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '500',
  },
  confirmButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    marginLeft: 8,
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    backgroundColor: '#ccc',
  },
  confirmButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButtonTextDisabled: {
    color: '#999',
  },
});