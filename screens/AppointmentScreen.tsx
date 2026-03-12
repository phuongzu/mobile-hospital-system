// screens/BookingScreen.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
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
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

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

const API_BASE_URL = 'http://localhost:3000';

// ==================== STEP INDICATOR ====================

const StepIndicator: React.FC<{ currentStep: number }> = ({ currentStep }) => {
  const steps = [
    { id: 1, label: 'Date & Time', icon: 'calendar-outline' },
    { id: 2, label: 'Symptoms', icon: 'medical-outline' },
    { id: 3, label: 'Confirm', icon: 'checkmark-circle-outline' },
  ];

  return (
    <View style={stepStyles.container}>
      {steps.map((step, index) => (
        <React.Fragment key={step.id}>
          <View style={stepStyles.stepItem}>
            <View
              style={[
                stepStyles.stepCircle,
                currentStep >= step.id ? stepStyles.stepCircleActive : stepStyles.stepCircleInactive,
                currentStep === step.id && stepStyles.stepCircleCurrent,
              ]}
            >
              {currentStep > step.id ? (
                <Ionicons name="checkmark" size={20} color="white" />
              ) : (
                <Ionicons
                  name={step.icon as any}
                  size={currentStep === step.id ? 18 : 16}
                  color={currentStep >= step.id ? 'white' : '#999'}
                />
              )}
            </View>
            <Text
              style={[
                stepStyles.stepLabel,
                currentStep >= step.id ? stepStyles.stepLabelActive : stepStyles.stepLabelInactive,
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
                currentStep > step.id ? stepStyles.connectorActive : stepStyles.connectorInactive,
              ]}
            />
          )}
        </React.Fragment>
      ))}
    </View>
  );
};

const stepStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 32,
    paddingHorizontal: 10,
  },
  stepItem: {
    alignItems: 'center',
    flex: 1,
  },
  stepCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 2,
  },
  stepCircleActive: {
    backgroundColor: '#1976d2',
    borderColor: '#1976d2',
  },
  stepCircleInactive: {
    backgroundColor: 'white',
    borderColor: '#e0e0e0',
  },
  stepCircleCurrent: {
    shadowColor: '#1976d2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    transform: [{ scale: 1.1 }],
  },
  stepLabel: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 4,
  },
  stepLabelActive: {
    color: '#1976d2',
    fontWeight: '600',
  },
  stepLabelInactive: {
    color: '#999',
  },
  stepLabelCurrent: {
    fontWeight: 'bold',
  },
  connector: {
    flex: 1,
    height: 2,
    marginHorizontal: 4,
    marginBottom: 20,
  },
  connectorActive: {
    backgroundColor: '#1976d2',
  },
  connectorInactive: {
    backgroundColor: '#e0e0e0',
  },
});

// ==================== DOCTOR CARD ====================

