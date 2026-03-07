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
const moderateScale = (size: number, factor = 0.5) =>
  size + ((width / 375) * size - size) * factor;

// FIX: Dynamic API URL from config
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';
const PENDING_MESSAGES_KEY = 'pending_chat_messages';

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
  followUpQuestions?: string[];
  requiresMoreInfo?: boolean;
  patientContextUsed?: boolean;
  appointmentRecommendation?: AppointmentSuggestion;
  // FIX: track pending/failed state
  pending?: boolean;
  failed?: boolean;
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
  contraindications?: string[];
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
    followUpQuestions?: string[];
    requiresMoreInfo?: boolean;
    patientContextUsed?: boolean;
    appointmentRecommendation?: AppointmentSuggestion;
    session_id?: string;
  };
}

type RootStackParamList = {
  Home: undefined;
  Login: undefined;
  ChatOption: undefined;
  AppointmentBooking: { doctorId: string; initialData?: any };
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
  border: '#E0E0E0',
  gradientPrimary: ['#00BCD4', '#00ACC1'] as [string, string],
  gradientSecondary: ['#00ACC1', '#0097A7'] as [string, string],
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
  } catch { return null; }
}

// ==================== OFFLINE QUEUE ====================
// FIX: Cache pending messages when offline

async function savePendingMessage(message: string): Promise<void> {
  try {
    const existing = await AsyncStorage.getItem(PENDING_MESSAGES_KEY);
    const queue: string[] = existing ? JSON.parse(existing) : [];
    queue.push(message);
    await AsyncStorage.setItem(PENDING_MESSAGES_KEY, JSON.stringify(queue));
  } catch { /* ignore */ }
}

async function getPendingMessages(): Promise<string[]> {
  try {
    const data = await AsyncStorage.getItem(PENDING_MESSAGES_KEY);
    return data ? JSON.parse(data) : [];
  } catch { return []; }
}

async function clearPendingMessages(): Promise<void> {
  await AsyncStorage.removeItem(PENDING_MESSAGES_KEY);
}

// ==================== APPOINTMENT SUGGESTION CARD ====================

