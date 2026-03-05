import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  Dimensions,
  StatusBar,
  Alert,
  SafeAreaView,
  Modal,
  ScrollView,
  Linking, // ✅ FIX #12: Thêm Linking để gọi điện
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

const { width, height } = Dimensions.get('window');
const moderateScale = (size: number, factor = 0.5) =>
  size + ((width / 375) * size - size) * factor;
const API_BASE_URL = 'http://localhost:3000/api';

// ==================== TYPES ====================

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
  appointmentRecommendation?: AppointmentSuggestion;
}

interface AppointmentSuggestion {
  shouldBook: boolean;
  urgencyLevel: 'low' | 'medium' | 'high';
  suggestedSpecialty?: string;
  suggestedSpecialtyId?: string;
  recommendedTimeframe?: string;
  reason?: string;
  symptoms: string[];
  hasExistingAppointment?: boolean;
  suggestedDoctors?: Array<{
    id: string;
    name: string;
    availableSlots: string[];
    consultationFee?: number;
    experience?: number;
    rating?: number;
  }>;
}

interface AIResponse {
  success: boolean;
  data: {
    response: string;
    confidence: number;
    suggestedActions?: string[];
    emergencyAlert?: boolean;
    category?: string;
    relatedSpecialties?: string[];
    language?: 'en' | 'vi';
    appointmentRecommendation?: AppointmentSuggestion;
    session_id?: string;
  };
}

interface Doctor {
  _id: string;
  name: string;
  specialty: { id: string; name: string; icon?: string; color?: string };
  consultation_fee: number;
  years_of_experience: number;
  rating?: { average: number; total: number };
  available_slots: string[];
  next_available_date: string;
  is_available_today: boolean;
}

interface ChatWidgetProps {
  onBackToHome?: () => void;
  showBackButton?: boolean;
  isFullScreen?: boolean;
}

type RootStackParamList = {
  Home: undefined;
  Login: undefined;
  ChatOption: undefined;
  AppointmentBooking: { doctorId: string; initialData?: any };
};

type NavigationProp = StackNavigationProp<RootStackParamList>;

// ==================== AUTH HELPERS ====================

// ✅ FIX #13: Token refresh flow
async function getValidToken(): Promise<string | null> {
  const token = await AsyncStorage.getItem('authToken');
  if (!token) return null;
  return token;
}

async function tryRefreshToken(): Promise<string | null> {
  try {
    const refreshToken = await AsyncStorage.getItem('refreshToken');
    if (!refreshToken) return null;

    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (data.success && data.data?.accessToken) {
      await AsyncStorage.setItem('authToken', data.data.accessToken);
      return data.data.accessToken;
    }
    return null;
  } catch {
    return null;
  }
}

// ==================== APPOINTMENT SUGGESTION CARD ====================

