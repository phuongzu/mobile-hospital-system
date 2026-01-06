import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  Image,
  Modal,
  TextInput,
  Animated,
  Dimensions,
  Platform,
  StatusBar,
  SafeAreaView,
  Pressable,
  RefreshControl,
  FlatList,
  KeyboardAvoidingView,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import FlashMessage, { showMessage } from 'react-native-flash-message';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Thêm interface cho tin nhắn
interface Message {
  _id?: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  message_type: 'text' | 'image' | 'file';
  timestamp: Date;
  read: boolean;
  appointment_id?: string;
  medical_record_id?: string;
}

interface TreatmentStep {
  stepNumber: number;
  title: string;
  description: string;
  medication?: string;
  dosage?: string;
  duration?: string;
  instructions?: string;
  status: 'pending' | 'in-progress' | 'completed' | 'approved' | 'rejected';
  completedAt?: Date;
  patient_message?: string;
  doctorNotes?: string;
  approval_requested?: boolean;
  approval_requested_at?: Date;
  _id?: string;
}

interface Record {
  _id: string;
  appointment_id?: {
    _id: string;
    appointment_date?: string;
    appointment_time?: string;
  };
  user_id?: {
    _id: string;
    name: string;
    email: string;
    phoneNumber?: string;
    dateOfBirth?: string;
    gender?: string;
    avatar?: string;
  };
  doctor_id?: {
    _id: string;
    name: string;
    email: string;
    specialty_id?: {
      name: string;
      description?: string;
    };
    avatar?: string;
  };
  diagnosis: string;
  treatment_plan: TreatmentStep[];
  consultation_status: 'in-progress' | 'completed';
  status: 'active' | 'resolved';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  notes?: string;
  severity?: 'mild' | 'moderate' | 'severe' | 'critical';
  created_at: string;
  updated_at: string;
  userRole?: 'patient' | 'doctor';
}

const API_BASE_URL = 'http://localhost:3000/api';

// Flash Message Helper
const showNotification = (message: string, type: 'success' | 'warning' | 'danger' | 'info' = 'info') => {
  showMessage({
    message,
    type,
    duration: 4000,
    floating: true,
    icon: type,
  });
};

