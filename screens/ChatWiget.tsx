import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
  Animated, Dimensions, StatusBar, Alert, SafeAreaView, Modal,
  ScrollView, Linking, AccessibilityInfo,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

const { width, height } = Dimensions.get('window');

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';
const PENDING_MESSAGES_KEY = 'pending_chat_messages';
const CONSENT_GIVEN_KEY = 'ai_consent_given';
const SESSION_ID_KEY = 'ai_session_id';

// ==================== TYPES ====================

interface Doctor {
  id: string;
  name: string;
  availableSlots: string[];
  consultationFee?: number;
  experience?: number;
  rating?: number;
}

interface ExistingAppointmentDetails {
  date: string;
  time: string;
  doctorName?: string;
  specialty?: string;
  id?: string;
}

interface AppointmentSuggestion {
  shouldBook: boolean;
  urgencyLevel: 'low' | 'medium' | 'high' | 'critical';
  suggestedSpecialty?: string;
  suggestedSpecialtyId?: string;
  recommendedTimeframe?: string;
  reason?: string;
  symptoms: string[];
  hasExistingAppointment?: boolean;
  existingAppointmentDetails?: ExistingAppointmentDetails;
  contraindications?: string[];
  awaitingBookingConfirmation?: boolean;
  bookingQuestion?: string;
  emergencyInstructions?: string;
  suggestedDoctors?: Doctor[];
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  id?: string;
  category?: string;
  confidence?: number;
  suggestedActions?: string[];
  emergencyAlert?: boolean;
  relatedSpecialties?: string[];
  language?: 'en' | 'vi';
  followUpQuestions?: string[];
  requiresMoreInfo?: boolean;
  patientContextUsed?: boolean;
  appointmentRecommendation?: AppointmentSuggestion;
  pending?: boolean;
  failed?: boolean;
}

interface AIResponseData {
  response: string;
  confidence: number;
  suggestedActions?: string[];
  emergencyAlert?: boolean;
  category?: string;
  relatedSpecialties?: string[];
  language?: 'en' | 'vi';
  followUpQuestions?: string[];
  requiresMoreInfo?: boolean;
  patientContextUsed?: boolean;
  appointmentRecommendation?: AppointmentSuggestion;
  session_id?: string;
  shouldAskBookingConfirmation?: boolean;
  triageScore?: number;
  urgencyLevel?: 'low' | 'medium' | 'high' | 'critical';
}

interface AIResponse {
  success: boolean;
  data: AIResponseData;
}

type RootStackParamList = {
  Home: undefined;
  Login: undefined;
  ChatOption: undefined;
  AppointmentBooking: { 
    appointmentId?: string; 
    doctorId?: string; 
    initialData?: any 
  };
  Appointments: undefined;
};

type NavigationProp = StackNavigationProp<RootStackParamList>;

// ==================== COLORS ====================

const colors = {
  primary: '#00BCD4',
  primaryDark: '#0097A7',
  background: '#FAFAFA',
  surface: '#FFFFFF',
  surfaceLight: '#F5F5F5',
  textPrimary: '#212121',
  textSecondary: '#757575',
  textLight: '#9E9E9E',
  error: '#FF5252',
  warning: '#FF9800',
  success: '#00BCD4',
  critical: '#D32F2F',
  border: '#E0E0E0',
  gradientPrimary: ['#00BCD4', '#00ACC1'] as [string, string],
  gradientSecondary: ['#00ACC1', '#0097A7'] as [string, string],
  gradientCritical: ['#D32F2F', '#B71C1C'] as [string, string],
};

// ==================== AUTH HELPERS ====================

async function getValidToken(): Promise<string | null> {
  return AsyncStorage.getItem('authToken');
}

async function tryRefreshToken(): Promise<string | null> {
  try {
    const refreshToken = await AsyncStorage.getItem('refreshToken');
    if (!refreshToken) return null;
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.success && data.data?.accessToken) {
      await AsyncStorage.setItem('authToken', data.data.accessToken);
      return data.data.accessToken;
    }
    return null;
  } catch { 
    return null; 
  }
}

// ==================== OFFLINE QUEUE ====================

async function savePendingMessage(message: string): Promise<void> {
  try {
    const existing = await AsyncStorage.getItem(PENDING_MESSAGES_KEY);
    const queue: string[] = existing ? JSON.parse(existing) : [];
    queue.push(message);
    await AsyncStorage.setItem(PENDING_MESSAGES_KEY, JSON.stringify(queue));
  } catch { 
    /* ignore */ 
  }
}

async function getPendingMessages(): Promise<string[]> {
  try {
    const data = await AsyncStorage.getItem(PENDING_MESSAGES_KEY);
    return data ? JSON.parse(data) : [];
  } catch { 
    return []; 
  }
}

async function clearPendingMessages(): Promise<void> {
  await AsyncStorage.removeItem(PENDING_MESSAGES_KEY);
}

// ==================== EMERGENCY MODAL ====================

const EmergencyModal = ({
  visible,
  instructions,
  onClose,
  language = 'vi',
}: {
  visible: boolean;
  instructions: string;
  onClose: () => void;
  language?: 'en' | 'vi';
}) => {
  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.emergencyOverlay}>
        <View style={styles.emergencyBox}>
          <LinearGradient colors={colors.gradientCritical} style={styles.emergencyHeader}>
            <Ionicons name="warning" size={50} color="#fff" />
            <Text style={styles.emergencyTitle}>
              {language === 'vi' ? 'CẤP CỨU!' : 'EMERGENCY!'}
            </Text>
          </LinearGradient>
          
          <ScrollView style={styles.emergencyContent}>
            <Text style={styles.emergencyText}>{instructions}</Text>
          </ScrollView>
          
          <View style={styles.emergencyButtons}>
            <TouchableOpacity
              style={[styles.emergencyBtn, styles.callBtn]}
              onPress={() => Linking.openURL('tel:115')}
              accessibilityLabel={language === 'vi' ? 'Gọi cấp cứu 115' : 'Call emergency 115'}
              accessibilityRole="button"
            >
              <Ionicons name="call" size={20} color="#fff" />
              <Text style={styles.emergencyBtnText}>
                {language === 'vi' ? 'Gọi 115' : 'Call 115'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.emergencyBtn, styles.mapBtn]}
              onPress={() => Linking.openURL('maps:')}
              accessibilityLabel={language === 'vi' ? 'Tìm bệnh viện gần nhất' : 'Find nearest hospital'}
              accessibilityRole="button"
            >
              <Ionicons name="map" size={20} color="#fff" />
              <Text style={styles.emergencyBtnText}>
                {language === 'vi' ? 'Bệnh viện gần nhất' : 'Nearest hospital'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.emergencyBtn, styles.closeEmergencyBtn]}
              onPress={onClose}
              accessibilityLabel={language === 'vi' ? 'Đóng' : 'Close'}
              accessibilityRole="button"
            >
              <Text style={styles.closeEmergencyText}>
                {language === 'vi' ? 'Đóng' : 'Close'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ==================== BOOKING CONFIRMATION CARD ====================

const BookingConfirmationCard = ({
  suggestion,
  onConfirm,
  onDecline,
  language = 'vi',
}: {
  suggestion: AppointmentSuggestion;
  onConfirm: () => void;
  onDecline: () => void;
  language?: 'en' | 'vi';
}) => {
  const slideAnim = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    Animated.spring(slideAnim, { 
      toValue: 0, 
      tension: 100, 
      friction: 8, 
      useNativeDriver: true 
    }).start();
  }, []);

  const getUrgencyColor = () => {
    switch(suggestion.urgencyLevel) {
      case 'critical': return colors.critical;
      case 'high': return colors.error;
      case 'medium': return colors.warning;
      default: return colors.primary;
    }
  };

  const getUrgencyLabel = () => {
    const labels = {
      critical: { vi: '🚨 CẤP CỨU', en: '🚨 EMERGENCY' },
      high: { vi: '⚠️ Khẩn cấp', en: '⚠️ Urgent' },
      medium: { vi: '📋 Nên khám sớm', en: '📋 See soon' },
      low: { vi: '📅 Khám định kỳ', en: '📅 Routine' },
    };
    return labels[suggestion.urgencyLevel]?.[language] || suggestion.urgencyLevel;
  };

  return (
    <Animated.View style={[styles.appointmentCard, { transform: [{ translateY: slideAnim }] }]}>
      <TouchableOpacity
        style={styles.closeBtn}
        onPress={onDecline}
        accessibilityLabel={language === 'vi' ? 'Đóng' : 'Close'}
        accessibilityRole="button"
      >
        <Ionicons name="close" size={20} color={colors.textSecondary} />
      </TouchableOpacity>

      <View style={[styles.urgencyBadge, { backgroundColor: getUrgencyColor() }]}>
        <Text style={styles.urgencyText}>{getUrgencyLabel()}</Text>
      </View>

      <Text style={styles.cardTitle}>
        {language === 'vi' ? '📋 Đề xuất đặt lịch khám' : '📋 Appointment Suggestion'}
      </Text>
      
      <Text style={styles.suggestionReason}>{suggestion.reason}</Text>

      <View style={styles.infoRow}>
        <Ionicons name="time-outline" size={16} color={colors.primary} />
        <Text style={styles.infoText}>{suggestion.recommendedTimeframe}</Text>
      </View>

      {suggestion.suggestedSpecialty && (
        <View style={styles.infoRow}>
          <Ionicons name="medical-outline" size={16} color={colors.primary} />
          <Text style={styles.infoText}>
            {language === 'vi' ? 'Chuyên khoa: ' : 'Specialty: '}{suggestion.suggestedSpecialty}
          </Text>
        </View>
      )}

      <Text style={styles.confirmationQuestion}>
        {suggestion.bookingQuestion || 
         (language === 'vi'
           ? (suggestion.urgencyLevel === 'medium' 
              ? '💡 Bạn có muốn tôi đặt lịch khám tự động không?'
              : '💡 Bạn có muốn đặt lịch khám định kỳ không?')
           : (suggestion.urgencyLevel === 'medium'
              ? '💡 Would you like me to book an appointment?'
              : '💡 Would you like to schedule a checkup?'))}
      </Text>

      <View style={styles.confirmationButtons}>
        <TouchableOpacity
          style={[styles.confirmBtn, styles.confirmBtnYes]}
          onPress={onConfirm}
          accessibilityLabel={language === 'vi' ? 'Đồng ý đặt lịch' : 'Confirm booking'}
          accessibilityRole="button"
        >
          <LinearGradient colors={colors.gradientPrimary} style={styles.confirmBtnGradient}>
            <Ionicons name="checkmark-circle" size={18} color="#fff" />
            <Text style={styles.confirmBtnText}>
              {language === 'vi' ? 'Có, đặt lịch' : 'Yes, book'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.confirmBtn, styles.confirmBtnNo]}
          onPress={onDecline}
          accessibilityLabel={language === 'vi' ? 'Không, để sau' : 'No, later'}
          accessibilityRole="button"
        >
          <View style={styles.declineBtnContent}>
            <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
            <Text style={styles.declineBtnText}>
              {language === 'vi' ? 'Không, để sau' : 'No, later'}
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