const AppointmentSuggestionCard = ({
  suggestion, onBook, onClose,
}: {
  suggestion: AppointmentSuggestion;
  onBook: (doctorId: string, timeSlot: string, doctorName: string) => void;
  onClose: () => void;
}) => {
  const [selectedDoctor, setSelectedDoctor] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [selectedDoctorName, setSelectedDoctorName] = useState('');
  const slideAnim = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    Animated.spring(slideAnim, { toValue: 0, tension: 100, friction: 8, useNativeDriver: true }).start();
  }, []);

  const urgencyColor = suggestion.urgencyLevel === 'high' ? '#FF5252' : suggestion.urgencyLevel === 'medium' ? '#FF9800' : '#00BCD4';
  const urgencyLabel = suggestion.urgencyLevel === 'high' ? '🚨 Urgent' : suggestion.urgencyLevel === 'medium' ? '⚠️ See Doctor Soon' : '📋 Routine Checkup';

  if (suggestion.hasExistingAppointment) {
    return (
      <Animated.View style={[styles.appointmentCard, { transform: [{ translateY: slideAnim }] }]}>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={onClose}
          accessibilityLabel="Close appointment hint"
          accessibilityRole="button"
        >
          <Ionicons name="close" size={20} color="#757575" />
        </TouchableOpacity>
        <View style={[styles.urgencyBadge, { backgroundColor: '#00BCD4' }]}>
          <Text style={styles.urgencyText}>📅 Existing Appointment</Text>
        </View>
        <Text style={styles.suggestionReason}>{suggestion.reason}</Text>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.appointmentCard, { transform: [{ translateY: slideAnim }] }]}>
      <TouchableOpacity
        style={styles.closeBtn}
        onPress={onClose}
        accessibilityLabel="Close booking suggestion"
        accessibilityRole="button"
      >
        <Ionicons name="close" size={20} color="#757575" />
      </TouchableOpacity>

      <View style={[styles.urgencyBadge, { backgroundColor: urgencyColor }]}>
        <Text style={styles.urgencyText}>{urgencyLabel}</Text>
      </View>

      <Text style={styles.cardTitle}>Book Appointment</Text>
      <Text style={styles.suggestionReason}>{suggestion.reason}</Text>

      {/* FIX: Show contraindication warnings */}
      {suggestion.contraindications && suggestion.contraindications.length > 0 && (
        <View style={styles.contraindicationBox}>
          <Ionicons name="warning" size={16} color="#FF5252" />
          <Text style={styles.contraindicationText}>
            {suggestion.contraindications.join('\n')}
          </Text>
        </View>
      )}

      {suggestion.symptoms.length > 0 && (
        <View style={styles.symptomsRow}>
          {suggestion.symptoms.map((s, i) => (
            <View key={i} style={styles.symptomChip}>
              <Ionicons name="medical" size={12} color="#00BCD4" />
              <Text style={styles.symptomChipText}>{s}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.infoRow}>
        <Ionicons name="time-outline" size={16} color="#00BCD4" />
        <Text style={styles.infoText}>{suggestion.recommendedTimeframe}</Text>
      </View>
      <View style={styles.infoRow}>
        <Ionicons name="medical-outline" size={16} color="#00BCD4" />
        <Text style={styles.infoText}>Specialty: {suggestion.suggestedSpecialty}</Text>
      </View>

      {suggestion.suggestedDoctors && suggestion.suggestedDoctors.length > 0 ? (
        <View>
          <Text style={styles.doctorsTitle}>Available doctors:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.doctorsScroll} nestedScrollEnabled>
            {suggestion.suggestedDoctors.map(doc => {
              const hasSlots = doc.availableSlots?.length > 0;
              const isSelected = selectedDoctor === doc.id;
              return (
                <TouchableOpacity
                  key={doc.id}
                  style={[styles.doctorCard, isSelected && styles.doctorCardSelected, !hasSlots && styles.doctorCardFull]}
                  onPress={() => { if (!hasSlots) return; setSelectedDoctor(doc.id); setSelectedDoctorName(doc.name); setSelectedSlot(''); }}
                  activeOpacity={hasSlots ? 0.8 : 1}
                  accessibilityLabel={`Dr. ${doc.name}, ${hasSlots ? `${doc.availableSlots.length} slot(s) available` : 'fully booked'}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected, disabled: !hasSlots }}
                >
                  <LinearGradient
                    colors={!hasSlots ? ['#F5F5F5', '#EEEEEE'] : isSelected ? colors.gradientPrimary : ['#F5F5F5', '#EEEEEE']}
                    style={styles.doctorCardGradient}
                  >
                    <View style={styles.doctorRow}>
                      <Text style={[styles.doctorName, isSelected && { color: '#fff' }, !hasSlots && { color: '#9E9E9E' }]}>
                        Dr. {doc.name}
                      </Text>
                      {!hasSlots ? (
                        <View style={styles.fullBadge}><Text style={styles.fullBadgeText}>Fully Booked</Text></View>
                      ) : doc.rating && doc.rating > 0 ? (
                        <View style={styles.ratingRow}>
                          <Ionicons name="star" size={12} color="#FFC107" />
                          <Text style={[styles.ratingText, isSelected && { color: '#fff' }]}>{doc.rating.toFixed(1)}</Text>
                        </View>
                      ) : null}
                    </View>
                    <View style={styles.doctorMeta}>
                      <Text style={[styles.expText, isSelected && { color: '#fff' }, !hasSlots && { color: '#BDBDBD' }]}>
                        {doc.experience || 0}+ yrs exp
                      </Text>
                      <Text style={[styles.feeText, !hasSlots && { color: '#BDBDBD' }]}>
                        {doc.consultationFee ? `${doc.consultationFee.toLocaleString('en-US')} USD` : 'Contact'}
                      </Text>
                    </View>
                    {isSelected && hasSlots && (
                      <View style={styles.slotsBox}>
                        <Text style={[styles.slotsLabel, { color: '#fff' }]}>Select time:</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                          {doc.availableSlots.map(slot => (
                            <TouchableOpacity
                              key={slot}
                              style={[styles.slotChip, selectedSlot === slot && styles.slotChipSelected]}
                              onPress={() => setSelectedSlot(slot)}
                              accessibilityLabel={`Time slot ${slot}`}
                              accessibilityRole="button"
                              accessibilityState={{ selected: selectedSlot === slot }}
                            >
                              <Text style={[styles.slotText, selectedSlot === slot && { color: '#fff' }]}>{slot}</Text>
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
        <View style={styles.noDoctorsBox}>
          <Ionicons name="calendar-outline" size={24} color="#BDBDBD" />
          <Text style={styles.noDoctorsText}>No doctors available tomorrow. Please try another date.</Text>
        </View>
      ) : (
        <View style={styles.noDoctorsBox}>
          <Ionicons name="search-outline" size={24} color="#00BCD4" />
          <Text style={styles.noDoctorsText}>
            Specialty <Text style={{ fontWeight: '700', color: '#00BCD4' }}>{suggestion.suggestedSpecialty}</Text> is not in the system yet. Please contact the clinic.
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.confirmBtn, (!selectedDoctor || !selectedSlot) && styles.confirmBtnDisabled]}
        onPress={() => { if (selectedDoctor && selectedSlot) onBook(selectedDoctor, selectedSlot, selectedDoctorName); }}
        disabled={!selectedDoctor || !selectedSlot}
        accessibilityLabel="Confirm appointment booking"
        accessibilityRole="button"
        accessibilityState={{ disabled: !selectedDoctor || !selectedSlot }}
      >
        <LinearGradient
          colors={(!selectedDoctor || !selectedSlot) ? ['#BDBDBD', '#9E9E9E'] : colors.gradientPrimary}
          style={styles.confirmBtnGradient}
        >
          <Text style={styles.confirmBtnText}>Confirm Booking</Text>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ==================== FOLLOW-UP QUESTIONS WIDGET ====================
// FIX: Display clarifying questions in a tappable format

const FollowUpWidget = ({
  questions,
  onSelect,
}: {
  questions: string[];
  onSelect: (question: string) => void;
}) => (
  <View style={styles.followUpContainer} accessibilityLabel="Clarifying questions from assistant">
    <Text style={styles.followUpTitle}>💬 Please answer:</Text>
    {questions.map((q, i) => (
      <TouchableOpacity
        key={i}
        style={styles.followUpChip}
        onPress={() => onSelect(q)}
        accessibilityLabel={`Question ${i + 1}: ${q}`}
        accessibilityRole="button"
      >
        <Ionicons name="chatbubble-outline" size={14} color="#00BCD4" />
        <Text style={styles.followUpText}>{q}</Text>
      </TouchableOpacity>
    ))}
  </View>
);

// ==================== MESSAGE ITEM ====================

const MessageItem = ({
  item, index, colors: _colors, onBookAppointment, onFollowUp,
}: {
  item: ChatMessage;
  index: number;
  colors: typeof colors;
  onBookAppointment?: (s: AppointmentSuggestion) => void;
  onFollowUp?: (question: string) => void;
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
        { opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [15, 0] }) }] },
      ]}
      accessibilityLabel={`${isUser ? 'You' : 'AI Assistant'}: ${item.content}`}
    >
      {!isUser && (
        <LinearGradient colors={colors.gradientPrimary} style={styles.botAvatar}>
          <Ionicons name={item.emergencyAlert ? 'warning' : 'medical'} size={16} color="#fff" />
        </LinearGradient>
      )}

      <View style={[styles.msgContent, isUser ? styles.userMsgContent : styles.botMsgContent]}>
        {isUser ? (
          <LinearGradient colors={colors.gradientPrimary} style={[styles.bubble, styles.userBubble]}>
            <Text style={styles.userMsgText}>{item.content}</Text>
            {/* FIX: Show pending/failed state */}
            {item.pending && <Text style={styles.pendingText}>Sending...</Text>}
            {item.failed && <Text style={styles.failedText}>⚠️ Failed to send — tap to retry</Text>}
          </LinearGradient>
        ) : (
          <View style={[styles.bubble, styles.botBubble]}>
            <Text style={[styles.msgText, { color: colors.textPrimary }]}>{item.content}</Text>

            {item.confidence !== undefined && (
              <View style={styles.confidenceBox}>
                <View style={styles.confidenceBar}>
                  <View style={[styles.confidenceFill, {
                    width: `${item.confidence * 100}%`,
                    backgroundColor: item.confidence > 0.7 ? '#00BCD4' : item.confidence > 0.5 ? '#FF9800' : '#FF5252',
                  }]} />
                </View>
                <Text style={styles.confidenceLabel}>{Math.round(item.confidence * 100)}% confidence</Text>
              </View>
            )}

            {item.emergencyAlert && (
              <View style={styles.emergencyBox}>
                <Ionicons name="warning" size={16} color="#FF5252" />
                <Text style={styles.emergencyText}>EMERGENCY SITUATION</Text>
              </View>
            )}

            {/* FIX: Show follow-up questions as tappable chips */}
            {item.requiresMoreInfo && item.followUpQuestions && item.followUpQuestions.length > 0 && onFollowUp && (
              <FollowUpWidget questions={item.followUpQuestions} onSelect={onFollowUp} />
            )}

            {item.suggestedActions && item.suggestedActions.length > 0 && (
              <View style={styles.actionsBox}>
                <Text style={styles.actionsTitle}>Suggestions:</Text>
                {item.suggestedActions.map((a, i) => (
                  <View key={i} style={styles.actionChip}>
                    <Ionicons name="checkmark-circle" size={13} color="#00BCD4" />
                    <Text style={styles.actionText}>{a}</Text>
                  </View>
                ))}
              </View>
            )}

            {item.appointmentRecommendation?.shouldBook && onBookAppointment && (
              <TouchableOpacity
                style={styles.bookBtn}
                onPress={() => onBookAppointment(item.appointmentRecommendation!)}
                accessibilityLabel="Book appointment"
                accessibilityRole="button"
              >
                <LinearGradient colors={colors.gradientPrimary} style={styles.bookBtnGradient}>
                  <Ionicons name="calendar" size={15} color="#fff" />
                  <Text style={styles.bookBtnText}>Book Appointment</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        )}

        <Text style={[styles.timestamp, { color: colors.textLight }]}>
          {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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

const TypingIndicator = ({ isTyping }: { isTyping: boolean }) => {
  const anim = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    if (isTyping) {
      Animated.loop(Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ])).start();
    } else { anim.setValue(0.5); }
  }, [isTyping]);

  if (!isTyping) return null;
  return (
    <Animated.View style={[styles.typingRow, { opacity: anim }]} accessibilityLabel="Assistant is analyzing">
      <LinearGradient colors={colors.gradientPrimary} style={styles.botAvatar}>
        <Ionicons name="medical" size={16} color="#fff" />
      </LinearGradient>
      <View style={styles.typingBubble}>
        <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Analyzing...</Text>
        <View style={{ flexDirection: 'row', marginTop: 4 }}>
          {[0, 1, 2].map(i => <Animated.View key={i} style={[styles.dot, { opacity: anim }]} />)}
        </View>
      </View>
    </Animated.View>
  );
};

// ==================== OFFLINE BANNER ====================
// FIX: Show offline state clearly

const OfflineBanner = ({ isOffline }: { isOffline: boolean }) => {
  if (!isOffline) return null;
  return (
    <View style={styles.offlineBanner} accessibilityLabel="No network connection" accessibilityRole="alert">
      <Ionicons name="cloud-offline-outline" size={16} color="#fff" />
      <Text style={styles.offlineText}>No connection. Messages will be sent when online.</Text>
    </View>
  );
};

// ==================== CONSENT MODAL ====================
// FIX: Show consent screen before first use

const ConsentModal = ({
  visible,
  onAccept,
  onDecline,
}: {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) => (
  <Modal visible={visible} transparent animationType="fade">
    <View style={styles.consentOverlay}>
      <View style={styles.consentBox}>
        <LinearGradient colors={colors.gradientPrimary} style={styles.consentHeader}>
          <Ionicons name="shield-checkmark" size={36} color="#fff" />
          <Text style={styles.consentTitle}>AI Terms of Use</Text>
        </LinearGradient>

        <ScrollView style={styles.consentContent}>
          <Text style={styles.consentText}>
            {`Before using the AI Medical Assistant, please read and agree to the following:\n\n`}
            {`⚕️ FOR EDUCATIONAL PURPOSES ONLY\nInformation provided by the AI is for reference only and does NOT replace professional medical diagnosis or advice.\n\n`}
            {`📋 NOT A DIAGNOSIS\nThe AI does not diagnose diseases. Always consult a doctor for accurate diagnosis.\n\n`}
            {`🔒 PRIVACY\nYour information is kept confidential. Conversations are stored to improve the service.\n\n`}
            {`🚨 EMERGENCY\nIn an emergency, call 911/115 immediately or go to the nearest hospital instead of using the AI.\n\n`}
            {`By tapping "Agree", you confirm you have read and agree to the above terms.`}
          </Text>
        </ScrollView>

        <View style={styles.consentButtons}>
          <TouchableOpacity
            style={[styles.consentBtn, styles.declineBtn]}
            onPress={onDecline}
            accessibilityLabel="Decline terms"
            accessibilityRole="button"
          >
            <Text style={styles.declineBtnText}>Decline</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.consentBtn, styles.acceptBtn]}
            onPress={onAccept}
            accessibilityLabel="Agree to terms and start"
            accessibilityRole="button"
          >
            <LinearGradient colors={colors.gradientPrimary} style={styles.acceptBtnGradient}>
              <Text style={styles.acceptBtnText}>Agree</Text>
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
  const [currentSuggestion, setCurrentSuggestion] = useState<AppointmentSuggestion | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const scrollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const inputAnim = useRef(new Animated.Value(0)).current;

  // ==================== INIT ====================

  useEffect(() => {
    // FIX: Monitor network status
    const unsubscribe = NetInfo.addEventListener(state => {
      const offline = !state.isConnected;
      setIsOffline(offline);

      // FIX: Auto-retry pending messages when back online
      if (!offline) retryPendingMessages();
    });

    initializeChat();
    return () => {
      unsubscribe();
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (isInitialized) {
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    }
  }, [isInitialized]);

  useEffect(() => {
    Animated.spring(inputAnim, { toValue: input.length > 0 ? 1 : 0, useNativeDriver: true, tension: 200, friction: 12 }).start();
  }, [input]);

  useEffect(() => { scrollToBottom(); }, [messages]);

  const scrollToBottom = useCallback((animated = true) => {
    if (flatListRef.current && messages.length > 0) {
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
      scrollTimerRef.current = setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated });
      }, 100);
    }
  }, [messages.length]);

  // ==================== INIT CHAT ====================

  const initializeChat = async () => {
    setLoading(true);
    try {
      const token = await getValidToken();
      if (!token) { setError('Please log in'); setIsInitialized(true); return; }

      await loadChatHistory(token);
      setIsInitialized(true);
    } catch { setError('Could not initialize assistant'); setIsInitialized(true); }
    finally { setLoading(false); }
  };

  const loadChatHistory = async (token: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/ai-medical/session`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setCurrentSession(data.data.session);

          // FIX: Show consent if required
          if (data.data.consent_required) {
            setShowConsent(true);
            return;
          }

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
    } catch { showWelcomeMessage(); }
  };

  const showWelcomeMessage = () => {
    setMessages([{
      role: 'assistant',
      content: 'Hello! I am your AI Medical Assistant. I can help you:\n\n• Look up medication and disease information\n• Explain medical terminology\n• Suggest suitable appointments\n\nDescribe your symptoms or ask a question!\n\n⚕️ Note: I provide educational information only and do not replace professional medical advice.',
      timestamp: new Date().toISOString(),
      id: `welcome-${Date.now()}`,
      language: 'vi',
    }]);
  };

  // ==================== CONSENT HANDLING ====================

  const handleConsentAccept = async () => {
    setShowConsent(false);
    setConsentGiven(true);

    if (currentSession?.session_id) {
      try {
        const token = await getValidToken();
        if (token) {
          await fetch(`${API_BASE_URL}/ai-medical/consent`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: currentSession.session_id, consent: true }),
          });
        }
      } catch { /* non-blocking */ }
    }
    showWelcomeMessage();
  };

  const handleConsentDecline = () => {
    setShowConsent(false);
    if (onBackToHome) onBackToHome();
    else navigation.goBack();
  };

  // ==================== OFFLINE RETRY ====================
  // FIX: Retry pending messages when back online

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
      let res = await fetch(`${API_BASE_URL}/ai-medical/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: messageText }),
        signal: controller.signal,
      });

      if (res.status === 401) {
        const newToken = await tryRefreshToken();
        if (!newToken) return null;
        res = await fetch(`${API_BASE_URL}/ai-medical/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${newToken}` },
          body: JSON.stringify({ message: messageText }),
        });
      }

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
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
      role: 'user', content: msgText,
      timestamp: new Date().toISOString(),
      id: `user-${Date.now()}`,
      language: currentLanguage,
      pending: true,
    };

    setMessages(prev => [...prev, userMsg]);

    // FIX: If offline, queue the message
    if (isOffline) {
      await savePendingMessage(msgText);
      setMessages(prev => prev.map(m => m.id === userMsg.id ? { ...m, pending: false, failed: true } : m));
      setLoading(false);
      return;
    }

    setIsTyping(true);

    try {
      let token = await getValidToken();
      if (!token) {
        token = await tryRefreshToken();
        if (!token) { navigation.navigate('Login'); return; }
      }

      // FIX: Mark message as sent (not pending)
      setMessages(prev => prev.map(m => m.id === userMsg.id ? { ...m, pending: false } : m));

      const data = await sendMessageToAPI(msgText, token);

      if (!data || !data.success) throw new Error('API error');

      if (data.data.session_id && !currentSession) setCurrentSession({ session_id: data.data.session_id });
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
          followUpQuestions: data.data.followUpQuestions,
          requiresMoreInfo: data.data.requiresMoreInfo,
          patientContextUsed: data.data.patientContextUsed,
          language: data.data.language || currentLanguage,
          appointmentRecommendation: data.data.appointmentRecommendation,
        };
        setMessages(prev => [...prev, botMsg]);

        if (data.data.appointmentRecommendation?.shouldBook) {
          setCurrentSuggestion(data.data.appointmentRecommendation);
          setShowAppointmentCard(true);
        }

        // FIX: Emergency — open dialer directly
        if (data.data.emergencyAlert) {
          Alert.alert(
            '🚨 EMERGENCY',
            'This may require immediate emergency care!',
            [
              { text: '📞 Call 115 Now', onPress: () => Linking.openURL('tel:115'), style: 'destructive' },
              { text: 'I understand', style: 'cancel' },
            ],
            { cancelable: false }
          );
          // FIX: Announce to accessibility
          AccessibilityInfo.announceForAccessibility('WARNING: Emergency situation. Call 115 now.');
        }
      }, 600 + Math.random() * 400);
    } catch (err: any) {
      setIsTyping(false);
      setMessages(prev => prev.map(m => m.id === userMsg.id ? { ...m, failed: true, pending: false } : m));

      let msg = 'Could not process request. Please try again.';
      if (err.name === 'AbortError') msg = 'Request timed out. Please try again.';

      setError(msg);
      setMessages(prev => [...prev, {
        role: 'assistant', content: 'Sorry, a technical issue occurred. For urgent matters, please contact a doctor directly.\n\n⚕️ This information is for educational purposes only.',
        timestamp: new Date().toISOString(), id: `err-${Date.now()}`, language: currentLanguage,
      }]);
    } finally {
      setLoading(false);
    }
  };

  // ==================== CLEAR CHAT ====================

  const clearChat = () => {
    Alert.alert('Start a new conversation?', '', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear', style: 'destructive',
        onPress: async () => {
          try {
            const token = await getValidToken();
            if (token && currentSession?.session_id) {
              await fetch(`${API_BASE_URL}/ai-medical/session/${currentSession.session_id}/close`, {
                method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
              });
              await loadChatHistory(token);
            }
            showWelcomeMessage();
            setCurrentSession(null);
            setShowAppointmentCard(false);
          } catch { setError('Could not clear history'); }
        },
      },
    ]);
  };

  // ==================== APPOINTMENT BOOKING ====================

  const handleBookAppointment = async (doctorId: string, timeSlot: string, doctorName: string) => {
    if (!currentSuggestion) return;
    setLoading(true);
    try {
      const token = await getValidToken();
      if (!token) { Alert.alert('Error', 'Please log in'); return; }

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];

      const res = await fetch(`${API_BASE_URL}/ai-medical/appointments/book-from-ai`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doctor_id: doctorId, appointment_date: dateStr, time_slot: timeSlot,
          symptoms: currentSuggestion.symptoms, reason: currentSuggestion.reason,
          urgency_level: currentSuggestion.urgencyLevel, session_id: currentSession?.session_id,
        }),
      });

      const data = await res.json();
      if (data.success) {
        Alert.alert('✅ Appointment Confirmed', `Dr. ${doctorName} — ${dateStr} at ${timeSlot}`, [
          { text: 'View details', onPress: () => navigation.navigate('AppointmentBooking', { doctorId, initialData: data.data.appointment }) },
          { text: 'OK', onPress: () => { setShowAppointmentCard(false); setCurrentSuggestion(null); } },
        ]);
      } else {
        Alert.alert('Error', data.message || 'Could not book appointment');
      }
    } catch { Alert.alert('Error', 'Could not book appointment. Please try again.'); }
    finally { setLoading(false); }
  };

  // ==================== QUICK REPLIES ====================

  const quickReplies = [
    '🤒 Common flu symptoms',
    '💊 Side effects of paracetamol',
    '🩺 What is normal blood pressure?',
    '🍎 Heart-healthy diet tips',
    '😴 Improve sleep quality',
    '🧘 Effective stress reduction',
  ];

  // ==================== BACK ====================

  const handleBack = useCallback(() => {
    if (onBackToHome) onBackToHome();
    else navigation.goBack();
  }, [onBackToHome, navigation]);

  // ==================== RENDER ====================

  if (!isInitialized) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <LinearGradient colors={colors.gradientPrimary} style={styles.loadingIcon}>
          <Ionicons name="medical" size={40} color="#fff" />
        </LinearGradient>
        <Text style={{ fontSize: 22, fontWeight: '700', marginTop: 16, color: colors.textPrimary }}>HealthAI Assistant</Text>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
      </View>
    );
  }

  const sendScale = inputAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] });

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {/* FIX: Consent modal shown before first use */}
      <ConsentModal visible={showConsent} onAccept={handleConsentAccept} onDecline={handleConsentDecline} />

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
                <TouchableOpacity onPress={handleBack} style={styles.headerBtn} accessibilityLabel="Go back" accessibilityRole="button">
                  <Ionicons name="chevron-back" size={24} color="#fff" />
                </TouchableOpacity>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginHorizontal: 12 }}>
                  <LinearGradient colors={['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.1)']} style={styles.headerAvatar}>
                    <Ionicons name="medical" size={18} color="#fff" />
                  </LinearGradient>
                  <View style={{ marginLeft: 10 }}>
                    <Text style={styles.headerTitle}>HealthAI Assistant</Text>
                    <Text style={styles.headerSubtitle}>{isTyping ? 'Analyzing...' : 'Ready to help'}</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={clearChat} style={styles.headerBtn} accessibilityLabel="Clear chat" accessibilityRole="button">
                  <Ionicons name="refresh-outline" size={22} color="#fff" />
                </TouchableOpacity>
              </View>
            </LinearGradient>

            {/* FIX: Offline banner */}
            <OfflineBanner isOffline={isOffline} />

            {/* Messages */}
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={({ item, index }) => (
                <MessageItem
                  item={item}
                  index={index}
                  colors={colors}
                  onBookAppointment={s => { setCurrentSuggestion(s); setShowAppointmentCard(true); }}
                  onFollowUp={q => setInput(q)}
                />
              )}
              keyExtractor={(item, i) => item.id || `${item.timestamp}-${i}`}
              contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
              showsVerticalScrollIndicator={false}
              ListHeaderComponent={
                messages.length <= 1 ? (
                  <View style={{ marginBottom: 16 }}>
                    <Text style={{ textAlign: 'center', color: colors.textSecondary, marginBottom: 8 }}>💡 Frequently Asked</Text>
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
                          <LinearGradient colors={i % 2 === 0 ? colors.gradientPrimary : colors.gradientSecondary} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 }}>
                            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '500' }}>{r}</Text>
                          </LinearGradient>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ) : null
              }
              ListFooterComponent={<TypingIndicator isTyping={isTyping} />}
            />

            {/* Error */}
            {error && (
              <View style={styles.errorBar}>
                <Ionicons name="warning" size={18} color={colors.error} />
                <Text style={[styles.errorText, { color: colors.error }]} numberOfLines={2}>{error}</Text>
                <TouchableOpacity onPress={() => setError(null)} accessibilityLabel="Close error message">
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
                  placeholder={isOffline ? 'Offline — messages will be sent when connected' : 'Ask about medical information...'}
                  placeholderTextColor={colors.textLight}
                  editable={!loading}
                  multiline
                  maxLength={500}
                  accessibilityLabel="Enter medical question"
                  accessibilityHint="Enter symptoms or health questions"
                />
                <Animated.View style={{ transform: [{ scale: sendScale }] }}>
                  <TouchableOpacity
                    style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
                    onPress={sendMessage}
                    disabled={!input.trim() || loading}
                    accessibilityLabel="Send message"
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !input.trim() || loading }}
                  >
                    <LinearGradient
                      colors={!input.trim() || loading ? [colors.textLight, colors.textLight] : colors.gradientPrimary}
                      style={styles.sendBtnGradient}
                    >
                      {loading ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="send" size={18} color="#fff" />}
                    </LinearGradient>
                  </TouchableOpacity>
                </Animated.View>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, marginTop: 6 }}>
                <Text style={{ fontSize: 11, color: colors.textLight }}>{input.length}/500</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="shield-checkmark" size={11} color={colors.success} />
                  <Text style={{ fontSize: 11, color: colors.textLight, marginLeft: 3 }}>Secure</Text>
                </View>
              </View>
            </View>

            {/* FIX: Appointment card with maxHeight constraint */}
            {showAppointmentCard && currentSuggestion && (
              <AppointmentSuggestionCard
                suggestion={currentSuggestion}
                onBook={handleBookAppointment}
                onClose={() => { setShowAppointmentCard(false); setCurrentSuggestion(null); }}
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
  container: { flex: 1, width: '100%', backgroundColor: '#FAFAFA' },

  header: { paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0, paddingBottom: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12 },
  headerBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)' },
  headerAvatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },
  headerSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.9)', marginTop: 1 },

  loadingIcon: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center' },

  // FIX: Offline banner
  offlineBanner: { backgroundColor: '#FF9800', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  offlineText: { color: '#fff', fontSize: 13, flex: 1 },

  msgContainer: { marginVertical: 6, paddingHorizontal: 4 },
  userContainer: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'flex-end' },
  botContainer: { flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'flex-start' },
  botAvatar: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  userAvatar: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  msgContent: { maxWidth: '80%' },
  userMsgContent: { alignItems: 'flex-end' },
  botMsgContent: { alignItems: 'flex-start' },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  userBubble: { borderBottomRightRadius: 4 },
  botBubble: { backgroundColor: '#fff', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#E0E0E0', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  msgText: { fontSize: 14, lineHeight: 21 },
  userMsgText: { color: '#fff', fontSize: 14, lineHeight: 21, fontWeight: '500' },
  timestamp: { fontSize: 10, marginTop: 3 },
  pendingText: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  failedText: { fontSize: 11, color: '#FFD54F', marginTop: 4 },

  confidenceBox: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.08)' },
  confidenceBar: { height: 4, backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: 2, overflow: 'hidden', marginBottom: 3 },
  confidenceFill: { height: '100%', borderRadius: 2 },
  confidenceLabel: { fontSize: 10, color: '#757575' },

  emergencyBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,82,82,0.1)', padding: 8, borderRadius: 8, marginTop: 8, borderWidth: 1, borderColor: 'rgba(255,82,82,0.3)' },
  emergencyText: { color: '#FF5252', fontWeight: '700', fontSize: 12, marginLeft: 6 },

  actionsBox: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.08)' },
  actionsTitle: { fontSize: 11, color: '#757575', fontWeight: '600', marginBottom: 4 },
  actionChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,188,212,0.08)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, marginBottom: 3, alignSelf: 'flex-start' },
  actionText: { fontSize: 11, color: '#00BCD4', marginLeft: 4 },

  // FIX: Follow-up widget
  followUpContainer: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.08)' },
  followUpTitle: { fontSize: 12, color: '#757575', fontWeight: '600', marginBottom: 6 },
  followUpChip: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: 'rgba(0,188,212,0.06)', padding: 8, borderRadius: 10, marginBottom: 5, borderWidth: 1, borderColor: 'rgba(0,188,212,0.2)' },
  followUpText: { fontSize: 12, color: '#00BCD4', marginLeft: 6, flex: 1, lineHeight: 18 },

  bookBtn: { marginTop: 10, borderRadius: 18, overflow: 'hidden' },
  bookBtnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 7, paddingHorizontal: 14 },
  bookBtnText: { color: '#fff', fontSize: 13, fontWeight: '600', marginLeft: 6 },

  typingRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 6, paddingHorizontal: 4 },
  typingBubble: { backgroundColor: '#fff', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: '#E0E0E0' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#9E9E9E', marginHorizontal: 3 },

  errorBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFEBEE', paddingHorizontal: 12, paddingVertical: 8, marginHorizontal: 12, marginBottom: 4, borderRadius: 8, gap: 8 },
  errorText: { flex: 1, fontSize: 12 },

  inputArea: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: Platform.OS === 'ios' ? 20 : 10, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E0E0E0' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end' },
  input: { flex: 1, backgroundColor: '#F5F5F5', borderRadius: 22, paddingHorizontal: 18, paddingVertical: 10, fontSize: 14, maxHeight: 100, borderWidth: 1, borderColor: '#E0E0E0', marginRight: 10, color: '#212121' },
  sendBtn: { width: 46, height: 46, borderRadius: 23, overflow: 'hidden' },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnGradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // FIX: Appointment card maxHeight constraint
  appointmentCard: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 120 : 100,
    left: 12, right: 12,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    maxHeight: height * 0.5, // FIX: limit height to 50% of screen
    zIndex: 1000,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 6,
  },
  closeBtn: { position: 'absolute', top: 10, right: 10, zIndex: 1, padding: 4 },
  urgencyBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start', marginBottom: 8 },
  urgencyText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#212121', marginBottom: 6 },
  suggestionReason: { fontSize: 13, color: '#424242', lineHeight: 19, marginBottom: 10 },

  contraindicationBox: { flexDirection: 'row', backgroundColor: '#FFEBEE', padding: 8, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,82,82,0.3)', gap: 6 },
  contraindicationText: { flex: 1, fontSize: 12, color: '#FF5252', lineHeight: 18 },

  symptomsRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  symptomChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F9FA', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, marginRight: 6, marginBottom: 4 },
  symptomChipText: { fontSize: 11, color: '#00BCD4', marginLeft: 3 },

  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  infoText: { fontSize: 13, color: '#757575', marginLeft: 6 },

  doctorsTitle: { fontSize: 13, fontWeight: '600', color: '#212121', marginTop: 8, marginBottom: 8 },
  doctorsScroll: { maxHeight: 150 },
  doctorCard: { width: 230, marginRight: 10, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: 'transparent' },
  doctorCardSelected: { borderColor: '#00BCD4', borderWidth: 2 },
  doctorCardFull: { opacity: 0.6 },
  doctorCardGradient: { padding: 10 },
  doctorRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  doctorName: { fontSize: 13, fontWeight: '600', color: '#212121' },
  ratingRow: { flexDirection: 'row', alignItems: 'center' },
  ratingText: { fontSize: 11, color: '#757575', marginLeft: 3 },
  fullBadge: { backgroundColor: '#FFEBEE', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 8 },
  fullBadgeText: { fontSize: 10, color: '#FF5252', fontWeight: '600' },
  doctorMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  expText: { fontSize: 11, color: '#757575' },
  feeText: { fontSize: 11, color: '#00BCD4', fontWeight: '600' },
  slotsBox: { marginTop: 8 },
  slotsLabel: { fontSize: 11, marginBottom: 4 },
  slotChip: { backgroundColor: '#fff', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, marginRight: 6, borderWidth: 1, borderColor: '#E0E0E0' },
  slotChipSelected: { backgroundColor: '#00BCD4', borderColor: '#00BCD4' },
  slotText: { fontSize: 11, color: '#757575' },

  noDoctorsBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5', borderRadius: 10, padding: 10, marginVertical: 8, gap: 8 },
  noDoctorsText: { flex: 1, fontSize: 12, color: '#757575', lineHeight: 18 },

  confirmBtn: { borderRadius: 12, overflow: 'hidden', marginTop: 10 },
  confirmBtnDisabled: { opacity: 0.5 },
  confirmBtnGradient: { paddingVertical: 13, alignItems: 'center' },
  confirmBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  // FIX: Consent modal
  consentOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
  consentBox: { backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden', maxHeight: height * 0.8 },
  consentHeader: { padding: 24, alignItems: 'center' },
  consentTitle: { fontSize: 20, fontWeight: '700', color: '#fff', marginTop: 10 },
  consentContent: { padding: 20, maxHeight: height * 0.4 },
  consentText: { fontSize: 14, color: '#424242', lineHeight: 22 },
  consentButtons: { flexDirection: 'row', padding: 16, gap: 12, borderTopWidth: 1, borderTopColor: '#E0E0E0' },
  consentBtn: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  declineBtn: { backgroundColor: '#F5F5F5', paddingVertical: 14, alignItems: 'center', borderRadius: 12 },
  declineBtnText: { color: '#757575', fontWeight: '600', fontSize: 15 },
  acceptBtn: { borderRadius: 12, overflow: 'hidden' },
  acceptBtnGradient: { paddingVertical: 14, alignItems: 'center' },
  acceptBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

export default ChatWidget;