import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  TextInput,
  Animated,
  Dimensions,
  Platform,
  StatusBar,
  SafeAreaView,
  RefreshControl,
  FlatList,
  KeyboardAvoidingView,
  Easing,
} from 'react-native';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import FlashMessage, { showMessage } from 'react-native-flash-message';

const { width: screenWidth } = Dimensions.get('window');
const API_BASE_URL = 'http://localhost:3000/api';

const COLORS = {
  primary: '#2563EB',
  secondary: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  background: '#F8FAFC',
  card: '#FFFFFF',
  text: '#1E293B',
  textLight: '#64748B',
  border: '#E2E8F0',
};

// ==================== TYPES ====================

interface User {
  _id: string;
  name: string;
  email: string;
  avatar?: string;
  phoneNumber?: string;
  dateOfBirth?: Date;
  gender?: string;
}

interface Doctor {
  _id: string;
  name: string;
  email: string;
  avatar?: string;
  specialty_id?: any;
}

interface TreatmentStep {
  _id?: string;
  stepNumber: number;
  title: string;
  description: string;
  status: string;
  medication?: string;
  dosage?: string;
  duration?: string;
  instructions?: string;
  isPhysicalVisit?: boolean;
  requires_followup?: boolean;
  followup_reason?: string;
  reExaminationDate?: Date;
  reExaminationAppointmentId?: string;
  approval_requested?: boolean;
  approval_requested_at?: Date;
  patient_message?: string;
  patientMessage?: string;
  condition_description?: string;
  doctorNotes?: string;
  createdAt?: Date;
  completedAt?: Date;
  approvedAt?: Date;
  rejectedAt?: Date;
}

interface Record {
  _id: string;
  user_id: User;
  doctor_id: Doctor;
  appointment_id?: any;
  diagnosis: string;
  symptoms?: string[];
  severity?: string;
  treatment_plan: TreatmentStep[];
  processes?: any[];
  current_step?: number;
  consultation_status: string;
  created_at: Date;
  updated_at: Date;
}

interface Message {
  _id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  message_type: string;
  read: boolean;
  timestamp: Date;
}

interface Appointment {
  _id: string;
  appointment_date: Date;
  time_slot: string;
  status: string;
  reason?: string;
  notes?: string;
  location?: string;
  clinic_location?: string;
  doctor_id: Doctor;
  user_id: User;
  created_at: Date;
}

// ==================== UI COMPONENTS ====================

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const config = useMemo(() => {
    const statusLower = status.toLowerCase();
    switch (statusLower) {
      case 'completed': 
        return { color: COLORS.secondary, icon: 'checkmark-circle', label: 'COMPLETED' };
      case 'approved': 
        return { color: COLORS.primary, icon: 'shield-checkmark', label: 'APPROVED' };
      case 'in-progress': 
      case 'in_progress': 
        return { color: COLORS.warning, icon: 'time', label: 'IN PROGRESS' };
      case 'scheduled': 
        return { color: '#8B5CF6', icon: 'calendar', label: 'SCHEDULED' };
      case 'pending': 
        return { color: '#94A3B8', icon: 'hourglass', label: 'PENDING' };
      default: 
        return { color: '#CBD5E1', icon: 'help-circle', label: status.toUpperCase() };
    }
  }, [status]);

  return (
    <View style={[styles.statusBadge, { backgroundColor: `${config.color}15` }]}>
      <Ionicons name={config.icon as any} size={12} color={config.color} />
      <Text style={[styles.statusBadgeText, { color: config.color }]}>{config.label}</Text>
    </View>
  );
};