// ==================== EXISTING APPOINTMENT CARD ====================

const ExistingAppointmentCard = ({
  suggestion,
  onClose,
  onViewAppointment,
  language = 'vi',
}: {
  suggestion: AppointmentSuggestion;
  onClose: () => void;
  onViewAppointment: () => void;
  language?: 'en' | 'vi';
}) => {
  const slideAnim = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    Animated.spring(slideAnim, { 
      toValue: 0, 
      tension: 100, 
      friction: 8, 
      useNativeDriver: true 
    }).start();
  }, []);

  return (
    <Animated.View style={[styles.appointmentCard, { transform: [{ translateY: slideAnim }] }]}>
      <TouchableOpacity
        style={styles.closeBtn}
        onPress={onClose}
        accessibilityLabel={language === 'vi' ? 'Đóng' : 'Close'}
        accessibilityRole="button"
      >
        <Ionicons name="close" size={20} color={colors.textSecondary} />
      </TouchableOpacity>

      <View style={[styles.urgencyBadge, { backgroundColor: colors.primary }]}>
        <Text style={styles.urgencyText}>
          {language === 'vi' ? '📅 Đã có lịch hẹn' : '📅 Existing Appointment'}
        </Text>
      </View>

      <Text style={styles.cardTitle}>
        {language === 'vi' ? 'Thông báo' : 'Notice'}
      </Text>
      
      <Text style={styles.suggestionReason}>{suggestion.reason}</Text>

      {suggestion.existingAppointmentDetails && (
        <View style={styles.existingAppointmentDetails}>
          <View style={styles.infoRow}>
            <Ionicons name="calendar" size={16} color={colors.primary} />
            <Text style={styles.infoText}>
              {suggestion.existingAppointmentDetails.date} - {suggestion.existingAppointmentDetails.time}
            </Text>
          </View>
          
          {suggestion.existingAppointmentDetails.doctorName && (
            <View style={styles.infoRow}>
              <Ionicons name="person" size={16} color={colors.primary} />
              <Text style={styles.infoText}>
                {language === 'vi' ? 'Bác sĩ: ' : 'Doctor: '}{suggestion.existingAppointmentDetails.doctorName}
              </Text>
            </View>
          )}
          
          {suggestion.existingAppointmentDetails.specialty && (
            <View style={styles.infoRow}>
              <Ionicons name="medical" size={16} color={colors.primary} />
              <Text style={styles.infoText}>
                {language === 'vi' ? 'Chuyên khoa: ' : 'Specialty: '}{suggestion.existingAppointmentDetails.specialty}
              </Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.infoRow}>
        <Ionicons name="information-circle" size={20} color={colors.primary} />
        <Text style={[styles.infoText, { flex: 1 }]}>
          {language === 'vi' 
            ? 'Bạn đã có lịch hẹn với bác sĩ. Vui lòng tham khảo ý kiến bác sĩ về các triệu chứng của bạn trong lần khám tới.'
            : 'You have an upcoming appointment. Please discuss your symptoms with your doctor during your visit.'}
        </Text>
      </View>

      <TouchableOpacity 
        style={[styles.confirmBtn, { marginTop: 15 }]}
        onPress={onViewAppointment}
      >
        <LinearGradient colors={colors.gradientPrimary} style={styles.confirmBtnGradient}>
          <Text style={styles.confirmBtnText}>
            {language === 'vi' ? 'Xem lịch hẹn' : 'View Appointment'}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ==================== NO DOCTORS CARD ====================

const NoDoctorsCard = ({
  suggestion,
  onClose,
  language = 'vi',
}: {
  suggestion: AppointmentSuggestion;
  onClose: () => void;
  language?: 'en' | 'vi';
}) => {
  const slideAnim = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    Animated.spring(slideAnim, { 
      toValue: 0, 
      tension: 100, 
      friction: 8, 
      useNativeDriver: true 
    }).start();
  }, []);

  const getUrgencyColor = () => {
    switch(suggestion.urgencyLevel) {
      case 'critical': return colors.critical;
      case 'high': return colors.error;
      case 'medium': return colors.warning;
      default: return colors.primary;
    }
  };

  const getUrgencyLabel = () => {
    const labels = {
      critical: { vi: '🚨 CẤP CỨU', en: '🚨 EMERGENCY' },
      high: { vi: '⚠️ Khẩn cấp', en: '⚠️ Urgent' },
      medium: { vi: '📋 Nên khám sớm', en: '📋 See soon' },
      low: { vi: '📅 Khám định kỳ', en: '📅 Routine' },
    };
    return labels[suggestion.urgencyLevel]?.[language] || suggestion.urgencyLevel;
  };

  return (
    <Animated.View style={[styles.appointmentCard, { transform: [{ translateY: slideAnim }] }]}>
      <TouchableOpacity
        style={styles.closeBtn}
        onPress={onClose}
        accessibilityLabel={language === 'vi' ? 'Đóng' : 'Close'}
        accessibilityRole="button"
      >
        <Ionicons name="close" size={20} color={colors.textSecondary} />
      </TouchableOpacity>

      <View style={[styles.urgencyBadge, { backgroundColor: getUrgencyColor() }]}>
        <Text style={styles.urgencyText}>{getUrgencyLabel()}</Text>
      </View>

      <Text style={styles.cardTitle}>
        {language === 'vi' ? 'Không có bác sĩ' : 'No Doctors Available'}
      </Text>
      
      <Text style={styles.suggestionReason}>{suggestion.reason}</Text>

      <View style={styles.noDoctorsBox}>
        <Ionicons name="calendar-outline" size={40} color={colors.textLight} />
        <Text style={styles.noDoctorsText}>
          {language === 'vi' 
            ? 'Hiện không có bác sĩ nào khả dụng cho chuyên khoa này. Vui lòng thử lại sau hoặc liên hệ trực tiếp bệnh viện qua hotline 1900 1234.'
            : 'No doctors available for this specialty. Please try again later or contact the hospital directly at 1900 1234.'}
        </Text>
      </View>
      
      <TouchableOpacity style={styles.confirmBtn} onPress={onClose}>
        <LinearGradient colors={colors.gradientPrimary} style={styles.confirmBtnGradient}>
          <Text style={styles.confirmBtnText}>
            {language === 'vi' ? 'Đóng' : 'Close'}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ==================== APPOINTMENT SUGGESTION CARD ====================

const AppointmentSuggestionCard = ({
  suggestion, 
  onBook, 
  onClose,
  language = 'vi',
}: {
  suggestion: AppointmentSuggestion;
  onBook: (doctorId: string, timeSlot: string, doctorName: string) => void;
  onClose: () => void;
  language?: 'en' | 'vi';
}) => {
  const [selectedDoctor, setSelectedDoctor] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [selectedDoctorName, setSelectedDoctorName] = useState('');
  const slideAnim = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    Animated.spring(slideAnim, { 
      toValue: 0, 
      tension: 100, 
      friction: 8, 
      useNativeDriver: true 
    }).start();
  }, []);

  const getUrgencyColor = () => {
    switch(suggestion.urgencyLevel) {
      case 'critical': return colors.critical;
      case 'high': return colors.error;
      case 'medium': return colors.warning;
      default: return colors.primary;
    }
  };

  const getUrgencyLabel = () => {
    const labels = {
      critical: { vi: '🚨 CẤP CỨU', en: '🚨 EMERGENCY' },
      high: { vi: '⚠️ Khẩn cấp', en: '⚠️ Urgent' },
      medium: { vi: '📋 Nên khám sớm', en: '📋 See soon' },
      low: { vi: '📅 Khám định kỳ', en: '📅 Routine' },
    };
    return labels[suggestion.urgencyLevel]?.[language] || suggestion.urgencyLevel;
  };

  return (
    <Animated.View style={[styles.appointmentCard, { transform: [{ translateY: slideAnim }] }]}>
      <TouchableOpacity
        style={styles.closeBtn}
        onPress={onClose}
        accessibilityLabel={language === 'vi' ? 'Đóng' : 'Close'}
        accessibilityRole="button"
      >
        <Ionicons name="close" size={20} color={colors.textSecondary} />
      </TouchableOpacity>

      <View style={[styles.urgencyBadge, { backgroundColor: getUrgencyColor() }]}>
        <Text style={styles.urgencyText}>{getUrgencyLabel()}</Text>
      </View>

      <Text style={styles.cardTitle}>
        {language === 'vi' ? '📅 Đặt lịch khám' : '📅 Book Appointment'}
      </Text>
      
      <Text style={styles.suggestionReason}>{suggestion.reason}</Text>

      {/* Cảnh báo chống chỉ định */}
      {suggestion.contraindications && suggestion.contraindications.length > 0 && (
        <View style={styles.contraindicationBox}>
          <Ionicons name="warning" size={16} color={colors.error} />
          <Text style={styles.contraindicationText}>
            {suggestion.contraindications.join('\n')}
          </Text>
        </View>
      )}

      {/* Danh sách triệu chứng */}
      {suggestion.symptoms.length > 0 && (
        <View style={styles.symptomsRow}>
          {suggestion.symptoms.map((s, i) => (
            <View key={i} style={styles.symptomChip}>
              <Ionicons name="medical" size={12} color={colors.primary} />
              <Text style={styles.symptomChipText}>{s}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Thông tin thời gian */}
      <View style={styles.infoRow}>
        <Ionicons name="time-outline" size={16} color={colors.primary} />
        <Text style={styles.infoText}>{suggestion.recommendedTimeframe}</Text>
      </View>
      
      {/* Chuyên khoa */}
      {suggestion.suggestedSpecialty && (
        <View style={styles.infoRow}>
          <Ionicons name="medical-outline" size={16} color={colors.primary} />
          <Text style={styles.infoText}>
            {language === 'vi' ? 'Chuyên khoa: ' : 'Specialty: '}{suggestion.suggestedSpecialty}
          </Text>
        </View>
      )}

      {/* Danh sách bác sĩ */}
      {suggestion.suggestedDoctors && suggestion.suggestedDoctors.length > 0 ? (
        <View>
          <Text style={styles.doctorsTitle}>
            {language === 'vi' ? '👨‍⚕️ Bác sĩ có lịch trống:' : '👨‍⚕️ Available doctors:'}
          </Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            style={styles.doctorsScroll} 
            nestedScrollEnabled
          >
            {suggestion.suggestedDoctors.map(doc => {
              const hasSlots = doc.availableSlots && doc.availableSlots.length > 0;
              const isSelected = selectedDoctor === doc.id;
              
              return (
                <TouchableOpacity
                  key={doc.id}
                  style={[
                    styles.doctorCard, 
                    isSelected && styles.doctorCardSelected, 
                    !hasSlots && styles.doctorCardFull
                  ]}
                  onPress={() => { 
                    if (!hasSlots) return; 
                    setSelectedDoctor(doc.id); 
                    setSelectedDoctorName(doc.name); 
                    setSelectedSlot(''); 
                  }}
                  activeOpacity={hasSlots ? 0.8 : 1}
                  accessibilityLabel={`Bác sĩ ${doc.name}, ${hasSlots ? `${doc.availableSlots.length} khung giờ trống` : 'đã kín lịch'}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected, disabled: !hasSlots }}
                >
                  <LinearGradient
                    colors={!hasSlots ? [colors.surfaceLight, '#EEEEEE'] : isSelected ? colors.gradientPrimary : [colors.surfaceLight, '#EEEEEE']}
                    style={styles.doctorCardGradient}
                  >
                    <View style={styles.doctorRow}>
                      <Text style={[
                        styles.doctorName, 
                        isSelected && { color: '#fff' }, 
                        !hasSlots && { color: colors.textLight }
                      ]}>
                        BS. {doc.name}
                      </Text>
                      {!hasSlots ? (
                        <View style={styles.fullBadge}>
                          <Text style={styles.fullBadgeText}>
                            {language === 'vi' ? 'Hết lịch' : 'Full'}
                          </Text>
                        </View>
                      ) : doc.rating && doc.rating > 0 ? (
                        <View style={styles.ratingRow}>
                          <Ionicons name="star" size={12} color="#FFC107" />
                          <Text style={[styles.ratingText, isSelected && { color: '#fff' }]}>
                            {doc.rating.toFixed(1)}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    
                    <View style={styles.doctorMeta}>
                      <Text style={[styles.expText, isSelected && { color: '#fff' }, !hasSlots && { color: colors.border }]}>
                        {doc.experience || 0}+ {language === 'vi' ? 'năm' : 'yrs'}
                      </Text>
                      <Text style={[styles.feeText, !hasSlots && { color: colors.border }]}>
                        {doc.consultationFee 
                          ? `${doc.consultationFee.toLocaleString('vi-VN')}đ` 
                          : (language === 'vi' ? 'Liên hệ' : 'Contact')}
                      </Text>
                    </View>

                    {isSelected && hasSlots && (
                      <View style={styles.slotsBox}>
                        <Text style={[styles.slotsLabel, { color: '#fff' }]}>
                          {language === 'vi' ? 'Chọn giờ:' : 'Select time:'}
                        </Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                          {doc.availableSlots.map(slot => (
                            <TouchableOpacity
                              key={slot}
                              style={[styles.slotChip, selectedSlot === slot && styles.slotChipSelected]}
                              onPress={() => setSelectedSlot(slot)}
                              accessibilityLabel={`Giờ ${slot}`}
                              accessibilityRole="button"
                              accessibilityState={{ selected: selectedSlot === slot }}
                            >
                              <Text style={[styles.slotText, selectedSlot === slot && { color: '#fff' }]}>
                                {slot}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      ) : (
        <View style={styles.noDoctorsBox}>
          <Ionicons name="sad-outline" size={32} color={colors.textLight} />
          <Text style={styles.noDoctorsText}>
            {language === 'vi' 
              ? 'Không có thông tin bác sĩ. Vui lòng thử lại sau.'
              : 'No doctor information available. Please try again later.'}
          </Text>
        </View>
      )}

      {/* Nút xác nhận */}
      <TouchableOpacity
        style={[styles.confirmBtn, (!selectedDoctor || !selectedSlot) && styles.confirmBtnDisabled]}
        onPress={() => { 
          if (selectedDoctor && selectedSlot) {
            onBook(selectedDoctor, selectedSlot, selectedDoctorName);
          }
        }}
        disabled={!selectedDoctor || !selectedSlot}
        accessibilityLabel={language === 'vi' ? 'Xác nhận đặt lịch' : 'Confirm booking'}
        accessibilityRole="button"
        accessibilityState={{ disabled: !selectedDoctor || !selectedSlot }}
      >
        <LinearGradient
          colors={(!selectedDoctor || !selectedSlot) ? [colors.textLight, colors.textLight] : colors.gradientPrimary}
          style={styles.confirmBtnGradient}
        >
          <Text style={styles.confirmBtnText}>
            {language === 'vi' ? 'Xác nhận đặt lịch' : 'Confirm Booking'}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ==================== FOLLOW-UP QUESTIONS WIDGET ====================

const FollowUpWidget = ({
  questions,
  onSelect,
  language = 'vi',
}: {
  questions: string[];
  onSelect: (question: string) => void;
  language?: 'en' | 'vi';
}) => (
  <View style={styles.followUpContainer} accessibilityLabel="Câu hỏi làm rõ từ trợ lý">
    <Text style={styles.followUpTitle}>
      {language === 'vi' ? '💬 Vui lòng trả lời:' : '💬 Please answer:'}
    </Text>
    {questions.map((q, i) => (
      <TouchableOpacity
        key={i}
        style={styles.followUpChip}
        onPress={() => onSelect(q)}
        accessibilityLabel={`Câu hỏi ${i + 1}: ${q}`}
        accessibilityRole="button"
      >
        <Ionicons name="chatbubble-outline" size={14} color={colors.primary} />
        <Text style={styles.followUpText}>{q}</Text>
      </TouchableOpacity>
    ))}
  </View>
);

// ==================== MESSAGE ITEM ====================

const MessageItem = ({
  item, 
  index, 
  colors: _colors, 
  onBookAppointment, 
  onFollowUp,
  onBookingConfirm,
  onBookingDecline,
  language = 'vi',
}: {
  item: ChatMessage;
  index: number;
  colors: typeof colors;
  onBookAppointment?: (s: AppointmentSuggestion) => void;
  onFollowUp?: (question: string) => void;
  onBookingConfirm?: (s: AppointmentSuggestion) => void;
  onBookingDecline?: () => void;
  language?: 'en' | 'vi';
}) => {
  const isUser = item.role === 'user';
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: 1,
      delay: Math.min(index * 40, 200),
      tension: 100,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.msgContainer,
        isUser ? styles.userContainer : styles.botContainer,
        { 
          opacity: anim, 
          transform: [{ 
            translateY: anim.interpolate({ 
              inputRange: [0, 1], 
              outputRange: [15, 0] 
            }) 
          }] 
        },
      ]}
      accessibilityLabel={`${isUser ? 'Bạn' : 'Trợ lý AI'}: ${item.content.substring(0, 100)}`}
    >
      {!isUser && (
        <LinearGradient 
          colors={item.emergencyAlert ? colors.gradientCritical : colors.gradientPrimary} 
          style={styles.botAvatar}
        >
          <Ionicons name={item.emergencyAlert ? 'warning' : 'medical'} size={16} color="#fff" />
        </LinearGradient>
      )}

      <View style={[styles.msgContent, isUser ? styles.userMsgContent : styles.botMsgContent]}>
        {isUser ? (
          <LinearGradient colors={colors.gradientPrimary} style={[styles.bubble, styles.userBubble]}>
            <Text style={styles.userMsgText}>{item.content}</Text>
            {item.pending && (
              <Text style={styles.pendingText}>
                {language === 'vi' ? 'Đang gửi...' : 'Sending...'}
              </Text>
            )}
            {item.failed && (
              <Text style={styles.failedText}>
                {language === 'vi' ? '⚠️ Gửi thất bại' : '⚠️ Failed to send'}
              </Text>
            )}
          </LinearGradient>
        ) : (
          <View style={[styles.bubble, styles.botBubble]}>
            <Text style={[styles.msgText, { color: colors.textPrimary }]}>{item.content}</Text>

            {item.confidence !== undefined && (
              <View style={styles.confidenceBox}>
                <View style={styles.confidenceBar}>
                  <View style={[
                    styles.confidenceFill, 
                    { 
                      width: `${item.confidence * 100}%`,
                      backgroundColor: item.confidence > 0.7 ? colors.primary : 
                                     item.confidence > 0.5 ? colors.warning : colors.error 
                    }
                  ]} />
                </View>
                <Text style={styles.confidenceLabel}>
                  {Math.round(item.confidence * 100)}% {language === 'vi' ? 'tin cậy' : 'confidence'}
                </Text>
              </View>
            )}

            {item.emergencyAlert && (
              <View style={styles.emergencyBox}>
                <Ionicons name="warning" size={16} color={colors.error} />
                <Text style={styles.emergencyText}>
                  {language === 'vi' ? '🚨 TÌNH HUỐNG KHẨN CẤP' : '🚨 EMERGENCY SITUATION'}
                </Text>
              </View>
            )}

            {/* Follow-up questions */}
            {item.requiresMoreInfo && item.followUpQuestions && item.followUpQuestions.length > 0 && onFollowUp && (
              <FollowUpWidget 
                questions={item.followUpQuestions} 
                onSelect={onFollowUp} 
                language={language} 
              />
            )}

            {/* Booking confirmation inline */}
            {item.appointmentRecommendation?.awaitingBookingConfirmation && onBookingConfirm && onBookingDecline && (
              <View style={styles.bookingConfirmationInline}>
                <Text style={styles.confirmationQuestionInline}>
                  {item.appointmentRecommendation.bookingQuestion ||
                   (language === 'vi'
                     ? '💡 Bạn có muốn đặt lịch khám không?'
                     : '💡 Would you like to book an appointment?')}
                </Text>
                <View style={styles.confirmationButtonsInline}>
                  <TouchableOpacity
                    style={styles.confirmYesInline}
                    onPress={() => onBookingConfirm(item.appointmentRecommendation!)}
                  >
                    <Text style={styles.confirmYesText}>
                      {language === 'vi' ? 'Có' : 'Yes'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.confirmNoInline}
                    onPress={onBookingDecline}
                  >
                    <Text style={styles.confirmNoText}>
                      {language === 'vi' ? 'Không' : 'No'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Suggested actions */}
            {item.suggestedActions && item.suggestedActions.length > 0 && (
              <View style={styles.actionsBox}>
                <Text style={styles.actionsTitle}>
                  {language === 'vi' ? '📋 Gợi ý:' : '📋 Suggestions:'}
                </Text>
                {item.suggestedActions.map((a, i) => (
                  <View key={i} style={styles.actionChip}>
                    <Ionicons name="checkmark-circle" size={13} color={colors.primary} />
                    <Text style={styles.actionText}>{a}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Book appointment button (for shouldBook) */}
            {item.appointmentRecommendation?.shouldBook && onBookAppointment && (
              <TouchableOpacity
                style={styles.bookBtn}
                onPress={() => onBookAppointment(item.appointmentRecommendation!)}
                accessibilityLabel={language === 'vi' ? 'Đặt lịch khám' : 'Book appointment'}
                accessibilityRole="button"
              >
                <LinearGradient colors={colors.gradientPrimary} style={styles.bookBtnGradient}>
                  <Ionicons name="calendar" size={15} color="#fff" />
                  <Text style={styles.bookBtnText}>
                    {language === 'vi' ? '📅 Đặt lịch khám' : '📅 Book Appointment'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        )}

        <Text style={[styles.timestamp, { color: colors.textLight }]}>
          {new Date(item.timestamp).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </Text>
      </View>

      {isUser && (
        <LinearGradient colors={colors.gradientSecondary} style={styles.userAvatar}>
          <Ionicons name="person" size={14} color="#fff" />
        </LinearGradient>
      )}
    </Animated.View>
  );
};

// ==================== TYPING INDICATOR ====================

const TypingIndicator = ({ isTyping, language = 'vi' }: { isTyping: boolean; language?: 'en' | 'vi' }) => {
  const anim = useRef(new Animated.Value(0.5)).current;
  
  useEffect(() => {
    if (isTyping) {
      Animated.loop(Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ])).start();
    } else { 
      anim.setValue(0.5); 
    }
  }, [isTyping]);

  if (!isTyping) return null;
  
  return (
    <Animated.View 
      style={[styles.typingRow, { opacity: anim }]} 
      accessibilityLabel={language === 'vi' ? 'Trợ lý đang phân tích' : 'Assistant is analyzing'}
    >
      <LinearGradient colors={colors.gradientPrimary} style={styles.botAvatar}>
        <Ionicons name="medical" size={16} color="#fff" />
      </LinearGradient>
      <View style={styles.typingBubble}>
        <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
          {language === 'vi' ? 'Đang phân tích...' : 'Analyzing...'}
        </Text>
        <View style={{ flexDirection: 'row', marginTop: 4 }}>
          {[0, 1, 2].map(i => (
            <Animated.View 
              key={i} 
              style={[styles.dot, { opacity: anim }]} 
            />
          ))}
        </View>
      </View>
    </Animated.View>
  );
};

// ==================== OFFLINE BANNER ====================

const OfflineBanner = ({ isOffline, language = 'vi' }: { isOffline: boolean; language?: 'en' | 'vi' }) => {
  if (!isOffline) return null;
  return (
    <View style={styles.offlineBanner} accessibilityLabel="Không có kết nối mạng" accessibilityRole="alert">
      <Ionicons name="cloud-offline-outline" size={16} color="#fff" />
      <Text style={styles.offlineText}>
        {language === 'vi' 
          ? '📡 Không có kết nối. Tin nhắn sẽ được gửi khi có mạng.' 
          : '📡 No connection. Messages will be sent when online.'}
      </Text>
    </View>
  );
};

// ==================== CONSENT MODAL ====================

const ConsentModal = ({
  visible,
  onAccept,
  onDecline,
  language = 'vi',
}: {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
  language?: 'en' | 'vi';
}) => (
  <Modal visible={visible} transparent animationType="fade">
    <View style={styles.consentOverlay}>
      <View style={styles.consentBox}>
        <LinearGradient colors={colors.gradientPrimary} style={styles.consentHeader}>
          <Ionicons name="shield-checkmark" size={36} color="#fff" />
          <Text style={styles.consentTitle}>
            {language === 'vi' ? 'Điều khoản sử dụng AI' : 'AI Terms of Use'}
          </Text>
        </LinearGradient>

        <ScrollView style={styles.consentContent}>
          <Text style={styles.consentText}>
            {language === 'vi' 
              ? `Trước khi sử dụng Trợ lý Y tế AI, vui lòng đọc và đồng ý với các điều khoản sau:\n\n`
              : `Before using the AI Medical Assistant, please read and agree to the following:\n\n`}
            
            {language === 'vi'
              ? `⚕️ CHỈ DÀNH CHO MỤC ĐÍCH GIÁO DỤC\nThông tin từ AI chỉ mang tính tham khảo, KHÔNG thay thế chẩn đoán hoặc tư vấn y tế chuyên nghiệp.\n\n`
              : `⚕️ FOR EDUCATIONAL PURPOSES ONLY\nInformation provided by the AI is for reference only and does NOT replace professional medical diagnosis or advice.\n\n`}
            
            {language === 'vi'
              ? `📋 KHÔNG PHẢI CHẨN ĐOÁN\nAI không chẩn đoán bệnh. Luôn tham khảo ý kiến bác sĩ để được chẩn đoán chính xác.\n\n`
              : `📋 NOT A DIAGNOSIS\nThe AI does not diagnose diseases. Always consult a doctor for accurate diagnosis.\n\n`}
            
            {language === 'vi'
              ? `🔒 QUYỀN RIÊNG TƯ\nThông tin của bạn được bảo mật. Cuộc trò chuyện được lưu trữ để cải thiện dịch vụ.\n\n`
              : `🔒 PRIVACY\nYour information is kept confidential. Conversations are stored to improve the service.\n\n`}
            
            {language === 'vi'
              ? `🚨 TRƯỜNG HỢP KHẨN CẤP\nTrong trường hợp khẩn cấp, hãy gọi 115 ngay lập tức hoặc đến bệnh viện gần nhất thay vì sử dụng AI.\n\n`
              : `🚨 EMERGENCY\nIn an emergency, call 911/115 immediately or go to the nearest hospital instead of using the AI.\n\n`}
            
            {language === 'vi'
              ? `Nhấn "Đồng ý" để xác nhận bạn đã đọc và đồng ý với các điều khoản trên.`
              : `By tapping "Agree", you confirm you have read and agree to the above terms.`}
          </Text>
        </ScrollView>

        <View style={styles.consentButtons}>
          <TouchableOpacity
            style={[styles.consentBtn, styles.declineBtn]}
            onPress={onDecline}
            accessibilityLabel={language === 'vi' ? 'Từ chối' : 'Decline'}
            accessibilityRole="button"
          >
            <Text style={styles.declineBtnText}>
              {language === 'vi' ? 'Từ chối' : 'Decline'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.consentBtn, styles.acceptBtn]}
            onPress={onAccept}
            accessibilityLabel={language === 'vi' ? 'Đồng ý' : 'Agree'}
            accessibilityRole="button"
          >
            <LinearGradient colors={colors.gradientPrimary} style={styles.acceptBtnGradient}>
              <Text style={styles.acceptBtnText}>
                {language === 'vi' ? 'Đồng ý' : 'Agree'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);

// ==================== MAIN CHAT WIDGET ====================

const ChatWidget: React.FC<{
  onBackToHome?: () => void;
  showBackButton?: boolean;
  isFullScreen?: boolean;
}> = ({ onBackToHome, isFullScreen = false }) => {
  const navigation = useNavigation<NavigationProp>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentSession, setCurrentSession] = useState<any>(null);
  const [currentLanguage, setCurrentLanguage] = useState<'en' | 'vi'>('en');
  const [isOffline, setIsOffline] = useState(false);
  const [showConsent, setShowConsent] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);
  const [showAppointmentCard, setShowAppointmentCard] = useState(false);
  const [showBookingConfirmation, setShowBookingConfirmation] = useState(false);
  const [showEmergency, setShowEmergency] = useState(false);
  const [currentSuggestion, setCurrentSuggestion] = useState<AppointmentSuggestion | null>(null);
  const [pendingSuggestion, setPendingSuggestion] = useState<AppointmentSuggestion | null>(null);
  const [emergencyInstructions, setEmergencyInstructions] = useState('');
  const [cardType, setCardType] = useState<'booking' | 'existing' | 'noDoctors' | 'confirmation'>('booking');

  const flatListRef = useRef<FlatList>(null);
  const scrollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const inputAnim = useRef(new Animated.Value(0)).current;

  // ==================== INIT ====================

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const offline = !state.isConnected;
      setIsOffline(offline);
      if (!offline) retryPendingMessages();
    });

    checkConsentAndInitialize();
    
    return () => {
      unsubscribe();
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (isInitialized) {
      Animated.timing(fadeAnim, { 
        toValue: 1, 
        duration: 600, 
        useNativeDriver: true 
      }).start();
    }
  }, [isInitialized]);

  useEffect(() => {
    Animated.spring(inputAnim, { 
      toValue: input.length > 0 ? 1 : 0, 
      useNativeDriver: true, 
      tension: 200, 
      friction: 12 
    }).start();
  }, [input]);

  useEffect(() => { 
    scrollToBottom(); 
  }, [messages]);

  const scrollToBottom = useCallback((animated = true) => {
    if (flatListRef.current && messages.length > 0) {
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
      scrollTimerRef.current = setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated });
      }, 100);
    }
  }, [messages.length]);

  // ==================== CONSENT CHECK ====================

  const checkConsentAndInitialize = async () => {
    try {
      const consent = await AsyncStorage.getItem(CONSENT_GIVEN_KEY);
      const savedSessionId = await AsyncStorage.getItem(SESSION_ID_KEY);
      
      if (consent === 'true') {
        setConsentGiven(true);
        if (savedSessionId) {
          setCurrentSession({ session_id: savedSessionId });
        }
        initializeChat();
      } else {
        setShowConsent(true);
        setIsInitialized(true);
      }
    } catch {
      setShowConsent(true);
      setIsInitialized(true);
    }
  };

  // ==================== INIT CHAT ====================

  const initializeChat = async () => {
    setLoading(true);
    try {
      const token = await getValidToken();
      if (!token) { 
        setError(currentLanguage === 'vi' ? 'Vui lòng đăng nhập' : 'Please log in'); 
        setIsInitialized(true); 
        return; 
      }

      await loadChatHistory(token);
      setIsInitialized(true);
    } catch { 
      setError(currentLanguage === 'vi' ? 'Không thể khởi tạo trợ lý' : 'Could not initialize assistant'); 
      setIsInitialized(true); 
    } finally { 
      setLoading(false); 
    }
  };

  const loadChatHistory = async (token: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/ai-medical/session`, {
        headers: { 
          Authorization: `Bearer ${token}`, 
          'Content-Type': 'application/json' 
        },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setCurrentSession(data.data.session);
          await AsyncStorage.setItem(SESSION_ID_KEY, data.data.session.session_id);

          if (data.data.messages?.length > 0) {
            setMessages(data.data.messages.map((m: any) => ({
              ...m,
              id: `${m.timestamp}-${m.role}`,
              timestamp: new Date(m.timestamp).toISOString(),
            })));
            return;
          }
        }
      }
      showWelcomeMessage();
    } catch { 
      showWelcomeMessage(); 
    }
  };

const showWelcomeMessage = () => {
  setMessages([{
    role: 'assistant',
    content: 'Hello! I am your AI Medical Assistant. I can help you:\n\n• Look up medication and disease information\n• Explain medical terminology\n• Suggest suitable appointments\n\nDescribe your symptoms or ask a question!\n\n⚕️ Note: I provide educational information only and do not replace professional medical advice.',
    timestamp: new Date().toISOString(),
    id: `welcome-${Date.now()}`,
    language: 'en',
  }]);
};

  // ==================== CONSENT HANDLING ====================

  const handleConsentAccept = async () => {
    setShowConsent(false);
    setConsentGiven(true);
    await AsyncStorage.setItem(CONSENT_GIVEN_KEY, 'true');

    if (currentSession?.session_id) {
      try {
        const token = await getValidToken();
        if (token) {
          await fetch(`${API_BASE_URL}/ai-medical/consent`, {
            method: 'POST',
            headers: { 
              Authorization: `Bearer ${token}`, 
              'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ 
              session_id: currentSession.session_id, 
              consent: true 
            }),
          });
        }
      } catch { 
        /* non-blocking */ 
      }
    }
    
    initializeChat();
  };

  const handleConsentDecline = () => {
    setShowConsent(false);
    if (onBackToHome) onBackToHome();
    else navigation.goBack();
  };

  // ==================== OFFLINE RETRY ====================

  const retryPendingMessages = async () => {
    const pending = await getPendingMessages();
    if (!pending.length) return;

    const token = await getValidToken();
    if (!token) return;

    for (const msg of pending) {
      await sendMessageToAPI(msg, token);
    }
    await clearPendingMessages();
  };

  // ==================== SEND MESSAGE ====================

  const sendMessageToAPI = async (messageText: string, token: string): Promise<AIResponse | null> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      console.log('📤 Sending message:', messageText);
      
      let res = await fetch(`${API_BASE_URL}/ai-medical/chat`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ message: messageText }),
        signal: controller.signal,
      });

      if (res.status === 401) {
        const newToken = await tryRefreshToken();
        if (!newToken) return null;
        res = await fetch(`${API_BASE_URL}/ai-medical/chat`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json', 
            Authorization: `Bearer ${newToken}` 
          },
          body: JSON.stringify({ message: messageText }),
        });
      }

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      const data = await res.json();
      console.log('📥 Response received');
      
      return data;
    } catch (error) {
      console.error('❌ API Error:', error);
      return null;
    } finally {
      clearTimeout(timeout);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const msgText = input.trim();
    setInput('');
    setError(null);
    setLoading(true);

    const userMsg: ChatMessage = {
      role: 'user', 
      content: msgText,
      timestamp: new Date().toISOString(),
      id: `user-${Date.now()}`,
      language: currentLanguage,
      pending: true,
    };

    setMessages(prev => [...prev, userMsg]);

    // Offline handling
    if (isOffline) {
      await savePendingMessage(msgText);
      setMessages(prev => prev.map(m => 
        m.id === userMsg.id ? { ...m, pending: false, failed: true } : m
      ));
      setLoading(false);
      return;
    }

    setIsTyping(true);

    try {
      let token = await getValidToken();
      if (!token) {
        token = await tryRefreshToken();
        if (!token) { 
          navigation.navigate('Login'); 
          return; 
        }
      }

      // Mark as sent
      setMessages(prev => prev.map(m => 
        m.id === userMsg.id ? { ...m, pending: false } : m
      ));

      const data = await sendMessageToAPI(msgText, token);

      if (!data || !data.success) throw new Error('API error');

      if (data.data.session_id && !currentSession) {
        setCurrentSession({ session_id: data.data.session_id });
        await AsyncStorage.setItem(SESSION_ID_KEY, data.data.session_id);
      }
      
      if (data.data.language) {
        setCurrentLanguage(data.data.language);
      }

      setTimeout(() => {
        setIsTyping(false);
        
        const botMsg: ChatMessage = {
          role: 'assistant',
          content: data.data.response,
          timestamp: new Date().toISOString(),
          id: `bot-${Date.now()}`,
          category: data.data.category,
          confidence: data.data.confidence,
          suggestedActions: data.data.suggestedActions,
          emergencyAlert: data.data.emergencyAlert,
          relatedSpecialties: data.data.relatedSpecialties,
          followUpQuestions: data.data.followUpQuestions,
          requiresMoreInfo: data.data.requiresMoreInfo,
          patientContextUsed: data.data.patientContextUsed,
          language: data.data.language || currentLanguage,
          appointmentRecommendation: data.data.appointmentRecommendation,
        };
        
        setMessages(prev => [...prev, botMsg]);

        // Xử lý các loại card khác nhau
        if (data.data.appointmentRecommendation) {
          const rec = data.data.appointmentRecommendation;
          
          // Critical emergency
          if (data.data.urgencyLevel === 'critical' || data.data.emergencyAlert) {
            setEmergencyInstructions(data.data.response);
            setShowEmergency(true);
            AccessibilityInfo.announceForAccessibility(
              currentLanguage === 'vi' 
                ? 'CẢNH BÁO: Tình huống khẩn cấp. Gọi 115 ngay lập tức.' 
                : 'WARNING: Emergency situation. Call 115 now.'
            );
          }
          // Đã có lịch hẹn
          else if (rec.hasExistingAppointment) {
            console.log('📅 Showing existing appointment card');
            setCurrentSuggestion(rec);
            setCardType('existing');
            setShowAppointmentCard(true);
          }
          // Chờ confirmation
          else if (rec.awaitingBookingConfirmation) {
            console.log('💬 Showing booking confirmation');
            setPendingSuggestion(rec);
            setShowBookingConfirmation(true);
          }
          // Cần book và có doctors
          else if (rec.shouldBook && rec.suggestedDoctors && rec.suggestedDoctors.length > 0) {
            console.log('✅ Showing booking card with doctors:', rec.suggestedDoctors.length);
            setCurrentSuggestion(rec);
            setCardType('booking');
            setShowAppointmentCard(true);
          }
          // Cần book nhưng không có doctors
          else if (rec.shouldBook) {
            console.log('⚠️ Showing no doctors card');
            setCurrentSuggestion(rec);
            setCardType('noDoctors');
            setShowAppointmentCard(true);
          }
        }

      }, 600 + Math.random() * 400);
      
    } catch (err: any) {
      setIsTyping(false);
      setMessages(prev => prev.map(m => 
        m.id === userMsg.id ? { ...m, failed: true, pending: false } : m
      ));

      let msg = currentLanguage === 'vi' 
        ? 'Không thể xử lý yêu cầu. Vui lòng thử lại.' 
        : 'Could not process request. Please try again.';
      
      if (err.name === 'AbortError') {
        msg = currentLanguage === 'vi' 
          ? 'Yêu cầu đã hết thời gian. Vui lòng thử lại.' 
          : 'Request timed out. Please try again.';
      }

      setError(msg);
      setMessages(prev => [...prev, {
        role: 'assistant', 
        content: currentLanguage === 'vi'
          ? 'Xin lỗi, đã xảy ra lỗi kỹ thuật. Vui lòng liên hệ bác sĩ trực tiếp nếu cần gấp.\n\n⚕️ Thông tin này chỉ mang tính giáo dục.'
          : 'Sorry, a technical issue occurred. For urgent matters, please contact a doctor directly.\n\n⚕️ This information is for educational purposes only.',
        timestamp: new Date().toISOString(), 
        id: `err-${Date.now()}`, 
        language: currentLanguage,
      }]);
    } finally {
      setLoading(false);
    }
  };

  // ==================== BOOKING HANDLERS ====================

  const handleBookingConfirm = (suggestion: AppointmentSuggestion) => {
    console.log('✅ User confirmed booking');
    setShowBookingConfirmation(false);
    setPendingSuggestion(null);
    // Gửi tin nhắn "có" đến AI
    setInput(currentLanguage === 'vi' ? 'có' : 'yes');
    setTimeout(() => {
      sendMessage();
    }, 500);
  };

  const handleBookingDecline = () => {
    console.log('❌ User declined booking');
    setShowBookingConfirmation(false);
    setPendingSuggestion(null);
    // Gửi tin nhắn "không" đến AI
    setInput(currentLanguage === 'vi' ? 'không' : 'no');
    setTimeout(() => {
      sendMessage();
    }, 500);
  };

  const handleBookAppointment = async (doctorId: string, timeSlot: string, doctorName: string) => {
    if (!currentSuggestion) return;
    
    console.log('📅 Booking appointment:', { doctorId, timeSlot, doctorName });
    setLoading(true);
    
    try {
      const token = await getValidToken();
      if (!token) { 
        Alert.alert(
          currentLanguage === 'vi' ? 'Lỗi' : 'Error', 
          currentLanguage === 'vi' ? 'Vui lòng đăng nhập' : 'Please log in'
        ); 
        return; 
      }

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];

      const res = await fetch(`${API_BASE_URL}/ai-medical/appointments/book-from-ai`, {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${token}`, 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({
          doctor_id: doctorId, 
          appointment_date: dateStr, 
          time_slot: timeSlot,
          symptoms: currentSuggestion.symptoms, 
          reason: currentSuggestion.reason,
          urgency_level: currentSuggestion.urgencyLevel, 
          session_id: currentSession?.session_id,
        }),
      });

      const data = await res.json();
      if (data.success) {
        Alert.alert(
          currentLanguage === 'vi' ? '✅ Đặt lịch thành công' : '✅ Appointment Confirmed',
          currentLanguage === 'vi'
            ? `Bác sĩ ${doctorName} — ${dateStr} lúc ${timeSlot}`
            : `Dr. ${doctorName} — ${dateStr} at ${timeSlot}`,
          [
            { 
              text: currentLanguage === 'vi' ? 'Xem chi tiết' : 'View details', 
              onPress: () => navigation.navigate('AppointmentBooking', { 
                appointmentId: data.data.appointment?._id,
                doctorId, 
                initialData: data.data.appointment 
              }) 
            },
            { 
              text: 'OK', 
              onPress: () => { 
                setShowAppointmentCard(false); 
                setCurrentSuggestion(null); 
              } 
            },
          ]
        );
        
        // Thêm tin nhắn xác nhận vào chat
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: currentLanguage === 'vi'
            ? `✅ Đã đặt lịch hẹn với Bác sĩ ${doctorName} vào ${dateStr} lúc ${timeSlot}. Vui lòng đến trước 15 phút.`
            : `✅ Appointment booked with Dr. ${doctorName} on ${dateStr} at ${timeSlot}. Please arrive 15 minutes early.`,
          timestamp: new Date().toISOString(),
          id: `booking-confirm-${Date.now()}`,
          language: currentLanguage,
        }]);
        
      } else {
        Alert.alert(
          currentLanguage === 'vi' ? 'Lỗi' : 'Error', 
          data.message || (currentLanguage === 'vi' ? 'Không thể đặt lịch' : 'Could not book appointment')
        );
      }
    } catch { 
      Alert.alert(
        currentLanguage === 'vi' ? 'Lỗi' : 'Error', 
        currentLanguage === 'vi' ? 'Không thể đặt lịch. Vui lòng thử lại.' : 'Could not book appointment. Please try again.'
      ); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleViewExistingAppointment = () => {
    setShowAppointmentCard(false);
    setCurrentSuggestion(null);
    // Navigate to appointments screen
    navigation.navigate('Appointments');
  };

  // ==================== TEST FUNCTION (Chỉ dùng khi dev) ====================

  const testBookingCard = () => {
    const mockSuggestion: AppointmentSuggestion = {
      shouldBook: true,
      urgencyLevel: 'medium',
      suggestedSpecialty: 'Thần kinh',
      suggestedSpecialtyId: '123',
      recommendedTimeframe: 'Trong 2-3 ngày',
      reason: 'Cần khám chuyên khoa thần kinh để đánh giá triệu chứng đau đầu kéo dài',
      symptoms: ['đau đầu', 'chóng mặt', 'mất ngủ'],
      contraindications: ['Dị ứng với Paracetamol'],
      suggestedDoctors: [
        {
          id: '1',
          name: 'Nguyễn Văn A',
          availableSlots: ['09:00', '09:30', '10:00', '10:30'],
          consultationFee: 500000,
          experience: 15,
          rating: 4.5
        },
        {
          id: '2',
          name: 'Trần Thị B',
          availableSlots: ['14:00', '14:30', '15:00', '15:30'],
          consultationFee: 400000,
          experience: 10,
          rating: 4.2
        }
      ]
    };
    
    console.log('🧪 Test: Setting mock booking card');
    setCurrentSuggestion(mockSuggestion);
    setCardType('booking');
    setShowAppointmentCard(true);
  };

  const testExistingAppointmentCard = () => {
    const mockSuggestion: AppointmentSuggestion = {
      shouldBook: false,
      urgencyLevel: 'low',
      symptoms: ['đau đầu'],
      hasExistingAppointment: true,
      reason: 'Bạn đã có lịch hẹn với bác sĩ vào ngày 15/03/2024. Hãy tham khảo bác sĩ về các triệu chứng này trong lần khám tới.',
      existingAppointmentDetails: {
        date: '15/03/2024',
        time: '09:00',
        doctorName: 'Nguyễn Văn A',
        specialty: 'Thần kinh'
      }
    };
    
    console.log('🧪 Test: Setting mock existing appointment card');
    setCurrentSuggestion(mockSuggestion);
    setCardType('existing');
    setShowAppointmentCard(true);
  };

  // ==================== CLEAR CHAT ====================

  const clearChat = () => {
    Alert.alert(
      currentLanguage === 'vi' ? 'Bắt đầu cuộc trò chuyện mới?' : 'Start a new conversation?',
      '',
      [
        { text: currentLanguage === 'vi' ? 'Hủy' : 'Cancel', style: 'cancel' },
        {
          text: currentLanguage === 'vi' ? 'Xóa' : 'Clear', 
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await getValidToken();
              if (token && currentSession?.session_id) {
                await fetch(`${API_BASE_URL}/ai-medical/session/${currentSession.session_id}/close`, {
                  method: 'POST', 
                  headers: { 
                    Authorization: `Bearer ${token}`, 
                    'Content-Type': 'application/json' 
                  },
                });
                await AsyncStorage.removeItem(SESSION_ID_KEY);
              }
              showWelcomeMessage();
              setCurrentSession(null);
              setShowAppointmentCard(false);
              setShowBookingConfirmation(false);
              setPendingSuggestion(null);
              setCurrentSuggestion(null);
            } catch { 
              setError(currentLanguage === 'vi' ? 'Không thể xóa lịch sử' : 'Could not clear history'); 
            }
          },
        },
      ]
    );
  };

  // ==================== QUICK REPLIES ====================

  const quickReplies = currentLanguage === 'vi'
    ? [
        '🤒 Triệu chứng cảm cúm',
        '💊 Tác dụng phụ paracetamol',
        '🩺 Huyết áp bình thường',
        '🍎 Ăn uống tốt cho tim',
        '😴 Cải thiện giấc ngủ',
        '🧘 Giảm stress',
      ]
    : [
        '🤒 Flu symptoms',
        '💊 Paracetamol side effects',
        '🩺 Normal blood pressure',
        '🍎 Heart-healthy diet',
        '😴 Improve sleep',
        '🧘 Reduce stress',
      ];

  // ==================== BACK ====================

  const handleBack = useCallback(() => {
    if (onBackToHome) onBackToHome();
    else navigation.goBack();
  }, [onBackToHome, navigation]);

  // ==================== RENDER CARD BASED ON TYPE ====================

  const renderAppointmentCard = () => {
    if (!currentSuggestion) return null;

    switch (cardType) {
      case 'existing':
        return (
          <ExistingAppointmentCard
            suggestion={currentSuggestion}
            onClose={() => { 
              setShowAppointmentCard(false); 
              setCurrentSuggestion(null); 
            }}
            onViewAppointment={handleViewExistingAppointment}
            language={currentLanguage}
          />
        );
      case 'noDoctors':
        return (
          <NoDoctorsCard
            suggestion={currentSuggestion}
            onClose={() => { 
              setShowAppointmentCard(false); 
              setCurrentSuggestion(null); 
            }}
            language={currentLanguage}
          />
        );
      case 'booking':
      default:
        return (
          <AppointmentSuggestionCard
            suggestion={currentSuggestion}
            onBook={handleBookAppointment}
            onClose={() => { 
              console.log('Closing appointment card');
              setShowAppointmentCard(false); 
              setCurrentSuggestion(null); 
            }}
            language={currentLanguage}
          />
        );
    }
  };

  // ==================== RENDER ====================

  if (!isInitialized) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <LinearGradient colors={colors.gradientPrimary} style={styles.loadingIcon}>
          <Ionicons name="medical" size={40} color="#fff" />
        </LinearGradient>
        <Text style={{ fontSize: 22, fontWeight: '700', marginTop: 16, color: colors.textPrimary }}>
          {currentLanguage === 'vi' ? 'Trợ lý Y tế AI' : 'HealthAI Assistant'}
        </Text>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
      </View>
    );
  }

  const sendScale = inputAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] });

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {/* Consent Modal */}
      <ConsentModal 
        visible={showConsent} 
        onAccept={handleConsentAccept} 
        onDecline={handleConsentDecline}
        language={currentLanguage}
      />

      {/* Emergency Modal */}
      <EmergencyModal
        visible={showEmergency}
        instructions={emergencyInstructions}
        onClose={() => setShowEmergency(false)}
        language={currentLanguage}
      />

      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      <LinearGradient colors={[colors.background, colors.surface]} style={{ flex: 1 }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? (isFullScreen ? 0 : 90) : 0}
        >
          <SafeAreaView style={{ flex: 1 }}>
            {/* Header */}
            <LinearGradient colors={['#00BCD4', '#00ACC1', '#0097A7']} style={styles.header}>
              <View style={styles.headerRow}>
                <TouchableOpacity 
                  onPress={handleBack} 
                  style={styles.headerBtn} 
                  accessibilityLabel={currentLanguage === 'vi' ? 'Quay lại' : 'Go back'} 
                  accessibilityRole="button"
                >
                  <Ionicons name="chevron-back" size={24} color="#fff" />
                </TouchableOpacity>
                
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginHorizontal: 12 }}>
                  <LinearGradient colors={['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.1)']} style={styles.headerAvatar}>
                    <Ionicons name="medical" size={18} color="#fff" />
                  </LinearGradient>
                  <View style={{ marginLeft: 10 }}>
                    <Text style={styles.headerTitle}>
                      {currentLanguage === 'vi' ? 'Trợ lý Y tế AI' : 'HealthAI Assistant'}
                    </Text>
                    <Text style={styles.headerSubtitle}>
                      {isTyping 
                        ? (currentLanguage === 'vi' ? 'Đang phân tích...' : 'Analyzing...')
                        : (currentLanguage === 'vi' ? 'Sẵn sàng hỗ trợ' : 'Ready to help')}
                    </Text>
                  </View>
                </View>
                
                <TouchableOpacity 
                  onPress={clearChat} 
                  style={styles.headerBtn} 
                  accessibilityLabel={currentLanguage === 'vi' ? 'Xóa chat' : 'Clear chat'} 
                  accessibilityRole="button"
                >
                  <Ionicons name="refresh-outline" size={22} color="#fff" />
                </TouchableOpacity>
              </View>
            </LinearGradient>

            {/* Offline banner */}
            <OfflineBanner isOffline={isOffline} language={currentLanguage} />

            {/* Messages */}
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={({ item, index }) => (
                <MessageItem
                  item={item}
                  index={index}
                  colors={colors}
                  language={currentLanguage}
                  onBookAppointment={(s) => { 
                    console.log('📖 Book appointment from message:', s);
                    setCurrentSuggestion(s); 
                    setCardType(s.suggestedDoctors && s.suggestedDoctors.length > 0 ? 'booking' : 'noDoctors');
                    setShowAppointmentCard(true); 
                  }}
                  onFollowUp={(q) => setInput(q)}
                  onBookingConfirm={handleBookingConfirm}
                  onBookingDecline={handleBookingDecline}
                />
              )}
              keyExtractor={(item, i) => item.id || `${item.timestamp}-${i}`}
              contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
              showsVerticalScrollIndicator={false}
              ListHeaderComponent={
                messages.length <= 1 ? (
                  <View style={{ marginBottom: 16 }}>
                    <Text style={{ textAlign: 'center', color: colors.textSecondary, marginBottom: 8 }}>
                      {currentLanguage === 'vi' ? '💡 Câu hỏi thường gặp' : '💡 Frequently Asked'}
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>
                      {quickReplies.map((r, i) => (
                        <TouchableOpacity
                          key={i}
                          onPress={() => setInput(r)}
                          disabled={loading}
                          style={{ margin: 4, borderRadius: 20, overflow: 'hidden' }}
                          accessibilityLabel={r}
                          accessibilityRole="button"
                        >
                          <LinearGradient 
                            colors={i % 2 === 0 ? colors.gradientPrimary : colors.gradientSecondary} 
                            style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 }}
                          >
                            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '500' }}>{r}</Text>
                          </LinearGradient>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ) : null
              }
              ListFooterComponent={<TypingIndicator isTyping={isTyping} language={currentLanguage} />}
            />

            {/* Error */}
            {error && (
              <View style={styles.errorBar}>
                <Ionicons name="warning" size={18} color={colors.error} />
                <Text style={[styles.errorText, { color: colors.error }]} numberOfLines={2}>{error}</Text>
                <TouchableOpacity onPress={() => setError(null)} accessibilityLabel="Đóng thông báo lỗi">
                  <Ionicons name="close" size={18} color={colors.error} />
                </TouchableOpacity>
              </View>
            )}

            {/* Input */}
            <View style={styles.inputArea}>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  value={input}
                  onChangeText={setInput}
                  placeholder={isOffline 
                    ? (currentLanguage === 'vi' ? 'Ngoại tuyến - tin nhắn sẽ được gửi khi có mạng' : 'Offline — messages will be sent when connected')
                    : (currentLanguage === 'vi' ? 'Hỏi về thông tin y tế...' : 'Ask about medical information...')}
                  placeholderTextColor={colors.textLight}
                  editable={!loading}
                  multiline
                  maxLength={500}
                  accessibilityLabel={currentLanguage === 'vi' ? 'Nhập câu hỏi y tế' : 'Enter medical question'}
                  accessibilityHint={currentLanguage === 'vi' ? 'Nhập triệu chứng hoặc câu hỏi sức khỏe' : 'Enter symptoms or health questions'}
                />
                <Animated.View style={{ transform: [{ scale: sendScale }] }}>
                  <TouchableOpacity
                    style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
                    onPress={sendMessage}
                    disabled={!input.trim() || loading}
                    accessibilityLabel={currentLanguage === 'vi' ? 'Gửi tin nhắn' : 'Send message'}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !input.trim() || loading }}
                  >
                    <LinearGradient
                      colors={!input.trim() || loading ? [colors.textLight, colors.textLight] : colors.gradientPrimary}
                      style={styles.sendBtnGradient}
                    >
                      {loading ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Ionicons name="send" size={18} color="#fff" />
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </Animated.View>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, marginTop: 6 }}>
                <Text style={{ fontSize: 11, color: colors.textLight }}>{input.length}/500</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="shield-checkmark" size={11} color={colors.success} />
                  <Text style={{ fontSize: 11, color: colors.textLight, marginLeft: 3 }}>
                    {currentLanguage === 'vi' ? 'Bảo mật' : 'Secure'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Debug - Hiển thị khi có suggestion nhưng không hiện card (chỉ dev) */}
            {__DEV__ && currentSuggestion && !showAppointmentCard && !showBookingConfirmation && (
              <View style={{ 
                position: 'absolute', 
                bottom: 200, 
                left: 20, 
                right: 20, 
                backgroundColor: 'rgba(255,255,0,0.9)', 
                padding: 10,
                borderRadius: 8,
                zIndex: 2000
              }}>
                <Text style={{ fontWeight: 'bold' }}>🔍 DEBUG: Có suggestion nhưng không hiện card</Text>
                <Text>shouldBook: {String(currentSuggestion.shouldBook)}</Text>
                <Text>hasExisting: {String(currentSuggestion.hasExistingAppointment)}</Text>
                <Text>doctors: {currentSuggestion.suggestedDoctors?.length || 0}</Text>
                <Text>specialty: {currentSuggestion.suggestedSpecialty}</Text>
                <TouchableOpacity 
                  onPress={() => setShowAppointmentCard(true)}
                  style={{ backgroundColor: 'blue', padding: 5, borderRadius: 5, marginTop: 5 }}
                >
                  <Text style={{ color: 'white', textAlign: 'center' }}>Hiện card</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Booking Confirmation Card */}
            {showBookingConfirmation && pendingSuggestion && (
              <BookingConfirmationCard
                suggestion={pendingSuggestion}
                onConfirm={() => handleBookingConfirm(pendingSuggestion)}
                onDecline={handleBookingDecline}
                language={currentLanguage}
              />
            )}

            {/* Appointment Card - Hiển thị theo type */}
            {showAppointmentCard && currentSuggestion && renderAppointmentCard()}
          </SafeAreaView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </Animated.View>
  );
};

// ==================== STYLES ====================

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    width: '100%', 
    backgroundColor: '#FAFAFA' 
  },

  header: { 
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0, 
    paddingBottom: 12 
  },
  headerRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 16, 
    paddingTop: 12 
  },
  headerBtn: { 
    width: 44, 
    height: 44, 
    borderRadius: 22, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: 'rgba(255,255,255,0.2)' 
  },
  headerAvatar: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  headerTitle: { 
    fontSize: 17, 
    fontWeight: '700', 
    color: '#fff' 
  },
  headerSubtitle: { 
    fontSize: 12, 
    color: 'rgba(255,255,255,0.9)', 
    marginTop: 1 
  },

  loadingIcon: { 
    width: 80, 
    height: 80, 
    borderRadius: 40, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },

  offlineBanner: { 
    backgroundColor: '#FF9800', 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 16, 
    paddingVertical: 8, 
    gap: 8 
  },
  offlineText: { 
    color: '#fff', 
    fontSize: 13, 
    flex: 1 
  },

  msgContainer: { 
    marginVertical: 6, 
    paddingHorizontal: 4 
  },
  userContainer: { 
    flexDirection: 'row', 
    justifyContent: 'flex-end', 
    alignItems: 'flex-end' 
  },
  botContainer: { 
    flexDirection: 'row', 
    justifyContent: 'flex-start', 
    alignItems: 'flex-start' 
  },
  botAvatar: { 
    width: 34, 
    height: 34, 
    borderRadius: 17, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginRight: 8 
  },
  userAvatar: { 
    width: 30, 
    height: 30, 
    borderRadius: 15, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginLeft: 8 
  },
  msgContent: { 
    maxWidth: '80%' 
  },
  userMsgContent: { 
    alignItems: 'flex-end' 
  },
  botMsgContent: { 
    alignItems: 'flex-start' 
  },
  bubble: { 
    paddingHorizontal: 14, 
    paddingVertical: 10, 
    borderRadius: 18 
  },
  userBubble: { 
    borderBottomRightRadius: 4 
  },
  botBubble: { 
    backgroundColor: '#fff', 
    borderBottomLeftRadius: 4, 
    borderWidth: 1, 
    borderColor: '#E0E0E0', 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 1 }, 
    shadowOpacity: 0.04, 
    shadowRadius: 4, 
    elevation: 1 
  },
  msgText: { 
    fontSize: 14, 
    lineHeight: 21 
  },
  userMsgText: { 
    color: '#fff', 
    fontSize: 14, 
    lineHeight: 21, 
    fontWeight: '500' 
  },
  timestamp: { 
    fontSize: 10, 
    marginTop: 3 
  },
  pendingText: { 
    fontSize: 11, 
    color: 'rgba(255,255,255,0.7)', 
    marginTop: 4 
  },
  failedText: { 
    fontSize: 11, 
    color: '#FFD54F', 
    marginTop: 4 
  },

  confidenceBox: { 
    marginTop: 8, 
    paddingTop: 8, 
    borderTopWidth: 1, 
    borderTopColor: 'rgba(0,0,0,0.08)' 
  },
  confidenceBar: { 
    height: 4, 
    backgroundColor: 'rgba(0,0,0,0.08)', 
    borderRadius: 2, 
    overflow: 'hidden', 
    marginBottom: 3 
  },
  confidenceFill: { 
    height: '100%', 
    borderRadius: 2 
  },
  confidenceLabel: { 
    fontSize: 10, 
    color: '#757575' 
  },

  emergencyBox: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: 'rgba(255,82,82,0.1)', 
    padding: 8, 
    borderRadius: 8, 
    marginTop: 8, 
    borderWidth: 1, 
    borderColor: 'rgba(255,82,82,0.3)' 
  },
  emergencyText: { 
    color: '#FF5252', 
    fontWeight: '700', 
    fontSize: 12, 
    marginLeft: 6 
  },

  bookingConfirmationInline: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.08)',
  },
  confirmationQuestionInline: {
    fontSize: 13,
    color: '#212121',
    fontWeight: '500',
    marginBottom: 8,
  },
  confirmationButtonsInline: {
    flexDirection: 'row',
    gap: 10,
  },
  confirmYesInline: {
    flex: 1,
    backgroundColor: '#00BCD4',
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: 'center',
  },
  confirmYesText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  confirmNoInline: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  confirmNoText: {
    color: '#757575',
    fontWeight: '600',
    fontSize: 14,
  },

  actionsBox: { 
    marginTop: 8, 
    paddingTop: 8, 
    borderTopWidth: 1, 
    borderTopColor: 'rgba(0,0,0,0.08)' 
  },
  actionsTitle: { 
    fontSize: 11, 
    color: '#757575', 
    fontWeight: '600', 
    marginBottom: 4 
  },
  actionChip: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: 'rgba(0,188,212,0.08)', 
    paddingHorizontal: 8, 
    paddingVertical: 3, 
    borderRadius: 12, 
    marginBottom: 3, 
    alignSelf: 'flex-start' 
  },
  actionText: { 
    fontSize: 11, 
    color: '#00BCD4', 
    marginLeft: 4 
  },

  followUpContainer: { 
    marginTop: 10, 
    paddingTop: 10, 
    borderTopWidth: 1, 
    borderTopColor: 'rgba(0,0,0,0.08)' 
  },
  followUpTitle: { 
    fontSize: 12, 
    color: '#757575', 
    fontWeight: '600', 
    marginBottom: 6 
  },
  followUpChip: { 
    flexDirection: 'row', 
    alignItems: 'flex-start', 
    backgroundColor: 'rgba(0,188,212,0.06)', 
    padding: 8, 
    borderRadius: 10, 
    marginBottom: 5, 
    borderWidth: 1, 
    borderColor: 'rgba(0,188,212,0.2)' 
  },
  followUpText: { 
    fontSize: 12, 
    color: '#00BCD4', 
    marginLeft: 6, 
    flex: 1, 
    lineHeight: 18 
  },

  bookBtn: { 
    marginTop: 10, 
    borderRadius: 18, 
    overflow: 'hidden' 
  },
  bookBtnGradient: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingVertical: 7, 
    paddingHorizontal: 14 
  },
  bookBtnText: { 
    color: '#fff', 
    fontSize: 13, 
    fontWeight: '600', 
    marginLeft: 6 
  },

  typingRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginVertical: 6, 
    paddingHorizontal: 4 
  },
  typingBubble: { 
    backgroundColor: '#fff', 
    borderRadius: 18, 
    paddingHorizontal: 14, 
    paddingVertical: 10, 
    borderWidth: 1, 
    borderColor: '#E0E0E0' 
  },
  dot: { 
    width: 6, 
    height: 6, 
    borderRadius: 3, 
    backgroundColor: '#9E9E9E', 
    marginHorizontal: 3 
  },

  errorBar: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#FFEBEE', 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    marginHorizontal: 12, 
    marginBottom: 4, 
    borderRadius: 8, 
    gap: 8 
  },
  errorText: { 
    flex: 1, 
    fontSize: 12 
  },

  inputArea: { 
    paddingHorizontal: 14, 
    paddingTop: 8, 
    paddingBottom: Platform.OS === 'ios' ? 20 : 10, 
    backgroundColor: '#fff', 
    borderTopWidth: 1, 
    borderTopColor: '#E0E0E0' 
  },
  inputRow: { 
    flexDirection: 'row', 
    alignItems: 'flex-end' 
  },
  input: { 
    flex: 1, 
    backgroundColor: '#F5F5F5', 
    borderRadius: 22, 
    paddingHorizontal: 18, 
    paddingVertical: 10, 
    fontSize: 14, 
    maxHeight: 100, 
    borderWidth: 1, 
    borderColor: '#E0E0E0', 
    marginRight: 10, 
    color: '#212121' 
  },
  sendBtn: { 
    width: 46, 
    height: 46, 
    borderRadius: 23, 
    overflow: 'hidden' 
  },
  sendBtnDisabled: { 
    opacity: 0.5 
  },
  sendBtnGradient: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },

  appointmentCard: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 120 : 100,
    left: 12, 
    right: 12,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    maxHeight: height * 0.6,
    zIndex: 1000,
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.15, 
    shadowRadius: 12, 
    elevation: 6,
  },
  closeBtn: { 
    position: 'absolute', 
    top: 10, 
    right: 10, 
    zIndex: 1, 
    padding: 4 
  },
  urgencyBadge: { 
    paddingHorizontal: 10, 
    paddingVertical: 4, 
    borderRadius: 12, 
    alignSelf: 'flex-start', 
    marginBottom: 8 
  },
  urgencyText: { 
    color: '#fff', 
    fontSize: 12, 
    fontWeight: '600' 
  },
  cardTitle: { 
    fontSize: 18, 
    fontWeight: '700', 
    color: '#212121', 
    marginBottom: 6 
  },
  suggestionReason: { 
    fontSize: 13, 
    color: '#424242', 
    lineHeight: 19, 
    marginBottom: 10 
  },

  confirmationQuestion: {
    fontSize: 15,
    color: '#212121',
    fontWeight: '500',
    marginVertical: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  confirmationButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  confirmBtnYes: {
    flex: 2,
  },
  confirmBtnNo: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
  },
  declineBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    gap: 6,
  },
  declineBtnText: {
    color: '#757575',
    fontSize: 14,
    fontWeight: '600',
  },

  existingAppointmentDetails: {
    backgroundColor: '#F0F9FA',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },

  contraindicationBox: { 
    flexDirection: 'row', 
    backgroundColor: '#FFEBEE', 
    padding: 8, 
    borderRadius: 8, 
    marginBottom: 10, 
    borderWidth: 1, 
    borderColor: 'rgba(255,82,82,0.3)', 
    gap: 6 
  },
  contraindicationText: { 
    flex: 1, 
    fontSize: 12, 
    color: '#FF5252', 
    lineHeight: 18 
  },

  symptomsRow: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    marginBottom: 8 
  },
  symptomChip: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#F0F9FA', 
    paddingHorizontal: 8, 
    paddingVertical: 3, 
    borderRadius: 12, 
    marginRight: 6, 
    marginBottom: 4 
  },
  symptomChipText: { 
    fontSize: 11, 
    color: '#00BCD4', 
    marginLeft: 3 
  },

  infoRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 6 
  },
  infoText: { 
    fontSize: 13, 
    color: '#757575', 
    marginLeft: 6 
  },

  doctorsTitle: { 
    fontSize: 14, 
    fontWeight: '600', 
    color: '#212121', 
    marginTop: 8, 
    marginBottom: 8 
  },
  doctorsScroll: { 
    maxHeight: 180 
  },
  doctorCard: { 
    width: 240, 
    marginRight: 10, 
    borderRadius: 14, 
    overflow: 'hidden', 
    borderWidth: 1, 
    borderColor: 'transparent' 
  },
  doctorCardSelected: { 
    borderColor: '#00BCD4', 
    borderWidth: 2 
  },
  doctorCardFull: { 
    opacity: 0.6 
  },
  doctorCardGradient: { 
    padding: 12 
  },
  doctorRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 4 
  },
  doctorName: { 
    fontSize: 14, 
    fontWeight: '600', 
    color: '#212121' 
  },
  ratingRow: { 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  ratingText: { 
    fontSize: 11, 
    color: '#757575', 
    marginLeft: 3 
  },
  fullBadge: { 
    backgroundColor: '#FFEBEE', 
    paddingHorizontal: 5, 
    paddingVertical: 2, 
    borderRadius: 8 
  },
  fullBadgeText: { 
    fontSize: 10, 
    color: '#FF5252', 
    fontWeight: '600' 
  },
  doctorMeta: { 
    flexDirection: 'row', 
    justifyContent: 'space-between' 
  },
  expText: { 
    fontSize: 11, 
    color: '#757575' 
  },
  feeText: { 
    fontSize: 11, 
    color: '#00BCD4', 
    fontWeight: '600' 
  },
  slotsBox: { 
    marginTop: 8 
  },
  slotsLabel: { 
    fontSize: 11, 
    marginBottom: 4 
  },
  slotChip: { 
    backgroundColor: '#fff', 
    paddingHorizontal: 10, 
    paddingVertical: 5, 
    borderRadius: 14, 
    marginRight: 6, 
    borderWidth: 1, 
    borderColor: '#E0E0E0' 
  },
  slotChipSelected: { 
    backgroundColor: '#00BCD4', 
    borderColor: '#00BCD4' 
  },
  slotText: { 
    fontSize: 11, 
    color: '#757575' 
  },

  noDoctorsBox: { 
    alignItems: 'center',
    backgroundColor: '#F5F5F5', 
    borderRadius: 10, 
    padding: 15, 
    marginVertical: 8, 
    gap: 10 
  },
  noDoctorsText: { 
    fontSize: 13, 
    color: '#757575', 
    lineHeight: 18,
    textAlign: 'center',
  },

  confirmBtn: { 
    borderRadius: 12, 
    overflow: 'hidden', 
    marginTop: 10 
  },
  confirmBtnDisabled: { 
    opacity: 0.5 
  },
  confirmBtnGradient: { 
    paddingVertical: 13, 
    alignItems: 'center' 
  },
  confirmBtnText: { 
    color: '#fff', 
    fontSize: 15, 
    fontWeight: '600' 
  },

  consentOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.6)', 
    justifyContent: 'center', 
    padding: 20 
  },
  consentBox: { 
    backgroundColor: '#fff', 
    borderRadius: 20, 
    overflow: 'hidden', 
    maxHeight: height * 0.8 
  },
  consentHeader: { 
    padding: 24, 
    alignItems: 'center' 
  },
  consentTitle: { 
    fontSize: 20, 
    fontWeight: '700', 
    color: '#fff', 
    marginTop: 10 
  },
  consentContent: { 
    padding: 20, 
    maxHeight: height * 0.4 
  },
  consentText: { 
    fontSize: 14, 
    color: '#424242', 
    lineHeight: 22 
  },
  consentButtons: { 
    flexDirection: 'row', 
    padding: 16, 
    gap: 12, 
    borderTopWidth: 1, 
    borderTopColor: '#E0E0E0' 
  },
  consentBtn: { 
    flex: 1, 
    borderRadius: 12, 
    overflow: 'hidden' 
  },
  declineBtn: { 
    backgroundColor: '#F5F5F5', 
    paddingVertical: 14, 
    alignItems: 'center', 
    borderRadius: 12 
  },
  declineBtnText: { 
    color: '#757575', 
    fontWeight: '600', 
    fontSize: 15 
  },
  acceptBtn: { 
    borderRadius: 12, 
    overflow: 'hidden' 
  },
  acceptBtnGradient: { 
    paddingVertical: 14, 
    alignItems: 'center' 
  },
  acceptBtnText: { 
    color: '#fff', 
    fontWeight: '700', 
    fontSize: 15 
  },

  emergencyOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    padding: 20,
  },
  emergencyHeader: {
    padding: 24,
    alignItems: 'center',
  },
  emergencyTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    marginTop: 10,
  },
  emergencyContent: {
    padding: 20,
    maxHeight: height * 0.4,
  },
  emergencyText: {
    fontSize: 16,
    color: '#212121',
    lineHeight: 24,
  },
  emergencyButtons: {
    padding: 16,
    gap: 10,
  },
  emergencyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  callBtn: {
    backgroundColor: '#D32F2F',
  },
  mapBtn: {
    backgroundColor: '#1976D2',
  },
  closeEmergencyBtn: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  closeEmergencyText: {
    color: '#757575',
    fontSize: 16,
    fontWeight: '600',
  },
  emergencyBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ChatWidget;