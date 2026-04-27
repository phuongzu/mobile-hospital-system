// screens/BookingScreen.tsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  TextInput,
  Dimensions,
  Animated,
  Platform,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";

const { width, height } = Dimensions.get("window");

interface Doctor {
  _id: string;
  name: string;
  email: string;
  phoneNumber?: string;
  specialty?: string;
  specialty_id?: { name: string };
  consultation_fee?: number;
  rating?: number;
  years_of_experience?: number;
  isAvailable?: boolean;
  user_id?: { name: string };
}

interface TimeSlot {
  time: string;
  isAvailable: boolean;
  isReserved: boolean;
  isBooked?: boolean;
  bookedInfo?: any;
  bookingStatus?: string;
}

interface BookingScreenProps {
  route: any;
  navigation: any;
}

const API_BASE_URL = "http://localhost:3000";

// ==================== STEP INDICATOR ====================

const StepIndicator: React.FC<{ currentStep: number }> = ({ currentStep }) => {
  const steps = [
    { id: 1, label: "Date & Time", icon: "calendar-outline" },
    { id: 2, label: "Symptoms", icon: "medical-outline" },
    { id: 3, label: "Confirm", icon: "checkmark-circle-outline" },
  ];

  return (
    <View style={stepStyles.container}>
      {steps.map((step, index) => (
        <React.Fragment key={step.id}>
          <View style={stepStyles.stepItem}>
            <View
              style={[
                stepStyles.stepCircle,
                currentStep >= step.id
                  ? stepStyles.stepCircleActive
                  : stepStyles.stepCircleInactive,
                currentStep === step.id && stepStyles.stepCircleCurrent,
              ]}
            >
              {currentStep > step.id ? (
                <Ionicons name="checkmark" size={20} color="white" />
              ) : (
                <Ionicons
                  name={step.icon as any}
                  size={currentStep === step.id ? 18 : 16}
                  color={currentStep >= step.id ? "white" : "#999"}
                />
              )}
            </View>
            <Text
              style={[
                stepStyles.stepLabel,
                currentStep >= step.id
                  ? stepStyles.stepLabelActive
                  : stepStyles.stepLabelInactive,
                currentStep === step.id && stepStyles.stepLabelCurrent,
              ]}
            >
              {step.label}
            </Text>
          </View>

          {index < steps.length - 1 && (
            <View
              style={[
                stepStyles.connector,
                currentStep > step.id
                  ? stepStyles.connectorActive
                  : stepStyles.connectorInactive,
              ]}
            />
          )}
        </React.Fragment>
      ))}
    </View>
  );
};

const stepStyles = StyleSheet.create({
  connector: {
    flex: 1,
    height: 2,
    marginBottom: 20,
    marginHorizontal: 4,
  },
  connectorActive: {
    backgroundColor: "#1976d2",
  },
  connectorInactive: {
    backgroundColor: "#e0e0e0",
  },
  container: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 32,
    paddingHorizontal: 10,
  },
  stepCircle: {
    alignItems: "center",
    borderRadius: 20,
    borderWidth: 2,
    height: 40,
    justifyContent: "center",
    marginBottom: 8,
    width: 40,
  },
  stepCircleActive: {
    backgroundColor: "#1976d2",
    borderColor: "#1976d2",
  },
  stepCircleCurrent: {
    elevation: 6,
    shadowColor: "#1976d2",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    transform: [{ scale: 1.1 }],
  },
  stepCircleInactive: {
    backgroundColor: "white",
    borderColor: "#e0e0e0",
  },
  stepItem: {
    alignItems: "center",
    flex: 1,
  },
  stepLabel: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: 4,
    textAlign: "center",
  },
  stepLabelActive: {
    color: "#1976d2",
    fontWeight: "600",
  },
  stepLabelCurrent: {
    fontWeight: "bold",
  },
  stepLabelInactive: {
    color: "#999",
  },
});

// ==================== DOCTOR CARD ====================