const AppointmentInfoCard: React.FC<{ 
  appointment: Appointment | any, 
  step: TreatmentStep,
  onCheckIn?: () => void 
}> = ({ appointment, step, onCheckIn }) => {
  // Nếu không có appointment từ API, tạo từ step data
  const effectiveAppointment = appointment || (step.reExaminationDate ? {
    _id: `mock_${step.stepNumber}`,
    appointment_date: step.reExaminationDate,
    time_slot: "09:00", // Default time
    status: step.status === 'scheduled' ? 'scheduled' : 'confirmed',
    reason: step.followup_reason || step.description || "Re-examination",
    notes: step.doctorNotes || "",
    location: "Main Hospital",
    clinic_location: "Main Hospital - Room 101"
  } : null);

  if (!effectiveAppointment) return null;

  const appointmentDate = effectiveAppointment.appointment_date 
    ? new Date(effectiveAppointment.appointment_date)
    : step.reExaminationDate 
      ? new Date(step.reExaminationDate)
      : null;

  if (!appointmentDate) return null;

  const now = new Date();
  const isToday = appointmentDate.toDateString() === now.toDateString();
  const isPast = appointmentDate < now;
  const status = effectiveAppointment.status?.toLowerCase() || 'scheduled';

  // Get gradient colors based on status
  const getGradientColors = () => {
    if (isToday) return ['#F59E0B', '#D97706'];
    if (isPast) return ['#6B7280', '#4B5563'];
    
    switch (status) {
      case 'confirmed': return ['#10B981', '#059669'];
      case 'completed': return ['#3B82F6', '#2563EB'];
      case 'cancelled': return ['#EF4444', '#DC2626'];
      default: return ['#8B5CF6', '#7C3AED'];
    }
  };

  // Get title based on status
  const getTitle = () => {
    if (isToday) return "TODAY'S APPOINTMENT";
    switch (status) {
      case 'confirmed': return "CONFIRMED APPOINTMENT";
      case 'completed': return "COMPLETED VISIT";
      case 'cancelled': return "CANCELLED APPOINTMENT";
      default: return "SCHEDULED APPOINTMENT";
    }
  };

  // Format date
  const formattedDate = appointmentDate.toLocaleDateString('en-US', { 
    weekday: 'short',
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  });

  // Format time
  const timeSlot = effectiveAppointment.time_slot || 
                   appointmentDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <LinearGradient colors={getGradientColors()} style={styles.appointmentCard}>
      <View style={styles.appointmentHeader}>
        <MaterialCommunityIcons 
          name={isToday ? "calendar-today" : "calendar-clock"} 
          size={18} 
          color="#FFF" 
        />
        <Text style={styles.appointmentTitle}>{getTitle()}</Text>
      </View>
      
      <View style={styles.appointmentGrid}>
        <View style={styles.appointmentItem}>
          <Text style={styles.appointmentLabel}>DATE</Text>
          <Text style={styles.appointmentValue}>{formattedDate}</Text>
        </View>
        
        <View style={styles.appointmentItem}>
          <Text style={styles.appointmentLabel}>TIME</Text>
          <Text style={styles.appointmentValue}>{timeSlot}</Text>
        </View>
        
        <View style={styles.appointmentItem}>
          <Text style={styles.appointmentLabel}>STATUS</Text>
          <View style={[
            styles.statusBadgeSmall, 
            { 
              backgroundColor: status === 'confirmed' ? '#10B98120' : 
                             status === 'completed' ? '#3B82F620' : 
                             status === 'cancelled' ? '#EF444420' : '#F59E0B20'
            }
          ]}>
            <Text style={[
              styles.statusBadgeTextSmall,
              { 
                color: status === 'confirmed' ? '#10B981' : 
                       status === 'completed' ? '#3B82F6' : 
                       status === 'cancelled' ? '#EF4444' : '#F59E0B'
              }
            ]}>
              {status.toUpperCase()}
            </Text>
          </View>
        </View>
      </View>
      
      {(effectiveAppointment.location || effectiveAppointment.clinic_location) && (
        <View style={styles.locationRow}>
          <Ionicons name="location" size={12} color="#FFF" />
          <Text style={styles.locationText}>
            {effectiveAppointment.location || effectiveAppointment.clinic_location || 'Main Hospital'}
          </Text>
        </View>
      )}
      
      {effectiveAppointment.reason && (
        <View style={styles.reasonBox}>
          <Text style={styles.reasonLabel}>REASON</Text>
          <Text style={styles.reasonText}>{effectiveAppointment.reason}</Text>
        </View>
      )}

      {/* Check-in button for scheduled appointments */}
      {status === 'scheduled' && onCheckIn && !effectiveAppointment._id?.startsWith('mock_') && (
  <TouchableOpacity 
    style={styles.checkInButton}
    onPress={onCheckIn}
  >
    <Ionicons name="checkmark-circle" size={18} color="#FFF" />
    <Text style={styles.checkInText}>Confirm Check-in</Text>
  </TouchableOpacity>
)}


      {/* Status indicator for confirmed appointments */}
      {status === 'confirmed' && (
        <View style={styles.confirmedRow}>
          <Ionicons name="checkmark-circle" size={16} color="#10B981" />
          <Text style={styles.confirmedText}>Checked in - Waiting for doctor</Text>
        </View>
      )}

      {/* Hiển thị nếu là mock appointment */}
      {effectiveAppointment._id?.startsWith('mock_') && (
        <View style={styles.mockAppointmentNote}>
          <Ionicons name="information-circle" size={14} color="#FBBF24" />
          <Text style={styles.mockAppointmentNoteText}>
            Appointment details will be confirmed by the clinic
          </Text>
        </View>
      )}
    </LinearGradient>
  );
};

const TreatmentProtocolCard: React.FC<{ step: TreatmentStep }> = ({ step }) => {
  if (!step.createdAt) return null;
  
  const date = new Date(step.createdAt);
  return (
    <LinearGradient colors={['#3B82F6', '#2563EB']} style={styles.protocolCard}>
      <View style={styles.protocolHeader}>
        <MaterialCommunityIcons name="clipboard-pulse" size={18} color="#FFF" />
        <Text style={styles.protocolTitle}>TREATMENT PROTOCOL</Text>
      </View>
      <View style={styles.protocolGrid}>
        <View style={styles.protocolItem}>
          <Text style={styles.protocolLabel}>STARTED</Text>
          <Text style={styles.protocolValue}>
            {date.toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric', 
              year: 'numeric' 
            })}
          </Text>
        </View>
        <View style={styles.protocolItem}>
          <Text style={styles.protocolLabel}>DURATION</Text>
          <Text style={styles.protocolValue}>{step.duration || 'Flexible'}</Text>
        </View>
      </View>
      {step.medication && (
        <View style={styles.medicationBox}>
          <Text style={styles.medicationLabel}>MEDICATION</Text>
          <Text style={styles.medicationText}>{step.medication}</Text>
        </View>
      )}
    </LinearGradient>
  );
};

