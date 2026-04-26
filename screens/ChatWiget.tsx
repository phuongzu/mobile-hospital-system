import React, { useEffect, useState, useRef, useCallback } from "react";
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
  Linking,
  AccessibilityInfo,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";

const { width, height } = Dimensions.get("window");

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000/api";
const PENDING_MESSAGES_KEY = "pending_chat_messages";
const CONSENT_GIVEN_KEY = "ai_consent_given";
const SESSION_ID_KEY = "ai_session_id";
const BOOKED_APPOINTMENTS_KEY = "booked_appointment_ids";

// ==================== TYPES ====================

interface Doctor {
  _id: string;
  name: string;
  email: string;
  specialty?: string;
  specialty_id?: { name: string };
  consultation_fee?: number;
  rating?: number;
  years_of_experience?: number;
  isAvailable?: boolean;
  user_id?: { name: string };
  id?: string;
  availableSlots?: string[];
  experience?: number;
}

interface ExistingAppointmentDetails {
  id?: string;
  date: string;
  time: string;
  doctorName?: string;
  specialty?: string;
  specialtyId?: string;
  status?: string;
}

interface AppointmentFilter {
  status: "all" | "pending" | "confirmed" | "completed" | "cancelled";
}

interface AppointmentSuggestion {
  shouldBook: boolean;
  urgencyLevel: "low" | "medium" | "high" | "critical";
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
  suggestedDoctors?: AISuggestedDoctor[];
  actionType?:
  | "view_appointments"
  | "reschedule"
  | "cancel"
  | "new_booking"
  | "info";
  upcomingAppointments?: ExistingAppointmentDetails[];
}

interface AISuggestedDoctor {
  id: string;
  name: string;
  availableSlots: string[];
  consultationFee?: number;
  experience?: number;
  rating?: number;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  id?: string;
  category?: string;
  confidence?: number;
  suggestedActions?: string[];
  emergencyAlert?: boolean;
  relatedSpecialties?: string[];
  language?: "en";
  followUpQuestions?: string[];
  requiresMoreInfo?: boolean;
  patientContextUsed?: boolean;
  appointmentRecommendation?: AppointmentSuggestion;
  pending?: boolean;
  failed?: boolean;
  bookedAppointmentId?: string;
}

interface AIResponseData {
  response: string;
  confidence: number;
  suggestedActions?: string[];
  emergencyAlert?: boolean;
  category?: string;
  relatedSpecialties?: string[];
  language?: "en";
  followUpQuestions?: string[];
  requiresMoreInfo?: boolean;
  patientContextUsed?: boolean;
  appointmentRecommendation?: AppointmentSuggestion;
  session_id?: string;
  shouldAskBookingConfirmation?: boolean;
  triageScore?: number;
  urgencyLevel?: "low" | "medium" | "high" | "critical";
  upcomingAppointments?: ExistingAppointmentDetails[];
}

interface AIResponse {
  success: boolean;
  data: AIResponseData;
}

interface DateOption {
  label: string;
  sublabel: string;
  date: Date;
  dateStr: string;
  isWeekend: boolean;
}

type RootStackParamList = {
  Home: undefined;
  Login: undefined;
  ChatOption: undefined;
  AppointmentBooking: {
    appointmentId?: string;
    doctorId?: string;
    doctor?: Doctor;
    initialData?: any;
  };
  Appointments: undefined;
  HistoryAppointment: { appointmentId: string };
};

type NavigationProp = StackNavigationProp<RootStackParamList>;

// ==================== COLORS ====================

const colors = {
  primary: "#00BCD4",
  primaryDark: "#0097A7",
  background: "#FAFAFA",
  surface: "#FFFFFF",
  surfaceLight: "#F5F5F5",
  textPrimary: "#212121",
  textSecondary: "#757575",
  textLight: "#9E9E9E",
  error: "#FF5252",
  warning: "#FF9800",
  success: "#00BCD4",
  critical: "#D32F2F",
  border: "#E0E0E0",
  gradientPrimary: ["#00BCD4", "#00ACC1"] as [string, string],
  gradientSecondary: ["#00ACC1", "#0097A7"] as [string, string],
  gradientCritical: ["#D32F2F", "#B71C1C"] as [string, string],
  gradientView: ["#26C6DA", "#00897B"] as [string, string],
  gradientWarning: ["#FF9800", "#F57C00"] as [string, string],
  gradientCancel: ["#EF5350", "#C62828"] as [string, string],
};

// ==================== AUTH HELPERS ====================

async function getValidToken(): Promise<string | null> {
  return AsyncStorage.getItem("authToken");
}

async function tryRefreshToken(): Promise<string | null> {
  try {
    const refreshToken = await AsyncStorage.getItem("refreshToken");
    if (!refreshToken) return null;
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.success && data.data?.accessToken) {
      await AsyncStorage.setItem("authToken", data.data.accessToken);
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
    const d = await AsyncStorage.getItem(PENDING_MESSAGES_KEY);
    return d ? JSON.parse(d) : [];
  } catch {
    return [];
  }
}

async function clearPendingMessages(): Promise<void> {
  await AsyncStorage.removeItem(PENDING_MESSAGES_KEY);
}

async function saveBookedAppointmentId(id: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(BOOKED_APPOINTMENTS_KEY);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    if (!ids.includes(id)) {
      ids.push(id);
      await AsyncStorage.setItem(BOOKED_APPOINTMENTS_KEY, JSON.stringify(ids));
    }
  } catch {
    /* ignore */
  }
}

