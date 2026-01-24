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
} from 'react-native';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import FlashMessage, { showMessage } from 'react-native-flash-message';

const { width: screenWidth } = Dimensions.get('window');
const API_BASE_URL = 'http://localhost:3000/api';

// ==================== PATIENT-FRIENDLY COLOR PALETTE ====================
const COLORS = {
  primary: '#4A90E2',        // Soft blue
  secondary: '#5CB85C',      // Fresh green
  accent: '#FFB74D',         // Warm orange-yellow
  danger: '#E57373',         // Soft red, not harsh
  background: '#F5F7FA',     // Soft gray-white background
  card: '#FFFFFF',           // Pure white
  text: '#2C3E50',           // Dark gray-black
  textLight: '#7F8C8D',      // Light gray
  border: '#E0E6ED',         // Light border
  success: '#81C784',        // Success green
  warning: '#FFD54F',        // Warning yellow
  info: '#64B5F6',           // Info blue
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

// ==================== HELPER COMPONENTS ====================

const IconWithLabel: React.FC<{ icon: string; label: string; color?: string }> = ({ 
  icon, 
  label, 
  color = COLORS.primary 
}) => (
  <View style={styles.iconLabelContainer}>
    <View style={[styles.iconCircle, { backgroundColor: `${color}15` }]}>
      <Ionicons name={icon as any} size={28} color={color} />
    </View>
    <Text style={styles.iconLabel}>{label}</Text>
  </View>
);

const SimpleStatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const config = useMemo(() => {
    const statusLower = status.toLowerCase();
    switch (statusLower) {
      case 'completed':
      case 'approved':
        return { color: COLORS.success, icon: 'checkmark-circle', label: 'Completed' };
      case 'in-progress':
      case 'in_progress':
        return { color: COLORS.warning, icon: 'time-outline', label: 'In Progress' };
      case 'scheduled':
        return { color: COLORS.info, icon: 'calendar-outline', label: 'Scheduled' };
      case 'pending':
        return { color: COLORS.textLight, icon: 'hourglass-outline', label: 'Pending' };
      default:
        return { color: COLORS.textLight, icon: 'help-circle-outline', label: 'Unknown' };
    }
  }, [status]);

  return (
    <View style={[styles.statusBadge, { backgroundColor: config.color }]}>
      <Ionicons name={config.icon as any} size={18} color="#FFF" />
      <Text style={styles.statusBadgeText}>{config.label}</Text>
    </View>
  );
};