const DoctorCard: React.FC<{ doctor: Doctor }> = ({ doctor }) => {
  return (
    <View style={doctorCardStyles.container}>
      <LinearGradient
        colors={['#1976d2', '#1565c0']}
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
              Dr. {doctor.user_id?.name || doctor.name || 'Unknown Doctor'}
            </Text>
            <Text style={doctorCardStyles.specialty}>
              {doctor.specialty_id?.name || doctor.specialty || 'General Practice'}
            </Text>
          </View>
        </View>
      </LinearGradient>

      <View style={doctorCardStyles.content}>
        <View style={doctorCardStyles.statsRow}>
          {doctor.years_of_experience !== undefined && (
            <View style={doctorCardStyles.statItem}>
              <Ionicons name="time-outline" size={16} color="#1976d2" />
              <Text style={doctorCardStyles.statText}>{doctor.years_of_experience} years</Text>
            </View>
          )}

          {doctor.rating !== undefined && (
            <View style={doctorCardStyles.statItem}>
              <Ionicons name="star" size={16} color="#FFD700" />
              <Text style={doctorCardStyles.statText}>{doctor.rating.toFixed(1)}</Text>
            </View>
          )}

          {doctor.consultation_fee !== undefined && (
            <View style={doctorCardStyles.statItem}>
              <Ionicons name="pricetag" size={16} color="#4CAF50" />
              <Text style={doctorCardStyles.statText}>${doctor.consultation_fee}</Text>
            </View>
          )}
        </View>

        <View style={doctorCardStyles.availabilityContainer}>
          {doctor.isAvailable ? (
            <View style={doctorCardStyles.availableBadge}>
              <View style={doctorCardStyles.availabilityDot} />
              <Text style={doctorCardStyles.availabilityText}>Available Today</Text>
            </View>
          ) : (
            <View style={doctorCardStyles.busyBadge}>
              <Ionicons name="time" size={12} color="white" />
              <Text style={doctorCardStyles.availabilityText}>Currently Busy</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

const doctorCardStyles = StyleSheet.create({
  container: {
    borderRadius: 20,
    marginBottom: 24,
    backgroundColor: 'white',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    marginRight: 16,
  },
  headerInfo: {
    flex: 1,
  },
  doctorName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  specialty: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  content: {
    padding: 20,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f7fa',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  statText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  availabilityContainer: {
    alignItems: 'center',
  },
  availableBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  busyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffebee',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ff6b6b',
  },
  availabilityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
    marginRight: 8,
  },
  availabilityText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
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
        <Text style={timeSlotStyles.loadingText}>Loading available slots...</Text>
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
            <View style={[timeSlotStyles.legendDot, timeSlotStyles.legendAvailable]} />
            <Text style={timeSlotStyles.legendText}>Available</Text>
          </View>
          <View style={timeSlotStyles.legendItem}>
            <View style={[timeSlotStyles.legendDot, timeSlotStyles.legendBooked]} />
            <Text style={timeSlotStyles.legendText}>Booked</Text>
          </View>
          <View style={timeSlotStyles.legendItem}>
            <View style={[timeSlotStyles.legendDot, timeSlotStyles.legendSelected]} />
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
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    marginBottom: 20,
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 8,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  legendAvailable: {
    backgroundColor: '#4CAF50',
  },
  legendBooked: {
    backgroundColor: '#ff6b6b',
  },
  legendSelected: {
    backgroundColor: '#1976d2',
  },
  legendText: {
    fontSize: 12,
    color: '#666',
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
    fontSize: 14,
  },
  slotsContainer: {
    paddingBottom: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  slot: {
    width: (width - 80) / 3 - 4,
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  slotAvailable: {
    backgroundColor: '#f0f7ff',
    borderWidth: 1,
    borderColor: '#1976d2',
  },
  slotSelected: {
    backgroundColor: '#1976d2',
    borderWidth: 2,
    borderColor: '#1976d2',
  },
  slotUnavailable: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  slotText: {
    fontSize: 14,
    fontWeight: '500',
  },
  slotTextAvailable: {
    color: '#1976d2',
  },
  slotTextSelected: {
    color: 'white',
  },
  slotTextUnavailable: {
    color: '#999',
  },
  slotIcon: {
    position: 'absolute',
    top: 4,
    right: 4,
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
  const commonSymptoms = ['Fever', 'Headache', 'Cough', 'Sore throat', 'Fatigue', 'Body aches'];

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
        <Text style={symptomsStyles.inputLabel}>Additional Notes (Optional)</Text>
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
  container: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 8,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  symptomsInput: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    minHeight: 100,
    fontSize: 14,
    color: '#333',
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  charCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginTop: 4,
  },
  suggestionsContainer: {
    marginBottom: 20,
  },
  suggestionsTitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  suggestionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  symptomChip: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  symptomChipText: {
    fontSize: 12,
    color: '#1976d2',
    fontWeight: '500',
  },
  notesInput: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    minHeight: 80,
    fontSize: 14,
    color: '#333',
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#e0e0e0',
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
          _id: params.doctorId ?? params.initialData?.doctor_id ?? '',
          name:
            params.initialData?.doctor_name ??
            params.initialData?.doctorName ??
            'Unknown Doctor',
          email: '',
          specialty: params.initialData?.specialty ?? '',
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
  const [selectedTime, setSelectedTime] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [symptoms, setSymptoms] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [currentStep, setCurrentStep] = useState(1);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(30))[0];

  const timeSlots = [
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
  ];

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
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  };

  const fetchAvailableSlots = async () => {
    setLoadingSlots(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      const formattedDate = selectedDate.toISOString().split('T')[0];

      const response = await fetch(
        `${API_BASE_URL}/api/patient/appointments/availability?doctor_id=${doctor._id}&date=${formattedDate}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const data = await response.json();

        const slots = timeSlots.map(time => {
          const slotData = data.availableSlots?.find((s: any) => s.time === time);
          return {
            time,
            isAvailable: slotData ? slotData.isAvailable : true,
            isReserved: slotData ? slotData.isReserved : false,
            isBooked: slotData ? !slotData.isAvailable : false,
            bookedInfo: slotData?.bookedInfo || null,
          };
        });

        setAvailableSlots(slots);

        if (data.summary?.isFullyBooked) {
          Alert.alert(
            'Fully Booked',
            `No available time slots for ${selectedDate.toDateString()}. Please select another date.`
          );
        }
      } else {
        simulateAvailableSlots();
      }
    } catch (error) {
      console.error('Error fetching slots:', error);
      simulateAvailableSlots();
    } finally {
      setLoadingSlots(false);
      setRefreshing(false);
    }
  };

  const simulateAvailableSlots = () => {
    const slots = timeSlots.map((time, index) => ({
      time,
      isAvailable: index % 3 !== 0,
      isReserved: index % 4 === 0,
      isBooked: index % 5 === 0,
    }));
    setAvailableSlots(slots);
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAvailableSlots();
  }, [selectedDate]);

  const handleDateChange = (event: any, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (date) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const selected = new Date(date);
      selected.setHours(0, 0, 0, 0);

      if (selected <= today) {
        Alert.alert('Invalid Date', 'Please select a date starting from tomorrow.');
        return;
      }

      setSelectedDate(date);
      setSelectedTime('');
    }
  };

  const handleAddSymptom = (symptom: string) => {
    const newSymptoms = symptoms ? `${symptoms}, ${symptom}` : symptom;
    setSymptoms(newSymptoms);
  };

  const validateBooking = () => {
    if (!selectedTime) {
      Alert.alert('Select Time', 'Please select a time slot for your appointment');
      return false;
    }

    const selectedSlot = availableSlots.find(slot => slot.time === selectedTime);
    if (selectedSlot?.isReserved || selectedSlot?.isBooked) {
      Alert.alert(
        'Slot Unavailable',
        'This time slot is no longer available. Please choose a different time.'
      );
      return false;
    }

    if (!selectedSlot?.isAvailable) {
      Alert.alert(
        'Slot Unavailable',
        'This time slot is not available. Please choose a different time.'
      );
      return false;
    }

    if (symptoms.length > 0 && symptoms.length < 5) {
      Alert.alert(
        'Symptoms Description',
        'Please provide a more detailed description of your symptoms (minimum 5 characters)'
      );
      return false;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selected = new Date(selectedDate);
    selected.setHours(0, 0, 0, 0);

    if (selected <= today) {
      Alert.alert('Invalid Date', 'Appointments can only be booked for tomorrow onwards.');
      return false;
    }

    return true;
  };

  const showConfirmation = () => {
    if (!validateBooking()) return;

    Alert.alert(
      'Confirm Appointment',
      `Are you sure you want to book this appointment?\n\n• Dr. ${doctor.user_id?.name || doctor.name}\n• ${selectedDate.toDateString()} at ${selectedTime}\n• Fee: $${doctor.consultation_fee || '150'}`,
      [
        { text: 'Edit', style: 'cancel' },
        { text: 'Confirm', onPress: submitBooking, style: 'default' },
      ]
    );
  };

  const submitBooking = async () => {
    setIsLoading(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      const userDataString = await AsyncStorage.getItem('userData');

      let user_id = null;
      if (userDataString) {
        const userData = JSON.parse(userDataString);
        user_id = userData._id || userData.user_id || userData.id || null;
      }

      if (!user_id || !token) {
        Alert.alert('Authentication Error', 'Please log in again.');
        setIsLoading(false);
        return;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const selected = new Date(selectedDate);
      selected.setHours(0, 0, 0, 0);

      if (selected <= today) {
        Alert.alert('Invalid Date', 'Appointments can only be booked for tomorrow onwards.');
        setIsLoading(false);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/patient/appointments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          doctor_id: doctor._id,
          user_id,
          specialty_id: doctor.specialty_id,
          appointment_date: selectedDate.toISOString().split('T')[0],
          time_slot: selectedTime,
          reason: symptoms || 'General consultation',
          notes,
          status: 'pending',
        }),
      });

      if (response.ok) {
        Alert.alert(
          'Booking Confirmed! 🎉',
          `Your appointment has been confirmed.\n\nA confirmation has been sent to your email.`,
          [{ text: 'Done', onPress: () => navigation.navigate('Home') }]
        );
      } else {
        const errorText = await response.text();
        let errorMessage = 'Booking failed. Please try again.';
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorMessage;
        } catch (e) {
          console.error('Error parsing response:', e);
        }
        throw new Error(errorMessage);
      }
    } catch (error) {
      Alert.alert(
        'Booking Failed',
        error instanceof Error ? error.message : 'Network error. Please try again.'
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
        style={[styles.section, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
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
              {selectedDate.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </Text>
            <Ionicons name="chevron-forward" size={16} color="#666" />
          </TouchableOpacity>
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
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
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={18} color="#1976d2" />
            <Text style={styles.backButtonText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.nextButton, !selectedTime && styles.nextButtonDisabled]}
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
      style={[styles.section, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
    >
      <SymptomsInput
        symptoms={symptoms}
        notes={notes}
        onSymptomsChange={setSymptoms}
        onNotesChange={setNotes}
        onAddSymptom={handleAddSymptom}
      />

      <View style={styles.navigationButtons}>
        <TouchableOpacity style={styles.backButton} onPress={() => setCurrentStep(1)}>
          <Ionicons name="arrow-back" size={18} color="#1976d2" />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.nextButton, symptoms.length < 5 && styles.nextButtonDisabled]}
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
        style={[styles.section, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
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
                {doctor.specialty_id?.name || doctor.specialty || 'General Practice'}
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
                ${doctor.consultation_fee || '150'}
              </Text>
            </View>
          </View>

          <View style={styles.summarySection}>
            <Text style={styles.summarySectionTitle}>Symptoms</Text>
            <Text style={styles.symptomsSummary}>{symptoms || 'General consultation'}</Text>
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
          <Text style={styles.totalAmount}>${doctor.consultation_fee || '150'}</Text>
        </View>

        <View style={styles.navigationButtons}>
          <TouchableOpacity style={styles.backButton} onPress={() => setCurrentStep(2)}>
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
                  {isDateValid ? 'Confirm Booking' : 'Invalid Date'}
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
        colors={['#1976d2', '#1565c0']}
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
            colors={['#1976d2']}
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
    flex: 1,
    backgroundColor: '#f8f9fa',
  },

  // Fallback screen styles
  fallbackContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  fallbackTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginTop: 16,
    textAlign: 'center',
  },
  fallbackSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  fallbackButton: {
    marginTop: 28,
    backgroundColor: '#1976d2',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  fallbackButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },

  header: {
    paddingTop: Platform.OS === 'ios' ? 10 : 20,
    paddingBottom: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  backButtonHeader: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
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
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 8,
  },
  dateContainer: {
    marginBottom: 20,
  },
  dateLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    fontWeight: '500',
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  dateText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
    fontWeight: '500',
  },
  navigationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1976d2',
    backgroundColor: 'white',
  },
  backButtonText: {
    color: '#1976d2',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 6,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1976d2',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    gap: 6,
  },
  nextButtonDisabled: {
    backgroundColor: '#b0bec5',
  },
  nextButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 10,
    gap: 8,
  },
  confirmButtonDisabled: {
    backgroundColor: '#81c784',
    opacity: 0.6,
  },
  confirmButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  confirmationHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  confirmationIcon: {
    marginBottom: 16,
  },
  confirmationTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  confirmationSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff8e1',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#ffecb3',
    gap: 12,
  },
  warningText: {
    flex: 1,
    color: '#ff6f00',
    fontSize: 14,
    fontWeight: '500',
  },
  summaryCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    padding: 16,
    marginBottom: 20,
  },
  summarySection: {
    marginBottom: 20,
  },
  summarySectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    textAlign: 'right',
  },
  feeText: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  symptomsSummary: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  notesSummary: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  notesLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  totalContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  totalLabel: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1976d2',
  },
  spacer: {
    height: 20,
  },
});

export default BookingScreen;