import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  FlatList,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Dimensions,
  Animated,
  PanResponder
} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { LinearGradient } from 'expo-linear-gradient';

type NavigationProp = StackNavigationProp<RootStackParamList, 'Home'>;

interface MedicalRecord {
  _id: string;
  diagnosis: string;
  treatment: string;
  symptoms: string[];
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
  patient_id?: {
    _id: string;
    name: string;
    email: string;
    phoneNumber?: string;
  };
  doctor_id?: {
    _id: string;
    name: string;
    email: string;
  };
  appointment_id?: {
    _id: string;
    appointment_date?: string;
    appointment_time?: string;
  };
}

const { width, height } = Dimensions.get('window');

const HomeScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState('');
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'resolved'>('all');
  const [updatingRecord, setUpdatingRecord] = useState<string | null>(null);
  
  // Chatbot Widget State
  const [isChatbotVisible, setIsChatbotVisible] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const position = useState(new Animated.ValueXY({ x: width - 80, y: height - 200 }))[0];

  // PanResponder for draggable chatbot widget
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderMove: Animated.event([
      null,
      {
        dx: position.x,
        dy: position.y,
      },
    ], { useNativeDriver: false }),
    onPanResponderRelease: () => {
      // Keep widget within screen bounds
      const currentX = position.x.__getValue();
      const currentY = position.y.__getValue();

      let newX = currentX;
      let newY = currentY;

      // Ensure widget stays within screen bounds
      if (currentX < 0) newX = 0;
      if (currentX > width - 60) newX = width - 60;
      if (currentY < 100) newY = 100;
      if (currentY > height - 100) newY = height - 100;

      Animated.spring(position, {
        toValue: { x: newX, y: newY },
        useNativeDriver: false,
      }).start();
    },
  });

  useEffect(() => {
    loadUserData();
    fetchMedicalRecords();
    
    // Simulate receiving new messages
    const messageInterval = setInterval(() => {
      if (!isChatbotVisible && Math.random() > 0.7) {
        setUnreadMessages(prev => prev + 1);
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(messageInterval);
  }, [isChatbotVisible]);

  const loadUserData = async () => {
    try {
      const name = await AsyncStorage.getItem('userName');
      const role = await AsyncStorage.getItem('userRole');
      if (name) setUserName(name);
      if (role) setUserRole(role);
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const fetchMedicalRecords = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        Alert.alert('Error', 'Please login again');
        navigation.navigate('Login');
        return;
      }

      const API_BASE_URL = 'http://localhost:3000';
      const response = await axios.get(`${API_BASE_URL}/api/patient/medical-records/my-records`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setRecords(response.data || []);
    } catch (error: any) {
      console.error('Error fetching medical records:', error);
      
      if (error.response?.status === 404) {
        setRecords([]);
      } else if (error.response?.status === 401) {
        Alert.alert('Session expired', 'Please login again');
        navigation.navigate('Login');
      } else if (error.response?.status === 500) {
        Alert.alert('Server Error', 'Please try again later');
      } else {
        Alert.alert('Error', 'Unable to load medical records');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const updateRecordStatus = async (recordId: string, newStatus: string) => {
    try {
      setUpdatingRecord(recordId);
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        Alert.alert('Error', 'Please login again');
        navigation.navigate('Login');
        return;
      }

      const API_BASE_URL = 'http://localhost:3000';
      await axios.patch(
        `${API_BASE_URL}/api/patient/medical-records/${recordId}/status`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setRecords(prevRecords => 
        prevRecords.map(record => 
          record._id === recordId ? { ...record, status: newStatus } : record
        )
      );

      Alert.alert('Success', `Record marked as ${newStatus}`);
    } catch (error: any) {
      console.error('Error updating record status:', error);
      Alert.alert('Error', 'Failed to update record status');
    } finally {
      setUpdatingRecord(null);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchMedicalRecords();
  };

  const handleLogout = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (token) {
        const API_BASE_URL = 'http://localhost:3000';
        await axios.post(`${API_BASE_URL}/api/auth/logout`, {}, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      await AsyncStorage.multiRemove(['authToken', 'refreshToken', 'userName', 'userEmail', 'userRole', 'userData']);
      navigation.navigate('Login');
    }
  };

  const confirmLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', onPress: handleLogout, style: 'destructive' },
      ]
    );
  };

  const navigateToProfile = () => {
    navigation.navigate('Profile');
  };

  const navigateToSettings = () => {
    navigation.navigate('Settings');
  };

  const navigateToFindDoctor = () => {
    navigation.navigate('FindDoctor');
  };

  const navigateToHistoryAppointment = () => {
    navigation.navigate('HistoryAppointment');
  };

  const navigateToMessages = () => {
    navigation.navigate('Message');
  };
  const navigateToFeedback = () => {
    navigation.navigate('Feedback');
  };

  const toggleChatbot = () => {
    if (isChatbotVisible) {
      setIsChatbotVisible(false);
    } else {
      setUnreadMessages(0);
      setIsChatbotVisible(true);
      navigation.navigate('ChatOption');
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      return dateString;
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'urgent': return { icon: 'warning', color: '#FF3B30' };
      case 'high': return { icon: 'error', color: '#FF9500' };
      case 'medium': return { icon: 'info', color: '#FFCC00' };
      case 'low': return { icon: 'low-priority', color: '#34C759' };
      default: return { icon: 'help', color: '#8E8E93' };
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return { icon: 'access-time', color: '#007AFF' };
      case 'resolved': return { icon: 'check-circle', color: '#34C759' };
      default: return { icon: 'help', color: '#8E8E93' };
    }
  };

  const filteredRecords = records.filter(r =>
    filter === 'all' ? true : r.status === filter
  );

  const renderRecord = ({ item }: { item: MedicalRecord }) => {
    const isExpanded = expandedId === item._id;
    const priorityIcon = getPriorityIcon(item.priority);
    const statusIcon = getStatusIcon(item.status);
    const isUpdating = updatingRecord === item._id;

    const handleRecordPress = () => {
      // @ts-ignore: navigation param type workaround
      navigation.navigate('RecordDetail', { record: item });
    };

    // Helper for badge style
    const getStatusBadgeStyle = (status: string) => {
      switch (status) {
        case 'active': return styles.activeBadge;
        case 'resolved': return styles.resolvedBadge;
        default: return {};
      }
    };
    const getPriorityBadgeStyle = (priority: string) => {
      switch (priority) {
        case 'urgent': return styles.urgentBadge;
        case 'high': return styles.highBadge;
        case 'medium': return styles.mediumBadge;
        case 'low': return styles.lowBadge;
        default: return {};
      }
    };
    return (
      <TouchableOpacity
        style={[styles.card, isExpanded && styles.cardExpanded]}
        onPress={handleRecordPress}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleContainer}>
            <View style={styles.avatar}>
              <Icon name="person" size={16} color="#FFFFFF" />
            </View>
            <View>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {userRole === 'doctor' ? item.patient_id?.name : item.doctor_id?.name}
              </Text>
              <Text style={styles.cardSubtitle}>
                {userRole === 'doctor' ? 'Patient' : 'Doctor'}
              </Text>
            </View>
          </View>
          <Text style={styles.date}>{formatDate(item.created_at)}</Text>
        </View>

        <View style={styles.cardContent}>
          <Text style={styles.diagnosis} numberOfLines={1}>{item.diagnosis}</Text>
          <View style={styles.badges}>
            <View style={[styles.badge, getStatusBadgeStyle(item.status)]}>
              <Icon name={statusIcon.icon} size={12} color={statusIcon.color} />
              <Text style={[styles.badgeText, { color: statusIcon.color }]}> 
                {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
              </Text>
            </View>
            <View style={[styles.badge, getPriorityBadgeStyle(item.priority)]}>
              <Icon name={priorityIcon.icon} size={12} color={priorityIcon.color} />
              <Text style={[styles.badgeText, { color: priorityIcon.color }]}> 
                {item.priority.charAt(0).toUpperCase() + item.priority.slice(1)}
              </Text>
            </View>
          </View>
        </View>

        {isExpanded && (
          <View style={styles.details}>
            <View style={styles.detailRow}>
              <Text style={styles.label}>Diagnosis</Text>
              <Text style={styles.detailText}>{item.diagnosis}</Text>
            </View>

            {item.treatment && (
              <View style={styles.detailRow}>
                <Text style={styles.label}>Treatment</Text>
                <Text style={styles.detailText}>{item.treatment}</Text>
              </View>
            )}

            {item.symptoms?.length > 0 && (
              <View style={styles.detailRow}>
                <Text style={styles.label}>Symptoms</Text>
                <View style={styles.symptomsContainer}>
                  {item.symptoms.map((symptom, index) => (
                    <View key={index} style={styles.symptomTag}>
                      <Text style={styles.symptomText}>{symptom}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
            
            {item.appointment_id && (
              <View style={styles.detailRow}>
                <Text style={styles.label}>Appointment</Text>
                <Text style={styles.detailText}>
                  {item.appointment_id.appointment_date && formatDate(item.appointment_id.appointment_date)}
                  {item.appointment_id.appointment_time && ` at ${item.appointment_id.appointment_time}`}
                </Text>
              </View>
            )}
            
            {userRole === 'doctor' && (
              <View style={styles.actionButtonsContainer}>
                {item.status !== 'active' && (
                  <TouchableOpacity 
                    style={[styles.statusButton, styles.activeButton]}
                    onPress={() => updateRecordStatus(item._id, 'active')}
                    disabled={isUpdating}
                  >
                    {isUpdating && item.status !== 'active' ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Icon name="access-time" size={16} color="#FFFFFF" />
                        <Text style={styles.statusButtonText}>Mark as Active</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
                
                {item.status !== 'resolved' && (
                  <TouchableOpacity 
                    style={[styles.statusButton, styles.resolveButton]}
                    onPress={() => updateRecordStatus(item._id, 'resolved')}
                    disabled={isUpdating}
                  >
                    {isUpdating && item.status !== 'resolved' ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Icon name="check-circle" size={16} color="#FFFFFF" />
                        <Text style={styles.statusButtonText}>Mark as Resolved</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            )}
            
            <View style={styles.expandedFooter}>
              <Icon name="keyboard-arrow-up" size={20} color="#8E8E93" />
              <Text style={styles.collapseText}>Tap to collapse</Text>
            </View>
          </View>
        )}
        
        {!isExpanded && (
          <View style={styles.cardFooter}>
            <Icon name="keyboard-arrow-down" size={16} color="#8E8E93" />
            <Text style={styles.moreText}>Tap for details</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // Chatbot Widget Component
  const ChatbotWidget = () => (
    <Animated.View
      style={[
        styles.chatbotWidget,
        {
          transform: [{ translateX: position.x }, { translateY: position.y }],
        },
      ]}
      {...panResponder.panHandlers}
    >
      <TouchableOpacity 
        style={styles.chatbotButton}
        onPress={toggleChatbot}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={['#00BFFF', '#1976d2']}
          style={styles.chatbotGradient}
        >
          <Icon name="chat" size={24} color="#FFFFFF" />
        </LinearGradient>
        
        {unreadMessages > 0 && (
          <View style={styles.notificationBadge}>
            <Text style={styles.notificationText}>
              {unreadMessages > 9 ? '9+' : unreadMessages}
            </Text>
          </View>
        )}
        
        {/* Drag handle indicator */}
        <View style={styles.dragHandle}>
          <View style={styles.dragDot} />
          <View style={styles.dragDot} />
          <View style={styles.dragDot} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#0A84FF" />
        <LinearGradient
          colors={['#0A84FF', '#5E5CE6']}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.loadingText}>Loading your medical records...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0A84FF" />
      
      {/* Header với layout mới */}
      <View style={styles.headerContainer}>
        <LinearGradient
          colors={['#0A84FF', '#5E5CE6']}
          style={styles.headerGradient}
        >
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.avatarContainer}>
                <View style={styles.avatar}>
                  <Icon name="person" size={24} color="#FFFFFF" />
                </View>
                <View style={styles.userInfo}>
                  <Text style={styles.greeting}>Welcome back,</Text>
                  <Text style={styles.userName}>{userName}</Text>
                </View>
              </View>
              <View style={styles.roleBadge}>
                <Text style={styles.roleText}>
                  {userRole === 'doctor' ? 'Doctor' : 'Patient'}
                </Text>
              </View>
            </View>
            
            <View style={styles.headerRight}>
              <TouchableOpacity 
                onPress={handleRefresh}
                style={styles.iconButton}
              >
                <Icon name="refresh" size={24} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity onPress={confirmLogout} style={styles.iconButton}>
                <Icon name="logout" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Stats Overview trong header */}
          <View style={styles.headerStats}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{records.length}</Text>
              <Text style={styles.statLabel}>Total Records</Text>
            </View>
            
            <View style={styles.statDivider} />
            
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {records.filter(r => r.status === 'active').length}
              </Text>
              <Text style={styles.statLabel}>Active</Text>
            </View>
            
            <View style={styles.statDivider} />
            
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {records.filter(r => r.status === 'resolved').length}
              </Text>
              <Text style={styles.statLabel}>Resolved</Text>
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* Main Content với padding top để không bị header che */}
      <FlatList
        data={filteredRecords}
        keyExtractor={item => item._id}
        renderItem={renderRecord}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={handleRefresh}
            colors={['#0A84FF']}
            tintColor={'#0A84FF'}
            progressBackgroundColor="#FFFFFF"
          />
        }
        ListHeaderComponent={
          <View style={styles.listHeader}>
            {/* Quick Actions Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Quick Actions</Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.actionsContent}
              >
                <TouchableOpacity 
                  style={styles.quickAction}
                  onPress={navigateToFindDoctor}
                >
                  <LinearGradient
                    colors={['#32D74B', '#30DB84']}
                    style={styles.quickActionIcon}
                  >
                    <Icon name="search" size={24} color="#FFFFFF" />
                  </LinearGradient>
                  <Text style={styles.quickActionText}>Find Doctor</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.quickAction}
                  onPress={navigateToHistoryAppointment}
                >
                  <LinearGradient
                    colors={['#BF5AF2', '#FF375F']}
                    style={styles.quickActionIcon}
                  >
                    <Icon name="history" size={24} color="#FFFFFF" />
                  </LinearGradient>
                  <Text style={styles.quickActionText}>Appointment History</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickAction}
                  onPress={navigateToMessages}
                >
                  <LinearGradient
                    colors={['#FF9F0A', '#FFCC00']}
                    style={styles.quickActionIcon}
                  >
                    <Icon name="message" size={24} color="#FFFFFF" />
                  </LinearGradient>
                  <Text style={styles.quickActionText}>Messages</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.quickAction}
                  onPress={navigateToProfile}
                >
                  <LinearGradient
                    colors={['#5E5CE6', '#0A84FF']}
                    style={styles.quickActionIcon}
                  >
                    <Icon name="person" size={24} color="#FFFFFF" />
                  </LinearGradient>
                  <Text style={styles.quickActionText}>Profile</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.quickAction}
                  onPress={navigateToFeedback}
                >
                  <LinearGradient
                    colors={['#FFD700', '#FFB300']}
                    style={styles.quickActionIcon}
                  >
                    <Icon name="star" size={24} color="#FFFFFF" />
                  </LinearGradient>
                  <Text style={styles.quickActionText}>Feedback</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.quickAction}
                  onPress={navigateToSettings}
                >
                  <LinearGradient
                    colors={['#FF453A', '#FF375F']}
                    style={styles.quickActionIcon}
                  >
                    <Icon name="settings" size={24} color="#FFFFFF" />
                  </LinearGradient>
                  <Text style={styles.quickActionText}>Settings</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>

            {/* Filter Tabs */}
            <View style={styles.filterContainer}>
              {[
                { key: 'all', label: 'All Records', icon: 'list' },
                { key: 'active', label: 'Active', icon: 'access-time' },
                { key: 'resolved', label: 'Resolved', icon: 'check-circle' }
              ].map(tab => (
                <TouchableOpacity 
                  key={tab.key} 
                  onPress={() => setFilter(tab.key as any)}
                  style={[styles.filterTab, filter === tab.key && styles.filterTabActive]}
                >
                  <Icon 
                    name={tab.icon} 
                    size={16} 
                    color={filter === tab.key ? '#0A84FF' : '#8E8E93'} 
                    style={styles.filterIcon}
                  />
                  <Text style={[styles.filterTabText, filter === tab.key && styles.filterTabTextActive]}>
                    {tab.label}
                  </Text>
                  {filter === tab.key && <View style={styles.filterTabIndicator} />}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Icon name="folder-open" size={60} color="#C7C7CC" />
            <Text style={styles.emptyStateTitle}>No records found</Text>
            <Text style={styles.emptyStateText}>
              {(filter !== 'all')
                ? `No ${filter} medical records available`
                : "You don't have any medical records yet"}
            </Text>
            <TouchableOpacity 
              style={styles.refreshButtonLarge}
              onPress={handleRefresh}
            >
              <Text style={styles.refreshButtonText}>Refresh</Text>
            </TouchableOpacity>
          </View>
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        style={styles.mainContent}
      />

      {/* Chatbot Widget */}
      <ChatbotWidget />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  // Header container với absolute positioning
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  headerGradient: {
    paddingTop: 60, // Thêm padding top cho status bar
    paddingBottom: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  userInfo: {
    flex: 1,
  },
  greeting: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 4,
    fontWeight: '500',
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  roleBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  roleText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  iconButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginLeft: 12,
  },
  // Header Stats
  headerStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  // Main content với padding top để không bị header che
  mainContent: {
    flex: 1,
    marginTop: 260, // Tăng margin top để phù hợp với header mới
  },
  listHeader: {
    backgroundColor: '#F2F2F7',
    paddingTop: 0,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 16,
  },
  actionsContent: {
    paddingBottom: 8,
  },
  quickAction: {
    alignItems: 'center',
    marginRight: 16,
    width: 80,
  },
  quickActionIcon: {
    width: 60,
    height: 60,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  quickActionText: {
    color: '#000000',
    fontWeight: '500',
    fontSize: 12,
    textAlign: 'center',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 8,
    position: 'relative',
    borderRadius: 10,
  },
  filterTabActive: {
    backgroundColor: '#F2F2F7',
  },
  filterIcon: {
    marginRight: 6,
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E8E93',
  },
  filterTabTextActive: {
    color: '#0A84FF',
    fontWeight: '600',
  },
  filterTabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 16,
    right: 16,
    height: 3,
    backgroundColor: '#0A84FF',
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  listContent: {
    paddingBottom: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  cardExpanded: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cardTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0A84FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#8E8E93',
  },
  date: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
  },
  cardContent: {
    marginBottom: 8,
  },
  diagnosis: {
    fontSize: 14,
    color: '#000000',
    marginBottom: 12,
    fontWeight: '500',
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  activeBadge: { backgroundColor: 'rgba(0, 122, 255, 0.1)' },
  resolvedBadge: { backgroundColor: 'rgba(52, 199, 89, 0.1)' },
  urgentBadge: { backgroundColor: 'rgba(255, 59, 48, 0.1)' },
  highBadge: { backgroundColor: 'rgba(255, 149, 0, 0.1)' },
  mediumBadge: { backgroundColor: 'rgba(255, 204, 0, 0.1)' },
  lowBadge: { backgroundColor: 'rgba(52, 199, 89, 0.1)' },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
  },
  moreText: {
    fontSize: 12,
    color: '#8E8E93',
    marginLeft: 4,
  },
  details: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
  },
  detailRow: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailText: {
    fontSize: 14,
    color: '#000000',
    lineHeight: 20,
  },
  symptomsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  symptomTag: {
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  symptomText: {
    fontSize: 12,
    color: '#000000',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
    marginBottom: 8,
    gap: 12,
  },
  statusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
  },
  activeButton: {
    backgroundColor: '#007AFF',
  },
  resolveButton: {
    backgroundColor: '#34C759',
  },
  statusButtonText: {
    color: '#FFFFFF',
    fontWeight: '500',
    fontSize: 12,
  },
  expandedFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  collapseText: {
    fontSize: 12,
    color: '#8E8E93',
    marginLeft: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  refreshButtonLarge: {
    backgroundColor: '#0A84FF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  refreshButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#FFFFFF',
  },
  // Chatbot Widget Styles
  chatbotWidget: {
    position: 'absolute',
    zIndex: 1000,
    elevation: 10,
  },
  chatbotButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatbotGradient: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FF3B30',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  notificationText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  dragHandle: {
    position: 'absolute',
    bottom: -20,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  dragDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#C7C7CC',
    marginVertical: 1,
  },
});

export default HomeScreen;