const RecordDetail: React.FC = () => {
  const route = useRoute<any>();
  const navigation = useNavigation();
  const { record: initialRecord } = route.params;
  
  // State
  const [record, setRecord] = useState<Record>(initialRecord);
  const [treatmentPlan, setTreatmentPlan] = useState<TreatmentStep[]>(initialRecord.treatment_plan || []);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeStep, setActiveStep] = useState<string | null>(null);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [currentStep, setCurrentStep] = useState<TreatmentStep | null>(null);
  const [doctorNotes, setDoctorNotes] = useState('');
  const [requestMessage, setRequestMessage] = useState('');
  const [showRequestModal, setShowRequestModal] = useState(false);
  
  // State cho tính năng nhắn tin
  const [showChatModal, setShowChatModal] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const modalSlideAnim = useRef(new Animated.Value(screenHeight)).current;
  const requestModalSlideAnim = useRef(new Animated.Value(screenHeight)).current;
  const chatModalSlideAnim = useRef(new Animated.Value(screenHeight)).current;
  
  // Refs
  const flatListRef = useRef<FlatList>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    // Entrance animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchRecordData();
    setTimeout(() => {
      setRefreshing(false);
    }, 500);
  }, []);

  // Mặc định userRole là patient
  const userRole = record.userRole || 'patient';

  // Helper functions
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

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  const getDoctorAvatarUrl = (avatarPath: string | undefined): string => {
    if (!avatarPath) return '';
    if (avatarPath.startsWith('http')) return avatarPath;
    if (avatarPath.startsWith('doctor-')) {
      return `${API_BASE_URL}/doctors/avatar/${avatarPath}?t=${Date.now()}`;
    }
    return '';
  };

  const shouldShowAvatar = (avatarPath: string | undefined): boolean => {
    if (!avatarPath) return false;
    return avatarPath.startsWith('doctor-') || avatarPath.startsWith('http');
  };

  // Status checks - ĐƠN GIẢN HÓA CHO PATIENT
  const canStartTreatment = treatmentPlan.length > 0 && 
                           treatmentPlan[0]?.status === 'pending' && 
                           userRole === 'patient';

  const getCurrentActiveStep = () => {
    return treatmentPlan.find(step => step.status === 'in-progress') || null;
  };

  const getNextPendingStep = () => {
    return treatmentPlan.find(step => step.status === 'pending') || null;
  };

  // Modal animations
  const showModal = () => {
    setShowNotesModal(true);
    Animated.spring(modalSlideAnim, {
      toValue: 0,
      tension: 100,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };

  const hideModal = () => {
    Animated.timing(modalSlideAnim, {
      toValue: screenHeight,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setShowNotesModal(false);
      modalSlideAnim.setValue(screenHeight);
    });
  };

  const openRequestModal = (step: TreatmentStep) => {
    setCurrentStep(step);
    setShowRequestModal(true);
    Animated.spring(requestModalSlideAnim, {
      toValue: 0,
      tension: 100,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };

  const hideRequestModal = () => {
    Animated.timing(requestModalSlideAnim, {
      toValue: screenHeight,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setShowRequestModal(false);
      setRequestMessage('');
      setCurrentStep(null);
      requestModalSlideAnim.setValue(screenHeight);
    });
  };

  // Chat Modal animations
  const showChatModalFunc = () => {
    setShowChatModal(true);
    loadMessages();
    Animated.spring(chatModalSlideAnim, {
      toValue: 0,
      tension: 100,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };

  const hideChatModal = () => {
    Animated.timing(chatModalSlideAnim, {
      toValue: screenHeight,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setShowChatModal(false);
      setNewMessage('');
      chatModalSlideAnim.setValue(screenHeight);
    });
  };

  // Chat Functions - DÀNH CHO BỆNH NHÂN
const loadMessages = async () => {
  if (!record._id || !record.doctor_id?._id) return;
  
  setChatLoading(true);
  try {
    const token = await AsyncStorage.getItem('authToken');
    const response = await axios.get(
      `${API_BASE_URL}/messages/record/${record._id}`, 
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (response.data.success) {
      setMessages(response.data.data.messages);
      // Auto scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  } catch (error) {
    console.error('Error loading messages:', error);
    // Fallback: tạo tin nhắn mẫu
    setMessages([
      {
        _id: '1',
        sender_id: record.doctor_id._id,
        receiver_id: record.user_id?._id || '',
        message: 'Hello! I\'m here to help with your treatment. How are you feeling today?',
        message_type: 'text',
        timestamp: new Date(Date.now() - 3600000),
        read: true,
        medical_record_id: record._id
      },
      {
        _id: '2',
        sender_id: record.user_id?._id || '',
        receiver_id: record.doctor_id._id,
        message: 'Thank you doctor. I started the treatment and feeling better.',
        message_type: 'text',
        timestamp: new Date(Date.now() - 1800000),
        read: true,
        medical_record_id: record._id
      }
    ]);
  } finally {
    setChatLoading(false);
  }
};

const sendMessage = async () => {
  if (!newMessage.trim() || !record._id || !record.doctor_id?._id) return;

  setSendingMessage(true);
  const tempMessageId = Date.now().toString();
  const newMessageObj: Message = {
    _id: tempMessageId,
    sender_id: record.user_id?._id || 'patient',
    receiver_id: record.doctor_id._id,
    message: newMessage.trim(),
    message_type: 'text',
    timestamp: new Date(),
    read: false,
    medical_record_id: record._id
  };

  // Optimistic update
  setMessages(prev => [...prev, newMessageObj]);
  setNewMessage('');

  try {
    const token = await AsyncStorage.getItem('authToken');
    const response = await axios.post(
      `${API_BASE_URL}/messages/send`,
      {
        receiver_id: record.doctor_id._id,
        message: newMessage.trim(),
        message_type: 'text',
        medical_record_id: record._id,
        appointment_id: record.appointment_id?._id
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (response.data.success) {
      // Replace temporary message with actual message from server
      setMessages(prev => 
        prev.map(msg => 
          msg._id === tempMessageId ? response.data.data.message : msg
        )
      );
    }
  } catch (error) {
    console.error('Error sending message:', error);
    showNotification('Failed to send message', 'danger');
    setMessages(prev => prev.filter(msg => msg._id !== tempMessageId));
  } finally {
    setSendingMessage(false);
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }
};

  const fetchRecordData = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      // Fetch specifically this record if endpoint exists, otherwise list
      // Assuming my-records returns a list
      const response = await axios.get(
        `${API_BASE_URL}/medical-records/my-records`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      const currentRecord = response.data.find((r: Record) => r._id === record._id);
      if (currentRecord) {
        setRecord(currentRecord);
        setTreatmentPlan(currentRecord.treatment_plan || []);
      }
    } catch (error) {
      console.error('Error fetching record data:', error);
      showNotification('Failed to refresh record data', 'danger');
    }
  };

  const handleStartTreatment = async () => {
    if (treatmentPlan.length === 0) return;
    
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      const firstStep = treatmentPlan[0];
      
      const response = await axios.patch(
        `${API_BASE_URL}/medical-records/${record._id}/steps/${firstStep.stepNumber}/activate`,
        {},
        { 
          headers: { Authorization: `Bearer ${token}` } 
        }
      );

      if (response.data.success) {
        // Update local state with the returned data to ensure sync
        setRecord(response.data.data.record);
        setTreatmentPlan(response.data.data.record.treatment_plan);
        showNotification('🎉 Treatment started successfully!', 'success');
      }
      
    } catch (error: any) {
      console.error('Error starting treatment via backend:', error);
      
      // CRITICAL: Do NOT use fallback that desyncs state if backend failed.
      // If backend fails with 404/500, user should know, rather than seeing a fake success.
      if (error.response?.status === 404) {
         showNotification('Server error: Could not find treatment step to start.', 'danger');
      } else if (error.response?.status === 403) {
         showNotification('Permission denied.', 'danger');
      } else {
         showNotification('Failed to start treatment. Please try again.', 'danger');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteStep = async (stepNumber: number) => {
    setLoading(true);
    setActiveStep(stepNumber.toString());
    
    try {
      const token = await AsyncStorage.getItem('authToken');
      
      if (!token) {
        showNotification('Authentication required.', 'danger');
        setLoading(false);
        return;
      }

      // Use the standardized route
      const url = `${API_BASE_URL}/medical-records/${record._id}/steps/${stepNumber}/complete`;

      const response = await axios.patch(
        url,
        { 
          patientMessage: "I have completed this step",
          status: 'completed'
        },
        { 
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          } 
        }
      );

      if (response.data.success) {
        setRecord(response.data.data.record);
        setTreatmentPlan(response.data.data.record.treatment_plan);
        showNotification(`✅ Step ${stepNumber} completed successfully!`, 'success');
      }
      
    } catch (error: any) {
      console.error('❌ Error completing step:', error);
      
      if (error.response?.status === 400) {
        const errorMsg = error.response?.data?.message || '';
        if (errorMsg.includes('not in progress')) {
          showNotification('This step must be activated before completing.', 'warning');
          // Refresh data to get true state
          fetchRecordData();
        } else {
          showNotification(errorMsg || 'Cannot complete step.', 'warning');
        }
      } else {
         showNotification('Failed to complete step. Please check connection.', 'danger');
      }
    } finally {
      setLoading(false);
      setActiveStep(null);
    }
  };

  const handleSendApprovalRequest = async () => {
    if (!currentStep) return;
    
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      
      // Use the corrected route: /steps/:stepNumber/request-approval
      const response = await axios.post(
        `${API_BASE_URL}/medical-records/${record._id}/steps/${currentStep.stepNumber}/request-approval`,
        { 
          message: requestMessage,
          patientName: record.user_id?.name || 'Patient'
        },
        { 
          headers: { Authorization: `Bearer ${token}` } 
        }
      );

      if (response.data.success) {
        // Backend now returns updated record in data.record if we updated the controller
        // If not, we might need to refetch, but let's assume controller returns relevant data
        if (response.data.data.record) {
             setRecord(response.data.data.record);
             setTreatmentPlan(response.data.data.record.treatment_plan);
        } else {
             // Fallback refresh
             fetchRecordData();
        }
        showNotification('✅ Approval request sent to doctor!', 'success');
        hideRequestModal();
      }
      
    } catch (error: any) {
      console.error('Error sending approval request:', error);
      showNotification('Failed to send request.', 'danger');
    } finally {
      setLoading(false);
      setCurrentStep(null);
    }
  };

  // UI Helper Functions
  const getStatusConfig = (status: string) => {
    const configs = {
      pending: {
        icon: 'time-outline' as const,
        color: '#FF9500',
        gradient: ['#FFB84D', '#FF9500'],
        text: 'Pending',
        bgColor: '#FFF3E0'
      },
      'in-progress': {
        icon: 'play-circle-outline' as const,
        color: '#2196F3',
        gradient: ['#42A5F5', '#2196F3'],
        text: 'In Progress',
        bgColor: '#E3F2FD'
      },
      completed: {
        icon: 'checkmark-circle-outline' as const,
        color: '#FF9800',
        gradient: ['#FFB74D', '#FF9800'],
        text: 'Completed',
        bgColor: '#FFF3E0'
      },
      approved: {
        icon: 'checkmark-done-circle' as const,
        color: '#4CAF50',
        gradient: ['#66BB6A', '#4CAF50'],
        text: 'Approved',
        bgColor: '#E8F5E8'
      },
      rejected: {
        icon: 'alert-circle-outline' as const,
        color: '#F44336',
        gradient: ['#EF5350', '#C62828'],
        text: 'Rejected',
        bgColor: '#FFEBEE'
      }
    };
    return configs[status as keyof typeof configs] || configs.pending;
  };

  const ProgressBar = ({ progress }: { progress: number }) => (
    <View style={styles.progressBarContainer}>
      <Animated.View 
        style={[
          styles.progressBar,
          {
            width: `${progress}%`,
            transform: [{ scaleX: fadeAnim }]
          }
        ]}
      >
        <LinearGradient
          colors={['#4CAF50', '#2196F3']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        />
      </Animated.View>
    </View>
  );

  const calculateProgress = () => {
    if (treatmentPlan.length === 0) return 0;
    const completedCount = treatmentPlan.filter(step => step.status === 'approved').length;
    return (completedCount / treatmentPlan.length) * 100;
  };

  const getSeverityColor = (severity?: string) => {
    switch (severity) {
      case 'critical': return '#F44336';
      case 'severe': return '#FF9800';
      case 'moderate': return '#FFC107';
      case 'mild': return '#4CAF50';
      default: return '#666';
    }
  };

  // Render Message Item - CHO BỆNH NHÂN
  const renderMessageItem = ({ item }: { item: Message }) => {
    const isPatientMessage = item.sender_id !== record.doctor_id?._id;
    
    return (
      <View style={[
        styles.messageContainer,
        isPatientMessage ? styles.patientMessage : styles.doctorMessage
      ]}>
        <View style={[
          styles.messageBubble,
          isPatientMessage ? styles.patientBubble : styles.doctorBubble
        ]}>
          <Text style={[
            styles.messageText,
            isPatientMessage ? styles.patientMessageText : styles.doctorMessageText
          ]}>
            {item.message}
          </Text>
          <Text style={[
            styles.messageTime,
            isPatientMessage ? styles.patientMessageTime : styles.doctorMessageTime
          ]}>
            {formatTime(new Date(item.timestamp))}
          </Text>
        </View>
      </View>
    );
  };

  const renderStepActions = (step: TreatmentStep) => {
    const statusConfig = getStatusConfig(step.status);
    const currentActiveStep = getCurrentActiveStep();

    if (loading && activeStep === step.stepNumber.toString()) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#1976D2" />
          <Text style={styles.loadingText}>Processing...</Text>
        </View>
      );
    }

    if (userRole === 'patient') {
      return (
        <View style={styles.processActions}>
          {/* Action: Mark Complete */}
          {step.status === 'in-progress' && (
            <Pressable
              style={styles.actionButton}
              onPress={() => handleCompleteStep(step.stepNumber)}
              disabled={loading}
            >
              <LinearGradient colors={['#2196F3', '#1976D2']} style={styles.actionButtonGradient}>
                <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                <Text style={styles.actionButtonText}>Mark Complete</Text>
              </LinearGradient>
            </Pressable>
          )}

          {/* Action: Request Approval (if completed but not requested) */}
          {step.status === 'completed' && !step.approval_requested && (
             <Pressable
              style={styles.requestApprovalButton}
              onPress={() => openRequestModal(step)}
              disabled={loading}
            >
              <LinearGradient colors={['#FF9800', '#F57C00']} style={styles.actionButtonGradient}>
                <Ionicons name="notifications-outline" size={18} color="#fff" />
                <Text style={styles.actionButtonText}>Request Approval</Text>
              </LinearGradient>
            </Pressable>
          )}

          {/* Status Display: Awaiting Approval */}
          {step.status === 'completed' && step.approval_requested && (
            <View style={styles.pendingApprovalContainer}>
              <LinearGradient colors={['#FFF3E0', '#FFE0B2']} style={styles.pendingApprovalBadge}>
                <Ionicons name="time-outline" size={18} color="#FF9800" />
                <Text style={styles.pendingApprovalText}>Awaiting Doctor Approval</Text>
              </LinearGradient>
            </View>
          )}

          {/* Status Display: Approved */}
          {step.status === 'approved' && (
            <View style={styles.completedContainer}>
              <LinearGradient colors={['#E8F5E8', '#C8E6C9']} style={styles.completedBadge}>
                <Ionicons name="checkmark-done-circle" size={18} color="#4CAF50" />
                <Text style={styles.completedText}>Approved by Doctor</Text>
              </LinearGradient>
            </View>
          )}
          
           {/* Status Display: Rejected */}
          {step.status === 'rejected' && (
            <View style={styles.completedContainer}>
              <LinearGradient colors={['#FFEBEE', '#FFCDD2']} style={styles.completedBadge}>
                <Ionicons name="alert-circle" size={18} color="#D32F2F" />
                <Text style={[styles.completedText, {color: '#D32F2F'}]}>Rejected - See notes</Text>
              </LinearGradient>
            </View>
          )}

          {/* Status Display: Pending */}
          {step.status === 'pending' && (
            <View style={styles.pendingContainer}>
              <LinearGradient colors={['#F5F5F5', '#E0E0E0']} style={styles.pendingBadge}>
                <Ionicons name="time-outline" size={18} color="#666" />
                <Text style={styles.pendingText}>
                  {step.stepNumber === 1 ? 'Ready to start' : 'Waiting for previous steps'}
                </Text>
              </LinearGradient>
            </View>
          )}
        </View>
      );
    }
    return null;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1565C0" />
      <FlashMessage position="top" />
      
      {/* Header */}
      <LinearGradient
        colors={['#1976D2', '#1565C0', '#0D47A1']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <Pressable
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
          >
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </Pressable>
          
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Medical Consultation</Text>
            <Text style={styles.headerSubtitle}>Treatment Plan & Progress</Text>
          </View>
          
          <TouchableOpacity 
            style={styles.refreshButton}
            onPress={onRefresh}
            disabled={refreshing}
          >
            <Ionicons 
              name="refresh" 
              size={20} 
              color="#fff" 
              style={refreshing && styles.refreshingIcon}
            />
          </TouchableOpacity>
        </View>
        
        <ProgressBar progress={calculateProgress()} />
      </LinearGradient>

      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Patient Card */}
        <Animated.View 
          style={[
            styles.patientCard, 
            { transform: [{ translateY: slideAnim }, { scale: scaleAnim }] }
          ]}
        >
          <LinearGradient
            colors={['#fff', '#f8f9fa']}
            style={styles.cardGradient}
          >
            <View style={styles.patientHeader}>
              <View style={styles.patientInfo}>
                <View style={styles.avatarContainer}>
                  {record.doctor_id?.avatar && shouldShowAvatar(record.doctor_id.avatar) ? (
                    <Image 
                      source={{ uri: getDoctorAvatarUrl(record.doctor_id.avatar) }}
                      style={styles.patientAvatar}
                    />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <Text style={styles.avatarText}>
                        {record.doctor_id?.name?.charAt(0) || 'D'}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={styles.doctorDetails}>
                  <Text style={styles.doctorName}>
                    {record.doctor_id?.name || 'Doctor'}
                  </Text>
                  <Text style={styles.doctorMeta}>
                    Doctor
                    {record.doctor_id?.specialty_id ? ` • ${record.doctor_id.specialty_id.name}` : ''}
                  </Text>
                  <View style={styles.doctorIdContainer}>
                    <Ionicons name="medical-outline" size={12} color="#999" />
                    <Text style={styles.patientId}>
                      Diagnosis: {record.diagnosis}
                    </Text>
                  </View>
                </View>
              </View>
              <View style={styles.dateTimeContainer}>
                <View style={[
                  styles.severityChip,
                  { backgroundColor: getSeverityColor(record.severity) + '20' }
                ]}>
                  <Ionicons 
                    name="alert-circle-outline" 
                    size={12} 
                    color={getSeverityColor(record.severity)} 
                  />
                  <Text style={[
                    styles.severityText,
                    { color: getSeverityColor(record.severity) }
                  ]}>
                    {record.severity || 'Unknown'}
                  </Text>
                </View>
                <View style={[
                  styles.statusChip,
                  { 
                    backgroundColor: record.consultation_status === 'completed' ? '#E8F5E8' : '#E3F2FD' 
                  }
                ]}>
                  <Ionicons 
                    name={record.consultation_status === 'completed' ? 'checkmark-done' : 'time'} 
                    size={12} 
                    color={record.consultation_status === 'completed' ? '#4CAF50' : '#2196F3'} 
                  />
                  <Text style={[
                    styles.statusText,
                    { color: record.consultation_status === 'completed' ? '#4CAF50' : '#2196F3' }
                  ]}>
                    {record.consultation_status === 'completed' ? 'Completed' : 'In Progress'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Chat Button - CHỈ HIỂN THỊ CHO BỆNH NHÂN */}
            {userRole === 'patient' && (
              <Pressable
                style={styles.chatButton}
                onPress={showChatModalFunc}
                android_ripple={{ color: 'rgba(25, 118, 210, 0.1)' }}
              >
                <LinearGradient
                  colors={['#1976D2', '#1565C0']}
                  style={styles.chatButtonGradient}
                >
                  <Ionicons name="chatbubble-ellipses" size={18} color="#fff" />
                  <Text style={styles.chatButtonText}>Message Doctor</Text>
                </LinearGradient>
              </Pressable>
            )}
          </LinearGradient>
        </Animated.View>

        {/* Stats Section */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{treatmentPlan.length}</Text>
            <Text style={styles.statLabel}>Total Steps</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="checkmark-done-circle" size={20} color="#4CAF50" />
            <Text style={styles.statNumber}>
              {treatmentPlan.filter(step => step.status === 'approved').length}
            </Text>
            <Text style={styles.statLabel}>Approved</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="play-circle-outline" size={20} color="#2196F3" />
            <Text style={styles.statNumber}>
              {treatmentPlan.filter(step => step.status === 'in-progress').length}
            </Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
        </View>

        {/* Medical Info Section */}
        <View style={styles.medicalSection}>
          <View style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <LinearGradient
                colors={['#1976D2', '#1565C0']}
                style={styles.iconContainer}
              >
                <Ionicons name="medical-outline" size={20} color="#fff" />
              </LinearGradient>
              <Text style={styles.infoTitle}>Diagnosis Details</Text>
            </View>
            <Text style={styles.infoContent}>{record.diagnosis}</Text>
          </View>

          {record.notes && (
            <View style={styles.infoCard}>
              <View style={styles.infoHeader}>
                <LinearGradient
                  colors={['#FF9800', '#F57C00']}
                  style={styles.iconContainer}
                >
                  <Ionicons name="document-text-outline" size={20} color="#fff" />
                </LinearGradient>
                <Text style={styles.infoTitle}>Doctor's Notes</Text>
              </View>
              <Text style={styles.infoContent}>{record.notes}</Text>
            </View>
          )}
        </View>

        {/* Action Buttons - CHỈ HIỂN THỊ CHO PATIENT */}
        {userRole === 'patient' && (
          <View style={styles.actionSection}>
            {/* Start Treatment Button - chỉ hiển thị khi step đầu tiên là pending */}
            {canStartTreatment && (
              <Pressable
                style={styles.startTreatmentButton}
                onPress={handleStartTreatment}
                disabled={loading}
                android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
              >
                <LinearGradient
                  colors={['#1976D2', '#1565C0']}
                  style={styles.gradientButton}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Ionicons name="play-circle-outline" size={20} color="#fff" />
                      <Text style={styles.buttonText}>Start Treatment</Text>
                    </>
                  )}
                </LinearGradient>
              </Pressable>
            )}
          </View>
        )}

        {/* Treatment Plan Section */}
        <View style={styles.processSection}>
          <View style={styles.processSectionHeader}>
            <Text style={styles.processSectionTitle}>Treatment Plan</Text>
            <Text style={styles.processSectionSubtitle}>
              {treatmentPlan.length > 0 
                ? 'Follow the treatment steps as prescribed'
                : 'No treatment steps defined yet'
              }
            </Text>
          </View>

          {treatmentPlan.map((step) => {
            const statusConfig = getStatusConfig(step.status);
            
            return (
              <Animated.View
                key={step.stepNumber}
                style={[styles.processCard, {
                  transform: [{ translateX: slideAnim }],
                  opacity: fadeAnim,
                  borderLeftColor: statusConfig.color,
                }]}
              >
                {/* Step Header */}
                <View style={styles.processHeader}>
                  <LinearGradient
                    colors={statusConfig.gradient as [string, string]}
                    style={styles.processNumber}
                  >
                    <Text style={styles.processNumberText}>{step.stepNumber}</Text>
                  </LinearGradient>
                  <View style={styles.processInfo}>
                    <Text style={styles.processName}>{step.title}</Text>
                    <Text style={styles.processDescription}>{step.description}</Text>
                    
                    {/* Medication Info */}
                    {(step.medication || step.dosage || step.duration) && (
                      <View style={styles.medicationInfo}>
                        {step.medication && (
                          <Text style={styles.medicationText}>
                            <Ionicons name="medical" size={12} color="#666" />
                            {' '}Medication: {step.medication}
                          </Text>
                        )}
                        {step.dosage && (
                          <Text style={styles.medicationText}>
                            <Ionicons name="fitness" size={12} color="#666" />
                            {' '}Dosage: {step.dosage}
                          </Text>
                        )}
                        {step.duration && (
                          <Text style={styles.medicationText}>
                            <Ionicons name="time" size={12} color="#666" />
                            {' '}Duration: {step.duration}
                          </Text>
                        )}
                      </View>
                    )}
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}> 
                    <Ionicons name={statusConfig.icon} size={14} color={statusConfig.color} />
                    <Text style={[styles.statusBadgeText, { color: statusConfig.color }]}>
                      {statusConfig.text}
                    </Text>
                  </View>
                </View>

                {/* Instructions */}
                {step.instructions && (
                  <View style={styles.notesContainer}>
                    <View style={styles.notesHeader}>
                      <Ionicons name="document-text-outline" size={16} color="#1976D2" />
                      <Text style={styles.notesLabel}>Instructions</Text>
                    </View>
                    <Text style={styles.notesText}>{step.instructions}</Text>
                  </View>
                )}
                
                 {/* Doctor's Notes (if rejected or commented) */}
                {step.doctorNotes && (
                   <View style={[styles.notesContainer, {borderLeftColor: '#F44336'}]}>
                    <View style={styles.notesHeader}>
                      <Ionicons name="alert-circle-outline" size={16} color="#F44336" />
                      <Text style={[styles.notesLabel, {color: '#F44336'}]}>Doctor's Feedback</Text>
                    </View>
                    <Text style={styles.notesText}>{step.doctorNotes}</Text>
                  </View>
                )}

                {/* Step Actions */}
                {renderStepActions(step)}
              </Animated.View>
            );
          })}
        </View>

        {treatmentPlan.length === 0 && (
          <View style={styles.noProcessContainer}>
            <Ionicons name="information-circle-outline" size={40} color="#1976D2" />
            <Text style={styles.noProcessText}>No treatment steps defined yet.</Text>
            <Text style={styles.noProcessSubtext}>
              The doctor will add treatment steps soon.
            </Text>
          </View>
        )}

        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* Chat Modal - CHO BỆNH NHÂN */}
      {userRole === 'patient' && (
        <Modal
          visible={showChatModal}
          transparent
          animationType="none"
          statusBarTranslucent
          onRequestClose={hideChatModal}
        >
          <BlurView intensity={20} style={styles.modalOverlay}>
            <Animated.View 
              style={[
                styles.chatModalContainer,
                { transform: [{ translateY: chatModalSlideAnim }] }
              ]}
            >
              <LinearGradient
                colors={['#fff', '#f8f9fa']}
                style={styles.chatModalContent}
              >
                {/* Chat Header */}
                <View style={styles.chatHeader}>
                  <View style={styles.chatDoctorInfo}>
                    <View style={styles.chatAvatarContainer}>
                      {record.doctor_id?.avatar && shouldShowAvatar(record.doctor_id.avatar) ? (
                        <Image 
                          source={{ uri: getDoctorAvatarUrl(record.doctor_id.avatar) }}
                          style={styles.chatAvatar}
                        />
                      ) : (
                        <View style={styles.chatAvatarPlaceholder}>
                          <Text style={styles.chatAvatarText}>
                            {record.doctor_id?.name?.charAt(0) || 'D'}
                          </Text>
                        </View>
                      )}
                    </View>
                    <View>
                      <Text style={styles.chatDoctorName}>
                        Dr. {record.doctor_id?.name || 'Doctor'}
                      </Text>
                      <Text style={styles.chatStatus}>
                        <Ionicons name="ellipse" size={8} color="#4CAF50" />
                        {' '}Online
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity 
                    style={styles.chatCloseButton}
                    onPress={hideChatModal}
                  >
                    <Ionicons name="close" size={24} color="#666" />
                  </TouchableOpacity>
                </View>

                {/* Messages List */}
                <View style={styles.messagesContainer}>
                  {chatLoading ? (
                    <View style={styles.chatLoadingContainer}>
                      <ActivityIndicator size="large" color="#1976D2" />
                      <Text style={styles.chatLoadingText}>Loading messages...</Text>
                    </View>
                  ) : (
                    <FlatList
                      ref={flatListRef}
                      data={messages}
                      renderItem={renderMessageItem}
                      keyExtractor={(item) => item._id || item.timestamp.toString()}
                      showsVerticalScrollIndicator={false}
                      contentContainerStyle={styles.messagesList}
                      onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                    />
                  )}
                </View>

                {/* Message Input */}
                <KeyboardAvoidingView 
                  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                  style={styles.messageInputContainer}
                >
                  <View style={styles.inputWrapper}>
                    <TextInput
                      style={styles.messageInput}
                      placeholder="Type your message..."
                      placeholderTextColor="#999"
                      value={newMessage}
                      onChangeText={setNewMessage}
                      multiline
                      maxLength={500}
                    />
                    <Pressable
                      style={[
                        styles.sendButton,
                        (!newMessage.trim() || sendingMessage) && styles.sendButtonDisabled
                      ]}
                      onPress={sendMessage}
                      disabled={!newMessage.trim() || sendingMessage}
                    >
                      {sendingMessage ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Ionicons name="send" size={20} color="#fff" />
                      )}
                    </Pressable>
                  </View>
                  <Text style={styles.messageHint}>
                    Discuss your treatment progress with your doctor
                  </Text>
                </KeyboardAvoidingView>
              </LinearGradient>
            </Animated.View>
          </BlurView>
        </Modal>
      )}

      {/* Request Approval Modal */}
      <Modal
        visible={showRequestModal}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={hideRequestModal}
      >
        <BlurView intensity={20} style={styles.modalOverlay}>
          <Animated.View 
            style={[
              styles.modalContainer,
              { transform: [{ translateY: requestModalSlideAnim }] }
            ]}
          >
            <LinearGradient
              colors={['#fff', '#f8f9fa']}
              style={styles.modalContent}
            >
              <View style={styles.modalHeader}>
                <View style={styles.modalTitleContainer}>
                  <LinearGradient
                    colors={['#FFF3E0', '#FFE0B2']}
                    style={styles.modalIcon}
                  >
                    <Ionicons name="notifications" size={20} color="#FF9800" />
                  </LinearGradient>
                  <View>
                    <Text style={styles.modalTitle}>Request Doctor Approval</Text>
                    <Text style={styles.modalSubtitle}>Step {currentStep?.stepNumber}: {currentStep?.title}</Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.modalCloseButton} onPress={hideRequestModal}>
                  <Ionicons name="close" size={20} color="#666" />
                </TouchableOpacity>
              </View>

              <View style={styles.processInfoContainer}>
                <Text style={styles.processInfoLabel}>Step Description:</Text>
                <Text style={styles.processInfoText}>{currentStep?.description}</Text>
              </View>

              <View style={styles.notesInputContainer}>
                <Text style={styles.inputLabel}>
                  <Ionicons name="chatbubble-outline" size={16} color="#FF9800" />
                  {' '}Message to Doctor
                </Text>
                <TextInput
                  style={styles.notesInput}
                  multiline
                  numberOfLines={4}
                  placeholder="Let the doctor know about your progress and request approval for the next step..."
                  placeholderTextColor="#999"
                  value={requestMessage}
                  onChangeText={setRequestMessage}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.modalActions}>
                <Pressable
                  style={styles.modalSecondaryButton}
                  onPress={hideRequestModal}
                  android_ripple={{ color: 'rgba(0,0,0,0.1)' }}
                >
                  <Text style={styles.modalSecondaryButtonText}>Cancel</Text>
                </Pressable>
                
                <Pressable
                  style={styles.modalPrimaryButton}
                  onPress={handleSendApprovalRequest}
                  disabled={loading}
                  android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
                >
                  <LinearGradient
                    colors={['#FF9800', '#F57C00']}
                    style={styles.modalPrimaryButtonGradient}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <>
                        <Ionicons name="send" size={18} color="#fff" />
                        <Text style={styles.modalPrimaryButtonText}>Send Request</Text>
                      </>
                    )}
                  </LinearGradient>
                </Pressable>
              </View>
            </LinearGradient>
          </Animated.View>
        </BlurView>
      </Modal>
    </SafeAreaView>
  );
}

// ... (giữ nguyên phần styles không thay đổi)

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  header: {
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    paddingBottom: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshingIcon: {
    transform: [{ rotate: '180deg' }],
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: 20,
    marginTop: 15,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
    overflow: 'hidden',
  },
  scrollView: {
    flex: 1,
  },
  patientCard: {
    margin: 20,
    marginTop: -10,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  cardGradient: {
    padding: 20,
  },
  patientHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  patientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 15,
  },
  patientAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    borderColor: '#fff',
  },
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#666',
  },
  doctorDetails: {
    flex: 1,
  },
  doctorName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  doctorMeta: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
  },
  doctorIdContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  patientId: {
    fontSize: 12,
    color: '#999',
    marginLeft: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  dateTimeContainer: {
    alignItems: 'flex-end',
  },
  severityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 6,
  },
  severityText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  // Chat Button Styles
  chatButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
  },
  chatButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  chatButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  // Chat Modal Styles
  chatModalContainer: {
    width: '100%',
    height: '80%',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  chatModalContent: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  chatDoctorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  chatAvatarContainer: {
    marginRight: 12,
  },
  chatAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#1976D2',
  },
  chatAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#1976D2',
  },
  chatAvatarText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
  },
  chatDoctorName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  chatStatus: {
    fontSize: 12,
    color: '#666',
  },
  chatCloseButton: {
    padding: 8,
  },
  messagesContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  chatLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatLoadingText: {
    marginTop: 12,
    color: '#666',
    fontSize: 14,
  },
  messagesList: {
    padding: 16,
    paddingBottom: 8,
  },
  messageContainer: {
    marginBottom: 12,
  },
  patientMessage: {
    alignItems: 'flex-end',
  },
  doctorMessage: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  patientBubble: {
    backgroundColor: '#1976D2',
    borderBottomRightRadius: 4,
  },
  doctorBubble: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  doctorMessageText: {
    color: '#1A1A1A',
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  patientMessageTime: {
    color: '#fff',
    textAlign: 'right',
  },
  doctorMessageTime: {
    color: '#666',
  },
  messageInputContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  messageInput: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    maxHeight: 100,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1976D2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  messageHint: {
    fontSize: 11,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
  },
  // ... (giữ nguyên các styles khác)
  statsContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 10,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  medicalSection: {
    marginHorizontal: 20,
    marginBottom: 20,
    gap: 16,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    letterSpacing: 0.3,
  },
  infoContent: {
    fontSize: 15,
    lineHeight: 22,
    color: '#444',
    letterSpacing: 0.2,
  },
  actionSection: {
    marginHorizontal: 20,
    marginBottom: 20,
    gap: 12,
  },
  startTreatmentButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#1976D2',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  gradientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    letterSpacing: 0.5,
  },
  processSection: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  processSectionHeader: {
    marginBottom: 20,
  },
  processSectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  processSectionSubtitle: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  processCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  processHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  processNumber: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  processNumberText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  processInfo: {
    flex: 1,
    marginRight: 12,
  },
  processName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
    letterSpacing: 0.2,
  },
  processDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 8,
  },
  medicationInfo: {
    marginTop: 8,
  },
  medicationText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  notesContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#1976D2',
  },
  patientMessageContainer: {
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#FF9800',
  },
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  notesLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1976D2',
    marginLeft: 6,
  },
  patientMessageLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF9800',
    marginLeft: 6,
  },
  notesText: {
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  patientMessageText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  processActions: {
    marginTop: 4,
    gap: 8,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  loadingText: {
    marginLeft: 8,
    color: '#666',
    fontSize: 14,
  },
  actionButton: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  requestApprovalButton: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#FF9800',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  actionButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  pendingApprovalContainer: {
    marginTop: 8,
  },
  pendingApprovalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  pendingApprovalText: {
    fontSize: 12,
    color: '#FF9800',
    fontWeight: '600',
    marginLeft: 4,
  },
  noProcessContainer: {
    alignItems: 'center',
    marginTop: 40,
    paddingHorizontal: 20,
  },
  noProcessText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976D2',
    marginTop: 12,
    marginBottom: 4,
  },
  noProcessSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  bottomSpacing: {
    height: 40,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: 20,
  },
  modalContainer: {
    width: '100%',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  modalContent: {
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    letterSpacing: 0.3,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  modalCloseButton: {
    padding: 8,
  },
  processInfoContainer: {
    marginBottom: 16,
  },
  processInfoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1976D2',
    marginBottom: 4,
  },
  processInfoText: {
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
  },
  notesInputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1976D2',
    marginBottom: 6,
  },
  notesInput: {
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: '#1A1A1A',
    minHeight: 80,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalSecondaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#E0E0E0',
  },
  modalSecondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  modalPrimaryButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalPrimaryButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  modalPrimaryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  requestApprovalButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  pendingContainer: {
    marginTop: 8,
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  pendingText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
    marginLeft: 4,
  },
  completedContainer: {
    marginTop: 8,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E8',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  completedText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '600',
    marginLeft: 4,
  },
});

export default RecordDetail;