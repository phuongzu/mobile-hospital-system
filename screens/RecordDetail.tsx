import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
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

// Interfaces
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
  status: 'pending' | 'in-progress' | 'scheduled' | 'completed' | 'approved' | 'rejected';
  completedAt?: Date;
  patient_message?: string;
  doctorNotes?: string;
  approval_requested?: boolean;
  approval_requested_at?: Date;
  condition_description?: string;
  rejectionReason?: string;
  rejectedAt?: Date;
  isPhysicalVisit?: boolean;
  reExaminationScheduled?: boolean;
  reExaminationDate?: Date;
  reExaminationAppointmentId?: string;
  arrivalConfirmed?: boolean;
  arrivalConfirmedAt?: Date;
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
  
  // Chat states
  const [showChatModal, setShowChatModal] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  
  // Complete step modal states
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [selectedStep, setSelectedStep] = useState<TreatmentStep | null>(null);
  const [conditionDescription, setConditionDescription] = useState('');
  const [patientMessage, setPatientMessage] = useState('');
  
  // Confirm arrival modal
  const [showConfirmArrivalModal, setShowConfirmArrivalModal] = useState(false);
  const [arrivalStep, setArrivalStep] = useState<TreatmentStep | null>(null);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const completeModalAnim = useRef(new Animated.Value(screenHeight)).current;
  const requestModalAnim = useRef(new Animated.Value(screenHeight)).current;
  const chatModalAnim = useRef(new Animated.Value(screenHeight)).current;
  const confirmArrivalAnim = useRef(new Animated.Value(screenHeight)).current;
  
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
    setRefreshing(false);
  }, []);

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

  const canStartTreatment = treatmentPlan.length > 0 && 
                           treatmentPlan[0]?.status === 'pending' && 
                           userRole === 'patient';

  const getCurrentActiveStep = () => {
    return treatmentPlan.find(step => step.status === 'in-progress') || null;
  };

  // Modal functions
  const openCompleteModal = (step: TreatmentStep) => {
    setSelectedStep(step);
    setConditionDescription('');
    setPatientMessage('');
    setShowCompleteModal(true);
    
    Animated.spring(completeModalAnim, {
      toValue: 0,
      tension: 100,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };

  const closeCompleteModal = () => {
    Animated.timing(completeModalAnim, {
      toValue: screenHeight,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setShowCompleteModal(false);
      setSelectedStep(null);
      completeModalAnim.setValue(screenHeight);
    });
  };

  const openRequestModal = (step: TreatmentStep) => {
    setCurrentStep(step);
    setRequestMessage('');
    setShowRequestModal(true);
    
    Animated.spring(requestModalAnim, {
      toValue: 0,
      tension: 100,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };

  const closeRequestModal = () => {
    Animated.timing(requestModalAnim, {
      toValue: screenHeight,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setShowRequestModal(false);
      setCurrentStep(null);
      setRequestMessage('');
      requestModalAnim.setValue(screenHeight);
    });
  };

  const openConfirmArrivalModal = (step: TreatmentStep) => {
    setArrivalStep(step);
    setShowConfirmArrivalModal(true);
    
    Animated.spring(confirmArrivalAnim, {
      toValue: 0,
      tension: 100,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };

  const closeConfirmArrivalModal = () => {
    Animated.timing(confirmArrivalAnim, {
      toValue: screenHeight,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setShowConfirmArrivalModal(false);
      setArrivalStep(null);
      confirmArrivalAnim.setValue(screenHeight);
    });
  };

  const openChatModal = () => {
    setShowChatModal(true);
    loadMessages();
    
    Animated.spring(chatModalAnim, {
      toValue: 0,
      tension: 100,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };

  const closeChatModal = () => {
    Animated.timing(chatModalAnim, {
      toValue: screenHeight,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setShowChatModal(false);
      setNewMessage('');
      chatModalAnim.setValue(screenHeight);
    });
  };

  // API functions
  const fetchRecordData = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
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
      showNotification('Failed to refresh data', 'danger');
    }
  };

  const handleCompleteStep = async () => {
    if (!selectedStep || !conditionDescription.trim()) return;
    
    setLoading(true);
    
    try {
      const token = await AsyncStorage.getItem('authToken');
      
      const response = await axios.patch(
        `${API_BASE_URL}/medical-records/${record._id}/steps/${selectedStep.stepNumber}/complete-with-message`,
        { 
          patientMessage: patientMessage || "Completed this step",
          conditionDescription: conditionDescription
        },
        { 
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          } 
        }
      );

      if (response.data.success) {
        setRecord(response.data.data.record || response.data.data);
        setTreatmentPlan(response.data.data.record?.treatment_plan || response.data.data.treatment_plan);
        showNotification('Step completed successfully!', 'success');
        closeCompleteModal();
        fetchRecordData();
      }
      
    } catch (error: any) {
      console.error('Error completing step:', error);
      
      // Fallback for UI testing
      console.log('Using fallback for UI demo');
      const updatedSteps = treatmentPlan.map(step => {
        if (step.stepNumber === selectedStep.stepNumber) {
          return {
            ...step,
            status: 'completed',
            condition_description: conditionDescription,
            patient_message: patientMessage,
            approval_requested: true,
            completedAt: new Date()
          };
        }
        return step;
      });
      
      setTreatmentPlan(updatedSteps);
      showNotification('Step completed (demo mode)', 'success');
      closeCompleteModal();
      
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmArrival = async () => {
    if (!arrivalStep) return;
    
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      
      const response = await axios.post(
        `${API_BASE_URL}/patients/consultations/${record._id}/steps/${arrivalStep.stepNumber}/confirm-arrival`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        showNotification('Arrival confirmed. Doctor has been notified.', 'success');
        closeConfirmArrivalModal();
        fetchRecordData();
      } else {
        showNotification(response.data.message || 'Failed to confirm arrival', 'danger');
      }
    } catch (error: any) {
      console.error('Error confirming arrival:', error);
      showNotification('Error confirming arrival', 'danger');
    } finally {
      setLoading(false);
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
        setRecord(response.data.data.record);
        setTreatmentPlan(response.data.data.record.treatment_plan);
        showNotification('Treatment started successfully!', 'success');
      }
      
    } catch (error: any) {
      console.error('Error starting treatment:', error);
      showNotification('Failed to start treatment', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const handleSendApprovalRequest = async () => {
    if (!currentStep) return;
    
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      
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
        setRecord(response.data.data.record);
        setTreatmentPlan(response.data.data.record.treatment_plan);
        showNotification('Approval request sent!', 'success');
        closeRequestModal();
      }
      
    } catch (error: any) {
      console.error('Error sending approval request:', error);
      showNotification('Failed to send request', 'danger');
    } finally {
      setLoading(false);
    }
  };

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
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
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
      scheduled: {
        icon: 'calendar-outline' as const,
        color: '#2196F3',
        gradient: ['#42A5F5', '#2196F3'],
        text: 'Scheduled',
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
      <View style={[styles.progressBar, { width: `${progress}%` }]}>
        <LinearGradient
          colors={['#4CAF50', '#2196F3']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        />
      </View>
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
    if (loading && activeStep === step.stepNumber.toString()) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#1976D2" />
          <Text style={styles.loadingText}>Processing...</Text>
        </View>
      );
    }

    if (userRole === 'patient') {
      switch (step.status) {
        case 'in-progress':
          return (
            <Pressable
              style={styles.actionButton}
              onPress={() => openCompleteModal(step)}
              disabled={loading}
            >
              <LinearGradient colors={['#2196F3', '#1976D2']} style={styles.actionButtonGradient}>
                <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                <Text style={styles.actionButtonText}>Complete Step</Text>
              </LinearGradient>
            </Pressable>
          );
        
        case 'completed' && !step.approval_requested:
          return (
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
          );
        
        case 'completed' && step.approval_requested:
          return (
            <View style={styles.pendingApprovalContainer}>
              <View style={styles.pendingApprovalBadge}>
                <Ionicons name="time-outline" size={18} color="#FF9800" />
                <Text style={styles.pendingApprovalText}>Awaiting Review</Text>
              </View>
              {step.condition_description && (
                <Text style={styles.conditionDescriptionText}>
                  <Ionicons name="chatbubble" size={12} color="#FF9800" /> 
                  You submitted: {step.condition_description.substring(0, 60)}...
                </Text>
              )}
            </View>
          );
        
        case 'approved':
          return (
            <View style={styles.completedContainer}>
              <View style={styles.completedBadge}>
                <Ionicons name="checkmark-done-circle" size={18} color="#4CAF50" />
                <Text style={styles.completedText}>Approved by Doctor</Text>
              </View>
              {step.doctorNotes && (
                <Text style={styles.doctorNotesText}>
                  <Ionicons name="document-text" size={12} color="#4CAF50" /> 
                  Doctor's note: {step.doctorNotes}
                </Text>
              )}
            </View>
          );
        
        case 'rejected':
          return (
            <View style={styles.completedContainer}>
              <View style={styles.rejectedBadge}>
                <Ionicons name="alert-circle" size={18} color="#D32F2F" />
                <Text style={styles.rejectedText}>Needs Revision</Text>
              </View>
              {step.rejectionReason && (
                <Text style={styles.rejectionReasonText}>
                  <Ionicons name="alert-circle" size={12} color="#D32F2F" /> 
                  Reason: {step.rejectionReason}
                </Text>
              )}
            </View>
          );
        
        default:
          return null;
      }
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
        {/* Doctor Card */}
        <Animated.View 
          style={[
            styles.doctorCard,
            { transform: [{ translateY: slideAnim }, { scale: scaleAnim }] }
          ]}
        >
          <View style={styles.cardContent}>
            <View style={styles.doctorHeader}>
              <View style={styles.avatarContainer}>
                {record.doctor_id?.avatar && shouldShowAvatar(record.doctor_id.avatar) ? (
                  <Image 
                    source={{ uri: getDoctorAvatarUrl(record.doctor_id.avatar) }}
                    style={styles.doctorAvatar}
                  />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarText}>
                      {record.doctor_id?.name?.charAt(0) || 'D'}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.doctorInfo}>
                <Text style={styles.doctorName}>
                  {record.doctor_id?.name || 'Doctor'}
                </Text>
                <Text style={styles.doctorMeta}>
                  Doctor
                  {record.doctor_id?.specialty_id ? ` • ${record.doctor_id.specialty_id.name}` : ''}
                </Text>
                <Text style={styles.diagnosis}>
                  Diagnosis: {record.diagnosis}
                </Text>
              </View>
            </View>
            
            <View style={styles.statusContainer}>
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

            {userRole === 'patient' && (
              <Pressable
                style={styles.chatButton}
                onPress={openChatModal}
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
          </View>
        </Animated.View>

        {/* Stats Section */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{treatmentPlan.length}</Text>
            <Text style={styles.statLabel}>Total Steps</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {treatmentPlan.filter(step => step.status === 'approved').length}
            </Text>
            <Text style={styles.statLabel}>Approved</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {treatmentPlan.filter(step => step.status === 'in-progress').length}
            </Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
        </View>

        {/* Diagnosis Info */}
        <View style={styles.infoSection}>
          <View style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <View style={styles.infoIcon}>
                <Ionicons name="medical-outline" size={20} color="#1976D2" />
              </View>
              <Text style={styles.infoTitle}>Diagnosis Details</Text>
            </View>
            <Text style={styles.infoContent}>{record.diagnosis}</Text>
          </View>

          {record.notes && (
            <View style={styles.infoCard}>
              <View style={styles.infoHeader}>
                <View style={styles.infoIcon}>
                  <Ionicons name="document-text-outline" size={20} color="#FF9800" />
                </View>
                <Text style={styles.infoTitle}>Doctor's Notes</Text>
              </View>
              <Text style={styles.infoContent}>{record.notes}</Text>
            </View>
          )}
        </View>

        {/* Start Treatment Button */}
        {userRole === 'patient' && canStartTreatment && (
          <View style={styles.actionSection}>
            <Pressable
              style={styles.startTreatmentButton}
              onPress={handleStartTreatment}
              disabled={loading}
            >
              <LinearGradient
                colors={['#1976D2', '#1565C0']}
                style={styles.startButtonGradient}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="play-circle-outline" size={20} color="#fff" />
                    <Text style={styles.startButtonText}>Start Treatment</Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>
          </View>
        )}

        {/* Treatment Plan Section */}
        <View style={styles.treatmentSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Treatment Plan</Text>
            <Text style={styles.sectionSubtitle}>
              {treatmentPlan.length > 0 
                ? 'Follow the treatment steps as prescribed'
                : 'No treatment steps defined yet'
              }
            </Text>
          </View>

          {treatmentPlan.map((step) => {
            const statusConfig = getStatusConfig(step.status);
            const isPhysicalVisit = step.isPhysicalVisit;
            const isScheduledReExamination = step.reExaminationScheduled;
            
            return (
              <View
                key={step.stepNumber}
                style={[styles.stepCard, { borderLeftColor: statusConfig.color }]}
              >
                {/* Step Header */}
                <View style={styles.stepHeader}>
                  <View style={[styles.stepNumber, { backgroundColor: statusConfig.color }]}>
                    <Text style={styles.stepNumberText}>{step.stepNumber}</Text>
                  </View>
                  <View style={styles.stepInfo}>
                    <Text style={styles.stepTitle}>{step.title}</Text>
                    <Text style={styles.stepDescription}>{step.description}</Text>
                    
                    {/* Physical Visit Badge */}
                    {isPhysicalVisit && (
                      <View style={styles.physicalVisitBadge}>
                        <Ionicons name="medical" size={12} color="#D32F2F" />
                        <Text style={styles.physicalVisitText}>Physical Re-Examination Required</Text>
                      </View>
                    )}
                    
                    {/* Scheduled Appointment Info */}
                    {isScheduledReExamination && step.reExaminationDate && (
                      <View style={styles.scheduledAppointmentContainer}>
                        <View style={styles.appointmentDateTimeContainer}>
                          <Ionicons name="calendar" size={16} color="#1976D2" />
                          <Text style={styles.appointmentDateTime}>
                            Scheduled for: {new Date(step.reExaminationDate).toLocaleDateString()} at {' '}
                            {new Date(step.reExaminationDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </Text>
                        </View>
                        
                        {/* Confirm Arrival Button (only show on appointment day) */}
                        {step.status === 'scheduled' && 
                         !step.arrivalConfirmed && 
                         new Date(step.reExaminationDate!).toDateString() === new Date().toDateString() && (
                          <Pressable
                            style={styles.confirmArrivalButton}
                            onPress={() => openConfirmArrivalModal(step)}
                          >
                            <LinearGradient colors={['#4CAF50', '#388E3C']} style={styles.confirmArrivalGradient}>
                              <Ionicons name="checkmark-circle" size={18} color="#fff" />
                              <Text style={styles.confirmArrivalText}>Confirm Arrival at Clinic</Text>
                            </LinearGradient>
                          </Pressable>
                        )}
                        
                        {/* Already Confirmed Status */}
                        {step.arrivalConfirmed && (
                          <View style={styles.arrivalConfirmedContainer}>
                            <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                            <Text style={styles.arrivalConfirmedText}>
                              Arrival confirmed at {step.arrivalConfirmedAt ? 
                              new Date(step.arrivalConfirmedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 
                              'N/A'}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                    
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
                  <View style={styles.instructionsContainer}>
                    <Text style={styles.instructionsTitle}>Instructions:</Text>
                    <Text style={styles.instructionsText}>{step.instructions}</Text>
                  </View>
                )}
                
                {/* Condition Description */}
                {step.condition_description && (
                   <View style={styles.conditionContainer}>
                    <Text style={styles.conditionTitle}>Your Report:</Text>
                    <Text style={styles.conditionText}>{step.condition_description}</Text>
                  </View>
                )}

                {/* Doctor's Notes */}
                {step.doctorNotes && (
                   <View style={styles.doctorNotesContainer}>
                    <Text style={styles.doctorNotesTitle}>
                      {step.status === 'rejected' ? "Doctor's Feedback:" : "Doctor's Note:"}
                    </Text>
                    <Text style={styles.doctorNotesText}>{step.doctorNotes}</Text>
                  </View>
                )}

                {/* Step Actions */}
                {renderStepActions(step)}
              </View>
            );
          })}
        </View>

        {treatmentPlan.length === 0 && (
          <View style={styles.emptyContainer}>
            <Ionicons name="information-circle-outline" size={40} color="#1976D2" />
            <Text style={styles.emptyText}>No treatment steps defined yet.</Text>
            <Text style={styles.emptySubtext}>
              The doctor will add treatment steps soon.
            </Text>
          </View>
        )}

        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* Complete Step Modal */}
      <Modal
        visible={showCompleteModal}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={closeCompleteModal}
      >
        <BlurView intensity={20} style={styles.modalOverlay}>
          <Animated.View 
            style={[
              styles.modalContainer,
              { transform: [{ translateY: completeModalAnim }] }
            ]}
          >
            <View style={styles.modalContent}>
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <View style={styles.modalTitleContainer}>
                  <View style={styles.modalIcon}>
                    <Ionicons name="chatbubble-ellipses" size={20} color="#1976D2" />
                  </View>
                  <View>
                    <Text style={styles.modalTitle}>Complete Step {selectedStep?.stepNumber}</Text>
                    <Text style={styles.modalSubtitle}>{selectedStep?.title}</Text>
                  </View>
                </View>
                <TouchableOpacity 
                  style={styles.modalCloseButton} 
                  onPress={closeCompleteModal}
                >
                  <Ionicons name="close" size={20} color="#666" />
                </TouchableOpacity>
              </View>

              {/* Step Description */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionLabel}>Step Description:</Text>
                <Text style={styles.modalSectionText}>
                  {selectedStep?.description}
                </Text>
              </View>

              {/* Health Condition Input */}
              <View style={styles.modalSection}>
                <Text style={styles.inputLabel}>
                  <Ionicons name="heart" size={16} color="#F44336" />
                  {' '}Health Condition After Treatment *
                </Text>
                <Text style={styles.inputHint}>
                  Describe your current health condition after completing this step
                </Text>
                <TextInput
                  style={styles.textArea}
                  multiline
                  numberOfLines={4}
                  placeholder="Example: Pain has reduced, swelling is down..."
                  placeholderTextColor="#999"
                  value={conditionDescription}
                  onChangeText={setConditionDescription}
                  textAlignVertical="top"
                />
              </View>

              {/* Optional Message */}
              <View style={styles.modalSection}>
                <Text style={styles.inputLabel}>
                  <Ionicons name="document-text" size={16} color="#FF9800" />
                  {' '}Additional Message (Optional)
                </Text>
                <TextInput
                  style={styles.textArea}
                  multiline
                  numberOfLines={3}
                  placeholder="Any additional information for the doctor..."
                  placeholderTextColor="#999"
                  value={patientMessage}
                  onChangeText={setPatientMessage}
                  textAlignVertical="top"
                />
              </View>

              {/* Modal Actions */}
              <View style={styles.modalActions}>
                <Pressable
                  style={styles.secondaryButton}
                  onPress={closeCompleteModal}
                >
                  <Text style={styles.secondaryButtonText}>Cancel</Text>
                </Pressable>
                
                <Pressable
                  style={[
                    styles.primaryButton,
                    (!conditionDescription.trim() || loading) && styles.primaryButtonDisabled
                  ]}
                  onPress={handleCompleteStep}
                  disabled={!conditionDescription.trim() || loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Submit to Doctor</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </Animated.View>
        </BlurView>
      </Modal>

      {/* Request Approval Modal */}
      <Modal
        visible={showRequestModal}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={closeRequestModal}
      >
        <BlurView intensity={20} style={styles.modalOverlay}>
          <Animated.View 
            style={[
              styles.modalContainer,
              { transform: [{ translateY: requestModalAnim }] }
            ]}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View style={styles.modalTitleContainer}>
                  <View style={styles.modalIcon}>
                    <Ionicons name="notifications" size={20} color="#FF9800" />
                  </View>
                  <View>
                    <Text style={styles.modalTitle}>Request Doctor Approval</Text>
                    <Text style={styles.modalSubtitle}>Step {currentStep?.stepNumber}: {currentStep?.title}</Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.modalCloseButton} onPress={closeRequestModal}>
                  <Ionicons name="close" size={20} color="#666" />
                </TouchableOpacity>
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.modalSectionLabel}>Step Description:</Text>
                <Text style={styles.modalSectionText}>{currentStep?.description}</Text>
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.inputLabel}>
                  <Ionicons name="chatbubble-outline" size={16} color="#FF9800" />
                  {' '}Message to Doctor
                </Text>
                <TextInput
                  style={styles.textArea}
                  multiline
                  numberOfLines={4}
                  placeholder="Let the doctor know about your progress..."
                  placeholderTextColor="#999"
                  value={requestMessage}
                  onChangeText={setRequestMessage}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.modalActions}>
                <Pressable
                  style={styles.secondaryButton}
                  onPress={closeRequestModal}
                >
                  <Text style={styles.secondaryButtonText}>Cancel</Text>
                </Pressable>
                
                <Pressable
                  style={styles.primaryButton}
                  onPress={handleSendApprovalRequest}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Send Request</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </Animated.View>
        </BlurView>
      </Modal>

      {/* Confirm Arrival Modal */}
      <Modal
        visible={showConfirmArrivalModal}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={closeConfirmArrivalModal}
      >
        <BlurView intensity={20} style={styles.modalOverlay}>
          <Animated.View 
            style={[
              styles.modalContainer,
              { transform: [{ translateY: confirmArrivalAnim }] }
            ]}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View style={styles.modalTitleContainer}>
                  <View style={styles.modalIcon}>
                    <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                  </View>
                  <View>
                    <Text style={styles.modalTitle}>Confirm Clinic Arrival</Text>
                    <Text style={styles.modalSubtitle}>Step {arrivalStep?.stepNumber}: {arrivalStep?.title}</Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.modalCloseButton} onPress={closeConfirmArrivalModal}>
                  <Ionicons name="close" size={20} color="#666" />
                </TouchableOpacity>
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.modalSectionLabel}>Appointment Details:</Text>
                <Text style={styles.modalSectionText}>
                  {arrivalStep?.reExaminationDate && (
                    <>
                      {new Date(arrivalStep.reExaminationDate).toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                      {' at '}
                      {new Date(arrivalStep.reExaminationDate).toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </>
                  )}
                </Text>
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.inputLabel}>
                  <Ionicons name="information-circle" size={16} color="#2196F3" />
                  {' '}Important Notice
                </Text>
                <Text style={styles.inputHint}>
                  By confirming your arrival, you acknowledge that you are physically present at the clinic for your scheduled re-examination. The doctor will be notified and will begin your physical assessment shortly.
                </Text>
              </View>

              <View style={styles.modalActions}>
                <Pressable
                  style={styles.secondaryButton}
                  onPress={closeConfirmArrivalModal}
                >
                  <Text style={styles.secondaryButtonText}>Cancel</Text>
                </Pressable>
                
                <Pressable
                  style={styles.primaryButton}
                  onPress={handleConfirmArrival}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={18} color="#fff" />
                      <Text style={styles.primaryButtonText}>Confirm Arrival</Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          </Animated.View>
        </BlurView>
      </Modal>

      {/* Chat Modal */}
      {userRole === 'patient' && (
        <Modal
          visible={showChatModal}
          transparent
          animationType="none"
          statusBarTranslucent
          onRequestClose={closeChatModal}
        >
          <BlurView intensity={20} style={styles.modalOverlay}>
            <Animated.View 
              style={[
                styles.chatModalContainer,
                { transform: [{ translateY: chatModalAnim }] }
              ]}
            >
              <View style={styles.chatModalContent}>
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
                      <Text style={styles.chatStatus}>Online</Text>
                    </View>
                  </View>
                  <TouchableOpacity 
                    style={styles.chatCloseButton}
                    onPress={closeChatModal}
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
                </KeyboardAvoidingView>
              </View>
            </Animated.View>
          </BlurView>
        </Modal>
      )}
    </SafeAreaView>
  );
};

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
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
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
  },
  scrollView: {
    flex: 1,
  },
  doctorCard: {
    margin: 20,
    marginTop: -10,
    backgroundColor: '#fff',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  cardContent: {
    padding: 20,
  },
  doctorHeader: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  avatarContainer: {
    marginRight: 15,
  },
  doctorAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#fff',
  },
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#666',
  },
  doctorInfo: {
    flex: 1,
  },
  doctorName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  doctorMeta: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
  },
  diagnosis: {
    fontSize: 12,
    color: '#999',
  },
  statusContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 16,
  },
  severityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    marginRight: 8,
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
  chatButton: {
    borderRadius: 12,
    overflow: 'hidden',
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
  statsContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 20,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  infoSection: {
    marginHorizontal: 20,
    marginBottom: 20,
    gap: 16,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  infoContent: {
    fontSize: 14,
    lineHeight: 20,
    color: '#444',
  },
  actionSection: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  startTreatmentButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  startButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  treatmentSection: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  sectionHeader: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  stepCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepNumberText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  stepInfo: {
    flex: 1,
    marginRight: 12,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  stepDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 8,
  },
  physicalVisitBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  physicalVisitText: {
    fontSize: 11,
    color: '#D32F2F',
    fontWeight: '600',
    marginLeft: 4,
  },
  scheduledAppointmentContainer: {
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#BBDEFB'
  },
  appointmentDateTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8
  },
  appointmentDateTime: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#1976D2'
  },
  confirmArrivalButton: {
    borderRadius: 8,
    overflow: 'hidden',
    marginTop: 8
  },
  confirmArrivalGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16
  },
  confirmArrivalText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8
  },
  arrivalConfirmedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8
  },
  arrivalConfirmedText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600'
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
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  instructionsContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  instructionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1976D2',
    marginBottom: 4,
  },
  instructionsText: {
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  conditionContainer: {
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  conditionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2196F3',
    marginBottom: 4,
  },
  conditionText: {
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
  },
  doctorNotesContainer: {
    backgroundColor: '#E8F5E8',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  doctorNotesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4CAF50',
    marginBottom: 4,
  },
  doctorNotesText: {
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  actionButton: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  actionButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  requestApprovalButton: {
    borderRadius: 8,
    overflow: 'hidden',
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
  pendingApprovalContainer: {
    marginTop: 4,
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
  conditionDescriptionText: {
    fontSize: 11,
    color: '#FF9800',
    fontStyle: 'italic',
    marginTop: 4,
    paddingLeft: 6,
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
  rejectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  rejectedText: {
    fontSize: 12,
    color: '#D32F2F',
    fontWeight: '600',
    marginLeft: 4,
  },
  doctorNotesText: {
    fontSize: 11,
    color: '#4CAF50',
    fontStyle: 'italic',
    marginTop: 4,
    paddingLeft: 6,
  },
  rejectionReasonText: {
    fontSize: 11,
    color: '#D32F2F',
    fontStyle: 'italic',
    marginTop: 4,
    paddingLeft: 6,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 40,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976D2',
    marginTop: 12,
    marginBottom: 4,
  },
  emptySubtext: {
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
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
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
    flex: 1,
  },
  modalIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  modalCloseButton: {
    padding: 8,
  },
  modalSection: {
    marginBottom: 20,
  },
  modalSectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1976D2',
    marginBottom: 4,
  },
  modalSectionText: {
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 6,
  },
  inputHint: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  textArea: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#1A1A1A',
    minHeight: 80,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  secondaryButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#E0E0E0',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  primaryButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#1976D2',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  chatModalContainer: {
    width: '100%',
    height: '80%',
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
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
    borderRadius: 16,
  },
  patientBubble: {
    backgroundColor: '#1976D2',
  },
  doctorBubble: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  doctorMessageText: {
    color: '#1A1A1A',
  },
  patientMessageText: {
    color: '#fff',
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  doctorMessageTime: {
    color: '#666',
  },
  patientMessageTime: {
    color: '#fff',
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
    fontSize: 14,
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
});

export default RecordDetail;