const ScheduledStepCard: React.FC<{
  step: TreatmentStep;
  appointment: any;
  index: number;
  onCheckIn?: () => void;
  loading: boolean;
  totalSteps: number;
}> = ({ step, appointment, index, onCheckIn, loading, totalSteps }) => {
  return (
    <View key={step._id || index} style={styles.timelineItem}>
      {/* Timeline connector */}
      <View style={styles.timelineLeft}>
        <View style={[
          styles.timelineDot, 
          { 
            backgroundColor: '#8B5CF6' // Purple for scheduled
          }
        ]} />
        {index !== totalSteps - 1 && <View style={styles.timelineConnector} />}
      </View>
            {/* Step content */}
      <View style={[styles.stepCard]}>
        <View style={styles.stepHeader}>
          <Text style={styles.stepNumber}>PHASE {step.stepNumber}</Text>
          <StatusBadge status={step.status} />
        </View>
        
        <Text style={styles.stepTitle}>{step.title}</Text>
        <Text style={styles.stepDescription}>{step.description}</Text>

        {/* Luôn hiển thị appointment info cho scheduled steps */}
        <AppointmentInfoCard 
          appointment={appointment}
          step={step}
          onCheckIn={appointment?.status === 'scheduled' ? onCheckIn : undefined}
        />

        {/* Action buttons */}
        {step.status === 'scheduled' && appointment?.status === 'scheduled' && !appointment?._id?.startsWith('mock_') && (
          <View style={styles.stepActions}>
            <TouchableOpacity 
              style={styles.primaryButton}
              onPress={onCheckIn}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>Check-in at Appointment</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Doctor notes */}
        {step.doctorNotes && (
          <View style={styles.doctorNotes}>
            <Text style={styles.doctorNotesLabel}>DOCTOR FEEDBACK</Text>
            <Text style={styles.doctorNotesText}>{step.doctorNotes}</Text>
          </View>
        )}
      </View>
    </View>
  );
};

// ==================== MAIN COMPONENT ====================

const MedicalRecordDetail: React.FC = () => {
  const route = useRoute<any>();
  const navigation = useNavigation();
  
  const initialRecord = route.params?.record;
  const [record, setRecord] = useState<Record>(initialRecord);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [stepAppointments, setStepAppointments] = useState<Record<string, any>>({});
  const [showChat, setShowChat] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [selectedStep, setSelectedStep] = useState<TreatmentStep | null>(null);
  const [conditionDesc, setConditionDesc] = useState('');
  const [patientMsg, setPatientMsg] = useState('');
  const [directAppointments, setDirectAppointments] = useState<any[]>([]);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Memoized values
  const completionPercentage = useMemo(() => {
    if (!record?.treatment_plan?.length) return 0;
    const completedSteps = record.treatment_plan.filter(step => 
      ['approved', 'completed'].includes(step.status.toLowerCase())
    );
    return (completedSteps.length / record.treatment_plan.length) * 100;
  }, [record]);

  const severityColor = useMemo(() => {
    const severity = record.severity?.toLowerCase() || 'moderate';
    switch (severity) {
      case 'mild': return '#FBBF24';
      case 'severe': return '#EF4444';
      case 'critical': return '#7F1D1D';
      default: return '#F59E0B';
    }
  }, [record.severity]);

  // API Functions
  const getAuthHeaders = async () => {
    const token = await AsyncStorage.getItem('authToken');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  };

  const fetchRecordDetails = async () => {
    try {
      setLoading(true);
      const headers = await getAuthHeaders();
      const res = await axios.get(`${API_BASE_URL}/medical-records/my-records`, { headers });
      
      if (res.data && Array.isArray(res.data)) {
        const current = res.data.find((r: Record) => r._id === record._id);
        if (current) {
          setRecord(current);
          await fetchAllAppointments(current);
        }
      }
    } catch (error: any) {
      console.error('Failed to fetch record:', error);
      if (error.response?.status === 401) {
        showMessage({ message: "Session expired. Please login again.", type: "danger" });
        navigation.navigate('Login');
      } else {
        showMessage({ message: "Failed to load record details", type: "danger" });
      }
    } finally {
      setLoading(false);
    }
  };

 const fetchAllAppointments = async (currentRecord: Record) => {
  try {
    const headers = await getAuthHeaders();
    // 1. Fetch appointments từ API re-examination
    try {
      const reExamRes = await axios.get(
        `${API_BASE_URL}/medical-records/${currentRecord._id}/re-examination/appointments`,
        { headers }
      );

      if (reExamRes.data?.success && reExamRes.data.data?.stepAppointments) {
        const appointments: Record<string, any> = {};
        reExamRes.data.data.stepAppointments.forEach((item: any) => {
          if (item.appointment) {
            appointments[item.stepNumber] = item.appointment;
            console.log(`✅ Mapped re-examination appointment for step ${item.stepNumber}:`, {
              appointmentId: item.appointment._id,
              date: item.appointment.appointment_date,
              doctorId: item.appointment.doctor_id?._id,
              doctorName: item.appointment.doctor_id?.name,
              reason: item.appointment.reason,
              status: item.appointment.status
            });
          }
        });
        setStepAppointments(appointments);
      } else {
        console.log('⚠️ No re-examination appointments found in API response');
      }
    } catch (reExamError) {
      console.log('⚠️ Re-examination API error:', reExamError.message);
    }

    // 2. Fetch tất cả appointments của user để tìm appointment phù hợp
    try {
      const allAppointmentsRes = await axios.get(
        `${API_BASE_URL}/patient/appointments/history`,
        { headers }
      );

      if (allAppointmentsRes.data && Array.isArray(allAppointmentsRes.data)) {
        console.log(`📊 Total appointments fetched: ${allAppointmentsRes.data.length}`);
        
        // Log tất cả appointments để debug
        allAppointmentsRes.data.forEach((app, index) => {
          console.log(`Appointment ${index + 1}:`, {
            id: app._id,
            date: app.appointment_date,
            reason: app.reason,
            status: app.status,
            doctorId: app.doctor_id?._id,
            doctorName: app.doctor_id?.name,
            patientId: app.user_id?._id || app.user_id,
            is_re_examination: app.is_re_examination
          });
        });
        
        setDirectAppointments(allAppointmentsRes.data);
        
        // Tự động map appointments với scheduled steps
        const newAppointments = { ...stepAppointments };
        let updated = false;
        
        currentRecord.treatment_plan.forEach(step => {
          // CHỈ TÌM APPOINTMENT CHO CÁC STEP CÓ STATUS 'scheduled'
          if (step.status.toLowerCase() === 'scheduled' && !newAppointments[step.stepNumber]) {
            const matchedAppointment = findMatchingAppointment(step, allAppointmentsRes.data, currentRecord);
            if (matchedAppointment) {
              newAppointments[step.stepNumber] = matchedAppointment;
              updated = true;
              console.log(`🔗 Auto-matched appointment for step ${step.stepNumber}:`, {
                appointmentId: matchedAppointment._id,
                date: matchedAppointment.appointment_date,
                reason: matchedAppointment.reason,
                status: matchedAppointment.status,
                doctorId: matchedAppointment.doctor_id?._id,
                doctorName: matchedAppointment.doctor_id?.name
              });
            }
          }
        });
        
        if (updated) {
          setStepAppointments(newAppointments);
        }
      }
    } catch (appointmentsError) {
      console.error('Error fetching all appointments:', appointmentsError);
    }

  } catch (error) {
    console.error('Error in fetchAllAppointments:', error);
  }
};

const findMatchingAppointment = (step: TreatmentStep, appointments: any[], currentRecord: Record): any => {
  console.log(`🔍 Finding appointment for step ${step.stepNumber} - ${step.title}`);
  console.log(`📅 Step reExaminationDate: ${step.reExaminationDate}`);
  console.log(`🆔 Current Record Info:`, {
    recordId: currentRecord._id,
    doctorId: currentRecord.doctor_id._id,
    doctorName: currentRecord.doctor_id.name,
    patientId: currentRecord.user_id._id,
    stepId: step._id
  });

  // Tạo unique key cho step trong record này
  const stepUniqueKey = `${currentRecord._id}-${step.stepNumber}`;
  
  console.log(`🔑 Step Unique Key: ${stepUniqueKey}`);

  // **ƯU TIÊN 1: Tìm bằng unique key trong metadata**
  const matchedByUniqueKey = appointments.find(app => {
    const isMatch = app.metadata?.step_unique_key === stepUniqueKey ||
                   app.metadata?.medical_record_id === currentRecord._id && 
                   app.metadata?.step_number === step.stepNumber;
    
    console.log(`   Appointment ${app._id}: uniqueKey match = ${isMatch}`, {
      app_unique_key: app.metadata?.step_unique_key,
      app_medical_record_id: app.metadata?.medical_record_id,
      app_step_number: app.metadata?.step_number
    });
    
    return isMatch;
  });
  
  if (matchedByUniqueKey) {
    console.log(`✅ Matched by unique key: ${matchedByUniqueKey._id}`);
    return matchedByUniqueKey;
  }

  // **ƯU TIÊN 2: Tìm bằng reExaminationAppointmentId**
  if (step.reExaminationAppointmentId) {
    console.log(`🔍 Strategy 2: Looking for appointment with reExaminationAppointmentId`);
    
    const directMatch = appointments.find(app => {
      const match = app._id === step.reExaminationAppointmentId;
      console.log(`   Appointment ${app._id}: direct ID match = ${match}`);
      return match;
    });
    
    if (directMatch) {
      console.log(`✅ Direct appointment ID match: ${directMatch._id}`);
      return directMatch;
    }
  }

  // **ƯU TIÊN 3: Tìm bằng re_examination_step_id (có thể đã được fix)**
  if (step._id) {
    console.log(`🔍 Strategy 3: Looking for appointment with re_examination_step_id = ${step._id}`);
    
    const directStepMatch = appointments.find(app => {
      const stepIdMatch = app.re_examination_step_id?.toString() === step._id?.toString();
      console.log(`   Appointment ${app._id}: stepId match = ${stepIdMatch} (${app.re_examination_step_id} vs ${step._id})`);
      return stepIdMatch;
    });
    
    if (directStepMatch) {
      console.log(`✅ Direct step ID match: ${directStepMatch._id} (re_examination_step_id: ${directStepMatch.re_examination_step_id})`);
      return directStepMatch;
    }
  }

  // **ƯU TIÊN 4: Tìm theo lý do có chứa medical record ID**
  const recordIdShort = currentRecord._id.slice(-6);
  console.log(`🔍 Strategy 4: Looking for appointment with record ID: ${recordIdShort}`);
  
  const matchedByRecordId = appointments.find(app => {
    const reasonMatches = app.reason?.includes(recordIdShort) || 
                         app.reason?.includes(currentRecord._id);
    const notesMatches = app.notes?.includes(recordIdShort) || 
                        app.notes?.includes(currentRecord._id);
    
    console.log(`   Appointment ${app._id}: record match = ${reasonMatches || notesMatches}`, {
      reason: app.reason,
      notes: app.notes
    });
    
    return reasonMatches || notesMatches;
  });
  
  if (matchedByRecordId) {
    console.log(`✅ Matched by record ID: ${matchedByRecordId._id}`);
    return matchedByRecordId;
  }

  console.log(`❌ No appointment found for step ${step.stepNumber}`);
  
  // Debug: Log tất cả appointments
  console.log('📋 All available appointments:');
  appointments.forEach((app, index) => {
    console.log(`   ${index + 1}. ${app._id}:`, {
      date: app.appointment_date,
      reason: app.reason,
      is_re_examination: app.is_re_examination,
      re_examination_step_id: app.re_examination_step_id,
      metadata: app.metadata,
      step_unique_key: app.metadata?.step_unique_key
    });
  });
  
  return null;
};

  const loadMessages = async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await axios.get(`${API_BASE_URL}/messages/record/${record._id}`, { headers });
      setMessages(res.data?.data?.messages || []);
    } catch (error: any) {
      console.error('Failed to load messages:', error);
    }
  };

  const handleSendChat = async () => {
    if (!newMessage.trim()) return;
    
    try {
      const headers = await getAuthHeaders();
      await axios.post(
        `${API_BASE_URL}/messages/send`,
        {
          receiver_id: record.doctor_id._id,
          message: newMessage,
          medical_record_id: record._id,
          message_type: 'text'
        },
        { headers }
      );
      
      setNewMessage('');
      loadMessages();
      showMessage({ message: "Message sent", type: "success" });
    } catch (error) {
      console.error('Failed to send message:', error);
      showMessage({ message: "Failed to send message", type: "danger" });
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchRecordDetails();
    setRefreshing(false);
  };

  const handleStepAction = async (action: 'activate' | 'complete' | 'confirm', stepNumber: number) => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      let url = '';
      let payload = {};

      switch (action) {
        case 'activate':
          url = `${API_BASE_URL}/medical-records/${record._id}/steps/${stepNumber}/activate`;
          break;
        case 'complete':
          url = `${API_BASE_URL}/medical-records/${record._id}/steps/${stepNumber}/complete-with-message`;
          payload = { patientMessage: patientMsg, conditionDescription: conditionDesc };
          break;
        case 'confirm':
          const appointment = stepAppointments[stepNumber];
          if (appointment && !appointment._id?.startsWith('mock_')) {
            url = `${API_BASE_URL}/appointments/${appointment._id}/check-in`;
          } else {
            throw new Error('No real appointment found for this step');
          }
          break;
      }

      if (!url) {
        throw new Error('Invalid action or missing URL');
      }

      await axios.patch(url, payload, { headers });
      
      showMessage({ message: "Action completed successfully", type: "success" });
      
      if (action === 'complete') {
        setShowReport(false);
        setConditionDesc('');
        setPatientMsg('');
      }
      
      await fetchRecordDetails();
    } catch (error: any) {
      console.error('Action failed:', error);
      showMessage({ 
        message: error.response?.data?.message || "Operation failed", 
        type: "danger" 
      });
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = (step: TreatmentStep, index: number) => {
    const appointment = stepAppointments[step.stepNumber];
    const isScheduled = step.status.toLowerCase() === 'scheduled';
    const isInProgress = step.status.toLowerCase() === 'in-progress' || step.status.toLowerCase() === 'in_progress';

    console.log(`🔍 Step ${step.stepNumber} - ${step.title}`, {
      hasAppointment: !!appointment,
      appointmentData: appointment,
      isScheduled,
      stepStatus: step.status,
      stepDescription: step.description
    });

    // NẾU LÀ SCHEDULED - luôn hiển thị appointment card
    if (isScheduled) {
      return (
        <ScheduledStepCard
          key={step._id || index}
          step={step}
          appointment={appointment}
          index={index}
          onCheckIn={() => handleStepAction('confirm', step.stepNumber)}
          loading={loading}
        />
      );
    }

    // NẾU KHÔNG PHẢI SCHEDULED - hiển thị bình thường
    return (
      <View key={step._id || index} style={styles.timelineItem}>
        {/* Timeline connector */}
        <View style={styles.timelineLeft}>
          <View style={[
            styles.timelineDot, 
            { 
              backgroundColor: isInProgress ? COLORS.warning : 
                              step.status === 'completed' || step.status === 'approved' ? COLORS.secondary : COLORS.border
            }
          ]} />
          {index !== record.treatment_plan.length - 1 && <View style={styles.timelineConnector} />}
        </View>

        {/* Step content */}
        <View style={[styles.stepCard, isInProgress && styles.activeStepBorder]}>
          <View style={styles.stepHeader}>
            <Text style={styles.stepNumber}>PHASE {step.stepNumber}</Text>
            <StatusBadge status={step.status} />
          </View>
          
          <Text style={styles.stepTitle}>{step.title}</Text>
          <Text style={styles.stepDescription}>{step.description}</Text>

          {/* Show treatment protocol for non-scheduled steps */}
          {step.createdAt && !isScheduled && (
            <TreatmentProtocolCard step={step} />
          )}

          {/* Show visit info for completed physical visits */}
          {!isScheduled && step.reExaminationDate && (
            <LinearGradient colors={['#10B981', '#059669']} style={styles.completedVisitCard}>
              <View style={styles.completedVisitHeader}>
                <MaterialCommunityIcons name="calendar-check" size={18} color="#FFF" />
                <Text style={styles.completedVisitTitle}>VISIT COMPLETED</Text>
              </View>
              <Text style={styles.completedVisitDate}>
                {new Date(step.reExaminationDate).toLocaleDateString('en-US', { 
                  month: 'long', 
                  day: 'numeric', 
                  year: 'numeric' 
                })}
              </Text>
            </LinearGradient>
          )}

          {/* Action buttons */}
          <View style={styles.stepActions}>
            {step.status === 'pending' && (
              <TouchableOpacity 
                style={styles.primaryButton}
                onPress={() => handleStepAction('activate', step.stepNumber)}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={styles.primaryButtonText}>Start This Phase</Text>
                )}
              </TouchableOpacity>
            )}
            
            {step.status === 'in-progress' && (
              <TouchableOpacity 
                style={styles.secondaryButton}
                onPress={() => {
                  setSelectedStep(step);
                  setShowReport(true);
                }}
                disabled={loading}
              >
                <Text style={styles.secondaryButtonText}>Submit Health Report</Text>
              </TouchableOpacity>
            )}
          </View>
          
          {/* Doctor notes */}
          {step.doctorNotes && (
            <View style={styles.doctorNotes}>
              <Text style={styles.doctorNotesLabel}>DOCTOR FEEDBACK</Text>
              <Text style={styles.doctorNotesText}>{step.doctorNotes}</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  // Effects
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 50, useNativeDriver: true })
    ]).start();

    Animated.timing(progressAnim, {
      toValue: completionPercentage,
      duration: 1000,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
      useNativeDriver: false
    }).start();
  }, [completionPercentage]);

  useFocusEffect(
    useCallback(() => {
      if (record?._id) {
        fetchRecordDetails();
      }
    }, [record?._id])
  );

  if (!record) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading treatment details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <FlashMessage position="top" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Text style={styles.headerTitleText}>Treatment Journey</Text>
          <Text style={styles.recordId}>ID: #{record._id.slice(-6).toUpperCase()}</Text>
        </View>
        <TouchableOpacity 
          onPress={() => { setShowChat(true); loadMessages(); }} 
          style={styles.iconButton}
        >
          <Ionicons name="chatbubbles-outline" size={22} color={COLORS.primary} />
          {messages.filter(m => m.sender_id !== record.user_id._id && !m.read).length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {messages.filter(m => m.sender_id !== record.user_id._id && !m.read).length}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView 
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Progress card */}
        <Animated.View style={[styles.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.progressHeader}>
            <View>
              <Text style={styles.progressLabel}>OVERALL COMPLETION</Text>
              <Text style={styles.progressValue}>{Math.round(completionPercentage)}%</Text>
              <Text style={styles.progressSubtitle}>
                {record.treatment_plan?.filter(s => 
                  ['approved', 'completed'].includes(s.status.toLowerCase())
                ).length} of {record.treatment_plan?.length} phases completed
              </Text>
            </View>
            <MaterialCommunityIcons name="progress-check" size={32} color={COLORS.primary} />
          </View>
          <View style={styles.progressBar}>
            <Animated.View style={[styles.progressFill, { 
              width: progressAnim.interpolate({ 
                inputRange: [0, 100], 
                outputRange: ['0%', '100%'] 
              }) 
            }]} />
          </View>
        </Animated.View>

        {/* Diagnosis card */}
        <View style={styles.card}>
          <View style={styles.diagnosisHeader}>
            <View style={[styles.severityDot, { backgroundColor: severityColor }]} />
            <Text style={styles.diagnosisTitle}>Diagnosis</Text>
            <View style={[styles.severityTag, { backgroundColor: `${severityColor}20` }]}>
              <Text style={[styles.severityTagText, { color: severityColor }]}>
                {record.severity?.toUpperCase() || 'MODERATE'}
              </Text>
            </View>
          </View>
          <Text style={styles.diagnosisText}>{record.diagnosis}</Text>
          <View style={styles.doctorInfo}>
            <Ionicons name="medical" size={12} color={COLORS.textLight} />
            <Text style={styles.doctorName}>Supervised by Dr. {record.doctor_id?.name || 'Unknown'}</Text>
          </View>
        </View>

        {/* Treatment phases */}
        <Text style={styles.sectionTitle}>Treatment Phases</Text>
        {record.treatment_plan?.map((step, index) => renderStepContent(step, index))}
        
        {/* Debug section (chỉ hiển thị trong development) */}
        {__DEV__ && (
          <View style={styles.debugSection}>
            <Text style={styles.debugTitle}>Debug Info</Text>
            <Text style={styles.debugText}>
              Step 2 Status: {record.treatment_plan[1]?.status || 'N/A'}
            </Text>
            <Text style={styles.debugText}>
              Has Appointment: {stepAppointments[2] ? 'Yes' : 'No'}
            </Text>
            <Text style={styles.debugText}>
              Total Direct Appointments: {directAppointments.length}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Health report modal */}
      <Modal visible={showReport} animationType="slide" transparent>
        <BlurView intensity={30} style={styles.modalOverlay}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
            style={styles.modalContainer}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Daily Progress Report</Text>
                <TouchableOpacity onPress={() => setShowReport(false)}>
                  <Ionicons name="close" size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>
              
              <Text style={styles.inputLabel}>How are you feeling? (Required)</Text>
              <TextInput 
                style={styles.textInput}
                multiline
                placeholder="Describe any symptoms or changes..."
                value={conditionDesc}
                onChangeText={setConditionDesc}
              />

              <Text style={styles.inputLabel}>Message for Doctor (Optional)</Text>
              <TextInput 
                style={[styles.textInput, { height: 80 }]}
                multiline
                placeholder="Ask questions or leave comments..."
                value={patientMsg}
                onChangeText={setPatientMsg}
              />

              <TouchableOpacity 
                style={[styles.submitButton, (!conditionDesc || loading) && styles.disabledButton]}
                disabled={!conditionDesc || loading}
                onPress={() => selectedStep && handleStepAction('complete', selectedStep.stepNumber)}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.submitButtonText}>Submit Report</Text>
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </BlurView>
      </Modal>

      {/* Chat modal */}
      <Modal visible={showChat} animationType="slide">
        <SafeAreaView style={styles.chatContainer}>
          <View style={styles.chatHeader}>
            <TouchableOpacity onPress={() => setShowChat(false)} style={styles.chatBackButton}>
              <Ionicons name="chevron-down" size={28} color={COLORS.text} />
            </TouchableOpacity>
            <View>
              <Text style={styles.chatDoctorName}>Dr. {record.doctor_id?.name || 'Unknown'}</Text>
              <Text style={styles.chatStatus}>Professional Medical Chat</Text>
            </View>
          </View>

          <FlatList 
            data={messages}
            keyExtractor={(item) => item._id || Math.random().toString()}
            contentContainerStyle={styles.chatList}
            renderItem={({ item }) => (
              <View style={[
                styles.messageBubble, 
                item.sender_id === record.user_id._id ? styles.myMessage : styles.otherMessage
              ]}>
                <Text style={[
                  styles.messageText, 
                  item.sender_id === record.user_id._id ? styles.myMessageText : styles.otherMessageText
                ]}>{item.message}</Text>
                <Text style={styles.messageTime}>
                  {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            )}
            ListEmptyComponent={
              <Text style={styles.emptyChat}>No messages yet. Start the conversation!</Text>
            }
          />

          <View style={styles.chatInputContainer}>
            <TextInput 
              style={styles.chatInput}
              placeholder="Type your message..."
              value={newMessage}
              onChangeText={setNewMessage}
              multiline
            />
            <TouchableOpacity 
              style={[styles.sendButton, !newMessage.trim() && styles.disabledSendButton]} 
              onPress={handleSendChat}
              disabled={!newMessage.trim()}
            >
              <Ionicons name="send" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

// ==================== STYLES ====================

const styles = StyleSheet.create({
  // Container & Layout
  container: { 
    flex: 1, 
    backgroundColor: COLORS.background 
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    color: COLORS.textLight,
  },
  
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  iconButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  headerTitle: {
    alignItems: 'center',
  },
  headerTitleText: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
  },
  recordId: {
    fontSize: 12,
    color: COLORS.textLight,
    fontWeight: '500',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: COLORS.danger,
    borderRadius: 10,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  
  // Scroll Content
  scrollContent: { 
    padding: 20, 
    paddingBottom: 60 
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 20,
    marginTop: 10,
  },
  
  // Card Styles
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  
  // Progress Card
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textLight,
    letterSpacing: 0.5,
  },
  progressValue: {
    fontSize: 32,
    fontWeight: '900',
    color: COLORS.text,
    marginTop: 4,
  },
  progressSubtitle: {
    fontSize: 13,
    color: COLORS.textLight,
    marginTop: 4,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
  },
  
  // Diagnosis Card
  diagnosisHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  severityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  diagnosisTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
    flex: 1,
  },
  severityTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  severityTagText: {
    fontSize: 10,
    fontWeight: '800',
  },
  diagnosisText: {
    fontSize: 15,
    color: '#334155',
    lineHeight: 22,
    marginBottom: 16,
  },
  doctorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  doctorName: {
    fontSize: 13,
    color: COLORS.textLight,
    fontWeight: '600',
    marginLeft: 6,
  },
  
  // Timeline
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  timelineLeft: {
    width: 40,
    alignItems: 'center',
  },
  timelineDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 3,
    borderColor: '#FFF',
    zIndex: 2,
    marginTop: 20,
  },
  timelineConnector: {
    position: 'absolute',
    top: 30,
    bottom: -20,
    width: 2,
    backgroundColor: COLORS.border,
  },
  
  // Step Card
  stepCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  activeStepBorder: {
    borderColor: COLORS.primary,
    borderWidth: 2,
  },
  stepHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  stepNumber: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textLight,
    letterSpacing: 0.5,
  },
  stepTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 6,
  },
  stepDescription: {
    fontSize: 14,
    color: COLORS.textLight,
    lineHeight: 20,
    marginBottom: 16,
  },
  stepActions: {
    marginTop: 16,
  },
  
  // Status Badge
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  statusBadgeSmall: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  statusBadgeTextSmall: {
    fontSize: 9,
    fontWeight: '800',
  },
  
  // Appointment Card
  appointmentCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  appointmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  appointmentTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 0.5,
  },
  appointmentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  appointmentItem: {
    minWidth: '45%',
  },
  appointmentLabel: {
    fontSize: 10,
    color: '#DBEAFE',
    fontWeight: '700',
    marginBottom: 2,
  },
  appointmentValue: {
    fontSize: 15,
    color: '#FFF',
    fontWeight: '700',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 6,
  },
  locationText: {
    fontSize: 12,
    color: '#FFF',
    fontWeight: '500',
  },
  reasonBox: {
    marginTop: 10,
    padding: 8,
    backgroundColor: '#FFFFFF20',
    borderRadius: 6,
  },
  reasonLabel: {
    fontSize: 9,
    color: '#DBEAFE',
    fontWeight: '700',
    marginBottom: 2,
  },
  reasonText: {
    fontSize: 12,
    color: '#FFF',
    fontWeight: '400',
  },
  checkInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  checkInText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },
  confirmedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 8,
    backgroundColor: '#10B98120',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#10B98140',
  },
  confirmedText: {
    color: '#10B981',
    fontWeight: '600',
    fontSize: 13,
  },
  mockAppointmentNote: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    padding: 8,
    backgroundColor: '#FEF3C720',
    borderRadius: 6,
    gap: 6,
  },
  mockAppointmentNoteText: {
    fontSize: 11,
    color: '#92400E',
    fontWeight: '500',
    flex: 1,
  },
  
  // Treatment Protocol Card
  protocolCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  protocolHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  protocolTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 0.5,
  },
  protocolGrid: {
    flexDirection: 'row',
    gap: 20,
  },
  protocolItem: {
    flex: 1,
  },
  protocolLabel: {
    fontSize: 10,
    color: '#DBEAFE',
    fontWeight: '700',
    marginBottom: 2,
  },
  protocolValue: {
    fontSize: 15,
    color: '#FFF',
    fontWeight: '700',
  },
  medicationBox: {
    marginTop: 10,
    padding: 8,
    backgroundColor: '#FFFFFF20',
    borderRadius: 6,
  },
  medicationLabel: {
    fontSize: 9,
    color: '#DBEAFE',
    fontWeight: '700',
    marginBottom: 2,
  },
  medicationText: {
    fontSize: 12,
    color: '#FFF',
    fontWeight: '400',
  },
  
  // Completed Visit Card
  completedVisitCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  completedVisitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  completedVisitTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 0.5,
  },
  completedVisitDate: {
    fontSize: 15,
    color: '#FFF',
    fontWeight: '700',
  },
  
  // Doctor Notes
  doctorNotes: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#0EA5E9',
  },
  doctorNotesLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0369A1',
    marginBottom: 4,
  },
  doctorNotesText: {
    fontSize: 13,
    color: '#075985',
    fontStyle: 'italic',
  },
  
  // Buttons
  primaryButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },
  secondaryButton: {
    backgroundColor: '#EFF6FF',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  secondaryButtonText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 14,
  },
  
  // Debug Section
  debugSection: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: 12,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#FBBF24',
  },
  debugTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 8,
  },
  debugText: {
    fontSize: 11,
    color: '#92400E',
    marginBottom: 4,
  },
  
  // Modal Styles
  modalOverlay: { 
    flex: 1, 
    justifyContent: 'flex-end' 
  },
  modalContainer: { 
    flex: 1, 
    justifyContent: 'flex-end' 
  },
  modalContent: { 
    backgroundColor: '#FFF', 
    borderTopLeftRadius: 24, 
    borderTopRightRadius: 24, 
    padding: 24,
    maxHeight: '80%',
  },
  modalHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 20 
  },
  modalTitle: { 
    fontSize: 20, 
    fontWeight: '800', 
    color: COLORS.text 
  },
  inputLabel: { 
    fontSize: 14, 
    fontWeight: '700', 
    color: COLORS.text, 
    marginBottom: 8, 
    marginTop: 16 
  },
  textInput: { 
    backgroundColor: '#F1F5F9', 
    borderRadius: 12, 
    padding: 14, 
    fontSize: 15, 
    height: 100, 
    textAlignVertical: 'top' 
  },
  submitButton: { 
    backgroundColor: COLORS.primary, 
    padding: 16, 
    borderRadius: 12, 
    alignItems: 'center', 
    marginTop: 24 
  },
  submitButtonText: { 
    color: '#FFF', 
    fontWeight: '800', 
    fontSize: 16 
  },
  disabledButton: { 
    opacity: 0.5 
  },
  
  // Chat Styles
  chatContainer: { 
    flex: 1, 
    backgroundColor: '#FFF' 
  },
  chatHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 16, 
    borderBottomWidth: 1, 
    borderBottomColor: COLORS.border 
  },
  chatBackButton: { 
    marginRight: 16 
  },
  chatDoctorName: { 
    fontSize: 18, 
    fontWeight: '700', 
    color: COLORS.text 
  },
  chatStatus: { 
    fontSize: 12, 
    color: COLORS.secondary, 
    fontWeight: '600' 
  },
  chatList: { 
    padding: 16 
  },
  messageBubble: { 
    maxWidth: '80%', 
    padding: 12, 
    borderRadius: 18, 
    marginBottom: 12 
  },
  myMessage: { 
    alignSelf: 'flex-end', 
    backgroundColor: COLORS.primary, 
    borderBottomRightRadius: 4 
  },
  otherMessage: { 
    alignSelf: 'flex-start', 
    backgroundColor: '#F1F5F9', 
    borderBottomLeftRadius: 4 
  },
  messageText: { 
    fontSize: 15, 
    lineHeight: 22 
  },
  myMessageText: { 
    color: '#FFF' 
  },
  otherMessageText: { 
    color: COLORS.text 
  },
  messageTime: { 
    fontSize: 10, 
    marginTop: 5, 
    opacity: 0.6, 
    alignSelf: 'flex-end' 
  },
  emptyChat: { 
    textAlign: 'center', 
    marginTop: 100, 
    color: COLORS.textLight 
  },
  chatInputContainer: { 
    flexDirection: 'row', 
    padding: 16, 
    borderTopWidth: 1, 
    borderTopColor: COLORS.border, 
    alignItems: 'flex-end', 
    gap: 12 
  },
  chatInput: { 
    flex: 1, 
    backgroundColor: '#F8FAFC', 
    borderRadius: 24, 
    paddingHorizontal: 16, 
    paddingVertical: 10, 
    fontSize: 15, 
    maxHeight: 100 
  },
  sendButton: { 
    width: 44, 
    height: 44, 
    borderRadius: 22, 
    backgroundColor: COLORS.primary, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  disabledSendButton: { 
    backgroundColor: '#E2E8F0' 
  },
});

export default MedicalRecordDetail;