async function getBookedAppointmentIds(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(BOOKED_APPOINTMENTS_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

// ==================== DATE HELPERS ====================

const formatDateLocal = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const date = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${date}`;
};

function generateAvailableDates(count = 14): DateOption[] {
  const dates: DateOption[] = [];
  const today = new Date();
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  let i = 1;
  while (dates.length < count) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    d.setHours(0, 0, 0, 0);
    const dayIdx = d.getDay();
    dates.push({
      label: DAYS[dayIdx],
      sublabel: `${d.getDate()}/${d.getMonth() + 1}`,
      date: d,
      dateStr: formatDateLocal(d),
      isWeekend: dayIdx === 0 || dayIdx === 6,
    });
    i++;
  }
  return dates;
}

// ==================== DATE PICKER ====================

const DatePickerRow = ({
  selectedDate,
  onSelectDate,
}: {
  selectedDate: string;
  onSelectDate: (dateStr: string, date: Date) => void;
}) => {
  const dates = generateAvailableDates(14);
  return (
    <View style={datePickerStyles.container}>
      <Text style={datePickerStyles.label}>📅 Select appointment date:</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={datePickerStyles.scroll}
      >
        {dates.map((d) => {
          const isSelected = selectedDate === d.dateStr;
          return (
            <TouchableOpacity
              key={d.dateStr}
              style={[
                datePickerStyles.dateChip,
                isSelected && datePickerStyles.dateChipSelected,
                d.isWeekend && !isSelected && datePickerStyles.dateChipWeekend,
              ]}
              onPress={() => onSelectDate(d.dateStr, d.date)}
            >
              <LinearGradient
                colors={
                  isSelected
                    ? colors.gradientPrimary
                    : ["transparent", "transparent"]
                }
                style={datePickerStyles.dateChipGradient}
              >
                <Text
                  style={[
                    datePickerStyles.dateDay,
                    isSelected && { color: "#fff" },
                    d.isWeekend && !isSelected && { color: colors.warning },
                  ]}
                >
                  {d.label}
                </Text>
                <Text
                  style={[
                    datePickerStyles.dateNum,
                    isSelected && { color: "#fff", fontWeight: "700" },
                    d.isWeekend && !isSelected && { color: colors.warning },
                  ]}
                >
                  {d.sublabel}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      {selectedDate && (
        <Text style={datePickerStyles.selectedLabel}>
          ✓ Selected: {selectedDate}
        </Text>
      )}
    </View>
  );
};

const datePickerStyles = StyleSheet.create({
  container: { marginBottom: 4, marginTop: 10 },
  dateChip: {
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1.5,
    marginRight: 8,
    overflow: "hidden",
    width: 56,
  },
  dateChipGradient: { alignItems: "center", paddingVertical: 10 },
  dateChipSelected: {
    borderColor: colors.primary,
    elevation: 4,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  dateChipWeekend: { backgroundColor: "#FFF8F0", borderColor: "#FFE0B2" },
  dateDay: { color: colors.textSecondary, fontSize: 11, fontWeight: "500" },
  dateNum: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 2,
  },
  label: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
  },
  scroll: { maxHeight: 80 },
  selectedLabel: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "500",
    marginTop: 6,
  },
});

// ==================== EMERGENCY MODAL ====================

const EmergencyModal = ({
  visible,
  instructions,
  onClose,
}: {
  visible: boolean;
  instructions: string;
  onClose: () => void;
}) => {
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.emergencyOverlay}>
        <View style={styles.emergencyModalBox}>
          <LinearGradient
            colors={colors.gradientCritical}
            style={styles.emergencyHeader}
          >
            <Ionicons name="warning" size={50} color="#fff" />
            <Text style={styles.emergencyTitle}>EMERGENCY!</Text>
          </LinearGradient>
          <ScrollView style={styles.emergencyContent}>
            <Text style={styles.emergencyInstructionText}>{instructions}</Text>
          </ScrollView>
          <View style={styles.emergencyButtons}>
            <TouchableOpacity
              style={[styles.emergencyBtn, styles.callBtn]}
              onPress={() => Linking.openURL("tel:115")}
            >
              <Ionicons name="call" size={20} color="#fff" />
              <Text style={styles.emergencyBtnText}>Call 115</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.emergencyBtn, styles.mapBtn]}
              onPress={() => Linking.openURL("maps:")}
            >
              <Ionicons name="map" size={20} color="#fff" />
              <Text style={styles.emergencyBtnText}>Nearest Hospital</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.emergencyBtn, styles.closeEmergencyBtn]}
              onPress={onClose}
            >
              <Text style={styles.closeEmergencyText}>Close</Text>
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
}: {
  suggestion: AppointmentSuggestion;
  onConfirm: () => void;
  onDecline: () => void;
}) => {
  const slideAnim = useRef(new Animated.Value(300)).current;
  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 0,
      tension: 100,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, []);

  const getUrgencyColor = () =>
    ({
      critical: colors.critical,
      high: colors.error,
      medium: colors.warning,
      low: colors.primary,
    })[suggestion.urgencyLevel] ?? colors.primary;

  const getUrgencyLabel = () =>
    ({
      critical: "🚨 EMERGENCY",
      high: "⚠️ Urgent",
      medium: "📋 See Soon",
      low: "📅 Routine",
    })[suggestion.urgencyLevel] ?? suggestion.urgencyLevel;

  return (
    <Animated.View
      style={[
        styles.appointmentCard,
        { transform: [{ translateY: slideAnim }] },
      ]}
    >
      <TouchableOpacity style={styles.closeBtn} onPress={onDecline}>
        <Ionicons name="close" size={20} color={colors.textSecondary} />
      </TouchableOpacity>
      <View
        style={[styles.urgencyBadge, { backgroundColor: getUrgencyColor() }]}
      >
        <Text style={styles.urgencyText}>{getUrgencyLabel()}</Text>
      </View>
      <Text style={styles.cardTitle}>📋 Appointment Suggestion</Text>
      <Text style={styles.suggestionReason}>{suggestion.reason}</Text>
      <View style={styles.infoRow}>
        <Ionicons name="time-outline" size={16} color={colors.primary} />
        <Text style={styles.infoText}>{suggestion.recommendedTimeframe}</Text>
      </View>
      {suggestion.suggestedSpecialty && (
        <View style={styles.infoRow}>
          <Ionicons name="medical-outline" size={16} color={colors.primary} />
          <Text style={styles.infoText}>
            Specialty: {suggestion.suggestedSpecialty}
          </Text>
        </View>
      )}
      <Text style={styles.confirmationQuestion}>
        {suggestion.bookingQuestion ||
          "💡 Would you like to book an appointment?"}
      </Text>
      <View style={styles.confirmationButtons}>
        <TouchableOpacity
          style={[styles.confirmBtn, styles.confirmBtnYes]}
          onPress={onConfirm}
        >
          <LinearGradient
            colors={colors.gradientPrimary}
            style={styles.confirmBtnGradient}
          >
            <Ionicons name="checkmark-circle" size={18} color="#fff" />
            <Text style={styles.confirmBtnText}>Yes, Book Now</Text>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.confirmBtn, styles.confirmBtnNo]}
          onPress={onDecline}
        >
          <View style={styles.declineBtnContent}>
            <Ionicons
              name="close-circle"
              size={18}
              color={colors.textSecondary}
            />
            <Text style={styles.declineBtnText}>Not Now</Text>
          </View>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

// ==================== ALL APPOINTMENTS CARD ====================

const AllAppointmentsCard = ({
  appointments,
  onClose,
  onViewDetail,
}: {
  appointments: ExistingAppointmentDetails[];
  onClose: () => void;
  onViewDetail: (id: string) => void;
}) => {
  const [filter, setFilter] = useState<AppointmentFilter["status"]>("all");
  const slideAnim = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 0,
      tension: 100,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, []);

  const filtered =
    filter === "all"
      ? appointments
      : appointments.filter((a) => a.status === filter);

  const statusColor = (s?: string) =>
    ({
      pending: colors.warning,
      confirmed: colors.primary,
      completed: colors.success,
      cancelled: colors.error,
    })[s ?? ""] ?? colors.textLight;

  const filters: Array<{ key: AppointmentFilter["status"]; label: string }> = [
    { key: "all", label: "All" },
    { key: "confirmed", label: "Confirmed" },
    { key: "pending", label: "Pending" },
    { key: "completed", label: "Completed" },
    { key: "cancelled", label: "Cancelled" },
  ];

  return (
    <Animated.View
      style={[
        styles.appointmentCard,
        { transform: [{ translateY: slideAnim }] },
      ]}
    >
      <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
        <Ionicons name="close" size={20} color={colors.textSecondary} />
      </TouchableOpacity>
      <View style={[styles.urgencyBadge, { backgroundColor: colors.primary }]}>
        <Text style={styles.urgencyText}>📋 All Appointments</Text>
      </View>
      <Text style={styles.cardTitle}>Appointment History</Text>

      {/* Filter tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginBottom: 10 }}
      >
        {filters.map((f) => (
          <TouchableOpacity
            key={f.key}
            onPress={() => setFilter(f.key)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 16,
              marginRight: 8,
              backgroundColor:
                filter === f.key ? colors.primary : colors.surfaceLight,
              borderWidth: 1,
              borderColor: filter === f.key ? colors.primary : colors.border,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: "600",
                color: filter === f.key ? "#fff" : colors.textSecondary,
              }}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {filtered.length === 0 ? (
        <View style={styles.noDoctorsBox}>
          <Ionicons
            name="calendar-outline"
            size={36}
            color={colors.textLight}
          />
          <Text style={styles.noDoctorsText}>No appointments found.</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={{ maxHeight: 280 }}
          nestedScrollEnabled
        >
          {filtered.map((appt, i) => (
            <TouchableOpacity
              key={appt.id ?? i}
              style={[upcomingStyles.row, { paddingVertical: 10 }]}
              onPress={() => appt.id && onViewDetail(appt.id)}
            >
              <View style={upcomingStyles.mainRow}>
                <View
                  style={[
                    upcomingStyles.iconBox,
                    { backgroundColor: statusColor(appt.status) + "15" },
                  ]}
                >
                  <Ionicons
                    name={
                      appt.status === "completed"
                        ? "checkmark-circle"
                        : appt.status === "cancelled"
                          ? "close-circle"
                          : "calendar"
                    }
                    size={20}
                    color={statusColor(appt.status)}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={upcomingStyles.doctorName}>
                    Dr. {appt.doctorName}
                  </Text>
                  <Text style={upcomingStyles.specialty}>{appt.specialty}</Text>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      marginTop: 3,
                    }}
                  >
                    <Ionicons
                      name="time-outline"
                      size={12}
                      color={colors.textLight}
                    />
                    <Text style={upcomingStyles.datetime}>
                      {" "}
                      {appt.date} – {appt.time}
                    </Text>
                  </View>
                </View>
                <View
                  style={[
                    upcomingStyles.statusBadge,
                    {
                      backgroundColor: statusColor(appt.status) + "20",
                      borderColor: statusColor(appt.status),
                    },
                  ]}
                >
                  <Text
                    style={[
                      upcomingStyles.statusText,
                      { color: statusColor(appt.status) },
                    ]}
                  >
                    {{
                      pending: "Pending",
                      confirmed: "Confirmed",
                      completed: "Completed",
                      cancelled: "Cancelled",
                    }[appt.status ?? ""] ?? appt.status}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <TouchableOpacity
        style={[styles.confirmBtn, { marginTop: 12 }]}
        onPress={onClose}
      >
        <LinearGradient
          colors={colors.gradientPrimary}
          style={styles.confirmBtnGradient}
        >
          <Text style={styles.confirmBtnText}>Close</Text>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ==================== UPCOMING APPOINTMENTS CARD ====================

const UpcomingAppointmentsCard = ({
  appointments,
  onClose,
  onViewDetail,
  onReschedule,
  onCancel,
  actionType,
}: {
  appointments: ExistingAppointmentDetails[];
  onClose: () => void;
  onViewDetail: (id: string) => void;
  onReschedule?: (id: string) => void;
  onCancel?: (id: string) => void;
  actionType?: string;
}) => {
  const slideAnim = useRef(new Animated.Value(300)).current;
  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 0,
      tension: 100,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, []);

  const statusColor = (s?: string) =>
    ({
      pending: colors.warning,
      confirmed: colors.primary,
      cancelled: colors.error,
    })[s ?? ""] ?? colors.textLight;

  const statusLabel = (s?: string) =>
    ({
      pending: "Pending",
      confirmed: "Confirmed",
      cancelled: "Cancelled",
    })[s ?? ""] ??
    s ??
    "";

  const showCancelButtons = actionType === "cancel";
  const showRescheduleButtons = actionType === "reschedule";

  const badgeLabel =
    actionType === "cancel"
      ? "❌ Cancel Appointment"
      : actionType === "reschedule"
        ? "🔄 Reschedule"
        : "📅 Upcoming Appointments";

  const badgeBg =
    actionType === "cancel"
      ? colors.error
      : actionType === "reschedule"
        ? colors.warning
        : colors.primary;

  return (
    <Animated.View
      style={[
        styles.appointmentCard,
        { transform: [{ translateY: slideAnim }] },
      ]}
    >
      <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
        <Ionicons name="close" size={20} color={colors.textSecondary} />
      </TouchableOpacity>
      <View style={[styles.urgencyBadge, { backgroundColor: badgeBg }]}>
        <Text style={styles.urgencyText}>{badgeLabel}</Text>
      </View>
      <Text style={styles.cardTitle}>
        {actionType === "cancel"
          ? "Select appointment to cancel"
          : actionType === "reschedule"
            ? "Select appointment to reschedule"
            : "Your Appointments"}
      </Text>

      {appointments.length === 0 ? (
        <View style={styles.noDoctorsBox}>
          <Ionicons
            name="calendar-outline"
            size={36}
            color={colors.textLight}
          />
          <Text style={styles.noDoctorsText}>
            You have no upcoming appointments.
          </Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={{ maxHeight: 320 }}
          nestedScrollEnabled
        >
          {appointments.map((appt, i) => (
            <View key={appt.id ?? i} style={upcomingStyles.row}>
              <TouchableOpacity
                style={upcomingStyles.mainRow}
                onPress={() => {
                  if (appt.id && !showCancelButtons && !showRescheduleButtons) {
                    onViewDetail(appt.id);
                  }
                }}
              >
                <View style={upcomingStyles.iconBox}>
                  <Ionicons name="calendar" size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={upcomingStyles.doctorName}>
                    Dr. {appt.doctorName}
                  </Text>
                  <Text style={upcomingStyles.specialty}>{appt.specialty}</Text>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      marginTop: 3,
                    }}
                  >
                    <Ionicons
                      name="time-outline"
                      size={12}
                      color={colors.textLight}
                    />
                    <Text style={upcomingStyles.datetime}>
                      {" "}
                      {appt.date} – {appt.time}
                    </Text>
                  </View>
                </View>
                <View
                  style={[
                    upcomingStyles.statusBadge,
                    {
                      backgroundColor: statusColor(appt.status) + "22",
                      borderColor: statusColor(appt.status),
                    },
                  ]}
                >
                  <Text
                    style={[
                      upcomingStyles.statusText,
                      { color: statusColor(appt.status) },
                    ]}
                  >
                    {statusLabel(appt.status)}
                  </Text>
                </View>
              </TouchableOpacity>

              {(showCancelButtons || showRescheduleButtons) && appt.id && (
                <View style={upcomingStyles.actionRow}>
                  {showRescheduleButtons && onReschedule && (
                    <TouchableOpacity
                      style={[
                        upcomingStyles.actionBtn,
                        {
                          backgroundColor: colors.warning + "15",
                          borderColor: colors.warning,
                        },
                      ]}
                      onPress={() => onReschedule(appt.id!)}
                    >
                      <Ionicons
                        name="refresh"
                        size={14}
                        color={colors.warning}
                      />
                      <Text
                        style={[
                          upcomingStyles.actionBtnText,
                          { color: colors.warning },
                        ]}
                      >
                        Reschedule
                      </Text>
                    </TouchableOpacity>
                  )}
                  {showCancelButtons && onCancel && (
                    <TouchableOpacity
                      style={[
                        upcomingStyles.actionBtn,
                        {
                          backgroundColor: colors.error + "15",
                          borderColor: colors.error,
                        },
                      ]}
                      onPress={() => onCancel(appt.id!)}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={14}
                        color={colors.error}
                      />
                      <Text
                        style={[
                          upcomingStyles.actionBtnText,
                          { color: colors.error },
                        ]}
                      >
                        Cancel
                      </Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[
                      upcomingStyles.actionBtn,
                      {
                        backgroundColor: colors.primary + "15",
                        borderColor: colors.primary,
                      },
                    ]}
                    onPress={() => onViewDetail(appt.id!)}
                  >
                    <Ionicons
                      name="eye-outline"
                      size={14}
                      color={colors.primary}
                    />
                    <Text
                      style={[
                        upcomingStyles.actionBtnText,
                        { color: colors.primary },
                      ]}
                    >
                      Details
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      <TouchableOpacity
        style={[styles.confirmBtn, { marginTop: 12 }]}
        onPress={onClose}
      >
        <LinearGradient
          colors={colors.gradientPrimary}
          style={styles.confirmBtnGradient}
        >
          <Text style={styles.confirmBtnText}>Close</Text>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
};

const upcomingStyles = StyleSheet.create({
  actionBtn: {
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  actionBtnText: { fontSize: 12, fontWeight: "500" },
  actionRow: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "flex-end",
    marginTop: 8,
  },
  datetime: { color: colors.textLight, fontSize: 12 },
  doctorName: { color: colors.textPrimary, fontSize: 14, fontWeight: "600" },
  iconBox: {
    alignItems: "center",
    backgroundColor: "rgba(0,188,212,0.1)",
    borderRadius: 19,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  mainRow: { alignItems: "center", flexDirection: "row", gap: 10 },
  row: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    paddingVertical: 8,
  },
  specialty: { color: colors.textSecondary, fontSize: 12, marginTop: 1 },
  statusBadge: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusText: { fontSize: 11, fontWeight: "600" },
});

// ==================== RESCHEDULE CARD ====================

const ALL_RESCHEDULE_SLOTS = [
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
];

const RescheduleCard = ({
  appointment,
  onReschedule,
  onClose,
}: {
  appointment: ExistingAppointmentDetails;
  onReschedule: (
    appointmentId: string,
    newSlot: string,
    newDate: string,
  ) => void;
  onClose: () => void;
}) => {
  const slideAnim = useRef(new Animated.Value(300)).current;
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 0,
      tension: 100,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleDateChange = useCallback(
    async (dateStr: string) => {
      setSelectedDate(dateStr);
      setSelectedSlot("");
      setLoadingSlots(true);
      try {
        const token = await getValidToken();
        if (!token || !appointment.id) {
          setAvailableSlots(ALL_RESCHEDULE_SLOTS);
          return;
        }
        const res = await fetch(
          `${API_BASE_URL}/appointments/${appointment.id}/available-slots?date=${dateStr}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (res.ok) {
          const d = await res.json();
          if (
            d.success &&
            Array.isArray(d.data?.slots) &&
            d.data.slots.length > 0
          ) {
            setAvailableSlots(d.data.slots);
          } else {
            setAvailableSlots(ALL_RESCHEDULE_SLOTS);
          }
        } else {
          setAvailableSlots(ALL_RESCHEDULE_SLOTS);
        }
      } catch {
        setAvailableSlots(ALL_RESCHEDULE_SLOTS);
      } finally {
        setLoadingSlots(false);
      }
    },
    [appointment.id],
  );

  const canConfirm = !!selectedDate && !!selectedSlot;

  return (
    <Animated.View
      style={[
        styles.appointmentCard,
        { transform: [{ translateY: slideAnim }] },
      ]}
    >
      <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Ionicons name="close" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
        <View
          style={[styles.urgencyBadge, { backgroundColor: colors.warning }]}
        >
          <Text style={styles.urgencyText}>🔄 Reschedule</Text>
        </View>
        <Text style={styles.cardTitle}>
          Reschedule: Dr. {appointment.doctorName}
        </Text>
        <View
          style={[
            styles.infoRow,
            {
              backgroundColor: "#FFF8E1",
              borderRadius: 10,
              padding: 10,
              marginBottom: 10,
            },
          ]}
        >
          <Ionicons name="calendar" size={14} color={colors.warning} />
          <Text
            style={[
              styles.infoText,
              { color: colors.warning, fontWeight: "500" },
            ]}
          >
            Current: {appointment.date} at {appointment.time}
          </Text>
        </View>

        <DatePickerRow
          selectedDate={selectedDate}
          onSelectDate={(dateStr) => handleDateChange(dateStr)}
        />

        {selectedDate && (
          <>
            <Text style={styles.doctorsTitle}>
              {loadingSlots ? "⏳" : "⏰ Choose new time:"}
            </Text>
            {loadingSlots ? (
              <ActivityIndicator
                color={colors.primary}
                style={{ marginVertical: 12 }}
              />
            ) : (
              <View style={rescheduleStyles.slotsWrap}>
                {availableSlots.map((slot) => (
                  <TouchableOpacity
                    key={slot}
                    style={[
                      rescheduleStyles.slotChip,
                      selectedSlot === slot &&
                      rescheduleStyles.slotChipSelected,
                    ]}
                    onPress={() => setSelectedSlot(slot)}
                  >
                    <Text
                      style={[
                        rescheduleStyles.slotText,
                        selectedSlot === slot && { color: "#fff" },
                      ]}
                    >
                      {slot}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        )}

        {canConfirm && (
          <View style={bookingCardStyles.summary}>
            <Ionicons
              name="checkmark-circle"
              size={16}
              color={colors.primary}
            />
            <Text style={bookingCardStyles.summaryText}>
              Reschedule to: {selectedDate} – {selectedSlot}
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.confirmBtn, !canConfirm && styles.confirmBtnDisabled]}
          disabled={!canConfirm}
          onPress={() => {
            if (canConfirm && appointment.id) {
              onReschedule(appointment.id, selectedSlot, selectedDate);
            }
          }}
        >
          <LinearGradient
            colors={
              !canConfirm
                ? [colors.textLight, colors.textLight]
                : colors.gradientWarning
            }
            style={styles.confirmBtnGradient}
          >
            <Ionicons name="refresh" size={18} color="#fff" />
            <Text style={styles.confirmBtnText}>Confirm Reschedule</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </Animated.View>
  );
};

const rescheduleStyles = StyleSheet.create({
  slotChip: {
    backgroundColor: colors.surfaceLight,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  slotChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  slotText: { color: colors.textPrimary, fontSize: 12, fontWeight: "500" },
  slotsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
});

// ==================== EXISTING APPOINTMENT CARD ====================

const ExistingAppointmentCard = ({
  suggestion,
  onClose,
  onViewAppointment,
}: {
  suggestion: AppointmentSuggestion;
  onClose: () => void;
  onViewAppointment: () => void;
}) => {
  const slideAnim = useRef(new Animated.Value(300)).current;
  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 0,
      tension: 100,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.appointmentCard,
        { transform: [{ translateY: slideAnim }] },
      ]}
    >
      <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
        <Ionicons name="close" size={20} color={colors.textSecondary} />
      </TouchableOpacity>
      <View style={[styles.urgencyBadge, { backgroundColor: colors.primary }]}>
        <Text style={styles.urgencyText}>📅 Existing Appointment</Text>
      </View>
      <Text style={styles.cardTitle}>Notice</Text>
      <Text style={styles.suggestionReason}>{suggestion.reason}</Text>
      {suggestion.existingAppointmentDetails && (
        <View style={styles.existingAppointmentDetails}>
          <View style={styles.infoRow}>
            <Ionicons name="calendar" size={16} color={colors.primary} />
            <Text style={styles.infoText}>
              {suggestion.existingAppointmentDetails.date} -{" "}
              {suggestion.existingAppointmentDetails.time}
            </Text>
          </View>
          {suggestion.existingAppointmentDetails.doctorName && (
            <View style={styles.infoRow}>
              <Ionicons name="person" size={16} color={colors.primary} />
              <Text style={styles.infoText}>
                Doctor: {suggestion.existingAppointmentDetails.doctorName}
              </Text>
            </View>
          )}
          {suggestion.existingAppointmentDetails.specialty && (
            <View style={styles.infoRow}>
              <Ionicons name="medical" size={16} color={colors.primary} />
              <Text style={styles.infoText}>
                Specialty: {suggestion.existingAppointmentDetails.specialty}
              </Text>
            </View>
          )}
        </View>
      )}
      <TouchableOpacity
        style={[styles.confirmBtn, { marginTop: 15 }]}
        onPress={onViewAppointment}
      >
        <LinearGradient
          colors={colors.gradientView}
          style={styles.confirmBtnGradient}
        >
          <Ionicons name="eye-outline" size={18} color="#fff" />
          <Text style={styles.confirmBtnText}>View Appointment Details</Text>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ==================== NO DOCTORS CARD ====================

const NoDoctorsCard = ({
  suggestion,
  onClose,
}: {
  suggestion: AppointmentSuggestion;
  onClose: () => void;
}) => {
  const slideAnim = useRef(new Animated.Value(300)).current;
  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 0,
      tension: 100,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, []);

  type UrgencyLevel = "low" | "medium" | "high" | "critical";

  const getUrgencyColor = () => {
    const map: Record<UrgencyLevel, string> = {
      low: colors.success,
      medium: colors.warning,
      high: colors.error,
      critical: colors.error,
    };
    return map[suggestion.urgencyLevel] ?? colors.primary;
  };

  return (
    <Animated.View
      style={[
        styles.appointmentCard,
        { transform: [{ translateY: slideAnim }] },
      ]}
    >
      <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
        <Ionicons name="close" size={20} color={colors.textSecondary} />
      </TouchableOpacity>
      <View
        style={[styles.urgencyBadge, { backgroundColor: getUrgencyColor() }]}
      >
        <Text style={styles.urgencyText}>📋 Appointment</Text>
      </View>
      <Text style={styles.cardTitle}>No Doctors Available</Text>
      <Text style={styles.suggestionReason}>{suggestion.reason}</Text>
      <View style={styles.noDoctorsBox}>
        <Ionicons name="calendar-outline" size={40} color={colors.textLight} />
        <Text style={styles.noDoctorsText}>
          No doctors available right now. Please try again later or call 1900
          1234.
        </Text>
      </View>
      <TouchableOpacity style={styles.confirmBtn} onPress={onClose}>
        <LinearGradient
          colors={colors.gradientPrimary}
          style={styles.confirmBtnGradient}
        >
          <Text style={styles.confirmBtnText}>Close</Text>
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
}: {
  suggestion: AppointmentSuggestion;
  onBook: (
    doctorId: string,
    timeSlot: string,
    doctorName: string,
    appointmentDate: string,
  ) => void;
  onClose: () => void;
}) => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = formatDateLocal(tomorrow);

  const [selectedDate, setSelectedDate] = useState(tomorrowStr);
  const [selectedDoctor, setSelectedDoctor] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [selectedDoctorName, setSelectedDoctorName] = useState("");
  const [doctors, setDoctors] = useState<AISuggestedDoctor[]>(
    suggestion.suggestedDoctors || [],
  );
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const slideAnim = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 0,
      tension: 100,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleDateChange = useCallback(
    async (dateStr: string) => {
      setSelectedDate(dateStr);
      setSelectedDoctor(null);
      setSelectedSlot("");
      setSelectedDoctorName("");
      if (!suggestion.suggestedSpecialtyId) return;
      setLoadingDoctors(true);
      try {
        const token = await getValidToken();
        if (!token) return;
        const res = await fetch(
          `${API_BASE_URL}/ai-medical/specialties/${suggestion.suggestedSpecialtyId}/doctors?date=${dateStr}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (res.ok) {
          const d = await res.json();
          if (d.success && d.data?.doctors) {
            setDoctors(
              d.data.doctors.map((x: any) => ({
                id: x._id?.toString() || x.id,
                name: x.name || x.user_id?.name || "Doctor",
                availableSlots: x.available_slots || x.availableSlots || [],
                consultationFee: x.consultation_fee ?? x.consultationFee,
                experience: x.years_of_experience ?? x.experience ?? 0,
                rating: x.rating?.average ?? x.rating ?? 0,
              })),
            );
          }
        }
      } catch {
        /* keep existing doctors */
      } finally {
        setLoadingDoctors(false);
      }
    },
    [suggestion.suggestedSpecialtyId],
  );

  const getUrgencyColor = () =>
    ({
      critical: colors.critical,
      high: colors.error,
      medium: colors.warning,
      low: colors.primary,
    })[suggestion.urgencyLevel] ?? colors.primary;

  const getUrgencyLabel = () =>
    ({
      critical: "🚨 EMERGENCY",
      high: "⚠️ Urgent",
      medium: "📋 See Soon",
      low: "📅 Routine",
    })[suggestion.urgencyLevel] ?? suggestion.urgencyLevel;

  const canBook = selectedDoctor && selectedSlot && selectedDate;

  return (
    <Animated.View
      style={[
        styles.appointmentCard,
        { transform: [{ translateY: slideAnim }] },
      ]}
    >
      <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Ionicons name="close" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
        <View
          style={[styles.urgencyBadge, { backgroundColor: getUrgencyColor() }]}
        >
          <Text style={styles.urgencyText}>{getUrgencyLabel()}</Text>
        </View>
        <Text style={styles.cardTitle}>
          {suggestion.actionType === "reschedule"
            ? "🔄 Reschedule Appointment"
            : suggestion.actionType === "cancel"
              ? "❌ Cancel Appointment"
              : suggestion.actionType === "view_appointments"
                ? "📅 Your Appointments"
                : "📅 Book Appointment"}
        </Text>
        <Text style={styles.suggestionReason}>{suggestion.reason}</Text>
        {suggestion.contraindications &&
          suggestion.contraindications.length > 0 && (
            <View style={styles.contraindicationBox}>
              <Ionicons name="warning" size={16} color={colors.error} />
              <Text style={styles.contraindicationText}>
                {suggestion.contraindications.join("\n")}
              </Text>
            </View>
          )}
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
        {suggestion.suggestedSpecialty && (
          <View style={styles.infoRow}>
            <Ionicons name="medical-outline" size={16} color={colors.primary} />
            <Text style={styles.infoText}>
              Specialty: {suggestion.suggestedSpecialty}
            </Text>
          </View>
        )}

        <DatePickerRow
          selectedDate={selectedDate}
          onSelectDate={handleDateChange}
        />

        <Text style={styles.doctorsTitle}>
          {loadingDoctors ? "⏳ Loading doctors..." : "👨‍⚕️ Available doctors:"}
        </Text>

        {loadingDoctors ? (
          <ActivityIndicator
            color={colors.primary}
            style={{ marginVertical: 16 }}
          />
        ) : doctors && doctors.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.doctorsScroll}
            nestedScrollEnabled
          >
            {doctors.map((doc) => {
              const hasSlots =
                doc.availableSlots && doc.availableSlots.length > 0;
              const isSelected = selectedDoctor === doc.id;
              return (
                <TouchableOpacity
                  key={doc.id}
                  style={[
                    styles.doctorCard,
                    isSelected && styles.doctorCardSelected,
                    !hasSlots && styles.doctorCardFull,
                  ]}
                  onPress={() => {
                    if (!hasSlots) return;
                    setSelectedDoctor(doc.id);
                    setSelectedDoctorName(doc.name);
                    setSelectedSlot("");
                  }}
                  activeOpacity={hasSlots ? 0.8 : 1}
                >
                  <LinearGradient
                    colors={
                      !hasSlots
                        ? [colors.surfaceLight, "#EEE"]
                        : isSelected
                          ? colors.gradientPrimary
                          : [colors.surfaceLight, "#EEE"]
                    }
                    style={styles.doctorCardGradient}
                  >
                    <View style={styles.doctorRow}>
                      <Text
                        style={[
                          styles.doctorName,
                          isSelected && { color: "#fff" },
                          !hasSlots && { color: colors.textLight },
                        ]}
                      >
                        Dr. {doc.name}
                      </Text>
                      {!hasSlots ? (
                        <View style={styles.fullBadge}>
                          <Text style={styles.fullBadgeText}>Full</Text>
                        </View>
                      ) : doc.rating && doc.rating > 0 ? (
                        <View style={styles.ratingRow}>
                          <Ionicons name="star" size={12} color="#FFC107" />
                          <Text
                            style={[
                              styles.ratingText,
                              isSelected && { color: "#fff" },
                            ]}
                          >
                            {doc.rating.toFixed(1)}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <View style={styles.doctorMeta}>
                      <Text
                        style={[
                          styles.expText,
                          isSelected && { color: "#fff" },
                          !hasSlots && { color: colors.border },
                        ]}
                      >
                        {doc.experience || 0}+ yrs
                      </Text>
                      <Text
                        style={[
                          styles.feeText,
                          !hasSlots && { color: colors.border },
                        ]}
                      >
                        {doc.consultationFee
                          ? `${doc.consultationFee.toLocaleString()}đ`
                          : "Contact"}
                      </Text>
                    </View>
                    {isSelected && hasSlots && (
                      <View style={styles.slotsBox}>
                        <Text style={[styles.slotsLabel, { color: "#fff" }]}>
                          Select time:
                        </Text>
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                        >
                          {doc.availableSlots.map((slot) => (
                            <TouchableOpacity
                              key={slot}
                              style={[
                                styles.slotChip,
                                selectedSlot === slot &&
                                styles.slotChipSelected,
                              ]}
                              onPress={() => setSelectedSlot(slot)}
                            >
                              <Text
                                style={[
                                  styles.slotText,
                                  selectedSlot === slot && { color: "#fff" },
                                ]}
                              >
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
        ) : (
          <View style={styles.noDoctorsBox}>
            <Ionicons name="sad-outline" size={32} color={colors.textLight} />
            <Text style={styles.noDoctorsText}>
              No doctors available on this date. Please select another date.
            </Text>
          </View>
        )}

        {canBook && (
          <View style={bookingCardStyles.summary}>
            <Ionicons
              name="checkmark-circle"
              size={16}
              color={colors.primary}
            />
            <Text style={bookingCardStyles.summaryText}>
              Dr. {selectedDoctorName} • {selectedDate} • {selectedSlot}
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.confirmBtn, !canBook && styles.confirmBtnDisabled]}
          onPress={() => {
            if (canBook)
              onBook(
                selectedDoctor!,
                selectedSlot,
                selectedDoctorName,
                selectedDate,
              );
          }}
          disabled={!canBook}
        >
          <LinearGradient
            colors={
              !canBook
                ? [colors.textLight, colors.textLight]
                : colors.gradientPrimary
            }
            style={styles.confirmBtnGradient}
          >
            <Ionicons name="calendar-outline" size={18} color="#fff" />
            <Text style={styles.confirmBtnText}>Confirm Booking</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </Animated.View>
  );
};

const bookingCardStyles = StyleSheet.create({
  summary: {
    alignItems: "center",
    backgroundColor: "rgba(0,188,212,0.08)",
    borderColor: "rgba(0,188,212,0.2)",
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    marginBottom: 4,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  summaryText: {
    color: colors.primary,
    flex: 1,
    fontSize: 13,
    fontWeight: "500",
  },
});

// ==================== FOLLOW-UP WIDGET ====================

const FollowUpWidget = ({
  questions,
  onSelect,
}: {
  questions: string[];
  onSelect: (q: string) => void;
}) => (
  <View style={styles.followUpContainer}>
    <Text style={styles.followUpTitle}>💬 Please answer:</Text>
    {questions.map((q, i) => (
      <TouchableOpacity
        key={i}
        style={styles.followUpChip}
        onPress={() => onSelect(q)}
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
  onViewAppointment,
  bookedIds,
}: {
  item: ChatMessage;
  index: number;
  colors: typeof colors;
  onBookAppointment?: (s: AppointmentSuggestion) => void;
  onFollowUp?: (q: string) => void;
  onBookingConfirm?: (s: AppointmentSuggestion) => void;
  onBookingDecline?: () => void;
  onViewAppointment?: (id?: string) => void;
  bookedIds: Set<string>;
}) => {
  const isUser = item.role === "user";
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

  const rec = item.appointmentRecommendation;
  const alreadyBooked = !!(
    item.bookedAppointmentId && bookedIds.has(item.bookedAppointmentId)
  );

  return (
    <Animated.View
      style={[
        styles.msgContainer,
        isUser ? styles.userContainer : styles.botContainer,
        {
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [15, 0],
              }),
            },
          ],
        },
      ]}
    >
      {!isUser && (
        <LinearGradient
          colors={
            item.emergencyAlert
              ? colors.gradientCritical
              : colors.gradientPrimary
          }
          style={styles.botAvatar}
        >
          <Ionicons
            name={item.emergencyAlert ? "warning" : "medical"}
            size={16}
            color="#fff"
          />
        </LinearGradient>
      )}
      <View
        style={[
          styles.msgContent,
          isUser ? styles.userMsgContent : styles.botMsgContent,
        ]}
      >
        {isUser ? (
          <LinearGradient
            colors={colors.gradientPrimary}
            style={[styles.bubble, styles.userBubble]}
          >
            <Text style={styles.userMsgText}>{item.content}</Text>
            {item.pending && (
              <Text style={styles.pendingText}>Sending...</Text>
            )}
            {item.failed && (
              <Text style={styles.failedText}>⚠️ Failed to send</Text>
            )}
          </LinearGradient>
        ) : (
          <View style={[styles.bubble, styles.botBubble]}>
            <Text style={[styles.msgText, { color: colors.textPrimary }]}>
              {item.content}
            </Text>
            {item.confidence !== undefined && (
              <View style={styles.confidenceBox}>
                <View style={styles.confidenceBar}>
                  <View
                    style={[
                      styles.confidenceFill,
                      {
                        width: `${item.confidence * 100}%`,
                        backgroundColor:
                          item.confidence > 0.7
                            ? colors.primary
                            : item.confidence > 0.5
                              ? colors.warning
                              : colors.error,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.confidenceLabel}>
                  {Math.round(item.confidence * 100)}% confidence
                </Text>
              </View>
            )}
            {item.emergencyAlert && (
              <View style={styles.emergencyInlineBox}>
                <Ionicons name="warning" size={16} color={colors.error} />
                <Text style={styles.emergencyInlineText}>
                  🚨 EMERGENCY SITUATION
                </Text>
              </View>
            )}
            {item.requiresMoreInfo &&
              item.followUpQuestions &&
              item.followUpQuestions.length > 0 &&
              onFollowUp && (
                <FollowUpWidget
                  questions={item.followUpQuestions}
                  onSelect={onFollowUp}
                />
              )}
            {rec?.awaitingBookingConfirmation &&
              onBookingConfirm &&
              onBookingDecline && (
                <View style={styles.bookingConfirmationInline}>
                  <Text style={styles.confirmationQuestionInline}>
                    {rec.bookingQuestion ||
                      "💡 Would you like to book an appointment?"}
                  </Text>
                  <View style={styles.confirmationButtonsInline}>
                    <TouchableOpacity
                      style={styles.confirmYesInline}
                      onPress={() => onBookingConfirm(rec!)}
                    >
                      <Text style={styles.confirmYesText}>Yes</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.confirmNoInline}
                      onPress={onBookingDecline}
                    >
                      <Text style={styles.confirmNoText}>No</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            {item.suggestedActions && item.suggestedActions.length > 0 && (
              <View style={styles.actionsBox}>
                <Text style={styles.actionsTitle}>📋 Suggestions:</Text>
                {item.suggestedActions.map((a, i) => (
                  <View key={i} style={styles.actionChip}>
                    <Ionicons
                      name="checkmark-circle"
                      size={13}
                      color={colors.primary}
                    />
                    <Text style={styles.actionText}>{a}</Text>
                  </View>
                ))}
              </View>
            )}
            {(rec?.shouldBook || !!rec?.actionType) &&
              onBookAppointment &&
              onViewAppointment &&
              (alreadyBooked ? (
                <TouchableOpacity
                  style={styles.bookBtn}
                  onPress={() => onViewAppointment(item.bookedAppointmentId)}
                >
                  <LinearGradient
                    colors={colors.gradientView}
                    style={styles.bookBtnGradient}
                  >
                    <Ionicons name="eye-outline" size={15} color="#fff" />
                    <Text style={styles.bookBtnText}>
                      📋 View Appointment Details
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.bookBtn}
                  onPress={() => onBookAppointment(rec!)}
                >
                  <LinearGradient
                    colors={colors.gradientPrimary}
                    style={styles.bookBtnGradient}
                  >
                    <Ionicons
                      name={
                        rec?.actionType === "reschedule"
                          ? "refresh"
                          : rec?.actionType === "cancel"
                            ? "close-circle"
                            : "calendar"
                      }
                      size={15}
                      color="#fff"
                    />
                    <Text style={styles.bookBtnText}>
                      {rec?.actionType === "reschedule"
                        ? "🔄 Reschedule Appointment"
                        : rec?.actionType === "cancel"
                          ? "❌ Cancel Appointment"
                          : rec?.actionType === "view_appointments"
                            ? "📅 View Appointments"
                            : "📅 Book Appointment"}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              ))}
          </View>
        )}
        <Text style={[styles.timestamp, { color: colors.textLight }]}>
          {new Date(item.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </View>
      {isUser && (
        <LinearGradient
          colors={colors.gradientSecondary}
          style={styles.userAvatar}
        >
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
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 1,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0.5,
            duration: 700,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    } else {
      anim.setValue(0.5);
    }
  }, [isTyping]);

  if (!isTyping) return null;
  return (
    <Animated.View style={[styles.typingRow, { opacity: anim }]}>
      <LinearGradient colors={colors.gradientPrimary} style={styles.botAvatar}>
        <Ionicons name="medical" size={16} color="#fff" />
      </LinearGradient>
      <View style={styles.typingBubble}>
        <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
          Analyzing...
        </Text>
        <View style={{ flexDirection: "row", marginTop: 4 }}>
          {[0, 1, 2].map((i) => (
            <Animated.View key={i} style={[styles.dot, { opacity: anim }]} />
          ))}
        </View>
      </View>
    </Animated.View>
  );
};

const OfflineBanner = ({ isOffline }: { isOffline: boolean }) => {
  if (!isOffline) return null;
  return (
    <View style={styles.offlineBanner}>
      <Ionicons name="cloud-offline-outline" size={16} color="#fff" />
      <Text style={styles.offlineText}>
        📡 No connection. Messages will be sent when back online.
      </Text>
    </View>
  );
};

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
        <LinearGradient
          colors={colors.gradientPrimary}
          style={styles.consentHeader}
        >
          <Ionicons name="shield-checkmark" size={36} color="#fff" />
          <Text style={styles.consentTitle}>AI Terms of Use</Text>
        </LinearGradient>
        <ScrollView style={styles.consentContent}>
          <Text style={styles.consentText}>
            Before using the AI Medical Assistant, please read and agree:{"\n\n"}
            ⚕️ FOR EDUCATIONAL PURPOSES ONLY{"\n"}
            AI information does not replace professional medical advice.{"\n\n"}
            📋 NOT A DIAGNOSIS{"\n"}
            The AI does not diagnose. Always consult a doctor.{"\n\n"}
            🔒 PRIVACY{"\n"}
            Your information is kept confidential.{"\n\n"}
            🚨 EMERGENCY{"\n"}
            Call 911/115 or go to a hospital instead of using AI.
          </Text>
        </ScrollView>
        <View style={styles.consentButtons}>
          <TouchableOpacity
            style={[styles.consentBtn, styles.declineBtn]}
            onPress={onDecline}
          >
            <Text style={styles.declineBtnText}>Decline</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.consentBtn, styles.acceptBtn]}
            onPress={onAccept}
          >
            <LinearGradient
              colors={colors.gradientPrimary}
              style={styles.acceptBtnGradient}
            >
              <Text style={styles.acceptBtnText}>Agree</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);

// ==================== CARD TYPE ====================

type CardType =
  | "booking"
  | "existing"
  | "noDoctors"
  | "confirmation"
  | "upcoming"
  | "reschedule_list"
  | "reschedule_single"
  | "cancel_list"
  | "all_appointments";

// ==================== MAIN CHAT WIDGET ====================

const ChatWidget: React.FC<{
  onBackToHome?: () => void;
  showBackButton?: boolean;
  isFullScreen?: boolean;
}> = ({ onBackToHome, isFullScreen = false }) => {
  const navigation = useNavigation<NavigationProp>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentSession, setCurrentSession] = useState<any>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [showConsent, setShowConsent] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);
  const [showAppointmentCard, setShowAppointmentCard] = useState(false);
  const [showBookingConfirmation, setShowBookingConfirmation] = useState(false);
  const [showEmergency, setShowEmergency] = useState(false);
  const [currentSuggestion, setCurrentSuggestion] =
    useState<AppointmentSuggestion | null>(null);
  const [pendingSuggestion, setPendingSuggestion] =
    useState<AppointmentSuggestion | null>(null);
  const [emergencyInstructions, setEmergencyInstructions] = useState("");
  const [cardType, setCardType] = useState<CardType>("booking");
  const [upcomingAppointments, setUpcomingAppointments] = useState<
    ExistingAppointmentDetails[]
  >([]);
  const [
    selectedAppointmentForReschedule,
    setSelectedAppointmentForReschedule,
  ] = useState<ExistingAppointmentDetails | null>(null);
  const [bookedIds, setBookedIds] = useState<Set<string>>(new Set());

  const flatListRef = useRef<FlatList>(null);
  const scrollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const inputAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    getBookedAppointmentIds().then((ids) => setBookedIds(ids));
  }, []);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
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
        useNativeDriver: true,
      }).start();
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

  const scrollToBottom = useCallback(
    (animated = true) => {
      if (flatListRef.current && messages.length > 0) {
        if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
        scrollTimerRef.current = setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated });
        }, 100);
      }
    },
    [messages.length],
  );

  const checkConsentAndInitialize = async () => {
    try {
      const consent = await AsyncStorage.getItem(CONSENT_GIVEN_KEY);
      const savedSessionId = await AsyncStorage.getItem(SESSION_ID_KEY);
      if (consent === "true") {
        setConsentGiven(true);
        if (savedSessionId) setCurrentSession({ session_id: savedSessionId });
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

  const initializeChat = async () => {
    setLoading(true);
    try {
      const token = await getValidToken();
      if (!token) {
        setError("Please log in to continue");
        setIsInitialized(true);
        return;
      }
      await loadChatHistory(token);
      setIsInitialized(true);
    } catch {
      setError("Could not initialize assistant");
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
          "Content-Type": "application/json",
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setCurrentSession(data.data.session);
          await AsyncStorage.setItem(
            SESSION_ID_KEY,
            data.data.session.session_id,
          );
          if (data.data.messages?.length > 0) {
            setMessages(
              data.data.messages.map((m: any) => ({
                ...m,
                id: `${m.timestamp}-${m.role}`,
                timestamp: new Date(m.timestamp).toISOString(),
              })),
            );
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
    setMessages([
      {
        role: "assistant",
        content:
          "👋 Hello! I am your AI Medical Assistant. I can help you:\n\n• 🩺 Symptom consultation & appointment booking\n• 📅 View your upcoming appointments\n• 🔄 Reschedule or change specialty\n• ❌ Cancel appointments\n• 💊 Look up medication and health information\n\nDescribe your symptoms or ask me anything!",
        timestamp: new Date().toISOString(),
        id: `welcome-${Date.now()}`,
        language: "en",
      },
    ]);
  };

  const handleConsentAccept = async () => {
    setShowConsent(false);
    setConsentGiven(true);
    await AsyncStorage.setItem(CONSENT_GIVEN_KEY, "true");
    if (currentSession?.session_id) {
      try {
        const token = await getValidToken();
        if (token) {
          await fetch(`${API_BASE_URL}/ai-medical/consent`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              session_id: currentSession.session_id,
              consent: true,
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

  const retryPendingMessages = async () => {
    const pending = await getPendingMessages();
    if (!pending.length) return;
    const token = await getValidToken();
    if (!token) return;
    for (const msg of pending) await sendMessageToAPI(msg, token);
    await clearPendingMessages();
  };

  const sendMessageToAPI = async (
    messageText: string,
    token: string,
  ): Promise<AIResponse | null> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      let res = await fetch(`${API_BASE_URL}/ai-medical/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: messageText,
          session_id: currentSession?.session_id,
        }),
        signal: controller.signal,
      });
      if (res.status === 401) {
        const newToken = await tryRefreshToken();
        if (!newToken) return null;
        res = await fetch(`${API_BASE_URL}/ai-medical/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${newToken}`,
          },
          body: JSON.stringify({ message: messageText }),
        });
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (error) {
      console.error("❌ API Error:", error);
      return null;
    } finally {
      clearTimeout(timeout);
    }
  };

  // ==================== SEND MESSAGE ====================

  const sendMessage = async (overrideText?: string) => {
    const msgText = (overrideText ?? input).trim();
    if (!msgText || loading) return;
    setInput("");
    setError(null);
    setLoading(true);

    const userMsg: ChatMessage = {
      role: "user",
      content: msgText,
      timestamp: new Date().toISOString(),
      id: `user-${Date.now()}`,
      language: "en",
      pending: true,
    };
    setMessages((prev) => [...prev, userMsg]);

    if (isOffline) {
      await savePendingMessage(msgText);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === userMsg.id ? { ...m, pending: false, failed: true } : m,
        ),
      );
      setLoading(false);
      return;
    }

    setIsTyping(true);
    try {
      let token = await getValidToken();
      if (!token) {
        token = await tryRefreshToken();
        if (!token) {
          navigation.navigate("Login");
          return;
        }
      }
      setMessages((prev) =>
        prev.map((m) => (m.id === userMsg.id ? { ...m, pending: false } : m)),
      );

      const apiResult = await sendMessageToAPI(msgText, token);
      if (!apiResult || !apiResult.success) throw new Error("API error");

      if (apiResult.data.session_id && !currentSession) {
        setCurrentSession({ session_id: apiResult.data.session_id });
        await AsyncStorage.setItem(SESSION_ID_KEY, apiResult.data.session_id);
      }

      setTimeout(
        () => {
          setIsTyping(false);
          const botMsg: ChatMessage = {
            role: "assistant",
            content: apiResult.data.response,
            timestamp: new Date().toISOString(),
            id: `bot-${Date.now()}`,
            category: apiResult.data.category,
            confidence: apiResult.data.confidence,
            suggestedActions: apiResult.data.suggestedActions,
            emergencyAlert: apiResult.data.emergencyAlert,
            relatedSpecialties: apiResult.data.relatedSpecialties,
            followUpQuestions: apiResult.data.followUpQuestions,
            requiresMoreInfo: apiResult.data.requiresMoreInfo,
            patientContextUsed: apiResult.data.patientContextUsed,
            language: "en",
            appointmentRecommendation: apiResult.data.appointmentRecommendation,
          };
          setMessages((prev) => [...prev, botMsg]);
          handleAPIResponse(apiResult.data);
        },
        600 + Math.random() * 400,
      );
    } catch (err: any) {
      setIsTyping(false);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === userMsg.id ? { ...m, failed: true, pending: false } : m,
        ),
      );
      let msg = "Could not process request. Please try again.";
      if (err.name === "AbortError") {
        msg = "Request timed out. Please try again.";
      }
      setError(msg);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Sorry, a technical issue occurred. For urgent matters, please contact a doctor directly.\n\n⚕️ This information is for educational purposes only.",
          timestamp: new Date().toISOString(),
          id: `err-${Date.now()}`,
          language: "en",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleAPIResponse = useCallback((data: AIResponseData) => {
    // 1. Emergency — highest priority
    if (data.urgencyLevel === "critical" || data.emergencyAlert) {
      setEmergencyInstructions(data.response);
      setShowEmergency(true);
      AccessibilityInfo.announceForAccessibility("EMERGENCY. Call 115 now.");
      return;
    }

    const rec = data.appointmentRecommendation;
    const actionType = rec?.actionType;

    if (
      !rec ||
      (rec.urgencyLevel === "low" &&
        !rec.shouldBook &&
        !rec.awaitingBookingConfirmation &&
        !rec.actionType)
    ) {
      return;
    }

    // 2. Upcoming appointments (top-level or nested in rec)
    const upcoming = data.upcomingAppointments ?? rec?.upcomingAppointments;
    if (upcoming !== undefined) {
      setUpcomingAppointments(upcoming);
      if (actionType === "reschedule") {
        setCardType("reschedule_list");
      } else if (actionType === "cancel") {
        setCardType("cancel_list");
      } else {
        setCardType("upcoming");
      }
      setShowAppointmentCard(true);
      return;
    }

    if (!rec) return;

    // 3. Existing appointment notice
    if (rec.hasExistingAppointment) {
      setCurrentSuggestion(rec);
      setCardType("existing");
      setShowAppointmentCard(true);
      return;
    }

    // 4. Awaiting booking confirmation (yes/no inline question)
    if (rec.awaitingBookingConfirmation) {
      setPendingSuggestion(rec);
      setShowBookingConfirmation(true);
      return;
    }

    // 5. Full booking card
    if (rec.shouldBook) {
      setCurrentSuggestion(rec);
      setCardType(rec.suggestedDoctors?.length ? "booking" : "noDoctors");
      setShowAppointmentCard(true);
    }
  }, []);

  // ==================== BOOKING HANDLERS ====================

  const handleBookingConfirm = (_suggestion: AppointmentSuggestion) => {
    setShowBookingConfirmation(false);
    setPendingSuggestion(null);
    sendMessage("yes");
  };

  const handleBookingDecline = () => {
    setShowBookingConfirmation(false);
    setPendingSuggestion(null);
    sendMessage("no");
  };

  const handleBookAppointment = async (
    doctorId: string,
    timeSlot: string,
    doctorName: string,
    appointmentDate: string,
  ) => {
    if (!currentSuggestion) return;
    setLoading(true);
    try {
      const token = await getValidToken();
      if (!token) {
        Alert.alert("Error", "Please log in again");
        return;
      }

      const res = await fetch(
        `${API_BASE_URL}/ai-medical/appointments/book-from-ai`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            use_ai_selection: false,
            doctor_id: doctorId,
            appointment_date: appointmentDate,
            time_slot: timeSlot,
            specialty_id: currentSuggestion.suggestedSpecialtyId,
            symptoms: currentSuggestion.symptoms || [],
            reason: currentSuggestion.reason,
            urgency_level: currentSuggestion.urgencyLevel,
            session_id: currentSession?.session_id,
            ai_decision: {
              urgencyLevel: currentSuggestion.urgencyLevel,
              reasoning: currentSuggestion.reason,
            },
          }),
        },
      );

      const data = await res.json();

      if (data.success) {
        const newApptId =
          data.data?.appointment?._id?.toString() ?? `booked-${Date.now()}`;
        setShowAppointmentCard(false);

        setBookedIds((prev) => {
          const n = new Set(prev);
          n.add(newApptId);
          return n;
        });
        await saveBookedAppointmentId(newApptId);

        setMessages((prev) =>
          prev.map((m) =>
            m.appointmentRecommendation?.shouldBook && !m.bookedAppointmentId
              ? { ...m, bookedAppointmentId: newApptId }
              : m,
          ),
        );

        const confirmMsg: ChatMessage = {
          role: "assistant",
          content: `✅ **Appointment confirmed!**\n\n👨‍⚕️ Dr. **${doctorName}**\n📅 Date: ${appointmentDate}\n⏰ Time: ${timeSlot}\n\nPlease arrive 15 minutes early.`,
          timestamp: new Date().toISOString(),
          id: `booking-${Date.now()}`,
          language: "en",
          bookedAppointmentId: newApptId,
        };
        setMessages((prev) => [...prev, confirmMsg]);
        setCurrentSuggestion(null);

        Alert.alert(
          "✅ Success",
          `Appointment with Dr. ${doctorName} on ${appointmentDate} at ${timeSlot} confirmed!`,
          [
            {
              text: "View Appointment",
              onPress: () =>
                navigation.navigate("HistoryAppointment", {
                  appointmentId: newApptId,
                }),
            },
            { text: "OK" },
          ],
        );
      } else {
        if (res.status === 409 && data.data?.alternativeSlots) {
          Alert.alert(
            "Slot Unavailable",
            `${timeSlot} is taken.\n\nAvailable slots: ${data.data.alternativeSlots.join(", ")}`,
          );
        } else {
          Alert.alert("Error", data.message || "Booking failed");
        }
      }
    } catch {
      Alert.alert("Connection Error", "Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRescheduleSelect = (appointmentId: string) => {
    const appt = upcomingAppointments.find((a) => a.id === appointmentId);
    if (!appt) return;
    setSelectedAppointmentForReschedule(appt);
    setCardType("reschedule_single");
  };

  const handleRescheduleConfirm = async (
    appointmentId: string,
    newSlot: string,
    newDate: string,
  ) => {
    setLoading(true);
    try {
      const token = await getValidToken();
      if (!token) return;
      const res = await fetch(
        `${API_BASE_URL}/ai-medical/appointments/${appointmentId}/reschedule`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ new_time_slot: newSlot, new_date: newDate }),
        },
      );
      const data = await res.json();
      setShowAppointmentCard(false);
      setSelectedAppointmentForReschedule(null);
      if (data.success) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `✅ Rescheduled successfully!\n📅 New date: ${newDate}\n⏰ New time: ${newSlot}`,
            timestamp: new Date().toISOString(),
            id: `reschedule-${Date.now()}`,
            language: "en",
          },
        ]);
        Alert.alert("✅ Rescheduled", `New time: ${newDate} at ${newSlot}`);
      } else {
        Alert.alert("Error", data.message);
      }
    } catch {
      Alert.alert("Error", "Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelAppointment = (appointmentId: string) => {
    const appt = upcomingAppointments.find((a) => a.id === appointmentId);
    if (!appt) return;
    Alert.alert(
      "⚠️ Confirm Cancellation",
      `Are you sure you want to cancel your appointment with Dr. ${appt.doctorName} on ${appt.date} at ${appt.time}?\n\nNote: Cancel at least 24 hours in advance to avoid fees.`,
      [
        { text: "Keep Appointment", style: "cancel" },
        {
          text: "Cancel Appointment",
          style: "destructive",
          onPress: () => confirmCancelAppointment(appointmentId),
        },
      ],
    );
  };

  const confirmCancelAppointment = async (appointmentId: string) => {
    setLoading(true);
    try {
      const token = await getValidToken();
      if (!token) return;
      const res = await fetch(
        `${API_BASE_URL}/ai-medical/appointments/${appointmentId}/cancel-by-chat`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            reason: "Cancelled via AI assistant",
          }),
        },
      );
      const data = await res.json();
      setShowAppointmentCard(false);

      if (data.success) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "✅ Appointment cancelled successfully.",
            timestamp: new Date().toISOString(),
            id: `cancel-${Date.now()}`,
            language: "en",
          },
        ]);
        setUpcomingAppointments((prev) =>
          prev.filter((a) => a.id !== appointmentId),
        );
        Alert.alert("✅ Cancelled", data.message);
      } else {
        Alert.alert(
          "⚠️ Notice",
          data.message,
          data.data?.canStillCancel
            ? [
              {
                text: "Cancel Anyway",
                style: "destructive",
                onPress: () => forceCancelAppointment(appointmentId),
              },
              {
                text: "Keep Appointment",
                style: "cancel",
              },
            ]
            : [{ text: "OK" }],
        );
      }
    } catch {
      Alert.alert("Error", "Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const forceCancelAppointment = async (appointmentId: string) => {
    setLoading(true);
    try {
      const token = await getValidToken();
      if (!token) return;
      const res = await fetch(
        `${API_BASE_URL}/ai-medical/appointments/${appointmentId}/cancel-by-chat`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            reason: "Force cancelled via chat",
            force: true,
          }),
        },
      );
      const data = await res.json();
      setShowAppointmentCard(false);
      if (data.success) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "✅ Appointment cancelled.",
            timestamp: new Date().toISOString(),
            id: `cancel-force-${Date.now()}`,
            language: "en",
          },
        ]);
        setUpcomingAppointments((prev) =>
          prev.filter((a) => a.id !== appointmentId),
        );
      } else {
        Alert.alert("Error", data.message);
      }
    } catch {
      Alert.alert("Error", "Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleViewExistingAppointment = (id?: string) => {
    setShowAppointmentCard(false);
    setCurrentSuggestion(null);
    if (id) navigation.navigate("HistoryAppointment", { appointmentId: id });
    else navigation.navigate("Appointments");
  };

  const clearChat = () => {
    Alert.alert("Start a new conversation?", "", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: async () => {
          try {
            const token = await getValidToken();
            if (token && currentSession?.session_id) {
              await fetch(
                `${API_BASE_URL}/ai-medical/session/${currentSession.session_id}/close`,
                {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                  },
                },
              );
              await AsyncStorage.removeItem(SESSION_ID_KEY);
            }
            showWelcomeMessage();
            setCurrentSession(null);
            setShowAppointmentCard(false);
            setShowBookingConfirmation(false);
            setPendingSuggestion(null);
            setCurrentSuggestion(null);
            setUpcomingAppointments([]);
            setSelectedAppointmentForReschedule(null);
          } catch {
            setError("Could not clear history");
          }
        },
      },
    ]);
  };

  const quickReplies = [
    "📅 View upcoming appointments",
    "🔄 I want to reschedule",
    "❌ Cancel my appointment",
    "🤒 I have fever and headache",
    "📋 View all my appointments",
    "✅ View completed appointments",
    "💊 Paracetamol side effects",
    "🩺 What is normal blood pressure",
  ];

  const handleBack = useCallback(() => {
    if (onBackToHome) onBackToHome();
    else navigation.goBack();
  }, [onBackToHome, navigation]);

  // ==================== RENDER CARD ====================

  const renderAppointmentCard = () => {
    switch (cardType) {
      case "upcoming":
        return (
          <UpcomingAppointmentsCard
            appointments={upcomingAppointments}
            onClose={() => setShowAppointmentCard(false)}
            onViewDetail={(id) => {
              setShowAppointmentCard(false);
              navigation.navigate("HistoryAppointment", { appointmentId: id });
            }}
          />
        );

      case "reschedule_list":
        return (
          <UpcomingAppointmentsCard
            appointments={upcomingAppointments}
            onClose={() => setShowAppointmentCard(false)}
            onViewDetail={(id) => {
              setShowAppointmentCard(false);
              navigation.navigate("HistoryAppointment", { appointmentId: id });
            }}
            onReschedule={handleRescheduleSelect}
            actionType="reschedule"
          />
        );

      case "reschedule_single":
        return selectedAppointmentForReschedule ? (
          <RescheduleCard
            appointment={selectedAppointmentForReschedule}
            onReschedule={handleRescheduleConfirm}
            onClose={() => {
              setSelectedAppointmentForReschedule(null);
              setCardType("reschedule_list");
            }}
          />
        ) : null;

      case "cancel_list":
        return (
          <UpcomingAppointmentsCard
            appointments={upcomingAppointments}
            onClose={() => setShowAppointmentCard(false)}
            onViewDetail={(id) => {
              setShowAppointmentCard(false);
              navigation.navigate("HistoryAppointment", { appointmentId: id });
            }}
            onCancel={handleCancelAppointment}
            actionType="cancel"
          />
        );

      case "existing":
        return currentSuggestion ? (
          <ExistingAppointmentCard
            suggestion={currentSuggestion}
            onClose={() => {
              setShowAppointmentCard(false);
              setCurrentSuggestion(null);
            }}
            onViewAppointment={() =>
              handleViewExistingAppointment(
                currentSuggestion?.existingAppointmentDetails?.id,
              )
            }
          />
        ) : null;

      case "noDoctors":
        return currentSuggestion ? (
          <NoDoctorsCard
            suggestion={currentSuggestion}
            onClose={() => {
              setShowAppointmentCard(false);
              setCurrentSuggestion(null);
            }}
          />
        ) : null;

      case "booking":
      default:
        return currentSuggestion ? (
          <AppointmentSuggestionCard
            suggestion={currentSuggestion}
            onBook={handleBookAppointment}
            onClose={() => {
              setShowAppointmentCard(false);
              setCurrentSuggestion(null);
            }}
          />
        ) : null;
    }
  };

  // ==================== RENDER ====================

  if (!isInitialized) {
    return (
      <View
        style={[
          styles.container,
          { justifyContent: "center", alignItems: "center" },
        ]}
      >
        <LinearGradient
          colors={colors.gradientPrimary}
          style={styles.loadingIcon}
        >
          <Ionicons name="medical" size={40} color="#fff" />
        </LinearGradient>
        <Text
          style={{
            fontSize: 22,
            fontWeight: "700",
            marginTop: 16,
            color: colors.textPrimary,
          }}
        >
          HealthAI Assistant
        </Text>
        <ActivityIndicator
          size="large"
          color={colors.primary}
          style={{ marginTop: 20 }}
        />
      </View>
    );
  }

  const sendScale = inputAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.9, 1],
  });

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <ConsentModal
        visible={showConsent}
        onAccept={handleConsentAccept}
        onDecline={handleConsentDecline}
      />
      <EmergencyModal
        visible={showEmergency}
        instructions={emergencyInstructions}
        onClose={() => setShowEmergency(false)}
      />
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      <LinearGradient
        colors={[colors.background, colors.surface]}
        style={{ flex: 1 }}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={
            Platform.OS === "ios" ? (isFullScreen ? 0 : 90) : 0
          }
        >
          <SafeAreaView style={{ flex: 1 }}>
            {/* Header */}
            <LinearGradient
              colors={["#00BCD4", "#00ACC1", "#0097A7"]}
              style={styles.header}
            >
              <View style={styles.headerRow}>
                <TouchableOpacity onPress={handleBack} style={styles.headerBtn}>
                  <Ionicons name="chevron-back" size={24} color="#fff" />
                </TouchableOpacity>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    flex: 1,
                    marginHorizontal: 12,
                  }}
                >
                  <LinearGradient
                    colors={[
                      "rgba(255,255,255,0.2)",
                      "rgba(255,255,255,0.1)",
                    ]}
                    style={styles.headerAvatar}
                  >
                    <Ionicons name="medical" size={18} color="#fff" />
                  </LinearGradient>
                  <View style={{ marginLeft: 10 }}>
                    <Text style={styles.headerTitle}>HealthAI Assistant</Text>
                    <Text style={styles.headerSubtitle}>
                      {isTyping ? "Analyzing..." : "Ready to help"}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity onPress={clearChat} style={styles.headerBtn}>
                  <Ionicons name="refresh-outline" size={22} color="#fff" />
                </TouchableOpacity>
              </View>
            </LinearGradient>

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
                  bookedIds={bookedIds}
                  onBookAppointment={(s) => {
                    setCurrentSuggestion(s);
                    setCardType(
                      s.suggestedDoctors && s.suggestedDoctors.length > 0
                        ? "booking"
                        : "noDoctors",
                    );
                    setShowAppointmentCard(true);
                  }}
                  onFollowUp={(q) => setInput(q)}
                  onBookingConfirm={handleBookingConfirm}
                  onBookingDecline={handleBookingDecline}
                  onViewAppointment={(id) =>
                    handleViewExistingAppointment(id)
                  }
                />
              )}
              keyExtractor={(item, i) => item.id || `${item.timestamp}-${i}`}
              contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
              showsVerticalScrollIndicator={false}
              ListHeaderComponent={
                messages.length <= 1 ? (
                  <View style={{ marginBottom: 16 }}>
                    <Text
                      style={{
                        textAlign: "center",
                        color: colors.textSecondary,
                        marginBottom: 8,
                      }}
                    >
                      💡 Quick Actions
                    </Text>
                    <View
                      style={{
                        flexDirection: "row",
                        flexWrap: "wrap",
                        justifyContent: "center",
                      }}
                    >
                      {quickReplies.map((r, i) => (
                        <TouchableOpacity
                          key={i}
                          onPress={() => sendMessage(r)}
                          disabled={loading}
                          style={{
                            margin: 4,
                            borderRadius: 20,
                            overflow: "hidden",
                          }}
                        >
                          <LinearGradient
                            colors={
                              i % 2 === 0
                                ? colors.gradientPrimary
                                : colors.gradientSecondary
                            }
                            style={{
                              paddingHorizontal: 14,
                              paddingVertical: 8,
                              borderRadius: 20,
                            }}
                          >
                            <Text
                              style={{
                                color: "#fff",
                                fontSize: 12,
                                fontWeight: "500",
                              }}
                            >
                              {r}
                            </Text>
                          </LinearGradient>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ) : null
              }
              ListFooterComponent={<TypingIndicator isTyping={isTyping} />}
            />

            {/* Error bar */}
            {error && (
              <View style={styles.errorBar}>
                <Ionicons name="warning" size={18} color={colors.error} />
                <Text
                  style={[styles.errorText, { color: colors.error }]}
                  numberOfLines={2}
                >
                  {error}
                </Text>
                <TouchableOpacity onPress={() => setError(null)}>
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
                  placeholder={
                    isOffline
                      ? "Offline — message will be queued..."
                      : "Ask about health, appointments..."
                  }
                  placeholderTextColor={colors.textLight}
                  editable={!loading}
                  multiline
                  maxLength={500}
                  onSubmitEditing={() => sendMessage()}
                />
                <Animated.View style={{ transform: [{ scale: sendScale }] }}>
                  <TouchableOpacity
                    style={[
                      styles.sendBtn,
                      (!input.trim() || loading) && styles.sendBtnDisabled,
                    ]}
                    onPress={() => sendMessage()}
                    disabled={!input.trim() || loading}
                  >
                    <LinearGradient
                      colors={
                        !input.trim() || loading
                          ? [colors.textLight, colors.textLight]
                          : colors.gradientPrimary
                      }
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
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  paddingHorizontal: 4,
                  marginTop: 6,
                }}
              >
                <Text style={{ fontSize: 11, color: colors.textLight }}>
                  {input.length}/500
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Ionicons
                    name="shield-checkmark"
                    size={11}
                    color={colors.success}
                  />
                  <Text
                    style={{
                      fontSize: 11,
                      color: colors.textLight,
                      marginLeft: 3,
                    }}
                  >
                    Secure
                  </Text>
                </View>
              </View>
            </View>

            {/* Booking Confirmation Card */}
            {showBookingConfirmation && pendingSuggestion && (
              <BookingConfirmationCard
                suggestion={pendingSuggestion}
                onConfirm={() => handleBookingConfirm(pendingSuggestion)}
                onDecline={handleBookingDecline}
              />
            )}

            {/* Dynamic Appointment Card */}
            {showAppointmentCard && renderAppointmentCard()}
          </SafeAreaView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </Animated.View>
  );
};

// ==================== STYLES ====================

const styles = StyleSheet.create({
  container: { backgroundColor: "#FAFAFA", flex: 1, width: "100%" },
  header: {
    paddingBottom: 12,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight || 0 : 0,
  },
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  headerBtn: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 22,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  headerAvatar: {
    alignItems: "center",
    borderRadius: 20,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  headerTitle: { color: "#fff", fontSize: 17, fontWeight: "700" },
  headerSubtitle: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 12,
    marginTop: 1,
  },
  loadingIcon: {
    alignItems: "center",
    borderRadius: 40,
    height: 80,
    justifyContent: "center",
    width: 80,
  },
  offlineBanner: {
    alignItems: "center",
    backgroundColor: "#FF9800",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  offlineText: { color: "#fff", flex: 1, fontSize: 13 },
  msgContainer: { marginVertical: 6, paddingHorizontal: 4 },
  userContainer: {
    alignItems: "flex-end",
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  botContainer: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "flex-start",
  },
  botAvatar: {
    alignItems: "center",
    borderRadius: 17,
    height: 34,
    justifyContent: "center",
    marginRight: 8,
    width: 34,
  },
  userAvatar: {
    alignItems: "center",
    borderRadius: 15,
    height: 30,
    justifyContent: "center",
    marginLeft: 8,
    width: 30,
  },
  msgContent: { maxWidth: "80%" },
  userMsgContent: { alignItems: "flex-end" },
  botMsgContent: { alignItems: "flex-start" },
  bubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  userBubble: { borderBottomRightRadius: 4 },
  botBubble: {
    backgroundColor: "#fff",
    borderBottomLeftRadius: 4,
    borderColor: "#E0E0E0",
    borderWidth: 1,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  msgText: { fontSize: 14, lineHeight: 21 },
  userMsgText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 21,
  },
  timestamp: { fontSize: 10, marginTop: 3 },
  pendingText: { color: "rgba(255,255,255,0.7)", fontSize: 11, marginTop: 4 },
  failedText: { color: "#FFD54F", fontSize: 11, marginTop: 4 },
  confidenceBox: {
    borderTopColor: "rgba(0,0,0,0.08)",
    borderTopWidth: 1,
    marginTop: 8,
    paddingTop: 8,
  },
  confidenceBar: {
    backgroundColor: "rgba(0,0,0,0.08)",
    borderRadius: 2,
    height: 4,
    marginBottom: 3,
    overflow: "hidden",
  },
  confidenceFill: { borderRadius: 2, height: "100%" },
  confidenceLabel: { color: "#757575", fontSize: 10 },
  emergencyInlineBox: {
    alignItems: "center",
    backgroundColor: "rgba(255,82,82,0.1)",
    borderColor: "rgba(255,82,82,0.3)",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    marginTop: 8,
    padding: 8,
  },
  emergencyInlineText: {
    color: "#FF5252",
    fontSize: 12,
    fontWeight: "700",
    marginLeft: 6,
  },
  bookingConfirmationInline: {
    borderTopColor: "rgba(0,0,0,0.08)",
    borderTopWidth: 1,
    marginTop: 10,
    paddingTop: 10,
  },
  confirmationQuestionInline: {
    color: "#212121",
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 8,
  },
  confirmationButtonsInline: { flexDirection: "row", gap: 10 },
  confirmYesInline: {
    alignItems: "center",
    backgroundColor: "#00BCD4",
    borderRadius: 20,
    flex: 1,
    paddingVertical: 8,
  },
  confirmYesText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  confirmNoInline: {
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    borderColor: "#E0E0E0",
    borderRadius: 20,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 8,
  },
  confirmNoText: { color: "#757575", fontSize: 14, fontWeight: "600" },
  actionsBox: {
    borderTopColor: "rgba(0,0,0,0.08)",
    borderTopWidth: 1,
    marginTop: 8,
    paddingTop: 8,
  },
  actionsTitle: {
    color: "#757575",
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 4,
  },
  actionChip: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(0,188,212,0.08)",
    borderRadius: 12,
    flexDirection: "row",
    marginBottom: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  actionText: { color: "#00BCD4", fontSize: 11, marginLeft: 4 },
  followUpContainer: {
    borderTopColor: "rgba(0,0,0,0.08)",
    borderTopWidth: 1,
    marginTop: 10,
    paddingTop: 10,
  },
  followUpTitle: {
    color: "#757575",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
  },
  followUpChip: {
    alignItems: "flex-start",
    backgroundColor: "rgba(0,188,212,0.06)",
    borderColor: "rgba(0,188,212,0.2)",
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    marginBottom: 5,
    padding: 8,
  },
  followUpText: {
    color: "#00BCD4",
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    marginLeft: 6,
  },
  bookBtn: { borderRadius: 18, marginTop: 10, overflow: "hidden" },
  bookBtnGradient: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  bookBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
    marginLeft: 6,
  },
  typingRow: {
    alignItems: "center",
    flexDirection: "row",
    marginVertical: 6,
    paddingHorizontal: 4,
  },
  typingBubble: {
    backgroundColor: "#fff",
    borderColor: "#E0E0E0",
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dot: {
    backgroundColor: "#9E9E9E",
    borderRadius: 3,
    height: 6,
    marginHorizontal: 3,
    width: 6,
  },
  errorBar: {
    alignItems: "center",
    backgroundColor: "#FFEBEE",
    borderRadius: 8,
    flexDirection: "row",
    gap: 8,
    marginBottom: 4,
    marginHorizontal: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  errorText: { flex: 1, fontSize: 12 },
  inputArea: {
    backgroundColor: "#fff",
    borderTopColor: "#E0E0E0",
    borderTopWidth: 1,
    paddingBottom: Platform.OS === "ios" ? 20 : 10,
    paddingHorizontal: 14,
    paddingTop: 8,
  },
  inputRow: { alignItems: "flex-end", flexDirection: "row" },
  input: {
    backgroundColor: "#F5F5F5",
    borderColor: "#E0E0E0",
    borderRadius: 22,
    borderWidth: 1,
    color: "#212121",
    flex: 1,
    fontSize: 14,
    marginRight: 10,
    maxHeight: 100,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  sendBtn: { borderRadius: 23, height: 46, overflow: "hidden", width: 46 },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnGradient: { alignItems: "center", flex: 1, justifyContent: "center" },
  appointmentCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    bottom: Platform.OS === "ios" ? 120 : 100,
    elevation: 6,
    left: 12,
    maxHeight: height * 0.72,
    padding: 16,
    position: "absolute",
    right: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    zIndex: 1000,
  },
  closeBtn: {
    padding: 4,
    position: "absolute",
    right: 10,
    top: 10,
    zIndex: 1,
  },
  urgencyBadge: {
    alignSelf: "flex-start",
    borderRadius: 12,
    marginBottom: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  urgencyText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  cardTitle: {
    color: "#212121",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 6,
  },
  suggestionReason: {
    color: "#424242",
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 10,
  },
  confirmationQuestion: {
    color: "#212121",
    fontSize: 15,
    fontWeight: "500",
    lineHeight: 22,
    marginVertical: 15,
    textAlign: "center",
  },
  confirmationButtons: { flexDirection: "row", gap: 12, marginTop: 8 },
  confirmBtnYes: { flex: 2 },
  confirmBtnNo: { backgroundColor: "#F5F5F5", borderRadius: 12, flex: 1 },
  declineBtnContent: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    paddingVertical: 13,
  },
  declineBtnText: { color: "#757575", fontSize: 14, fontWeight: "600" },
  existingAppointmentDetails: {
    backgroundColor: "#F0F9FA",
    borderRadius: 12,
    marginBottom: 10,
    padding: 12,
  },
  contraindicationBox: {
    backgroundColor: "#FFEBEE",
    borderColor: "rgba(255,82,82,0.3)",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    marginBottom: 10,
    padding: 8,
  },
  contraindicationText: {
    color: "#FF5252",
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  symptomsRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: 8 },
  symptomChip: {
    alignItems: "center",
    backgroundColor: "#F0F9FA",
    borderRadius: 12,
    flexDirection: "row",
    marginBottom: 4,
    marginRight: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  symptomChipText: { color: "#00BCD4", fontSize: 11, marginLeft: 3 },
  infoRow: { alignItems: "center", flexDirection: "row", marginBottom: 6 },
  infoText: { color: "#757575", fontSize: 13, marginLeft: 6 },
  doctorsTitle: {
    color: "#212121",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
    marginTop: 8,
  },
  doctorsScroll: { maxHeight: 180 },
  doctorCard: {
    borderColor: "transparent",
    borderRadius: 14,
    borderWidth: 1,
    marginRight: 10,
    overflow: "hidden",
    width: 240,
  },
  doctorCardSelected: { borderColor: "#00BCD4", borderWidth: 2 },
  doctorCardFull: { opacity: 0.6 },
  doctorCardGradient: { padding: 12 },
  doctorRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  doctorName: { color: "#212121", fontSize: 14, fontWeight: "600" },
  ratingRow: { alignItems: "center", flexDirection: "row" },
  ratingText: { color: "#757575", fontSize: 11, marginLeft: 3 },
  fullBadge: {
    backgroundColor: "#FFEBEE",
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  fullBadgeText: { color: "#FF5252", fontSize: 10, fontWeight: "600" },
  doctorMeta: { flexDirection: "row", justifyContent: "space-between" },
  expText: { color: "#757575", fontSize: 11 },
  feeText: { color: "#00BCD4", fontSize: 11, fontWeight: "600" },
  slotsBox: { marginTop: 8 },
  slotsLabel: { fontSize: 11, marginBottom: 4 },
  slotChip: {
    backgroundColor: "#fff",
    borderColor: "#E0E0E0",
    borderRadius: 14,
    borderWidth: 1,
    marginRight: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  slotChipSelected: { backgroundColor: "#00BCD4", borderColor: "#00BCD4" },
  slotText: { color: "#757575", fontSize: 11 },
  noDoctorsBox: {
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    borderRadius: 10,
    gap: 10,
    marginVertical: 8,
    padding: 15,
  },
  noDoctorsText: {
    color: "#757575",
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  confirmBtn: { borderRadius: 12, marginTop: 10, overflow: "hidden" },
  confirmBtnDisabled: { opacity: 0.5 },
  confirmBtnGradient: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    paddingVertical: 13,
  },
  confirmBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  // Consent modal
  consentOverlay: {
    backgroundColor: "rgba(0,0,0,0.6)",
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  consentBox: {
    backgroundColor: "#fff",
    borderRadius: 20,
    maxHeight: height * 0.8,
    overflow: "hidden",
  },
  consentHeader: { alignItems: "center", padding: 24 },
  consentTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    marginTop: 10,
  },
  consentContent: { maxHeight: height * 0.4, padding: 20 },
  consentText: { color: "#424242", fontSize: 14, lineHeight: 22 },
  consentButtons: {
    borderTopColor: "#E0E0E0",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 16,
  },
  consentBtn: { borderRadius: 12, flex: 1, overflow: "hidden" },
  declineBtn: {
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    paddingVertical: 14,
  },
  acceptBtn: { borderRadius: 12, overflow: "hidden" },
  acceptBtnGradient: { alignItems: "center", paddingVertical: 14 },
  acceptBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  // Emergency modal
  emergencyOverlay: {
    backgroundColor: "rgba(0,0,0,0.8)",
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  emergencyModalBox: {
    backgroundColor: "#fff",
    borderRadius: 20,
    maxHeight: height * 0.8,
    overflow: "hidden",
  },
  emergencyHeader: { alignItems: "center", padding: 24 },
  emergencyTitle: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "800",
    marginTop: 10,
  },
  emergencyContent: { maxHeight: height * 0.4, padding: 20 },
  emergencyInstructionText: { color: "#212121", fontSize: 15, lineHeight: 24 },
  emergencyButtons: { gap: 10, padding: 16 },
  emergencyBtn: {
    alignItems: "center",
    borderRadius: 12,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    paddingVertical: 14,
  },
  callBtn: { backgroundColor: "#D32F2F" },
  mapBtn: { backgroundColor: "#1976D2" },
  closeEmergencyBtn: {
    backgroundColor: "#F5F5F5",
    borderColor: "#E0E0E0",
    borderWidth: 1,
  },
  closeEmergencyText: { color: "#757575", fontSize: 16, fontWeight: "600" },
  emergencyBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});

export default ChatWidget;