const AppointmentSuggestionCard = ({
  suggestion,
  onBook,
  onClose,
  colors,
}: {
  suggestion: AppointmentSuggestion;
  onBook: (doctorId: string, timeSlot: string, doctorName: string) => void;
  onClose: () => void;
  colors: any;
}) => {
  const [selectedDoctor, setSelectedDoctor] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [selectedDoctorName, setSelectedDoctorName] = useState<string>('');
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 1,
      tension: 100,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, []);

  const getUrgencyColor = (level: string) => {
    switch (level) {
      case 'high': return '#FF5252';
      case 'medium': return '#FF9800';
      default: return '#00BCD4';
    }
  };

  const getUrgencyText = (level: string) => {
    switch (level) {
      case 'high': return '🚨 Khẩn cấp';
      case 'medium': return '⚠️ Nên khám sớm';
      default: return '📋 Khám định kỳ';
    }
  };

  // Nếu bệnh nhân đã có lịch hẹn
  if (suggestion.hasExistingAppointment) {
    return (
      <Animated.View
        style={[
          styles.appointmentSuggestion,
          { transform: [{ translateY: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [300, 0] }) }] },
        ]}
      >
        <LinearGradient colors={['#FFFFFF', '#F8F9FA']} style={styles.suggestionGradient}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={20} color="#757575" />
          </TouchableOpacity>
          <View style={styles.suggestionHeader}>
            <View style={[styles.urgencyBadge, { backgroundColor: '#00BCD4' }]}>
              <Text style={styles.urgencyText}>📅 Đã có lịch hẹn</Text>
            </View>
          </View>
          <Text style={styles.suggestionReason}>{suggestion.reason}</Text>
        </LinearGradient>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      style={[
        styles.appointmentSuggestion,
        { transform: [{ translateY: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [300, 0] }) }] },
      ]}
    >
      <LinearGradient colors={['#FFFFFF', '#F8F9FA']} style={styles.suggestionGradient}>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Ionicons name="close" size={20} color="#757575" />
        </TouchableOpacity>

        <View style={styles.suggestionHeader}>
          <View style={[styles.urgencyBadge, { backgroundColor: getUrgencyColor(suggestion.urgencyLevel) }]}>
            <Text style={styles.urgencyText}>{getUrgencyText(suggestion.urgencyLevel)}</Text>
          </View>
          <Text style={styles.suggestionTitle}>Đặt Lịch Khám</Text>
        </View>

        <Text style={styles.suggestionReason}>{suggestion.reason}</Text>

        {suggestion.symptoms && suggestion.symptoms.length > 0 && (
          <View style={styles.symptomsList}>
            <Text style={styles.symptomsTitle}>Triệu chứng phát hiện:</Text>
            <View style={styles.symptomsContainer}>
              {suggestion.symptoms.map((symptom, index) => (
                <View key={index} style={styles.symptomChip}>
                  <Ionicons name="medical" size={14} color="#00BCD4" />
                  <Text style={styles.symptomText}>{symptom}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.infoRow}>
          <Ionicons name="time-outline" size={16} color="#00BCD4" />
          <Text style={styles.infoText}>{suggestion.recommendedTimeframe}</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="medical-outline" size={16} color="#00BCD4" />
          <Text style={styles.infoText}>Chuyên khoa: {suggestion.suggestedSpecialty}</Text>
        </View>

        {suggestion.suggestedDoctors && suggestion.suggestedDoctors.length > 0 ? (
          // ✅ Có bác sĩ → hiển thị danh sách chọn
          <View style={styles.doctorsList}>
            <Text style={styles.doctorsTitle}>Bác sĩ có thể khám:</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.doctorsScroll}
              nestedScrollEnabled
            >
              {suggestion.suggestedDoctors.map((doctor) => {
                const hasSlots = doctor.availableSlots && doctor.availableSlots.length > 0;
                return (
                <TouchableOpacity
                  key={doctor.id}
                  style={[
                    styles.doctorCard,
                    selectedDoctor === doctor.id && styles.selectedDoctor,
                    !hasSlots && styles.doctorCardFull,
                  ]}
                  onPress={() => {
                    if (!hasSlots) return; // Disable nếu hết slot
                    setSelectedDoctor(doctor.id);
                    setSelectedDoctorName(doctor.name);
                    setSelectedSlot('');
                  }}
                  activeOpacity={hasSlots ? 0.8 : 1}
                >
                  <LinearGradient
                    colors={
                      !hasSlots ? ['#F5F5F5', '#EEEEEE'] :
                      selectedDoctor === doctor.id ? ['#00BCD4', '#00ACC1'] :
                      ['#F5F5F5', '#EEEEEE']
                    }
                    style={styles.doctorCardGradient}
                  >
                    <View style={styles.doctorHeader}>
                      <Text style={[
                        styles.doctorName,
                        selectedDoctor === doctor.id && styles.selectedDoctorText,
                        !hasSlots && styles.doctorNameFull,
                      ]}>
                        Bs. {doctor.name}
                      </Text>
                      {!hasSlots ? (
                        <View style={styles.fullBadge}>
                          <Text style={styles.fullBadgeText}>Hết lịch</Text>
                        </View>
                      ) : doctor.rating && doctor.rating > 0 ? (
                        <View style={styles.ratingContainer}>
                          <Ionicons name="star" size={12} color="#FFC107" />
                          <Text style={[styles.ratingText, selectedDoctor === doctor.id && styles.selectedDoctorText]}>
                            {doctor.rating.toFixed(1)}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <View style={styles.doctorDetails}>
                      <Text style={[
                        styles.experienceText,
                        selectedDoctor === doctor.id && styles.selectedDoctorText,
                        !hasSlots && styles.doctorNameFull,
                      ]}>
                        {doctor.experience || 0}+ năm KN
                      </Text>
                      <Text style={[
                        styles.feeText,
                        !hasSlots && { color: '#BDBDBD' },
                      ]}>
                        {doctor.consultationFee
                          ? `${(doctor.consultationFee).toLocaleString('vi-VN')}đ`
                          : 'Liên hệ'}
                      </Text>
                    </View>
                    {selectedDoctor === doctor.id && hasSlots && (
                      <View style={styles.slotsContainer}>
                        <Text style={[styles.slotsTitle, { color: '#fff' }]}>Chọn giờ:</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                          {doctor.availableSlots.map((slot) => (
                            <TouchableOpacity
                              key={slot}
                              style={[styles.slotChip, selectedSlot === slot && styles.selectedSlot]}
                              onPress={() => setSelectedSlot(slot)}
                            >
                              <Text style={[styles.slotText, selectedSlot === slot && styles.selectedSlotText]}>
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
        ) : suggestion.suggestedDoctors !== undefined ? (
          // ✅ suggestedDoctors = [] → có specialtyId nhưng không có bác sĩ trống lịch
          <View style={styles.noDoctorsInline}>
            <Ionicons name="calendar-outline" size={24} color="#BDBDBD" />
            <Text style={styles.noDoctorsInlineText}>
              Không có bác sĩ trống lịch ngày mai.{'\n'}Hãy thử chọn ngày khác.
            </Text>
          </View>
        ) : (
          // ✅ suggestedDoctors = undefined → không tìm được specialtyId trong DB
          // Không hiện spinner — hiện nút để bệnh nhân tự tìm bác sĩ
          <View style={styles.noDoctorsInline}>
            <Ionicons name="search-outline" size={24} color="#00BCD4" />
            <Text style={styles.noDoctorsInlineText}>
              Chuyên khoa <Text style={{ fontWeight: '700', color: '#00BCD4' }}>
                {suggestion.suggestedSpecialty}
              </Text> chưa có trong hệ thống.{'\n'}
              Vui lòng liên hệ phòng khám để đặt lịch.
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.bookButton, (!selectedDoctor || !selectedSlot) && styles.bookButtonDisabled]}
          onPress={() => {
            if (selectedDoctor && selectedSlot) {
              onBook(selectedDoctor, selectedSlot, selectedDoctorName);
            }
          }}
          disabled={!selectedDoctor || !selectedSlot}
        >
          <LinearGradient
            colors={!selectedDoctor || !selectedSlot ? ['#BDBDBD', '#9E9E9E'] : ['#00BCD4', '#00ACC1']}
            style={styles.bookButtonGradient}
          >
            <Text style={styles.bookButtonText}>Xác Nhận Đặt Lịch</Text>
          </LinearGradient>
        </TouchableOpacity>
      </LinearGradient>
    </Animated.View>
  );
};

// ==================== DOCTOR SELECTION MODAL ====================

const DoctorSelectionModal = ({
  visible,
  onClose,
  specialtyId,
  specialtyName,
  onSelectDoctor,
}: {
  visible: boolean;
  onClose: () => void;
  specialtyId: string;
  specialtyName: string;
  onSelectDoctor: (doctorId: string, timeSlot: string, doctorName: string) => void;
}) => {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [selectedDoctorName, setSelectedDoctorName] = useState<string>('');
  const [date, setDate] = useState(new Date());

  useEffect(() => {
    if (visible && specialtyId) fetchDoctors();
  }, [visible, specialtyId, date]);

  const fetchDoctors = async () => {
    setLoading(true);
    try {
      const token = await getValidToken();
      const dateStr = date.toISOString().split('T')[0];
      const response = await fetch(
        `${API_BASE_URL}/ai-medical/specialties/${specialtyId}/doctors?date=${dateStr}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.ok) {
        const data = await response.json();
        if (data.success) setDoctors(data.data.doctors);
      }
    } catch (error) {
      console.error('Error fetching doctors:', error);
    } finally {
      setLoading(false);
    }
  };

  const changeDate = (days: number) => {
    const newDate = new Date(date);
    newDate.setDate(newDate.getDate() + days);
    if (newDate >= new Date()) setDate(newDate);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <LinearGradient colors={['#00BCD4', '#00ACC1']} style={styles.modalHeader}>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Chọn Bác Sĩ</Text>
            <Text style={styles.modalSubtitle}>{specialtyName}</Text>
          </LinearGradient>

          <View style={styles.dateSelector}>
            <TouchableOpacity onPress={() => changeDate(-1)}>
              <Ionicons name="chevron-back" size={24} color="#00BCD4" />
            </TouchableOpacity>
            <Text style={styles.dateText}>
              {date.toLocaleDateString('vi-VN', { weekday: 'short', month: 'short', day: 'numeric' })}
            </Text>
            <TouchableOpacity onPress={() => changeDate(1)}>
              <Ionicons name="chevron-forward" size={24} color="#00BCD4" />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.modalLoading}>
              <ActivityIndicator size="large" color="#00BCD4" />
              <Text style={styles.modalLoadingText}>Đang tìm bác sĩ...</Text>
            </View>
          ) : (
            <ScrollView style={styles.doctorsListModal}>
              {doctors.map((doctor) => (
                <TouchableOpacity
                  key={doctor._id}
                  style={[styles.modalDoctorCard, selectedDoctor === doctor._id && styles.modalSelectedDoctor]}
                  onPress={() => {
                    setSelectedDoctor(doctor._id);
                    setSelectedDoctorName(doctor.name);
                    setSelectedSlot('');
                  }}
                >
                  <View style={styles.modalDoctorHeader}>
                    <View>
                      <Text style={styles.modalDoctorName}>Bs. {doctor.name}</Text>
                      <View style={styles.modalDoctorRating}>
                        <Ionicons name="star" size={14} color="#FFC107" />
                        <Text style={styles.modalRatingText}>
                          {doctor.rating?.average.toFixed(1) || 'Mới'} ({doctor.rating?.total || 0} đánh giá)
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.modalDoctorFee}>
                      {doctor.consultation_fee.toLocaleString('vi-VN')}đ
                    </Text>
                  </View>
                  <Text style={styles.modalDoctorExp}>
                    {doctor.years_of_experience}+ năm kinh nghiệm
                  </Text>
                  {selectedDoctor === doctor._id && (
                    <View style={styles.modalSlotsContainer}>
                      <Text style={styles.modalSlotsTitle}>Giờ trống:</Text>
                      <View style={styles.modalSlotsGrid}>
                        {doctor.available_slots.map((slot) => (
                          <TouchableOpacity
                            key={slot}
                            style={[styles.modalSlotChip, selectedSlot === slot && styles.modalSelectedSlot]}
                            onPress={() => setSelectedSlot(slot)}
                          >
                            <Text style={[styles.modalSlotText, selectedSlot === slot && styles.modalSelectedSlotText]}>
                              {slot}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
              {doctors.length === 0 && (
                <View style={styles.noDoctorsContainer}>
                  <Ionicons name="calendar-outline" size={48} color="#BDBDBD" />
                  <Text style={styles.noDoctorsText}>Không có bác sĩ nào cho ngày này</Text>
                  <TouchableOpacity style={styles.tryAnotherDate} onPress={() => changeDate(1)}>
                    <Text style={styles.tryAnotherDateText}>Thử ngày khác</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          )}

          {selectedDoctor && selectedSlot && (
            <TouchableOpacity
              style={styles.modalBookButton}
              onPress={() => { onSelectDoctor(selectedDoctor, selectedSlot, selectedDoctorName); onClose(); }}
            >
              <LinearGradient colors={['#00BCD4', '#00ACC1']} style={styles.modalBookButtonGradient}>
                <Text style={styles.modalBookButtonText}>Xác Nhận Đặt Lịch</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};

// ==================== MESSAGE ITEM ====================

const MessageItem = ({
  item,
  index,
  isUser,
  showAvatar,
  colors,
  onBookAppointment,
}: {
  item: ChatMessage;
  index: number;
  isUser: boolean;
  showAvatar: boolean;
  colors: any;
  onBookAppointment?: (suggestion: AppointmentSuggestion) => void;
}) => {
  const messageAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(messageAnim, {
      toValue: 1,
      delay: Math.min(index * 50, 300), // Cap delay
      tension: 100,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.messageContainer,
        isUser ? styles.userContainer : styles.botContainer,
        {
          opacity: messageAnim,
          transform: [{ translateY: messageAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
        },
      ]}
    >
      {!isUser && showAvatar && (
        <LinearGradient colors={colors.gradientPrimary} style={styles.botAvatarGradient}>
          <Ionicons name={item.emergencyAlert ? 'warning' : 'medical'} size={18} color="#FFFFFF" />
        </LinearGradient>
      )}

      <View style={[styles.messageContent, isUser ? styles.userContent : styles.botContent]}>
        {isUser ? (
          <LinearGradient colors={colors.gradientPrimary} style={[styles.messageBubble, styles.userBubble]}>
            <Text style={styles.userMessageText}>{item.content}</Text>
          </LinearGradient>
        ) : (
          <View style={[styles.messageBubble, styles.botBubble]}>
            <Text style={[styles.messageText, { color: colors.textPrimary }]}>{item.content}</Text>

            {item.confidence !== undefined && (
              <View style={styles.confidenceContainer}>
                <View style={styles.confidenceBar}>
                  <View
                    style={[
                      styles.confidenceFill,
                      {
                        width: `${item.confidence * 100}%`,
                        backgroundColor:
                          item.confidence > 0.7 ? '#00BCD4' : item.confidence > 0.5 ? '#FF9800' : '#FF5252',
                      },
                    ]}
                  />
                </View>
                <Text style={styles.confidenceText}>{Math.round(item.confidence * 100)}% độ tin cậy</Text>
              </View>
            )}

            {item.suggestedActions && item.suggestedActions.length > 0 && (
              <View style={styles.actionsContainer}>
                <Text style={styles.actionsTitle}>Gợi ý:</Text>
                {item.suggestedActions.map((action, idx) => (
                  <View key={idx} style={styles.actionChip}>
                    <Ionicons name="checkmark-circle" size={14} color="#00BCD4" />
                    <Text style={styles.actionText}>{action}</Text>
                  </View>
                ))}
              </View>
            )}

            {item.emergencyAlert && (
              <View style={styles.emergencyContainer}>
                <Ionicons name="warning" size={16} color="#FF5252" />
                <Text style={styles.emergencyText}>TÌNH HUỐNG KHẨN CẤP - CẦN CẤP CỨU NGAY</Text>
              </View>
            )}

            {item.appointmentRecommendation?.shouldBook && onBookAppointment && (
              <TouchableOpacity
                style={styles.bookSuggestionButton}
                onPress={() => onBookAppointment(item.appointmentRecommendation!)}
              >
                <LinearGradient colors={['#00BCD4', '#00ACC1']} style={styles.bookSuggestionGradient}>
                  <Ionicons name="calendar" size={16} color="#FFFFFF" />
                  <Text style={styles.bookSuggestionText}>Đặt Lịch Khám</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        )}

        <Text style={[styles.timestamp, { color: colors.textLight }]}>
          {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>

      {isUser && showAvatar && (
        <LinearGradient colors={colors.gradientSecondary} style={styles.userAvatarGradient}>
          <Ionicons name="person" size={16} color="#FFFFFF" />
        </LinearGradient>
      )}
    </Animated.View>
  );
};

// ==================== TYPING INDICATOR ====================

const TypingIndicator = ({ isTyping, colors }: { isTyping: boolean; colors: any }) => {
  const typingAnim = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    if (isTyping) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(typingAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
          Animated.timing(typingAnim, { toValue: 0.5, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    } else {
      typingAnim.setValue(0.5);
    }
  }, [isTyping]);

  if (!isTyping) return null;

  return (
    <Animated.View style={[styles.typingContainer, { opacity: typingAnim }]}>
      <LinearGradient colors={colors.gradientPrimary} style={styles.botAvatarGradient}>
        <Ionicons name="medical" size={18} color="#FFFFFF" />
      </LinearGradient>
      <View style={styles.typingBubble}>
        <Text style={[styles.typingText, { color: colors.textSecondary }]}>Đang phân tích...</Text>
        <View style={styles.typingDots}>
          {[0, 1, 2].map((i) => (
            <Animated.View key={i} style={[styles.typingDot, { opacity: typingAnim }]} />
          ))}
        </View>
      </View>
    </Animated.View>
  );
};

// ==================== CHAT HEADER ====================

const ChatHeader = ({
  onBackToHome,
  onClearChat,
  isTyping,
}: {
  onBackToHome: () => void;
  onClearChat: () => void;
  isTyping: boolean;
}) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isTyping) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.1, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isTyping]);

  return (
    <View style={styles.headerWrapper}>
      <StatusBar barStyle="light-content" backgroundColor="#00BCD4" />
      <LinearGradient
        colors={['#00BCD4', '#00ACC1', '#0097A7']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <SafeAreaView>
          <View style={styles.headerContainer}>
            <View style={styles.headerTopBar}>
              <TouchableOpacity style={styles.glassButton} onPress={onBackToHome} activeOpacity={0.8}>
                <View style={styles.buttonGlass} />
                <Ionicons name="chevron-back" size={moderateScale(24)} color="#FFFFFF" />
              </TouchableOpacity>

              <View style={styles.headerCenter}>
                <Animated.View style={[styles.avatarContainer, { transform: [{ scale: pulseAnim }] }]}>
                  <LinearGradient colors={['#00BCD4', '#00ACC1', '#0097A7']} style={styles.aiAvatar}>
                    <Ionicons name="medical" size={moderateScale(20)} color="#FFFFFF" />
                  </LinearGradient>
                </Animated.View>
                <View style={styles.headerTextContainer}>
                  <Text style={styles.headerTitle}>HealthAI Assistant</Text>
                  <View style={styles.statusContainer}>
                    <View style={[styles.statusDot, isTyping && styles.statusDotActive]} />
                    <Text style={styles.headerSubtitle}>{isTyping ? 'Đang phân tích...' : 'Sẵn sàng hỗ trợ'}</Text>
                  </View>
                </View>
              </View>

              <TouchableOpacity style={styles.glassButton} onPress={onClearChat} activeOpacity={0.8}>
                <View style={styles.buttonGlass} />
                <Ionicons name="refresh-outline" size={moderateScale(22)} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
};

// ==================== MAIN CHAT WIDGET ====================

const ChatWidget: React.FC<ChatWidgetProps> = ({
  onBackToHome,
  showBackButton = true,
  isFullScreen = false,
}) => {
  const navigation = useNavigation<NavigationProp>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [currentSession, setCurrentSession] = useState<any>(null);
  const flatListRef = useRef<FlatList>(null);
  const [currentLanguage, setCurrentLanguage] = useState<'en' | 'vi'>('vi');
  const inputAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [showAppointmentSuggestion, setShowAppointmentSuggestion] = useState(false);
  const [currentAppointmentSuggestion, setCurrentAppointmentSuggestion] =
    useState<AppointmentSuggestion | null>(null);
  const [showDoctorModal, setShowDoctorModal] = useState(false);
  const [selectedSpecialty, setSelectedSpecialty] = useState<{ id: string; name: string } | null>(null);

  const colors = {
    primary: '#00BCD4',
    primaryLight: '#4DD0E1',
    primaryDark: '#0097A7',
    background: '#FAFAFA',
    surface: '#FFFFFF',
    surfaceLight: '#F5F5F5',
    textPrimary: '#212121',
    textSecondary: '#757575',
    textLight: '#9E9E9E',
    error: '#FF5252',
    success: '#00BCD4',
    border: '#E0E0E0',
    gradientPrimary: ['#00BCD4', '#00ACC1'] as [string, string],
    gradientSecondary: ['#00ACC1', '#0097A7'] as [string, string],
  };

  // ==================== INIT ====================

  useEffect(() => {
    initializeChat();
    return () => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (isInitialized) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 1, tension: 100, friction: 8, useNativeDriver: true }),
      ]).start();
    }
  }, [isInitialized]);

  useEffect(() => {
    Animated.spring(inputAnim, {
      toValue: input.length > 0 ? 1 : 0,
      useNativeDriver: true,
      tension: 200,
      friction: 12,
    }).start();
  }, [input]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = useCallback((animated = true) => {
    if (flatListRef.current && messages.length > 0) {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated });
      }, 100);
    }
  }, [messages.length]);

  const initializeChat = async () => {
    setLoading(true);
    try {
      const token = await getValidToken();
      if (!token) {
        setError('Vui lòng đăng nhập để sử dụng HealthAI Assistant');
        setIsInitialized(true);
        return;
      }
      await loadChatHistory(token);
      setIsInitialized(true);
    } catch {
      setError('Không thể khởi động trợ lý y tế');
      setIsInitialized(true);
    } finally {
      setLoading(false);
    }
  };

  const loadChatHistory = async (token: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/ai-medical/session`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data.messages?.length > 0) {
          const formatted: ChatMessage[] = data.data.messages.map((msg: any) => ({
            role: msg.role,
            content: msg.content,
            timestamp: new Date(msg.timestamp).toISOString(),
            id: `${msg.timestamp}-${msg.role}`,
            category: msg.category,
            confidence: msg.confidence,
            suggestedActions: msg.suggestedActions,
            emergencyAlert: msg.emergencyAlert,
            relatedSpecialties: msg.relatedSpecialties,
            language: msg.language,
            appointmentRecommendation: msg.appointmentRecommendation,
          }));
          setMessages(formatted);
          setCurrentSession(data.data.session);
          return;
        }
        if (data.data?.session) setCurrentSession(data.data.session);
      }

      // Welcome message
      setMessages([{
        role: 'assistant',
        content: 'Xin chào! Tôi là Trợ lý Y tế AI của bạn. Tôi có thể giúp bạn:\n\n• Tra cứu thông tin thuốc và bệnh lý\n• Giải thích thuật ngữ y khoa\n• Gợi ý đặt lịch khám bác sĩ phù hợp\n\nHãy mô tả triệu chứng hoặc câu hỏi của bạn!\n\n⚕️ Lưu ý: Tôi cung cấp thông tin giáo dục, không thay thế tư vấn y tế chuyên nghiệp.',
        timestamp: new Date().toISOString(),
        id: `welcome-${Date.now()}`,
        category: 'general',
        confidence: 0.9,
        language: 'vi',
      }]);
    } catch {
      setMessages([{
        role: 'assistant',
        content: 'Xin chào! Tôi là Trợ lý Y tế AI. Hãy hỏi tôi về sức khỏe của bạn!\n\n⚕️ Thông tin này chỉ mang tính giáo dục, không thay thế tư vấn y tế chuyên nghiệp.',
        timestamp: new Date().toISOString(),
        id: `welcome-fallback-${Date.now()}`,
        category: 'general',
        language: 'vi',
      }]);
    }
  };

  // ==================== SEND MESSAGE ====================

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    setLoading(true);
    setError(null);

    const userMsg: ChatMessage = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
      id: `user-${Date.now()}`,
      language: currentLanguage,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      // ✅ FIX #13: Lấy token, thử refresh nếu cần
      let token = await getValidToken();
      if (!token) {
        token = await tryRefreshToken();
        if (!token) {
          navigation.navigate('Login');
          return;
        }
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      let response: Response;
      try {
        response = await fetch(`${API_BASE_URL}/ai-medical/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ message: userMsg.content }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      // ✅ FIX #13: Nếu 401 thì thử refresh token thay vì logout ngay
      if (response.status === 401) {
        const newToken = await tryRefreshToken();
        if (newToken) {
          // Retry với token mới
          response = await fetch(`${API_BASE_URL}/ai-medical/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${newToken}` },
            body: JSON.stringify({ message: userMsg.content }),
          });
        } else {
          await AsyncStorage.multiRemove(['authToken', 'refreshToken', 'userData']);
          Alert.alert('Phiên đăng nhập hết hạn', 'Vui lòng đăng nhập lại.', [
            { text: 'OK', onPress: () => navigation.navigate('Login') },
          ]);
          return;
        }
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Lỗi xử lý yêu cầu');
      }

      const data: AIResponse = await response.json();
      if (!data.success) throw new Error('Lỗi dịch vụ AI');

      if (data.data.session_id && !currentSession) {
        setCurrentSession({ session_id: data.data.session_id });
      }

      if (data.data.language) setCurrentLanguage(data.data.language);

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
          language: data.data.language || currentLanguage,
          appointmentRecommendation: data.data.appointmentRecommendation,
        };
        setMessages((prev) => [...prev, botMsg]);

        if (data.data.appointmentRecommendation?.shouldBook) {
          setCurrentAppointmentSuggestion(data.data.appointmentRecommendation);
          setShowAppointmentSuggestion(true);
        }

        // ✅ FIX #12: Emergency alert với nút gọi điện thực sự
        if (data.data.emergencyAlert) {
          Alert.alert(
            '🚨 TÌNH HUỐNG KHẨN CẤP',
            'Đây có thể là tình huống cần cấp cứu. Hãy gọi ngay hoặc đến bệnh viện gần nhất!',
            [
              {
                text: '📞 Gọi 115',
                onPress: () => Linking.openURL('tel:115'), // ✅ FIX #12
                style: 'destructive',
              },
              { text: 'Tôi đã hiểu', style: 'cancel' },
            ]
          );
        }
      }, 800 + Math.random() * 400);
    } catch (err: any) {
      setIsTyping(false);

      let errorMsg = 'Không thể xử lý yêu cầu. Vui lòng thử lại.';
      if (err.name === 'AbortError') errorMsg = 'Yêu cầu hết thời gian. Vui lòng thử lại.';
      else if (err.message) errorMsg = err.message;

      setError(errorMsg);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Xin lỗi, tôi đang gặp sự cố kỹ thuật. Vui lòng thử lại sau hoặc liên hệ trực tiếp với bác sĩ nếu cần gấp.\n\n⚕️ Thông tin này chỉ mang tính giáo dục, không thay thế tư vấn y tế chuyên nghiệp.',
          timestamp: new Date().toISOString(),
          id: `fallback-${Date.now()}`,
          category: 'general',
          confidence: 0.3,
          language: currentLanguage,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // ==================== CLEAR CHAT ====================

  const clearChat = async () => {
    Alert.alert(
      'Bắt đầu cuộc trò chuyện mới?',
      'Tất cả tin nhắn hiện tại sẽ được xóa.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await getValidToken();
              if (token && currentSession) {
                await fetch(`${API_BASE_URL}/ai-medical/session/${currentSession.session_id}/close`, {
                  method: 'POST',
                  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                });
              }

              // Load session mới
              if (token) await loadChatHistory(token);

              setMessages([{
                role: 'assistant',
                content: '🆕 Cuộc tư vấn mới bắt đầu! Tôi có thể giúp gì cho bạn hôm nay?\n\n⚕️ Thông tin này chỉ mang tính giáo dục, không thay thế tư vấn y tế chuyên nghiệp.',
                timestamp: new Date().toISOString(),
                id: `clear-${Date.now()}`,
                category: 'general',
                confidence: 0.9,
                language: 'vi',
              }]);
              setCurrentSession(null);
              setShowAppointmentSuggestion(false);
            } catch {
              setError('Không thể xóa lịch sử chat');
            }
          },
        },
      ]
    );
  };

  // ==================== BACK TO HOME ====================

  const handleBackToHome = useCallback(async () => {
    if (onBackToHome && typeof onBackToHome === 'function') {
      onBackToHome();
    } else if (navigation?.goBack) {
      navigation.goBack();
    }
  }, [onBackToHome, navigation]);

  // ==================== APPOINTMENT HANDLING ====================

  const handleBookAppointment = async (doctorId: string, timeSlot: string, doctorName: string) => {
    if (!currentAppointmentSuggestion) return;
    setLoading(true);

    try {
      const token = await getValidToken();
      if (!token) {
        Alert.alert('Lỗi', 'Vui lòng đăng nhập để đặt lịch');
        return;
      }

      const appointmentDate = new Date();
      appointmentDate.setDate(appointmentDate.getDate() + 1);
      const dateStr = appointmentDate.toISOString().split('T')[0];

      const response = await fetch(`${API_BASE_URL}/ai-medical/appointments/book-from-ai`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doctor_id: doctorId,
          appointment_date: dateStr,
          time_slot: timeSlot,
          symptoms: currentAppointmentSuggestion.symptoms,
          reason: currentAppointmentSuggestion.reason,
          urgency_level: currentAppointmentSuggestion.urgencyLevel,
          session_id: currentSession?.session_id,
        }),
      });

      const data = await response.json();

      if (data.success) {
        Alert.alert(
          '✅ Đặt lịch thành công',
          `Lịch hẹn với Bác sĩ ${doctorName} vào ${dateStr} lúc ${timeSlot} đã được xác nhận.`,
          [
            {
              text: 'Xem chi tiết',
              onPress: () => {
                navigation.navigate('AppointmentBooking', {
                  doctorId,
                  initialData: data.data.appointment,
                });
              },
            },
            {
              text: 'OK',
              onPress: () => {
                setShowAppointmentSuggestion(false);
                setCurrentAppointmentSuggestion(null);
              },
            },
          ]
        );
      } else {
        Alert.alert('Lỗi', data.message || 'Không thể đặt lịch');
      }
    } catch {
      Alert.alert('Lỗi', 'Không thể đặt lịch. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  // ==================== QUICK REPLIES ====================

  const quickReplies = [
    '🤒 Triệu chứng cảm cúm thông thường',
    '💊 Tác dụng phụ của thuốc paracetamol',
    '🩺 Huyết áp bình thường là bao nhiêu?',
    '🍎 Chế độ ăn uống lành mạnh cho tim',
    '😴 Cách cải thiện chất lượng giấc ngủ',
    '🧘 Kỹ thuật giảm stress hiệu quả',
  ];

  const renderQuickReplies = () => {
    if (messages.length > 1 || loading || !isInitialized) return null;
    return (
      <Animated.View style={[styles.quickRepliesContainer, { opacity: fadeAnim }]}>
        <Text style={[styles.quickRepliesTitle, { color: colors.textSecondary }]}>
          💡 Câu hỏi thường gặp
        </Text>
        {/* ✅ FIX #11: Dùng View bọc ngoài thay vì gradient absoluteFill */}
        <View style={styles.quickReplies}>
          {quickReplies.map((reply, index) => (
            <TouchableOpacity
              key={index}
              style={styles.quickReplyChip}
              onPress={() => setInput(reply)}
              disabled={loading}
            >
              <LinearGradient
                colors={index % 2 === 0 ? colors.gradientPrimary : colors.gradientSecondary}
                style={styles.quickReplyGradient}
              >
                <Text style={styles.quickReplyText}>{reply}</Text>
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </View>
      </Animated.View>
    );
  };

  // ==================== RENDER ====================

  const renderMessage = ({ item, index }: { item: ChatMessage; index: number }) => (
    <MessageItem
      item={item}
      index={index}
      isUser={item.role === 'user'}
      showAvatar={true}
      colors={colors}
      onBookAppointment={(suggestion) => {
        setCurrentAppointmentSuggestion(suggestion);
        setShowAppointmentSuggestion(true);
      }}
    />
  );

  const keyExtractor = (item: ChatMessage, index: number) =>
    item.id || `${item.timestamp}-${item.role}-${index}`;

  const sendButtonScale = inputAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] });
  const containerTranslateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [height, 0],
  });

  if (!isInitialized) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <LinearGradient colors={[colors.background, colors.surface]} style={styles.loadingGradient}>
          <Animated.View style={[styles.loadingContent, { opacity: fadeAnim }]}>
            <LinearGradient colors={colors.gradientPrimary} style={styles.loadingIcon}>
              <Ionicons name="medical" size={40} color="#FFFFFF" />
            </LinearGradient>
            <Text style={[styles.loadingTitle, { color: colors.textPrimary }]}>HealthAI Assistant</Text>
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Đang khởi động trợ lý y tế...
            </Text>
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
          </Animated.View>
        </LinearGradient>
      </View>
    );
  }

  return (
    <Animated.View
      style={[
        styles.container,
        { transform: [{ translateY: containerTranslateY }], opacity: fadeAnim },
      ]}
    >
      <LinearGradient colors={[colors.background, colors.surface]} style={styles.backgroundGradient}>
        <KeyboardAvoidingView
          style={styles.keyboardAvoidingView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? (isFullScreen ? 0 : 90) : 0}
        >
          <SafeAreaView style={styles.safeArea}>
            <ChatHeader
              onBackToHome={handleBackToHome}
              onClearChat={clearChat}
              isTyping={isTyping}
            />

            <View style={styles.messagesContainer}>
              <FlatList
                ref={flatListRef}
                data={messages}
                renderItem={renderMessage}
                keyExtractor={keyExtractor}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                ListHeaderComponent={renderQuickReplies()}
                ListFooterComponent={<TypingIndicator isTyping={isTyping} colors={colors} />}
                ListEmptyComponent={
                  !loading ? (
                    <Animated.View style={[styles.emptyState, { opacity: fadeAnim }]}>
                      <LinearGradient colors={colors.gradientPrimary} style={styles.emptyStateIcon}>
                        <Ionicons name="medical" size={60} color="#FFFFFF" />
                      </LinearGradient>
                      <Text style={[styles.emptyStateTitle, { color: colors.textPrimary }]}>
                        HealthAI Sẵn Sàng
                      </Text>
                      <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
                        Hãy hỏi tôi về bất kỳ vấn đề sức khỏe nào bạn quan tâm.
                      </Text>
                    </Animated.View>
                  ) : null
                }
              />
            </View>

            {error && (
              <View style={styles.errorContainer}>
                <LinearGradient colors={['#FFEBEE', '#FFCDD2']} style={StyleSheet.absoluteFillObject} />
                <Ionicons name="warning" size={20} color={colors.error} />
                <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
                <TouchableOpacity onPress={() => setError(null)}>
                  <Ionicons name="close" size={20} color={colors.error} />
                </TouchableOpacity>
              </View>
            )}

            {/* Input */}
            <Animated.View style={[styles.inputContainer, { opacity: fadeAnim }]}>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.surfaceLight, borderColor: colors.border }]}
                  value={input}
                  onChangeText={setInput}
                  placeholder="Hỏi về thông tin y tế..."
                  placeholderTextColor={colors.textLight}
                  editable={!loading}
                  multiline
                  maxLength={500}
                  returnKeyType="send"
                  blurOnSubmit={false}
                />
                <Animated.View style={{ transform: [{ scale: sendButtonScale }] }}>
                  <TouchableOpacity
                    style={[styles.sendButton, (!input.trim() || loading) && styles.sendButtonDisabled]}
                    onPress={sendMessage}
                    disabled={!input.trim() || loading}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={!input.trim() || loading ? [colors.textLight, colors.textLight] : colors.gradientPrimary}
                      style={styles.sendButtonGradient}
                    >
                      {loading ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Ionicons name="send" size={20} color="#FFFFFF" />
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </Animated.View>
              </View>

              <View style={styles.inputFooter}>
                <Text style={[styles.charCount, { color: colors.textLight }]}>{input.length}/500</Text>
                <View style={styles.securityInfo}>
                  <Ionicons name="shield-checkmark" size={12} color={colors.success} />
                  <Text style={[styles.securityText, { color: colors.textLight }]}>Thông tin y tế bảo mật</Text>
                </View>
              </View>
            </Animated.View>

            {/* ✅ FIX #10: Appointment card với maxHeight giới hạn */}
            {showAppointmentSuggestion && currentAppointmentSuggestion && (
              <AppointmentSuggestionCard
                suggestion={currentAppointmentSuggestion}
                onBook={handleBookAppointment}
                onClose={() => {
                  setShowAppointmentSuggestion(false);
                  setCurrentAppointmentSuggestion(null);
                }}
                colors={colors}
              />
            )}

            {selectedSpecialty && (
              <DoctorSelectionModal
                visible={showDoctorModal}
                onClose={() => { setShowDoctorModal(false); setSelectedSpecialty(null); }}
                specialtyId={selectedSpecialty.id}
                specialtyName={selectedSpecialty.name}
                onSelectDoctor={handleBookAppointment}
              />
            )}
          </SafeAreaView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </Animated.View>
  );
};

// ==================== STYLES ====================

const styles = StyleSheet.create({
  container: { flex: 1, width: '100%' },
  backgroundGradient: { flex: 1 },
  keyboardAvoidingView: { flex: 1 },
  safeArea: { flex: 1 },

  loadingContainer: { justifyContent: 'center', alignItems: 'center' },
  loadingGradient: { flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center' },
  loadingContent: { alignItems: 'center', padding: moderateScale(40) },
  loadingIcon: {
    width: moderateScale(80), height: moderateScale(80),
    borderRadius: moderateScale(40), justifyContent: 'center', alignItems: 'center',
    marginBottom: moderateScale(24),
  },
  loadingTitle: { fontSize: moderateScale(28), fontWeight: '700', marginBottom: moderateScale(8) },
  loadingText: { fontSize: moderateScale(16), textAlign: 'center' },

  headerWrapper: { zIndex: 1000, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8 },
  headerGradient: { paddingBottom: moderateScale(16), paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  headerContainer: { paddingHorizontal: moderateScale(20) },
  headerTopBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: moderateScale(16) },
  glassButton: { width: moderateScale(48), height: moderateScale(48), borderRadius: moderateScale(24), justifyContent: 'center', alignItems: 'center' },
  buttonGlass: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: moderateScale(24), borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  headerCenter: { flexDirection: 'row', alignItems: 'center', flex: 1, paddingHorizontal: moderateScale(20) },
  avatarContainer: { marginRight: moderateScale(12) },
  aiAvatar: { width: moderateScale(44), height: moderateScale(44), borderRadius: moderateScale(22), justifyContent: 'center', alignItems: 'center' },
  headerTextContainer: { flex: 1 },
  headerTitle: { fontSize: moderateScale(20), fontWeight: '700', color: '#FFFFFF' },
  statusContainer: { flexDirection: 'row', alignItems: 'center', marginTop: moderateScale(2) },
  statusDot: { width: moderateScale(8), height: moderateScale(8), borderRadius: moderateScale(4), backgroundColor: '#FFFFFF', marginRight: moderateScale(6) },
  statusDotActive: { backgroundColor: '#FFEB3B' },
  headerSubtitle: { fontSize: moderateScale(13), color: 'rgba(255,255,255,0.9)', fontWeight: '500' },

  messagesContainer: { flex: 1, paddingHorizontal: moderateScale(16) },
  listContent: { paddingVertical: moderateScale(20), paddingBottom: moderateScale(120) },

  messageContainer: { marginVertical: moderateScale(8), paddingHorizontal: moderateScale(4) },
  userContainer: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'flex-end' },
  botContainer: { flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'flex-start' },
  messageContent: { maxWidth: '80%', marginHorizontal: moderateScale(8) },
  userContent: { alignItems: 'flex-end' },
  botContent: { alignItems: 'flex-start' },
  messageBubble: { paddingHorizontal: moderateScale(16), paddingVertical: moderateScale(12), borderRadius: moderateScale(20) },
  userBubble: { borderBottomRightRadius: moderateScale(6) },
  botBubble: { backgroundColor: '#FFFFFF', borderBottomLeftRadius: moderateScale(6), borderWidth: 1, borderColor: '#E0E0E0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  messageText: { fontSize: moderateScale(15), lineHeight: moderateScale(22) },
  userMessageText: { color: '#FFFFFF', fontWeight: '500', fontSize: moderateScale(15), lineHeight: moderateScale(22) },
  timestamp: { fontSize: moderateScale(11), marginTop: moderateScale(4) },

  botAvatarGradient: { width: moderateScale(36), height: moderateScale(36), borderRadius: moderateScale(18), justifyContent: 'center', alignItems: 'center', marginRight: moderateScale(8) },
  userAvatarGradient: { width: moderateScale(32), height: moderateScale(32), borderRadius: moderateScale(16), justifyContent: 'center', alignItems: 'center' },

  typingContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: moderateScale(8), paddingHorizontal: moderateScale(4) },
  typingBubble: { backgroundColor: '#FFFFFF', borderRadius: moderateScale(20), paddingHorizontal: moderateScale(16), paddingVertical: moderateScale(10), borderWidth: 1, borderColor: '#E0E0E0' },
  typingText: { fontSize: moderateScale(14), fontWeight: '500' },
  typingDots: { flexDirection: 'row', marginTop: moderateScale(6) },
  typingDot: { width: moderateScale(6), height: moderateScale(6), borderRadius: moderateScale(3), backgroundColor: '#9E9E9E', marginHorizontal: moderateScale(4) },

  // ✅ FIX #11: Quick replies với gradient đúng cách
  quickRepliesContainer: { marginBottom: moderateScale(16) },
  quickRepliesTitle: { fontSize: moderateScale(16), fontWeight: '600', marginBottom: moderateScale(8), textAlign: 'center' },
  quickReplies: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  quickReplyChip: { margin: moderateScale(6), borderRadius: moderateScale(20), overflow: 'hidden' },
  quickReplyGradient: { paddingHorizontal: moderateScale(14), paddingVertical: moderateScale(10), borderRadius: moderateScale(20) },
  quickReplyText: { fontSize: moderateScale(13), fontWeight: '500', color: '#FFFFFF' },

  errorContainer: { flexDirection: 'row', alignItems: 'center', borderRadius: moderateScale(8), padding: moderateScale(12), marginVertical: moderateScale(8), marginHorizontal: moderateScale(16), overflow: 'hidden' },
  errorText: { flex: 1, marginHorizontal: moderateScale(8), fontSize: moderateScale(13), fontWeight: '500' },

  inputContainer: { paddingHorizontal: moderateScale(16), paddingTop: moderateScale(8), paddingBottom: Platform.OS === 'ios' ? moderateScale(20) : moderateScale(12) },
  inputWrapper: { flexDirection: 'row', alignItems: 'flex-end' },
  input: { flex: 1, borderRadius: 25, paddingHorizontal: 20, paddingVertical: 12, fontSize: 16, maxHeight: 100, borderWidth: 1, marginRight: moderateScale(12) },
  sendButton: { width: moderateScale(50), height: moderateScale(50), borderRadius: moderateScale(25), overflow: 'hidden' },
  sendButtonDisabled: { opacity: 0.5 },
  sendButtonGradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  inputFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: moderateScale(8), paddingHorizontal: moderateScale(4) },
  charCount: { fontSize: moderateScale(12) },
  securityInfo: { flexDirection: 'row', alignItems: 'center' },
  securityText: { fontSize: moderateScale(12), marginLeft: moderateScale(4) },

  emptyState: { alignItems: 'center', marginTop: moderateScale(40), paddingHorizontal: moderateScale(20) },
  emptyStateIcon: { width: moderateScale(80), height: moderateScale(80), borderRadius: moderateScale(40), justifyContent: 'center', alignItems: 'center', marginBottom: moderateScale(16) },
  emptyStateTitle: { fontSize: moderateScale(22), fontWeight: '700', marginBottom: moderateScale(8), textAlign: 'center' },
  emptyStateText: { fontSize: moderateScale(15), textAlign: 'center', lineHeight: moderateScale(22) },

  confidenceContainer: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.1)' },
  confidenceBar: { height: 6, backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 3, overflow: 'hidden', marginBottom: 4 },
  confidenceFill: { height: '100%', borderRadius: 3 },
  confidenceText: { fontSize: 11, color: '#757575', fontWeight: '500' },
  actionsContainer: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.1)' },
  actionsTitle: { fontSize: 12, color: '#757575', fontWeight: '600', marginBottom: 6 },
  actionChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,188,212,0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, marginBottom: 4, alignSelf: 'flex-start' },
  actionText: { fontSize: 11, color: '#00BCD4', fontWeight: '500', marginLeft: 4 },
  emergencyContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,82,82,0.1)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, marginTop: 8, borderWidth: 1, borderColor: 'rgba(255,82,82,0.3)' },
  emergencyText: { fontSize: 12, color: '#FF5252', fontWeight: '700', marginLeft: 6, flex: 1 },

  // ✅ FIX #10: Appointment card với maxHeight để không che input
  appointmentSuggestion: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 130 : 110,
    left: 16, right: 16,
    zIndex: 1000,
    borderRadius: 20,
    overflow: 'hidden',
    maxHeight: height * 0.55,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 5,
  },
  suggestionGradient: { padding: 16 },
  closeButton: { position: 'absolute', top: 8, right: 8, zIndex: 1, padding: 4 },
  suggestionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  urgencyBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, marginRight: 8 },
  urgencyText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  suggestionTitle: { fontSize: 18, fontWeight: '700', color: '#212121' },
  suggestionReason: { fontSize: 14, color: '#424242', marginBottom: 12, lineHeight: 20 },
  symptomsList: { marginBottom: 12 },
  symptomsTitle: { fontSize: 13, fontWeight: '600', color: '#757575', marginBottom: 8 },
  symptomsContainer: { flexDirection: 'row', flexWrap: 'wrap' },
  symptomChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, marginRight: 6, marginBottom: 6 },
  symptomText: { fontSize: 12, color: '#00BCD4', marginLeft: 4 },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  infoText: { fontSize: 14, color: '#757575', marginLeft: 8 },
  doctorsList: { marginTop: 12, marginBottom: 8 },
  doctorsTitle: { fontSize: 14, fontWeight: '600', color: '#212121', marginBottom: 12 },
  doctorsScroll: { maxHeight: 160 },
  doctorCard: { width: 260, marginRight: 12, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'transparent' },
  selectedDoctor: { borderColor: '#00BCD4', borderWidth: 2 },
  doctorCardFull: { opacity: 0.6, borderColor: '#E0E0E0', borderWidth: 1 },
  doctorCardGradient: { padding: 12 },
  doctorHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  doctorName: { fontSize: 15, fontWeight: '600', color: '#212121' },
  doctorNameFull: { color: '#9E9E9E' },
  selectedDoctorText: { color: '#FFFFFF' },
  fullBadge: { backgroundColor: '#FFEBEE', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  fullBadgeText: { fontSize: 11, color: '#FF5252', fontWeight: '600' },
  ratingContainer: { flexDirection: 'row', alignItems: 'center' },
  ratingText: { fontSize: 12, color: '#757575', marginLeft: 4 },
  doctorDetails: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  experienceText: { fontSize: 12, color: '#757575' },
  feeText: { fontSize: 12, color: '#00BCD4', fontWeight: '600' },
  slotsContainer: { marginTop: 8 },
  slotsTitle: { fontSize: 12, marginBottom: 4 },
  slotChip: { backgroundColor: '#FFFFFF', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, marginRight: 8, borderWidth: 1, borderColor: '#E0E0E0' },
  selectedSlot: { backgroundColor: '#00BCD4', borderColor: '#00BCD4' },
  slotText: { fontSize: 12, color: '#757575' },
  selectedSlotText: { color: '#FFFFFF' },
  loadingDoctors: { alignItems: 'center', padding: 16 },
  loadingDoctorsText: { marginTop: 8, fontSize: 14, color: '#757575' },
  noDoctorsInline: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 12,
    marginVertical: 8,
    gap: 10,
  },
  noDoctorsInlineText: {
    flex: 1,
    fontSize: 13,
    color: '#757575',
    lineHeight: 19,
  },
  bookButton: { borderRadius: 12, overflow: 'hidden', marginTop: 8 },
  bookButtonDisabled: { opacity: 0.5 },
  bookButtonGradient: { paddingVertical: 14, alignItems: 'center' },
  bookButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  bookSuggestionButton: { marginTop: 12, borderRadius: 20, overflow: 'hidden' },
  bookSuggestionGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, paddingHorizontal: 16 },
  bookSuggestionText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600', marginLeft: 8 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, height: '80%', overflow: 'hidden' },
  modalHeader: { padding: 20, alignItems: 'center' },
  modalCloseButton: { position: 'absolute', top: 12, right: 16, zIndex: 1 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF', marginBottom: 4 },
  modalSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.9)' },
  dateSelector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#F5F5F5' },
  dateText: { fontSize: 16, fontWeight: '600', color: '#212121' },
  modalLoading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  modalLoadingText: { marginTop: 12, fontSize: 16, color: '#757575' },
  doctorsListModal: { flex: 1, padding: 16 },
  modalDoctorCard: { backgroundColor: '#F5F5F5', borderRadius: 16, padding: 16, marginBottom: 12 },
  modalSelectedDoctor: { backgroundColor: '#E0F7FA', borderWidth: 1, borderColor: '#00BCD4' },
  modalDoctorHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  modalDoctorName: { fontSize: 16, fontWeight: '600', color: '#212121', marginBottom: 4 },
  modalDoctorRating: { flexDirection: 'row', alignItems: 'center' },
  modalRatingText: { fontSize: 12, color: '#757575', marginLeft: 4 },
  modalDoctorFee: { fontSize: 16, fontWeight: '700', color: '#00BCD4' },
  modalDoctorExp: { fontSize: 13, color: '#757575', marginBottom: 12 },
  modalSlotsContainer: { marginTop: 12 },
  modalSlotsTitle: { fontSize: 14, fontWeight: '600', color: '#212121', marginBottom: 8 },
  modalSlotsGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  modalSlotChip: { backgroundColor: '#FFFFFF', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, marginRight: 8, marginBottom: 8, borderWidth: 1, borderColor: '#E0E0E0' },
  modalSelectedSlot: { backgroundColor: '#00BCD4', borderColor: '#00BCD4' },
  modalSlotText: { fontSize: 12, color: '#757575' },
  modalSelectedSlotText: { color: '#FFFFFF' },
  noDoctorsContainer: { alignItems: 'center', padding: 40 },
  noDoctorsText: { fontSize: 16, color: '#757575', marginTop: 12, marginBottom: 16 },
  tryAnotherDate: { padding: 12, backgroundColor: '#00BCD4', borderRadius: 8 },
  tryAnotherDateText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  modalBookButton: { padding: 16, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E0E0E0' },
  modalBookButtonGradient: { paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  modalBookButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});

export default ChatWidget;