const DoctorCard: React.FC<{ doctor: Doctor }> = ({ doctor }) => {
  return (
    <View style={doctorCardStyles.container}>
      <LinearGradient
        colors={["#1976d2", "#1565c0"]}
        style={doctorCardStyles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <View style={doctorCardStyles.headerContent}>
          <View style={doctorCardStyles.avatar}>
            <Ionicons name="person-circle" size={60} color="white" />
          </View>
          <View style={doctorCardStyles.headerInfo}>
            <Text style={doctorCardStyles.doctorName}>
              Dr. {doctor.user_id?.name || doctor.name || "Unknown Doctor"}
            </Text>
            <Text style={doctorCardStyles.specialty}>
              {doctor.specialty_id?.name ||
                doctor.specialty ||
                "General Practice"}
            </Text>
          </View>
        </View>
      </LinearGradient>

      <View style={doctorCardStyles.content}>
        <View style={doctorCardStyles.statsRow}>
          {doctor.years_of_experience !== undefined && (
            <View style={doctorCardStyles.statItem}>
              <Ionicons name="time-outline" size={16} color="#1976d2" />
              <Text style={doctorCardStyles.statText}>
                {doctor.years_of_experience} years
              </Text>
            </View>
          )}

          {doctor.rating !== undefined && (
            <View style={doctorCardStyles.statItem}>
              <Ionicons name="star" size={16} color="#FFD700" />
              <Text style={doctorCardStyles.statText}>
                {doctor.rating.toFixed(1)}
              </Text>
            </View>
          )}

          {doctor.consultation_fee !== undefined && (
            <View style={doctorCardStyles.statItem}>
              <Ionicons name="pricetag" size={16} color="#4CAF50" />
              <Text style={doctorCardStyles.statText}>
                ${doctor.consultation_fee}
              </Text>
            </View>
          )}
        </View>

        <View style={doctorCardStyles.availabilityContainer}>
          {doctor.isAvailable ? (
            <View style={doctorCardStyles.availableBadge}>
              <View style={doctorCardStyles.availabilityDot} />
              <Text style={doctorCardStyles.availabilityText}>
                Available Today
              </Text>
            </View>
          ) : (
            <View style={doctorCardStyles.busyBadge}>
              <Ionicons name="time" size={12} color="white" />
              <Text style={doctorCardStyles.availabilityText}>
                Currently Busy
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

const doctorCardStyles = StyleSheet.create({
  availabilityContainer: {
    alignItems: "center",
  },
  availabilityDot: {
    backgroundColor: "#4CAF50",
    borderRadius: 4,
    height: 8,
    marginRight: 8,
    width: 8,
  },
  availabilityText: {
    color: "#333",
    fontSize: 14,
    fontWeight: "600",
  },
  availableBadge: {
    alignItems: "center",
    backgroundColor: "#e8f5e9",
    borderColor: "#4CAF50",
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  avatar: {
    marginRight: 16,
  },
  busyBadge: {
    alignItems: "center",
    backgroundColor: "#ffebee",
    borderColor: "#ff6b6b",
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  container: {
    backgroundColor: "white",
    borderRadius: 20,
    elevation: 8,
    marginBottom: 24,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  content: {
    padding: 20,
  },
  doctorName: {
    color: "white",
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 4,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  headerContent: {
    alignItems: "center",
    flexDirection: "row",
  },
  headerInfo: {
    flex: 1,
  },
  specialty: {
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: 16,
  },
  statItem: {
    alignItems: "center",
    backgroundColor: "#f5f7fa",
    borderRadius: 20,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  statText: {
    color: "#333",
    fontSize: 14,
    fontWeight: "500",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 16,
  },
});

// ==================== TIME SLOT PICKER ====================

const TimeSlotPicker: React.FC<{
  slots: TimeSlot[];
  selectedTime: string;
  onSelectTime: (time: string) => void;
  loading: boolean;
}> = ({ slots, selectedTime, onSelectTime, loading }) => {
  const renderTimeSlot = (slot: TimeSlot) => {
    const isSelected = selectedTime === slot.time;
    const isAvailable = slot.isAvailable && !slot.isReserved && !slot.isBooked;

    let slotStyle = timeSlotStyles.slotAvailable;
    let textStyle = timeSlotStyles.slotTextAvailable;

    if (isSelected) {
      slotStyle = timeSlotStyles.slotSelected;
      textStyle = timeSlotStyles.slotTextSelected;
    } else if (!isAvailable) {
      slotStyle = timeSlotStyles.slotUnavailable;
      textStyle = timeSlotStyles.slotTextUnavailable;
    }

    return (
      <TouchableOpacity
        key={slot.time}
        style={[timeSlotStyles.slot, slotStyle]}
        onPress={() => isAvailable && onSelectTime(slot.time)}
        disabled={!isAvailable}
        activeOpacity={0.7}
      >
        <Text style={[timeSlotStyles.slotText, textStyle]}>{slot.time}</Text>

        {!isAvailable && (
          <View style={timeSlotStyles.slotIcon}>
            {slot.isReserved ? (
              <Ionicons name="lock-closed" size={14} color="#ff9800" />
            ) : slot.isBooked ? (
              <Ionicons name="close-circle" size={14} color="#ff6b6b" />
            ) : null}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={timeSlotStyles.loadingContainer}>
        <ActivityIndicator size="large" color="#1976d2" />
        <Text style={timeSlotStyles.loadingText}>
          Loading available slots...
        </Text>
      </View>
    );
  }

  const rows: TimeSlot[][] = [];
  for (let i = 0; i < slots.length; i += 3) {
    rows.push(slots.slice(i, i + 3));
  }

  return (
    <View style={timeSlotStyles.container}>
      <View style={timeSlotStyles.header}>
        <View style={timeSlotStyles.headerTitle}>
          <Ionicons name="time-outline" size={20} color="#1976d2" />
          <Text style={timeSlotStyles.title}>Available Time Slots</Text>
        </View>

        <View style={timeSlotStyles.legend}>
          <View style={timeSlotStyles.legendItem}>
            <View
              style={[timeSlotStyles.legendDot, timeSlotStyles.legendAvailable]}
            />
            <Text style={timeSlotStyles.legendText}>Available</Text>
          </View>
          <View style={timeSlotStyles.legendItem}>
            <View
              style={[timeSlotStyles.legendDot, timeSlotStyles.legendBooked]}
            />
            <Text style={timeSlotStyles.legendText}>Booked</Text>
          </View>
          <View style={timeSlotStyles.legendItem}>
            <View
              style={[timeSlotStyles.legendDot, timeSlotStyles.legendSelected]}
            />
            <Text style={timeSlotStyles.legendText}>Selected</Text>
          </View>
        </View>
      </View>

      <View style={timeSlotStyles.slotsContainer}>
        {rows.map((row, rowIndex) => (
          <View key={`row-${rowIndex}`} style={timeSlotStyles.row}>
            {row.map(renderTimeSlot)}
          </View>
        ))}
      </View>
    </View>
  );
};

const timeSlotStyles = StyleSheet.create({
  container: {
    backgroundColor: "white",
    borderRadius: 16,
    elevation: 2,
    marginBottom: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  header: {
    marginBottom: 20,
  },
  headerTitle: {
    alignItems: "center",
    flexDirection: "row",
    marginBottom: 12,
  },
  legend: {
    backgroundColor: "#f8f9fa",
    borderRadius: 10,
    flexDirection: "row",
    justifyContent: "space-around",
    padding: 12,
  },
  legendAvailable: {
    backgroundColor: "#4CAF50",
  },
  legendBooked: {
    backgroundColor: "#ff6b6b",
  },
  legendDot: {
    borderRadius: 4,
    height: 8,
    marginRight: 6,
    width: 8,
  },
  legendItem: {
    alignItems: "center",
    flexDirection: "row",
  },
  legendSelected: {
    backgroundColor: "#1976d2",
  },
  legendText: {
    color: "#666",
    fontSize: 12,
  },
  loadingContainer: {
    alignItems: "center",
    padding: 40,
  },
  loadingText: {
    color: "#666",
    fontSize: 14,
    marginTop: 12,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  slot: {
    alignItems: "center",
    borderRadius: 10,
    height: 48,
    justifyContent: "center",
    position: "relative",
    width: (width - 80) / 3 - 4,
  },
  slotAvailable: {
    backgroundColor: "#f0f7ff",
    borderColor: "#1976d2",
    borderWidth: 1,
  },
  slotIcon: {
    position: "absolute",
    right: 4,
    top: 4,
  },
  slotSelected: {
    backgroundColor: "#1976d2",
    borderColor: "#1976d2",
    borderWidth: 2,
  },
  slotText: {
    fontSize: 14,
    fontWeight: "500",
  },
  slotTextAvailable: {
    color: "#1976d2",
  },
  slotTextSelected: {
    color: "white",
  },
  slotTextUnavailable: {
    color: "#999",
  },
  slotUnavailable: {
    backgroundColor: "#f5f5f5",
    borderColor: "#e0e0e0",
    borderWidth: 1,
  },
  slotsContainer: {
    paddingBottom: 10,
  },
  title: {
    color: "#333",
    fontSize: 18,
    fontWeight: "bold",
    marginLeft: 8,
  },
});

// ==================== SYMPTOMS INPUT ====================

const SymptomsInput: React.FC<{
  symptoms: string;
  notes: string;
  onSymptomsChange: (text: string) => void;
  onNotesChange: (text: string) => void;
  onAddSymptom: (symptom: string) => void;
}> = ({ symptoms, notes, onSymptomsChange, onNotesChange, onAddSymptom }) => {
  const [charCount, setCharCount] = useState(symptoms.length);
  const commonSymptoms = [
    "Fever",
    "Headache",
    "Cough",
    "Sore throat",
    "Fatigue",
    "Body aches",
  ];

  const handleSymptomsChange = (text: string) => {
    onSymptomsChange(text);
    setCharCount(text.length);
  };

  const handleAddSymptom = (symptom: string) => {
    onAddSymptom(symptom);
    setCharCount(symptoms.length + symptom.length + 2);
  };

  return (
    <View style={symptomsStyles.container}>
      <View style={symptomsStyles.sectionHeader}>
        <Ionicons name="medical-outline" size={24} color="#1976d2" />
        <Text style={symptomsStyles.sectionTitle}>Symptoms & Notes</Text>
      </View>

      <View style={symptomsStyles.inputGroup}>
        <Text style={symptomsStyles.inputLabel}>Describe Your Symptoms *</Text>
        <TextInput
          style={symptomsStyles.symptomsInput}
          placeholder="Tell us about your symptoms..."
          placeholderTextColor="#999"
          value={symptoms}
          onChangeText={handleSymptomsChange}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          maxLength={500}
        />
        <Text style={symptomsStyles.charCount}>{charCount}/500 characters</Text>
      </View>

      <View style={symptomsStyles.suggestionsContainer}>
        <Text style={symptomsStyles.suggestionsTitle}>Quick Add:</Text>
        <View style={symptomsStyles.suggestionsRow}>
          {commonSymptoms.map((symptom, index) => (
            <TouchableOpacity
              key={index}
              style={symptomsStyles.symptomChip}
              onPress={() => handleAddSymptom(symptom)}
            >
              <Text style={symptomsStyles.symptomChipText}>{symptom}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={symptomsStyles.inputGroup}>
        <Text style={symptomsStyles.inputLabel}>
          Additional Notes (Optional)
        </Text>
        <TextInput
          style={symptomsStyles.notesInput}
          placeholder="Any additional information for the doctor..."
          placeholderTextColor="#999"
          value={notes}
          onChangeText={onNotesChange}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          maxLength={300}
        />
      </View>
    </View>
  );
};

const symptomsStyles = StyleSheet.create({
  charCount: {
    color: "#999",
    fontSize: 12,
    marginTop: 4,
    textAlign: "right",
  },
  container: {
    backgroundColor: "white",
    borderRadius: 16,
    elevation: 2,
    marginBottom: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    color: "#333",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  notesInput: {
    backgroundColor: "#f8f9fa",
    borderColor: "#e0e0e0",
    borderRadius: 12,
    borderWidth: 1,
    color: "#333",
    fontSize: 14,
    minHeight: 80,
    padding: 16,
    textAlignVertical: "top",
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    marginBottom: 20,
  },
  sectionTitle: {
    color: "#333",
    fontSize: 18,
    fontWeight: "bold",
    marginLeft: 8,
  },
  suggestionsContainer: {
    marginBottom: 20,
  },
  suggestionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  suggestionsTitle: {
    color: "#666",
    fontSize: 14,
    marginBottom: 8,
  },
  symptomChip: {
    backgroundColor: "#e3f2fd",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  symptomChipText: {
    color: "#1976d2",
    fontSize: 12,
    fontWeight: "500",
  },
  symptomsInput: {
    backgroundColor: "#f8f9fa",
    borderColor: "#e0e0e0",
    borderRadius: 12,
    borderWidth: 1,
    color: "#333",
    fontSize: 14,
    minHeight: 100,
    padding: 16,
    textAlignVertical: "top",
  },
});

// ==================== MAIN BOOKING SCREEN ====================

const BookingScreen: React.FC<BookingScreenProps> = ({ route, navigation }) => {
  // ── Defensive params parsing ──────────────────────────────────────────────
  // Supports two shapes:
  //   1. { doctor: Doctor }            ← direct navigation with full object
  //   2. { doctorId, initialData }     ← from ChatWidget after AI booking
  const params = (route.params ?? {}) as {
    doctor?: Doctor;
    doctorId?: string;
    initialData?: any;
    appointmentId?: string;
  };

  const doctor: Doctor | null =
    params.doctor ??
    (params.initialData || params.doctorId
      ? {
        _id: params.doctorId ?? params.initialData?.doctor_id ?? "",
        name:
          params.initialData?.doctor_name ??
          params.initialData?.doctorName ??
          "Unknown Doctor",
        email: "",
        specialty: params.initialData?.specialty ?? "",
        consultation_fee: params.initialData?.consultation_fee,
        rating: params.initialData?.doctor?.rating,
        years_of_experience: params.initialData?.doctor?.years_of_experience,
      }
      : null);

  // Guard: render fallback if no doctor data at all
  if (!doctor) {
    return (
      <SafeAreaView style={styles.fallbackContainer}>
        <Ionicons name="alert-circle-outline" size={72} color="#b0bec5" />
        <Text style={styles.fallbackTitle}>Doctor information not found</Text>
        <Text style={styles.fallbackSubtitle}>
          Please go back and select a doctor to book an appointment.
        </Text>
        <TouchableOpacity
          style={styles.fallbackButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.fallbackButtonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }
  // ─────────────────────────────────────────────────────────────────────────

  const [selectedDate, setSelectedDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  });
  const [selectedTime, setSelectedTime] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [symptoms, setSymptoms] = useState("");
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [currentStep, setCurrentStep] = useState(1);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(30))[0];

  useEffect(() => {
    animateScreen();
    fetchAvailableSlots();
  }, []);

  useEffect(() => {
    if (selectedDate) {
      fetchAvailableSlots();
    }
  }, [selectedDate]);

  const animateScreen = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const fetchAvailableSlots = async () => {
    setLoadingSlots(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      const formattedDate = selectedDate.toISOString().split('T')[0];

      const response = await fetch(
        `${API_BASE_URL}/api/patient/appointments/availability?doctor_id=${doctor._id}&date=${formattedDate}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.ok) {
        const data = await response.json();

        // ✅ Xử lý ngày bác sĩ nghỉ
        if (data.isDayOff) {
          setAvailableSlots([]);
          Alert.alert(
            'Doctor Not Available',
            `This doctor does not work on ${selectedDate.toLocaleDateString('en-US', { weekday: 'long' })}. Please select another date.`
          );
          setLoadingSlots(false);
          setRefreshing(false);
          return;
        }

        // ✅ Dùng trực tiếp slots từ API — không map lại hardcode
        const slots: TimeSlot[] = (data.availableSlots ?? []).map((s: any) => ({
          time: s.time,
          isAvailable: s.isAvailable,
          isReserved: s.isReserved ?? false,
          isBooked: !s.isAvailable,
          bookedInfo: s.bookedInfo ?? null,
        }));

        setAvailableSlots(slots);

        if (data.summary?.isFullyBooked && slots.length > 0) {
          Alert.alert(
            'Fully Booked',
            `No available slots for ${selectedDate.toDateString()}. Please select another date.`
          );
        }
      } else {
        setAvailableSlots([]);
        Alert.alert('Error', 'Unable to load available slots. Please try again.');
      }
    } catch (error) {
      console.error('Error fetching slots:', error);
      setAvailableSlots([]);
      Alert.alert('Network Error', 'Could not load time slots. Please check your connection.');
    } finally {
      setLoadingSlots(false);
      setRefreshing(false);
    }
  };


  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAvailableSlots();
  }, [selectedDate]);

  const handleDateChange = (event: any, date?: Date) => {
    if (Platform.OS === "android") {
      setShowDatePicker(false);
    }
    if (date) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const selected = new Date(date);
      selected.setHours(0, 0, 0, 0);

      if (selected <= today) {
        Alert.alert(
          "Invalid Date",
          "Please select a date starting from tomorrow.",
        );
        return;
      }

      setSelectedDate(date);
      setSelectedTime("");
    }
  };

  const handleAddSymptom = (symptom: string) => {
    const newSymptoms = symptoms ? `${symptoms}, ${symptom}` : symptom;
    setSymptoms(newSymptoms);
  };

  const validateBooking = () => {
    if (!selectedTime) {
      Alert.alert(
        "Select Time",
        "Please select a time slot for your appointment",
      );
      return false;
    }

    const selectedSlot = availableSlots.find(
      (slot) => slot.time === selectedTime,
    );
    if (selectedSlot?.isReserved || selectedSlot?.isBooked) {
      Alert.alert(
        "Slot Unavailable",
        "This time slot is no longer available. Please choose a different time.",
      );
      return false;
    }

    if (!selectedSlot?.isAvailable) {
      Alert.alert(
        "Slot Unavailable",
        "This time slot is not available. Please choose a different time.",
      );
      return false;
    }

    if (symptoms.length > 0 && symptoms.length < 5) {
      Alert.alert(
        "Symptoms Description",
        "Please provide a more detailed description of your symptoms (minimum 5 characters)",
      );
      return false;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selected = new Date(selectedDate);
    selected.setHours(0, 0, 0, 0);

    if (selected <= today) {
      Alert.alert(
        "Invalid Date",
        "Appointments can only be booked for tomorrow onwards.",
      );
      return false;
    }

    return true;
  };

  const showConfirmation = () => {
    if (!validateBooking()) return;

    Alert.alert(
      "Confirm Appointment",
      `Are you sure you want to book this appointment?\n\n• Dr. ${doctor.user_id?.name || doctor.name}\n• ${selectedDate.toDateString()} at ${selectedTime}\n• Fee: $${doctor.consultation_fee || "150"}`,
      [
        { text: "Edit", style: "cancel" },
        { text: "Confirm", onPress: submitBooking, style: "default" },
      ],
    );
  };

  const submitBooking = async () => {
    setIsLoading(true);
    try {
      const token = await AsyncStorage.getItem("authToken");
      const userDataString = await AsyncStorage.getItem("userData");

      let user_id = null;
      if (userDataString) {
        const userData = JSON.parse(userDataString);
        user_id = userData._id || userData.user_id || userData.id || null;
      }

      if (!user_id || !token) {
        Alert.alert("Authentication Error", "Please log in again.");
        setIsLoading(false);
        return;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const selected = new Date(selectedDate);
      selected.setHours(0, 0, 0, 0);

      if (selected <= today) {
        Alert.alert(
          "Invalid Date",
          "Appointments can only be booked for tomorrow onwards.",
        );
        setIsLoading(false);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/patient/appointments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          doctor_id: doctor._id,
          user_id,
          specialty_id: doctor.specialty_id,
          appointment_date: selectedDate.toISOString().split("T")[0],
          time_slot: selectedTime,
          reason: symptoms || "General consultation",
          notes,
          status: "pending",
        }),
      });

      if (response.ok) {
        Alert.alert(
          "Booking Confirmed! 🎉",
          `Your appointment has been confirmed.\n\nA confirmation has been sent to your email.`,
          [{ text: "Done", onPress: () => navigation.navigate("Home") }],
        );
      } else {
        const errorText = await response.text();
        let errorMessage = "Booking failed. Please try again.";
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorMessage;
        } catch (e) {
          console.error("Error parsing response:", e);
        }
        throw new Error(errorMessage);
      }
    } catch (error) {
      Alert.alert(
        "Booking Failed",
        error instanceof Error
          ? error.message
          : "Network error. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  // ==================== RENDER STEPS ====================

  const renderDatePickerSection = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    return (
      <Animated.View
        style={[
          styles.section,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
        <View style={styles.sectionHeader}>
          <Ionicons name="calendar-outline" size={24} color="#1976d2" />
          <Text style={styles.sectionTitle}>Select Date & Time</Text>
        </View>

        <View style={styles.dateContainer}>
          <Text style={styles.dateLabel}>Appointment Date</Text>
          <TouchableOpacity
            style={styles.datePickerButton}
            onPress={() => setShowDatePicker(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="calendar" size={20} color="#1976d2" />
            <Text style={styles.dateText}>
              {selectedDate.toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </Text>
            <Ionicons name="chevron-forward" size={16} color="#666" />
          </TouchableOpacity>
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={handleDateChange}
            minimumDate={tomorrow}
            maximumDate={new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)}
          />
        )}

        <TimeSlotPicker
          slots={availableSlots}
          selectedTime={selectedTime}
          onSelectTime={setSelectedTime}
          loading={loadingSlots}
        />

        <View style={styles.navigationButtons}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={18} color="#1976d2" />
            <Text style={styles.backButtonText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.nextButton,
              !selectedTime && styles.nextButtonDisabled,
            ]}
            onPress={() => setCurrentStep(2)}
            disabled={!selectedTime}
          >
            <Text style={styles.nextButtonText}>Continue</Text>
            <Ionicons name="arrow-forward" size={18} color="white" />
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  };

  const renderSymptomsSection = () => (
    <Animated.View
      style={[
        styles.section,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}
    >
      <SymptomsInput
        symptoms={symptoms}
        notes={notes}
        onSymptomsChange={setSymptoms}
        onNotesChange={setNotes}
        onAddSymptom={handleAddSymptom}
      />

      <View style={styles.navigationButtons}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setCurrentStep(1)}
        >
          <Ionicons name="arrow-back" size={18} color="#1976d2" />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.nextButton,
            symptoms.length < 5 && styles.nextButtonDisabled,
          ]}
          onPress={() => setCurrentStep(3)}
          disabled={symptoms.length < 5}
        >
          <Text style={styles.nextButtonText}>Review</Text>
          <Ionicons name="arrow-forward" size={18} color="white" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  const renderConfirmationSection = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selected = new Date(selectedDate);
    selected.setHours(0, 0, 0, 0);
    const isDateValid = selected > today;

    return (
      <Animated.View
        style={[
          styles.section,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
        <View style={styles.confirmationHeader}>
          <View style={styles.confirmationIcon}>
            <Ionicons name="checkmark-circle" size={60} color="#4CAF50" />
          </View>
          <Text style={styles.confirmationTitle}>Review Your Booking</Text>
          <Text style={styles.confirmationSubtitle}>
            Please verify all details before confirming
          </Text>
        </View>

        {!isDateValid && (
          <View style={styles.warningBox}>
            <Ionicons name="warning" size={20} color="#ff9800" />
            <Text style={styles.warningText}>
              The selected date has passed. Please select a future date.
            </Text>
          </View>
        )}

        <View style={styles.summaryCard}>
          <View style={styles.summarySection}>
            <Text style={styles.summarySectionTitle}>Appointment Details</Text>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Doctor</Text>
              <Text style={styles.summaryValue}>
                Dr. {doctor.user_id?.name || doctor.name}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Specialty</Text>
              <Text style={styles.summaryValue}>
                {doctor.specialty_id?.name ||
                  doctor.specialty ||
                  "General Practice"}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Date & Time</Text>
              <Text style={styles.summaryValue}>
                {selectedDate.toLocaleDateString()} at {selectedTime}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Consultation Fee</Text>
              <Text style={[styles.summaryValue, styles.feeText]}>
                ${doctor.consultation_fee || "150"}
              </Text>
            </View>
          </View>

          <View style={styles.summarySection}>
            <Text style={styles.summarySectionTitle}>Symptoms</Text>
            <Text style={styles.symptomsSummary}>
              {symptoms || "General consultation"}
            </Text>
            {notes ? (
              <View style={styles.notesSummary}>
                <Text style={styles.notesLabel}>Additional notes:</Text>
                <Text style={styles.notesText}>{notes}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.totalContainer}>
          <Text style={styles.totalLabel}>Total Amount</Text>
          <Text style={styles.totalAmount}>
            ${doctor.consultation_fee || "150"}
          </Text>
        </View>

        <View style={styles.navigationButtons}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setCurrentStep(2)}
          >
            <Ionicons name="arrow-back" size={18} color="#1976d2" />
            <Text style={styles.backButtonText}>Edit</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.confirmButton,
              (isLoading || !isDateValid) && styles.confirmButtonDisabled,
            ]}
            onPress={showConfirmation}
            disabled={isLoading || !isDateValid}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="white" />
                <Text style={styles.confirmButtonText}>
                  {isDateValid ? "Confirm Booking" : "Invalid Date"}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  };

  // ==================== MAIN RENDER ====================

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={["#1976d2", "#1565c0"]}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.backButtonHeader}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={28} color="white" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Book Appointment</Text>
            <Text style={styles.headerSubtitle}>Step {currentStep} of 3</Text>
          </View>
          <View style={styles.headerPlaceholder} />
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#1976d2"]}
            tintColor="#1976d2"
          />
        }
      >
        <DoctorCard doctor={doctor} />
        <StepIndicator currentStep={currentStep} />

        {currentStep === 1 && renderDatePickerSection()}
        {currentStep === 2 && renderSymptomsSection()}
        {currentStep === 3 && renderConfirmationSection()}

        <View style={styles.spacer} />
      </ScrollView>
    </SafeAreaView>
  );
};

// ==================== STYLES ====================

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#f8f9fa",
    flex: 1,
  },

  // Fallback screen styles
  fallbackContainer: {
    alignItems: "center",
    backgroundColor: "#f8f9fa",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  fallbackTitle: {
    color: "#333",
    fontSize: 20,
    fontWeight: "700",
    marginTop: 16,
    textAlign: "center",
  },
  fallbackSubtitle: {
    color: "#666",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    textAlign: "center",
  },
  fallbackButton: {
    backgroundColor: "#1976d2",
    borderRadius: 12,
    marginTop: 28,
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  fallbackButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },

  header: {
    paddingBottom: 20,
    paddingTop: Platform.OS === "ios" ? 10 : 20,
  },
  headerContent: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  backButtonHeader: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  headerTitleContainer: {
    alignItems: "center",
  },
  headerTitle: {
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 2,
  },
  headerSubtitle: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 12,
  },
  headerPlaceholder: {
    width: 44,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    marginBottom: 20,
  },
  sectionTitle: {
    color: "#333",
    fontSize: 18,
    fontWeight: "bold",
    marginLeft: 8,
  },
  dateContainer: {
    marginBottom: 20,
  },
  dateLabel: {
    color: "#666",
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 8,
  },
  datePickerButton: {
    alignItems: "center",
    backgroundColor: "#f8f9fa",
    borderColor: "#e0e0e0",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    padding: 16,
  },
  dateText: {
    color: "#333",
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
    marginLeft: 12,
  },
  navigationButtons: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  backButton: {
    alignItems: "center",
    backgroundColor: "white",
    borderColor: "#1976d2",
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backButtonText: {
    color: "#1976d2",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 6,
  },
  nextButton: {
    alignItems: "center",
    backgroundColor: "#1976d2",
    borderRadius: 10,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  nextButtonDisabled: {
    backgroundColor: "#b0bec5",
  },
  nextButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  confirmButton: {
    alignItems: "center",
    backgroundColor: "#4CAF50",
    borderRadius: 10,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  confirmButtonDisabled: {
    backgroundColor: "#81c784",
    opacity: 0.6,
  },
  confirmButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  confirmationHeader: {
    alignItems: "center",
    marginBottom: 24,
  },
  confirmationIcon: {
    marginBottom: 16,
  },
  confirmationTitle: {
    color: "#333",
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 8,
  },
  confirmationSubtitle: {
    color: "#666",
    fontSize: 14,
    textAlign: "center",
  },
  warningBox: {
    alignItems: "center",
    backgroundColor: "#fff8e1",
    borderColor: "#ffecb3",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
    padding: 16,
  },
  warningText: {
    color: "#ff6f00",
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
  },
  summaryCard: {
    backgroundColor: "white",
    borderColor: "#e0e0e0",
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
    padding: 16,
  },
  summarySection: {
    marginBottom: 20,
  },
  summarySectionTitle: {
    borderBottomColor: "#f0f0f0",
    borderBottomWidth: 1,
    color: "#333",
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 12,
    paddingBottom: 8,
  },
  summaryRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  summaryLabel: {
    color: "#666",
    fontSize: 14,
  },
  summaryValue: {
    color: "#333",
    fontSize: 14,
    fontWeight: "500",
    textAlign: "right",
  },
  feeText: {
    color: "#4CAF50",
    fontWeight: "bold",
  },
  symptomsSummary: {
    color: "#333",
    fontSize: 14,
    lineHeight: 20,
  },
  notesSummary: {
    borderTopColor: "#f0f0f0",
    borderTopWidth: 1,
    marginTop: 12,
    paddingTop: 12,
  },
  notesLabel: {
    color: "#666",
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 4,
  },
  notesText: {
    color: "#333",
    fontSize: 14,
    lineHeight: 20,
  },
  totalContainer: {
    alignItems: "center",
    backgroundColor: "#f8f9fa",
    borderColor: "#e0e0e0",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
    padding: 20,
  },
  totalLabel: {
    color: "#666",
    fontSize: 16,
    fontWeight: "500",
  },
  totalAmount: {
    color: "#1976d2",
    fontSize: 24,
    fontWeight: "bold",
  },
  spacer: {
    height: 20,
  },
});

export default BookingScreen;
