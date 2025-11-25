// screens/BookingScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

interface Doctor {
  _id: string;
  name: string;
  email: string;
  phoneNumber?: string;
  specialty?: string;
  specialty_id?: string;
  consultation_fee?: number;
  rating?: number;
  years_of_experience?: number;
  isAvailable?: boolean;
}

interface TimeSlot {
  time: string;
  isAvailable: boolean;
  isReserved: boolean;
  reservedBy?: string;
}

interface BookingScreenProps {
  route: any;
  navigation: any;
}

const API_BASE_URL = 'http://localhost:3000';

const BookingScreen: React.FC<BookingScreenProps> = ({ route, navigation }) => {
  const { doctor } = route.params as { doctor: Doctor };
  const [selectedDate, setSelectedDate] = useState(new Date());
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
  const slideAnim = useState(new Animated.Value(50))[0];

  const timeSlots = [
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'
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
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
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
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        const slots = timeSlots.map(time => {
          const slotData = data.availableSlots?.find((slot: any) => slot.time === time);
          return {
            time,
            isAvailable: slotData ? slotData.isAvailable : false,
            isReserved: slotData ? slotData.isReserved : false,
            reservedBy: slotData?.reservedBy
          };
        });
        setAvailableSlots(slots);
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
    const available = timeSlots.map((time, index) => ({
      time,
      isAvailable: index % 3 !== 0,
      isReserved: index % 4 === 0,
      reservedBy: index % 4 === 0 ? 'Another patient' : undefined
    }));
    setAvailableSlots(available);
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAvailableSlots();
  }, []);

  const handleDateChange = (event: any, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (date) {
      setSelectedDate(date);
      setSelectedTime('');
    }
  };

  const getSlotStatus = (time: string) => {
    const slot = availableSlots.find(s => s.time === time);
    if (!slot) return 'loading';
    if (slot.isReserved) return 'reserved';
    if (!slot.isAvailable) return 'unavailable';
    return selectedTime === time ? 'selected' : 'available';
  };

  const validateBooking = () => {
    if (!selectedTime) {
      Alert.alert('Select Time', 'Please select a time slot for your appointment');
      return false;
    }

    const selectedSlot = availableSlots.find(slot => slot.time === selectedTime);
    if (selectedSlot?.isReserved) {
      Alert.alert('Slot Reserved', 'This time slot has been reserved by another patient. Please choose a different time.');
      return false;
    }

    if (!selectedSlot?.isAvailable) {
      Alert.alert('Slot Unavailable', 'This time slot is no longer available. Please choose a different time.');
      return false;
    }

    if (symptoms.length < 5 && symptoms.length > 0) {
      Alert.alert('Symptoms Description', 'Please provide a more detailed description of your symptoms (minimum 5 characters)');
      return false;
    }

    return true;
  };

  const showConfirmation = () => {
    if (!validateBooking()) return;

    Alert.alert(
      'Confirm Appointment',
      `Appointment Details:\n\n• Doctor: Dr. ${doctor.user_id?.name || 'Unknown Doctor'}\n• Specialty: ${doctor.specialty_id?.name || 'General Practitioner'}\n• Date: ${selectedDate.toDateString()}\n• Time: ${selectedTime}\n• Fee: $${doctor.consultation_fee || '150'}\n\nProceed with booking?`,
      [
        { text: 'Edit Details', style: 'cancel' },
        { 
          text: 'Confirm Booking', 
          onPress: submitBooking,
          style: 'default'
        }
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

      if (!doctor?._id || !selectedDate || !selectedTime) {
        Alert.alert('Validation Error', 'Please fill all required fields.');
        setIsLoading(false);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/patient/appointments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          doctor_id: doctor._id,
          user_id: user_id,
          specialty_id: doctor.specialty_id,
          appointment_date: selectedDate.toISOString().split('T')[0],
          time_slot: selectedTime,
          reason: symptoms || 'General consultation',
          notes: notes,
          status: 'pending'
        })
      });

      if (response.ok) {
        const appointment = await response.json();
        
        Alert.alert(
          'Booking Confirmed! 🎉',
          `Your appointment with Dr. ${doctor.user_id?.name || 'Unknown Doctor'} has been confirmed.\n\nDate: ${selectedDate.toDateString()}\nTime: ${selectedTime}\nFee: $${doctor.consultation_fee || '150'}`,
          [
            {
              text: 'View Details',
              onPress: () => navigation.navigate('AppointmentDetails', { 
                appointmentId: appointment._id 
              })
            },
            {
              text: 'Back to Home',
              onPress: () => navigation.navigate('Home')
            }
          ]
        );
      } else {
        const errorText = await response.text();
        let errorMessage = 'Booking failed. Please try again.';
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorMessage;
          
          if (errorData.conflict) {
            errorMessage = 'This time slot has been booked by another patient. Please choose a different time.';
          }
        } catch (e) {
          errorMessage = errorText || errorMessage;
        }
        
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('Booking error details:', error);
      Alert.alert(
        'Booking Failed',
        error instanceof Error ? error.message : 'Network error. Please check your connection and try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const renderStepIndicator = () => (
    <View style={styles.stepContainer}>
      {[1, 2, 3].map((step) => (
        <View key={step} style={styles.stepRow}>
          <View style={[
            styles.stepCircle,
            currentStep >= step ? styles.stepCircleActive : styles.stepCircleInactive
          ]}>
            <Text style={[
              styles.stepText,
              currentStep >= step ? styles.stepTextActive : styles.stepTextInactive
            ]}>
              {step}
            </Text>
          </View>
          {step < 3 && <View style={[
            styles.stepLine,
            currentStep > step ? styles.stepLineActive : styles.stepLineInactive
          ]} />}
        </View>
      ))}
      <View style={styles.stepLabels}>
        <Text style={styles.stepLabel}>Date & Time</Text>
        <Text style={styles.stepLabel}>Symptoms</Text>
        <Text style={styles.stepLabel}>Confirm</Text>
      </View>
    </View>
  );

  const renderDoctorInfo = () => (
    <View style={styles.doctorCard}>
      <View style={styles.doctorAvatar}>
        <Ionicons name="person-circle" size={50} color="#1976d2" />
      </View>
      <View style={styles.doctorInfo}>
          <Text style={styles.name}>Dr. {doctor.user_id?.name || 'Unknown Doctor'}</Text>
          <Text style={styles.specialty}>{doctor.specialty_id?.name || 'General Practice'}</Text>
        <View style={styles.doctorDetails}>
          {doctor.years_of_experience && (
            <Text style={styles.doctorDetail}>
              <Ionicons name="time-outline" size={12} /> {doctor.years_of_experience} years exp
            </Text>
          )}
          {doctor.rating && (
            <Text style={styles.doctorDetail}>
              <Ionicons name="star" size={12} /> {doctor.rating.toFixed(1)} rating
            </Text>
          )}
          {doctor.consultation_fee && (
            <Text style={styles.doctorDetail}>
              <Ionicons name="pricetag" size={12} /> ${doctor.consultation_fee}
            </Text>
          )}
        </View>
        {!doctor.isAvailable && (
          <View style={styles.availabilityBadge}>
            <Ionicons name="time" size={12} color="#fff" />
            <Text style={styles.availabilityText}>Currently busy</Text>
          </View>
        )}
      </View>
    </View>
  );

  const renderDateTimeSection = () => (
    <Animated.View 
      style={[
        styles.section,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
      ]}
    >
      <View style={styles.sectionHeader}>
        <Ionicons name="time-outline" size={20} color="#1976d2" />
        <Text style={styles.sectionTitle}>Select Date & Time</Text>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
          <Ionicons name="refresh" size={16} color="#1976d2" />
          <Text style={styles.refreshText}>Refresh</Text>
        </TouchableOpacity>
      </View>
      
      <TouchableOpacity 
        style={styles.datePickerButton}
        onPress={() => setShowDatePicker(true)}
      >
        <Ionicons name="calendar-outline" size={20} color="#1976d2" />
        <Text style={styles.dateText}>
          {selectedDate.toDateString()}
        </Text>
        <Ionicons name="chevron-forward" size={16} color="#666" />
      </TouchableOpacity>

      {showDatePicker && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleDateChange}
          minimumDate={new Date()}
          maximumDate={new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)}
        />
      )}

      <Text style={styles.timeSectionTitle}>Available Time Slots</Text>
      
      {loadingSlots ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#1976d2" />
          <Text style={styles.loadingText}>Checking availability...</Text>
        </View>
      ) : (
        <View style={styles.timeSlotsContainer}>
          {availableSlots.map((slot) => {
            const status = getSlotStatus(slot.time);
            
            return (
              <TouchableOpacity
                key={slot.time}
                style={[
                  styles.timeSlot,
                  status === 'selected' && styles.timeSlotSelected,
                  status === 'unavailable' && styles.timeSlotUnavailable,
                  status === 'reserved' && styles.timeSlotReserved,
                  status === 'loading' && styles.timeSlotLoading
                ]}
                onPress={() => status === 'available' && setSelectedTime(slot.time)}
                disabled={status !== 'available'}
              >
                <Text style={[
                  styles.timeSlotText,
                  status === 'selected' && styles.timeSlotTextSelected,
                  status === 'unavailable' && styles.timeSlotTextUnavailable,
                  status === 'reserved' && styles.timeSlotTextReserved,
                ]}>
                  {slot.time}
                </Text>
                
                {status === 'unavailable' && (
                  <Ionicons name="close-circle" size={16} color="#ff6b6b" />
                )}
                {status === 'reserved' && (
                  <Ionicons name="lock-closed" size={16} color="#ffa726" />
                )}
                {status === 'loading' && (
                  <ActivityIndicator size="small" color="#666" />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <View style={styles.legendContainer}>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, styles.legendAvailable]} />
          <Text style={styles.legendText}>Available</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, styles.legendReserved]} />
          <Text style={styles.legendText}>Reserved</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, styles.legendUnavailable]} />
          <Text style={styles.legendText}>Unavailable</Text>
        </View>
      </View>

      <TouchableOpacity 
        style={[styles.nextButton, !selectedTime && styles.nextButtonDisabled]}
        onPress={() => setCurrentStep(2)}
        disabled={!selectedTime}
      >
        <Text style={styles.nextButtonText}>Next: Symptoms</Text>
        <Ionicons name="arrow-forward" size={16} color="white" />
      </TouchableOpacity>
    </Animated.View>
  );

  const renderSymptomsSection = () => (
    <Animated.View 
      style={[
        styles.section,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
      ]}
    >
      <View style={styles.sectionHeader}>
        <Ionicons name="medical-outline" size={20} color="#1976d2" />
        <Text style={styles.sectionTitle}>Tell Us About Your Symptoms</Text>
      </View>
      <Text style={styles.sectionSubtitle}>This helps the doctor prepare for your visit</Text>
      
      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Main Symptoms *</Text>
        <TextInput
          style={styles.symptomsInput}
          placeholder="Describe your symptoms in detail..."
          value={symptoms}
          onChangeText={setSymptoms}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          maxLength={500}
        />
        <Text style={styles.charCount}>{symptoms.length}/500 characters</Text>
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Additional Notes (Optional)</Text>
        <TextInput
          style={styles.notesInput}
          placeholder="Any additional information you'd like to share..."
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          maxLength={300}
        />
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => setCurrentStep(1)}
        >
          <Ionicons name="arrow-back" size={16} color="#1976d2" />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.nextButton, symptoms.length < 5 && styles.nextButtonDisabled]}
          onPress={() => setCurrentStep(3)}
          disabled={symptoms.length < 5}
        >
          <Text style={styles.nextButtonText}>Next: Review</Text>
          <Ionicons name="arrow-forward" size={16} color="white" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  const renderConfirmationSection = () => (
    <Animated.View 
      style={[
        styles.section,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
      ]}
    >
      <View style={styles.confirmationHeader}>
        <Ionicons name="checkmark-circle" size={60} color="#4CAF50" />
        <Text style={styles.confirmationTitle}>Review Your Appointment</Text>
      </View>

      <View style={styles.appointmentSummary}>
        <Text style={styles.summaryTitle}>Appointment Details</Text>
        
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Doctor</Text>
          <Text style={styles.summaryValue}>Dr. {doctor.user_id?.name || 'Unknown Doctor'}</Text>
        </View>
        
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Specialty</Text>
          <Text style={styles.summaryValue}>{doctor.specialty_id?.name || 'General Practitioner'}</Text>
        </View>
        
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Date & Time</Text>
          <Text style={styles.summaryValue}>
            {selectedDate.toDateString()} at {selectedTime}
          </Text>
        </View>
        
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Consultation Fee</Text>
          <Text style={styles.summaryValue}>
            ${doctor.consultation_fee || '150'}
          </Text>
        </View>
        
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Symptoms</Text>
          <Text style={styles.summaryValue}>
            {symptoms || 'General consultation'}
          </Text>
        </View>
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => setCurrentStep(2)}
        >
          <Ionicons name="arrow-back" size={16} color="#1976d2" />
          <Text style={styles.backButtonText}>Edit Details</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.bookButton, isLoading && styles.bookButtonDisabled]}
          onPress={showConfirmation}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <>
              <Text style={styles.bookButtonText}>Confirm Booking</Text>
              <Ionicons name="checkmark" size={16} color="white" />
            </>
          )}
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1976d2', '#1565c0']}
        style={styles.header}
      >
        <TouchableOpacity 
          style={styles.backButtonHeader}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Book Appointment</Text>
        <View style={styles.headerIcon}>
          <Ionicons name="calendar" size={24} color="white" />
        </View>
      </LinearGradient>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {renderDoctorInfo()}
        {renderStepIndicator()}

        {currentStep === 1 && renderDateTimeSection()}
        {currentStep === 2 && renderSymptomsSection()}
        {currentStep === 3 && renderConfirmationSection()}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 20,
  },
  backButtonHeader: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginLeft: -40,
  },
  headerIcon: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  doctorCard: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  doctorAvatar: {
    marginRight: 12,
  },
  doctorInfo: {
    flex: 1,
  },
  doctorName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  doctorSpecialty: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  doctorDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 8,
  },
  doctorDetail: {
    fontSize: 12,
    color: '#888',
    flexDirection: 'row',
    alignItems: 'center',
  },
  availabilityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ff6b6b',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  availabilityText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 4,
  },
  stepContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepCircleActive: {
    backgroundColor: '#1976d2',
  },
  stepCircleInactive: {
    backgroundColor: '#e0e0e0',
  },
  stepText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  stepTextActive: {
    color: 'white',
  },
  stepTextInactive: {
    color: '#999',
  },
  stepLine: {
    width: 40,
    height: 2,
    marginHorizontal: 8,
  },
  stepLineActive: {
    backgroundColor: '#1976d2',
  },
  stepLineInactive: {
    backgroundColor: '#e0e0e0',
  },
  stepLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    paddingHorizontal: 10,
  },
  stepLabel: {
    fontSize: 10,
    color: '#666',
    textAlign: 'center',
    width: 80,
  },
  section: {
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
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 8,
    flex: 1,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
  },
  refreshText: {
    fontSize: 12,
    color: '#1976d2',
    marginLeft: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  dateText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
  timeSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 8,
    color: '#666',
    fontSize: 14,
  },
  timeSlotsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  timeSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minWidth: (width - 64) / 3,
  },
  timeSlotSelected: {
    backgroundColor: '#1976d2',
  },
  timeSlotUnavailable: {
    backgroundColor: '#ffebee',
    opacity: 0.6,
  },
  timeSlotReserved: {
    backgroundColor: '#fff3e0',
    borderColor: '#ffa726',
    borderWidth: 1,
  },
  timeSlotLoading: {
    backgroundColor: '#f8f9fa',
    opacity: 0.6,
  },
  timeSlotText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  timeSlotTextSelected: {
    color: 'white',
  },
  timeSlotTextUnavailable: {
    color: '#ff6b6b',
    textDecorationLine: 'line-through',
  },
  timeSlotTextReserved: {
    color: '#ff9800',
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  legendAvailable: {
    backgroundColor: '#1976d2',
  },
  legendReserved: {
    backgroundColor: '#ffa726',
  },
  legendUnavailable: {
    backgroundColor: '#ff6b6b',
  },
  legendText: {
    fontSize: 12,
    color: '#666',
  },
  inputContainer: {
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
    textAlignVertical: 'top',
    fontSize: 14,
  },
  notesInput: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    minHeight: 80,
    textAlignVertical: 'top',
    fontSize: 14,
  },
  charCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginTop: 4,
  },
  buttonRow: {
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
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1976d2',
  },
  backButtonText: {
    color: '#1976d2',
    fontWeight: '600',
    marginLeft: 4,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1976d2',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    gap: 8,
  },
  nextButtonDisabled: {
    backgroundColor: '#ccc',
    opacity: 0.6,
  },
  nextButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  bookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 8,
    gap: 8,
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  bookButtonDisabled: {
    backgroundColor: '#81c784',
  },
  bookButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  confirmationHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  confirmationTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 12,
  },
  appointmentSummary: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
    flex: 1,
  },
  summaryValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
    flex: 2,
    textAlign: 'right',
  },
});

export default BookingScreen;