const SimpleAppointmentCard: React.FC<{
  appointment: Appointment | any;
  step: TreatmentStep;
  onCheckIn?: () => void;
}> = ({ appointment, step, onCheckIn }) => {
  const effectiveAppointment = appointment || (step.reExaminationDate ? {
    _id: `mock_${step.stepNumber}`,
    appointment_date: step.reExaminationDate,
    time_slot: "09:00",
    status: step.status === 'scheduled' ? 'scheduled' : 'confirmed',
    reason: step.followup_reason || step.description || "Follow-up Examination",
    notes: step.doctorNotes || "",
    location: "Clinic",
    clinic_location: "Clinic - Room 101"
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

  const formattedDate = appointmentDate.toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const timeSlot = effectiveAppointment.time_slot ||
    appointmentDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const cardColor = isToday ? COLORS.accent : status === 'confirmed' ? COLORS.success : COLORS.info;

  return (
    <View style={[styles.appointmentCard, { borderLeftColor: cardColor }]}>
      <View style={styles.appointmentHeader}>
        <Ionicons 
          name={isToday ? "today" : "calendar"} 
          size={24} 
          color={cardColor} 
        />
        <Text style={styles.appointmentTitle}>
          {isToday ? "🔔 Today's Appointment" : "📅 Follow-up Appointment"}
        </Text>
      </View>

      <View style={styles.appointmentRow}>
        <Text style={styles.appointmentLabel}>Date:</Text>
        <Text style={styles.appointmentValue}>{formattedDate}</Text>
      </View>

      <View style={styles.appointmentRow}>
        <Text style={styles.appointmentLabel}>Time:</Text>
        <Text style={styles.appointmentValue}>{timeSlot}</Text>
      </View>

      {effectiveAppointment.location && (
        <View style={styles.appointmentRow}>
          <Text style={styles.appointmentLabel}>Location:</Text>
          <Text style={styles.appointmentValue}>{effectiveAppointment.location}</Text>
        </View>
      )}

      {effectiveAppointment.reason && (
        <View style={styles.reasonBox}>
          <Text style={styles.reasonLabel}>Reason:</Text>
          <Text style={styles.reasonText}>{effectiveAppointment.reason}</Text>
        </View>
      )}

      {/* Check-in button */}
      {status === 'scheduled' && onCheckIn && !effectiveAppointment._id?.startsWith('mock_') && (
        <TouchableOpacity style={styles.checkInButton} onPress={onCheckIn}>
          <Ionicons name="checkmark-circle" size={22} color="#FFF" />
          <Text style={styles.checkInButtonText}>Confirm Arrival</Text>
        </TouchableOpacity>
      )}

      {/* Checked-in status */}
      {status === 'pending' && (
        <View style={styles.pendingBox}>
          <Ionicons name="time-outline" size={20} color={COLORS.warning} />
          <Text style={styles.pendingText}>⏳ Pending Confirmation</Text>
        </View>
      )}
      {status === 'confirmed' && (
        <View style={styles.confirmedBox}>
          <Ionicons name="checkmark-done-circle" size={20} color={COLORS.success} />
          <Text style={styles.confirmedText}>✓ Confirmed - Waiting to see doctor</Text>
        </View>
      )}

      {status === 'completed' && (
        <View style={styles.completedBox}>
          <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
          <Text style={styles.completedText}>✓ Appointment Completed</Text>
        </View>
      )}

      {/* Mock appointment note */}
      {effectiveAppointment._id?.startsWith('mock_') && (
        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={18} color={COLORS.info} />
          <Text style={styles.infoText}>
            The clinic will contact to confirm specific appointment details
          </Text>
        </View>
      )}
    </View>
  );
};

const MedicationCard: React.FC<{ step: TreatmentStep }> = ({ step }) => {
  if (!step.medication && !step.duration) return null;

  return (
    <View style={styles.medicationCard}>
      <View style={styles.medicationHeader}>
        <Ionicons name="medical" size={22} color={COLORS.primary} />
        <Text style={styles.medicationTitle}>Medication and Prescription</Text>
      </View>

      {step.medication && (
        <View style={styles.medicationRow}>
          <Text style={styles.medicationLabel}>💊 Medication:</Text>
          <Text style={styles.medicationValue}>{step.medication}</Text>
        </View>
      )}

      {step.dosage && (
        <View style={styles.medicationRow}>
          <Text style={styles.medicationLabel}>📏 Dosage:</Text>
          <Text style={styles.medicationValue}>{step.dosage}</Text>
        </View>
      )}

      {step.duration && (
        <View style={styles.medicationRow}>
          <Text style={styles.medicationLabel}>⏱️ Duration:</Text>
          <Text style={styles.medicationValue}>{step.duration}</Text>
        </View>
      )}

      {step.instructions && (
        <View style={styles.instructionsBox}>
          <Text style={styles.instructionsLabel}>📋 Instructions:</Text>
          <Text style={styles.instructionsText}>{step.instructions}</Text>
        </View>
      )}
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

  // Animation
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Calculate completion percentage
  const completionPercentage = useMemo(() => {
    if (!record?.treatment_plan?.length) return 0;
    const completedSteps = record.treatment_plan.filter(step =>
      ['approved', 'completed'].includes(step.status.toLowerCase())
    );
    return Math.round((completedSteps.length / record.treatment_plan.length) * 100);
  }, [record]);

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
        navigation.navigate('Login' as never);
      } else {
        showMessage({ message: "Cannot load record information", type: "danger" });
      }
    } finally {
      setLoading(false);
    }
  };

  // FIX: Optimized appointment fetching
  const fetchAllAppointments = async (currentRecord: Record) => {
    try {
      const headers = await getAuthHeaders();
      
      // Fetch all appointments in parallel to improve performance
      const [allAppointmentsRes, reExamRes] = await Promise.allSettled([
        axios.get(`${API_BASE_URL}/patient/appointments/history`, { headers }),
        axios.get(`${API_BASE_URL}/medical-records/${currentRecord._id}/re-examination/appointments`, { headers })
      ]);

      const appointments: Record<string, any> = {};
      
      // Process re-examination appointments
      if (reExamRes.status === 'fulfilled' && reExamRes.value.data?.success) {
        const stepAppointmentsData = reExamRes.value.data.data?.stepAppointments || [];
        stepAppointmentsData.forEach((item: any) => {
          if (item.appointment && item.stepNumber) {
            appointments[item.stepNumber] = item.appointment;
          }
        });
      }

      // Process all appointments
      if (allAppointmentsRes.status === 'fulfilled' && Array.isArray(allAppointmentsRes.value.data)) {
        const allAppointments = allAppointmentsRes.value.data;
        setDirectAppointments(allAppointments);

        // Match appointments to treatment steps
        currentRecord.treatment_plan.forEach(step => {
          if (step.status.toLowerCase() === 'scheduled' && !appointments[step.stepNumber]) {
            const matchedAppointment = findMatchingAppointment(step, allAppointments, currentRecord);
            if (matchedAppointment) {
              appointments[step.stepNumber] = matchedAppointment;
            }
          }
        });
      }

      // Set appointments state - FIX: Only update if there are changes
      setStepAppointments(prev => {
        const prevKeys = Object.keys(prev).sort().join(',');
        const newKeys = Object.keys(appointments).sort().join(',');
        
        if (prevKeys !== newKeys) {
          return appointments;
        }
        
        // Deep compare if keys are same
        const hasChanges = Object.keys(appointments).some(key => 
          JSON.stringify(prev[key]) !== JSON.stringify(appointments[key])
        );
        
        return hasChanges ? appointments : prev;
      });

    } catch (error) {
      console.error('Error in fetchAllAppointments:', error);
    }
  };

  const findMatchingAppointment = (step: TreatmentStep, appointments: any[], currentRecord: Record): any => {
    const stepUniqueKey = `${currentRecord._id}-${step.stepNumber}`;

    // Find by unique key
    const matchedByUniqueKey = appointments.find(app =>
      app.metadata?.step_unique_key === stepUniqueKey ||
      (app.metadata?.medical_record_id === currentRecord._id &&
        app.metadata?.step_number === step.stepNumber)
    );

    if (matchedByUniqueKey) return matchedByUniqueKey;

    // Find by reExaminationAppointmentId
    if (step.reExaminationAppointmentId) {
      const directMatch = appointments.find(app => app._id === step.reExaminationAppointmentId);
      if (directMatch) return directMatch;
    }

    // Find by re_examination_step_id
    if (step._id) {
      const directStepMatch = appointments.find(app =>
        app.re_examination_step_id?.toString() === step._id?.toString()
      );
      if (directStepMatch) return directStepMatch;
    }

    // Find by record ID
    const recordIdShort = currentRecord._id.slice(-6);
    const matchedByRecordId = appointments.find(app =>
      app.reason?.includes(recordIdShort) ||
      app.reason?.includes(currentRecord._id) ||
      app.notes?.includes(recordIdShort) ||
      app.notes?.includes(currentRecord._id)
    );

    return matchedByRecordId || null;
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
      showMessage({ message: "Cannot send message", type: "danger" });
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
            throw new Error('Appointment not found');
          }
          break;
      }

      if (!url) {
        throw new Error('Invalid action');
      }

      await axios.patch(url, payload, { headers });

      showMessage({ message: "Action successful", type: "success" });

      if (action === 'complete') {
        setShowReport(false);
        setConditionDesc('');
        setPatientMsg('');
      }

      await fetchRecordDetails();
    } catch (error: any) {
      console.error('Action failed:', error);
      showMessage({
        message: error.response?.data?.message || "Action failed",
        type: "danger"
      });
    } finally {
      setLoading(false);
    }
  };

  // Render each treatment step
  const renderTreatmentStep = (step: TreatmentStep, index: number) => {
    const appointment = stepAppointments[step.stepNumber];
    const isScheduled = step.status.toLowerCase() === 'scheduled';
    const isInProgress = step.status.toLowerCase() === 'in-progress' || step.status.toLowerCase() === 'in_progress';
    const isPending = step.status.toLowerCase() === 'pending';
    const isCompleted = ['approved', 'completed'].includes(step.status.toLowerCase());

    return (
      <View key={step._id || index} style={styles.stepContainer}>
        {/* Step number */}
        <View style={styles.stepNumberBox}>
          <Text style={styles.stepNumberText}>Step {step.stepNumber}</Text>
          <SimpleStatusBadge status={step.status} />
        </View>

        {/* Step title */}
        <Text style={styles.stepTitle}>{step.title}</Text>

        {/* Description */}
        <Text style={styles.stepDescription}>{step.description}</Text>

        {/* Appointment information (if any) */}
        {isScheduled && (
          <SimpleAppointmentCard
            appointment={appointment}
            step={step}
            onCheckIn={() => handleStepAction('confirm', step.stepNumber)}
          />
        )}

        {/* Medication information */}
        {!isScheduled && <MedicationCard step={step} />}

        {/* Doctor's message */}
        {step.doctorNotes && (
          <View style={styles.doctorNotesBox}>
            <View style={styles.doctorNotesHeader}>
              <Ionicons name="chatbox-ellipses" size={20} color={COLORS.primary} />
              <Text style={styles.doctorNotesTitle}>Doctor's Message</Text>
            </View>
            <Text style={styles.doctorNotesText}>{step.doctorNotes}</Text>
          </View>
        )}

        {/* Action buttons */}
        <View style={styles.actionButtons}>
          {isPending && (
            <TouchableOpacity
              style={styles.startButton}
              onPress={() => handleStepAction('activate', step.stepNumber)}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Ionicons name="play-circle" size={24} color="#FFF" />
                  <Text style={styles.buttonText}>Start This Step</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {isInProgress && (
            <TouchableOpacity
              style={styles.reportButton}
              onPress={() => {
                setSelectedStep(step);
                setShowReport(true);
              }}
              disabled={loading}
            >
              <Ionicons name="document-text" size={24} color="#FFF" />
              <Text style={styles.buttonText}>Report Condition</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Separator */}
        {index < record.treatment_plan.length - 1 && <View style={styles.stepDivider} />}
      </View>
    );
  };

  // Effects
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true
    }).start();
  }, []);

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
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading information...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <FlashMessage position="top" />

      {/* Simple header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={28} color={COLORS.text} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            setShowChat(true);
            loadMessages();
          }}
          style={styles.chatButton}
        >
          <Ionicons name="chatbubbles" size={26} color={COLORS.primary} />
          {messages.filter(m => m.sender_id !== record.user_id._id && !m.read).length > 0 && (
            <View style={styles.chatBadge}>
              <Text style={styles.chatBadgeText}>
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
        {/* Overall progress card */}
        <Animated.View style={[styles.progressCard, { opacity: fadeAnim }]}>
          <View style={styles.progressHeader}>
            <Ionicons name="ribbon" size={36} color={COLORS.primary} />
            <View style={styles.progressTextContainer}>
              <Text style={styles.progressTitle}>Treatment Progress</Text>
              <Text style={styles.progressPercentage}>{completionPercentage}%</Text>
            </View>
          </View>

          <View style={styles.progressBarContainer}>
            <View style={[styles.progressBarFill, { width: `${completionPercentage}%` }]} />
          </View>

          <Text style={styles.progressSubtitle}>
            Completed {record.treatment_plan?.filter(s =>
              ['approved', 'completed'].includes(s.status.toLowerCase())
            ).length} / {record.treatment_plan?.length} steps
          </Text>
        </Animated.View>

        {/* Diagnosis card */}
        <View style={styles.diagnosisCard}>
          <View style={styles.diagnosisHeader}>
            <Ionicons name="medical" size={28} color={COLORS.primary} />
            <Text style={styles.diagnosisTitle}>Doctor's Diagnosis</Text>
          </View>

          <Text style={styles.diagnosisText}>{record.diagnosis}</Text>

          <View style={styles.doctorInfoRow}>
            <Ionicons name="person-circle" size={20} color={COLORS.textLight} />
            <Text style={styles.doctorInfoText}>
              Attending Doctor: {record.doctor_id?.name || 'Not specified'}
            </Text>
          </View>

          {record.severity && (
            <View style={styles.severityRow}>
              <Text style={styles.severityLabel}>Severity:</Text>
              <View style={[
                styles.severityBadge,
                {
                  backgroundColor:
                    record.severity.toLowerCase() === 'mild' ? COLORS.warning :
                      record.severity.toLowerCase() === 'moderate' ? COLORS.accent :
                        COLORS.danger
                }
              ]}>
                <Text style={styles.severityText}>
                  {record.severity.toLowerCase() === 'mild' ? 'Mild' :
                    record.severity.toLowerCase() === 'moderate' ? 'Moderate' :
                      'Severe'}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Treatment steps list */}
        <View style={styles.treatmentSection}>
          <Text style={styles.sectionTitle}>📋 Treatment Steps</Text>
          {record.treatment_plan?.map((step, index) => renderTreatmentStep(step, index))}
        </View>
      </ScrollView>

      {/* Condition report modal */}
      <Modal visible={showReport} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalContainer}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Health Condition Report</Text>
                <TouchableOpacity onPress={() => setShowReport(false)}>
                  <Ionicons name="close-circle" size={32} color={COLORS.textLight} />
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>
                How are you feeling? (Required) <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.textInput}
                multiline
                placeholder="Example: Pain reduced, still have mild cough..."
                value={conditionDesc}
                onChangeText={setConditionDesc}
                placeholderTextColor={COLORS.textLight}
              />

              <Text style={styles.inputLabel}>Message for doctor (Optional)</Text>
              <TextInput
                style={[styles.textInput, styles.messageInput]}
                multiline
                placeholder="Example: I want to ask about medication dosage..."
                value={patientMsg}
                onChangeText={setPatientMsg}
                placeholderTextColor={COLORS.textLight}
              />

              <TouchableOpacity
                style={[styles.submitButton, (!conditionDesc || loading) && styles.disabledButton]}
                disabled={!conditionDesc || loading}
                onPress={() => selectedStep && handleStepAction('complete', selectedStep.stepNumber)}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="send" size={22} color="#FFF" />
                    <Text style={styles.submitButtonText}>Send Report</Text>
                  </>
                )}
              </TouchableOpacity>

              <Text style={styles.modalNote}>
                💡 Reports help doctors track your condition better
              </Text>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Chat modal */}
      <Modal visible={showChat} animationType="slide">
        <SafeAreaView style={styles.chatContainer}>
          <View style={styles.chatHeader}>
            <TouchableOpacity onPress={() => setShowChat(false)} style={styles.chatCloseButton}>
              <Ionicons name="arrow-back" size={28} color={COLORS.text} />
            </TouchableOpacity>
            <View style={styles.chatHeaderInfo}>
              <Text style={styles.chatDoctorName}>💬 Message Doctor</Text>
              <Text style={styles.chatDoctorSubtitle}>
                Dr. {record.doctor_id?.name || 'Not specified'}
              </Text>
            </View>
          </View>

          <FlatList
            data={messages}
            keyExtractor={(item) => item._id || Math.random().toString()}
            contentContainerStyle={styles.chatList}
            renderItem={({ item }) => {
              const isMine = item.sender_id === record.user_id._id;
              return (
                <View style={[styles.messageBubble, isMine ? styles.myMessage : styles.doctorMessage]}>
                  {!isMine && (
                    <View style={styles.doctorAvatar}>
                      <Ionicons name="person-circle" size={24} color={COLORS.primary} />
                    </View>
                  )}
                  <View style={styles.messageContent}>
                    <Text style={[styles.messageText, isMine ? styles.myMessageText : styles.doctorMessageText]}>
                      {item.message}
                    </Text>
                    <Text style={styles.messageTime}>
                      {new Date(item.timestamp).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </Text>
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyChat}>
                <Ionicons name="chatbubbles-outline" size={64} color={COLORS.border} />
                <Text style={styles.emptyChatText}>No messages yet</Text>
                <Text style={styles.emptyChatSubtext}>Send a message to communicate with doctor</Text>
              </View>
            }
          />

          <View style={styles.chatInputContainer}>
            <TextInput
              style={styles.chatInput}
              placeholder="Type your message..."
              value={newMessage}
              onChangeText={setNewMessage}
              multiline
              placeholderTextColor={COLORS.textLight}
            />
            <TouchableOpacity
              style={[styles.sendButton, !newMessage.trim() && styles.disabledSendButton]}
              onPress={handleSendChat}
              disabled={!newMessage.trim()}
            >
              <Ionicons name="send" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

// ==================== STYLES ====================

const styles = StyleSheet.create({
  // Container
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 20,
    fontSize: 18,
    color: COLORS.textLight,
    fontWeight: '600',
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  chatButton: {
    padding: 8,
    position: 'relative',
  },
  chatBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: COLORS.danger,
    borderRadius: 12,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  chatBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },

  // Scroll Content
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },

  // Progress Card
  progressCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 16,
  },
  progressTextContainer: {
    flex: 1,
  },
  progressTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  progressPercentage: {
    fontSize: 36,
    fontWeight: '900',
    color: COLORS.primary,
  },
  progressBarContainer: {
    height: 12,
    backgroundColor: COLORS.border,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 6,
  },
  progressSubtitle: {
    fontSize: 16,
    color: COLORS.textLight,
    textAlign: 'center',
    fontWeight: '500',
  },

  // Diagnosis Card
  diagnosisCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  diagnosisHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  diagnosisTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  diagnosisText: {
    fontSize: 17,
    color: COLORS.text,
    lineHeight: 26,
    marginBottom: 20,
  },
  doctorInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 8,
  },
  doctorInfoText: {
    fontSize: 16,
    color: COLORS.textLight,
    fontWeight: '600',
  },
  severityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 12,
  },
  severityLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textLight,
  },
  severityBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  severityText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },

  // Treatment Section
  treatmentSection: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 20,
  },

  // Step Container
  stepContainer: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  stepNumberBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  stepNumberText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
    textTransform: 'uppercase',
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 12,
    lineHeight: 28,
  },
  stepDescription: {
    fontSize: 16,
    color: COLORS.textLight,
    lineHeight: 24,
    marginBottom: 20,
  },
  stepDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginTop: 20,
  },

  // Status Badge
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  statusBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },

  // Appointment Card
  appointmentCard: {
    backgroundColor: '#F0F9FF',
    borderLeftWidth: 5,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  appointmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 10,
  },
  appointmentTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  appointmentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  appointmentLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textLight,
  },
  appointmentValue: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    flex: 1,
    textAlign: 'right',
  },
  reasonBox: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
  },
  reasonLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textLight,
    marginBottom: 6,
  },
  reasonText: {
    fontSize: 15,
    color: COLORS.text,
    lineHeight: 22,
  },
  checkInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.success,
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 16,
    gap: 10,
  },
  checkInButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFF',
  },
  confirmedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F5E9',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 16,
    gap: 10,
  },
  confirmedText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.success,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 16,
    gap: 10,
  },
  infoText: {
    fontSize: 14,
    color: COLORS.info,
    fontWeight: '500',
    flex: 1,
  },

  // Medication Card
  medicationCard: {
    backgroundColor: '#FFF8E1',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  medicationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 10,
  },
  medicationTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  medicationRow: {
    marginBottom: 12,
  },
  medicationLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textLight,
    marginBottom: 4,
  },
  medicationValue: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    lineHeight: 24,
  },
  instructionsBox: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
  },
  instructionsLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textLight,
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: 15,
    color: COLORS.text,
    lineHeight: 22,
  },

  // Doctor Notes
  doctorNotesBox: {
    backgroundColor: '#E8EAF6',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  doctorNotesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  doctorNotesTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
  },
  doctorNotesText: {
    fontSize: 16,
    color: COLORS.text,
    lineHeight: 24,
    fontStyle: 'italic',
  },

  // Action Buttons
  actionButtons: {
    gap: 12,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 18,
    borderRadius: 14,
    gap: 12,
  },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.secondary,
    paddingVertical: 18,
    borderRadius: 14,
    gap: 12,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFF',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 28,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
  },
  inputLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 10,
    marginTop: 20,
  },
  required: {
    color: COLORS.danger,
  },
  textInput: {
    backgroundColor: COLORS.background,
    borderRadius: 14,
    padding: 18,
    fontSize: 16,
    color: COLORS.text,
    height: 120,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  messageInput: {
    height: 100,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 18,
    borderRadius: 14,
    marginTop: 28,
    gap: 12,
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  disabledButton: {
    backgroundColor: COLORS.border,
  },
  modalNote: {
    fontSize: 14,
    color: COLORS.textLight,
    textAlign: 'center',
    marginTop: 16,
    fontStyle: 'italic',
  },

  // Chat
  chatContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 16,
  },
  chatCloseButton: {
    padding: 4,
  },
  chatHeaderInfo: {
    flex: 1,
  },
  chatDoctorName: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  chatDoctorSubtitle: {
    fontSize: 15,
    color: COLORS.textLight,
    fontWeight: '500',
  },
  chatList: {
    padding: 20,
  },
  messageBubble: {
    flexDirection: 'row',
    marginBottom: 16,
    maxWidth: '85%',
  },
  myMessage: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
  },
  doctorMessage: {
    alignSelf: 'flex-start',
  },
  doctorAvatar: {
    marginRight: 10,
  },
  messageContent: {
    flex: 1,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 24,
    padding: 16,
    borderRadius: 18,
  },
  myMessageText: {
    backgroundColor: COLORS.primary,
    color: '#FFF',
    borderBottomRightRadius: 4,
  },
  doctorMessageText: {
    backgroundColor: COLORS.card,
    color: COLORS.text,
    borderBottomLeftRadius: 4,
  },
  messageTime: {
    fontSize: 13,
    color: COLORS.textLight,
    marginTop: 6,
    marginLeft: 16,
    fontWeight: '500',
  },
  emptyChat: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 100,
    gap: 12,
  },
  emptyChatText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textLight,
  },
  emptyChatSubtext: {
    fontSize: 15,
    color: COLORS.textLight,
  },
  chatInputContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    alignItems: 'flex-end',
    gap: 12,
  },
  chatInput: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 14,
    fontSize: 16,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sendButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledSendButton: {
    backgroundColor: COLORS.border,
  },

  // Icon with Label
  iconLabelContainer: {
    alignItems: 'center',
    gap: 8,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textLight,
  },
  completedBox: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  completedText: {
    fontSize: 14,
    color: COLORS.success,
    fontWeight: '700',
  },
  pendingBox: {
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  pendingText: {
    fontSize: 14,
    color: COLORS.warning,
    fontWeight: '700',
  },
});

export default MedicalRecordDetail;