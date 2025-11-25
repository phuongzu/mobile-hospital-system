import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Modal,
  ScrollView,
  Dimensions,
  Platform,
  SafeAreaView,
  StatusBar,
  TextInput
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

// Responsive scaling functions
const scale = (size: number) => (width / 375) * size;
const verticalScale = (size: number) => (height / 812) * size;
const moderateScale = (size: number, factor = 0.5) => size + (scale(size) - size) * factor;

interface Appointment {
  _id: string;
  doctor_id: {
    _id: string;
    user_id: {
      name: string;
      email: string;
      phoneNumber?: string;
    };
    specialty_id?: {
      name: string;
    };
  };
  appointment_date: string;
  time_slot: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'pending';
  created_at: string;
  symptoms?: string;
}

const API_BASE_URL = 'http://localhost:3000';

interface Review {
  _id: string;
  user_id: {
    name: string;
    avatar?: string;
  };
  rating: number;
  comment?: string;
  created_at: string;
}

// Star rating component
const StarRating = ({ rating, onChange, size = 24, disabled = false }: { rating: number; onChange?: (r: number) => void; size?: number; disabled?: boolean }) => (
  <View style={{ flexDirection: 'row' }}>
    {[1,2,3,4,5].map(i => (
      <TouchableOpacity
        key={i}
        disabled={disabled || !onChange}
        onPress={() => onChange && onChange(i)}
        activeOpacity={0.7}
      >
        <Ionicons
          name={i <= rating ? 'star' : 'star-outline'}
          size={size}
          color={i <= rating ? '#FFD700' : '#C7C7CC'}
          style={{ marginHorizontal: 2 }}
        />
      </TouchableOpacity>
    ))}
  </View>
);

const HistoryAppointment: React.FC = () => {
  // Review modal state
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewTargetDoctorId, setReviewTargetDoctorId] = useState<string | null>(null);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [doctorReviews, setDoctorReviews] = useState<Review[]>([]);
  const [reviewsModalVisible, setReviewsModalVisible] = useState(false);
  const [reviewsDoctorName, setReviewsDoctorName] = useState('');
  const [userReviews, setUserReviews] = useState<{[appointmentId: string]: Review}>({});
  const [reviewTargetAppointmentId, setReviewTargetAppointmentId] = useState<string | null>(null);
  
// Fetch user's reviews for all doctors
const fetchUserReviews = async () => {
  try {
    const token = await AsyncStorage.getItem('authToken');
    const response = await fetch(`${API_BASE_URL}/api/patient/reviews/user`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (response.ok) {
      const data = await response.json();      
      const reviewsMap: {[appointmentId: string]: Review} = {};
            if (data.reviews && Array.isArray(data.reviews)) {        
        data.reviews.forEach((review: any, index: number) => {
          console.log(`🔍 Review ${index + 1}:`, {
            reviewId: review._id,
            appointment_id: review.appointment_id,
            appointment_id_type: typeof review.appointment_id,
            rating: review.rating
          });
          
          let appointmentId: string | null = null;
          
          if (typeof review.appointment_id === 'string') {
            appointmentId = review.appointment_id;
          } else if (review.appointment_id && review.appointment_id._id) {
            appointmentId = review.appointment_id._id;
          }
          
          if (appointmentId) {
            reviewsMap[appointmentId] = review;
          } else {
            console.log(`❌ Could not find appointment_id for review:`, review);
          }
        });
      } else {
        console.log('❌ No reviews array found in response');
      }
            setUserReviews(reviewsMap);
    } else {
      console.log('❌ Failed to fetch reviews:', response.status);
    }
  } catch (error) {
    console.error('Error fetching user reviews:', error);
  }
};

  const handleSubmitReview = async () => {
  if (!reviewTargetAppointmentId || !reviewTargetDoctorId || reviewRating < 1) {
    Alert.alert('Error', 'Please select a rating');
    return;
  }
  if (userReviews[reviewTargetAppointmentId]) {
    Alert.alert('Error', 'You have already reviewed this appointment');
    return;
  }

  setSubmittingReview(true);
  try {
    const token = await AsyncStorage.getItem('authToken');
    const response = await fetch(`${API_BASE_URL}/api/patient/doctors/${reviewTargetDoctorId}/reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ 
        rating: reviewRating, 
        comment: reviewComment,
        appointment_id: reviewTargetAppointmentId
      }),
    });
    
    if (response.ok) {
      Alert.alert('Thank you!', 'Your review has been submitted.');
      setReviewModalVisible(false);
      setReviewRating(0);
      setReviewComment('');
      setReviewTargetAppointmentId(null); 
      setReviewTargetDoctorId(null);
      // Refresh user reviews after submitting
      fetchUserReviews();
    } else {
      const errorData = await response.json();
      Alert.alert('Error', errorData.message || 'Failed to submit review');
    }
  } catch {
    Alert.alert('Error', 'Failed to submit review. Please try again.');
  }
  setSubmittingReview(false);
};

  // Update existing review
const handleUpdateReview = async () => {
  if (!reviewTargetAppointmentId || reviewRating < 1) {
    Alert.alert('Error', 'Please select a rating');
    return;
  }

  setSubmittingReview(true);
  try {
    const token = await AsyncStorage.getItem('authToken');
    const userReview = userReviews[reviewTargetAppointmentId];
    
    if (!userReview) {
      Alert.alert('Error', 'Review not found');
      return;
    }
    const response = await fetch(`${API_BASE_URL}/api/patient/reviews/${userReview._id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ 
        rating: reviewRating, 
        comment: reviewComment 
      }),
    });

    if (response.ok) {
      Alert.alert('Success', 'Your review has been updated.');
      setReviewModalVisible(false);
      setReviewRating(0);
      setReviewComment('');
      setReviewTargetAppointmentId(null);
      setReviewTargetDoctorId(null);
      fetchUserReviews(); // Refresh reviews
    } else {
      const errorData = await response.json();
      Alert.alert('Error', errorData.message || 'Failed to update review');
    }
  } catch (error) {
    console.error('Update review error:', error);
    Alert.alert('Error', 'Failed to update review. Please try again.');
  }
  setSubmittingReview(false);
};

  // Delete review
  const handleDeleteReview = async (appointmentId: string) => {
    try {
      const userReview = userReviews[appointmentId];
      if (!userReview) return;

      Alert.alert(
        'Delete Review',
        'Are you sure you want to delete your review?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              const token = await AsyncStorage.getItem('authToken');
              const response = await fetch(`${API_BASE_URL}/api/patient/reviews/${userReview._id}`, {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${token}`,
                },
              });
              if (response.ok) {
                Alert.alert('Success', 'Your review has been deleted.');
                // Refresh user reviews after deleting
                fetchUserReviews();
              } else {
                Alert.alert('Error', 'Failed to delete review');
              }
            }
          }
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to delete review. Please try again.');
    }
  };

  const navigation = useNavigation<any>();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [updating, setUpdating] = useState(false);

  const timeSlots = [
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'
  ];

const fetchAppointments = async () => {
  setLoading(true);
  setError(null);
  try {
    const token = await AsyncStorage.getItem('authToken');
        const response = await fetch(`${API_BASE_URL}/api/patient/appointments/history`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      setError(errorData.message || 'Failed to fetch appointments');
      setLoading(false);
      return;
    }
    const data = await response.json();
    setAppointments(data);
  } catch (err) {
    setError('Failed to load appointments. Please check your connection.');
  } finally {
    setLoading(false);
    setRefreshing(false);
  }
};

  useEffect(() => {
    fetchAppointments();
    fetchUserReviews();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAppointments();
    fetchUserReviews();
  };

  const handleCancelAppointment = async (appointmentId: string) => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const userDataString = await AsyncStorage.getItem('userData');
      let user_id = null;
      if (userDataString) {
        const userData = JSON.parse(userDataString);
        user_id = userData._id || userData.user_id || userData.id || null;
      }
      const response = await fetch(`${API_BASE_URL}/api/patient/appointments/${appointmentId}/cancel`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ user_id }),
      });

      if (response.ok) {
        Alert.alert('Success', 'Appointment cancelled successfully');
        setAppointments(prevAppointments =>
          prevAppointments.map(app =>
            app._id === appointmentId ? { ...app, status: 'cancelled' } : app
          )
        );
        setModalVisible(false);
      } else {
        const errorData = await response.json();
        Alert.alert('Error', errorData.message || 'Failed to cancel appointment');
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to cancel appointment. Please try again.');
    }
  };

const fetchDoctorReviews = async (doctorId: string, doctorName: string) => {
  setReviewLoading(true);
  setDoctorReviews([]);
  setReviewsDoctorName(doctorName);
  setReviewsModalVisible(true);
  try {
    const response = await fetch(`${API_BASE_URL}/api/patient/doctors/${doctorId}/reviews`);
    if (response.ok) {
      const data = await response.json();
      setDoctorReviews(data.reviews || []);
    }
  } catch (error) {
    console.error('Error fetching doctor reviews:', error);
  } finally {
    setReviewLoading(false);
  }
};

  const handleUpdateAppointment = async () => {
    if (!selectedAppointment || !selectedTime) {
      Alert.alert('Error', 'Please select a time slot');
      return;
    }
    setUpdating(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      const userDataString = await AsyncStorage.getItem('userData');
      let user_id = null;
      if (userDataString) {
        const userData = JSON.parse(userDataString);
        user_id = userData._id || userData.user_id || userData.id || null;
      }
      const response = await fetch(`${API_BASE_URL}/api/patient/appointments/${selectedAppointment._id}/edit`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          user_id,
          appointment_date: selectedDate.toISOString().split('T')[0],
          time_slot: selectedTime,
        }),
      });

      if (response.ok) {
        Alert.alert('Success', 'Appointment updated successfully');
        setAppointments(prevAppointments =>
          prevAppointments.map(app =>
            app._id === selectedAppointment._id
              ? {
                  ...app,
                  appointment_date: selectedDate.toISOString().split('T')[0],
                  time_slot: selectedTime,
                }
              : app
          )
        );
        setEditModalVisible(false);
      } else {
        const errorData = await response.json();
        Alert.alert('Error', errorData.message || 'Failed to update appointment');
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to update appointment. Please try again.');
    } finally {
      setUpdating(false);
    }
  };

  const confirmCancel = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setModalVisible(true);
  };

  const openEditModal = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setSelectedDate(new Date(appointment.appointment_date));
    setSelectedTime(appointment.time_slot);
    setEditModalVisible(true);
  };

  // Open review modal with existing review data if available
const openReviewModal = (appointment: Appointment) => {
  setReviewTargetAppointmentId(appointment._id); // ← Thêm state mới
  setReviewTargetDoctorId(appointment.doctor_id._id);
  const existingReview = userReviews[appointment._id]; // ← Tìm theo appointment_id
  if (existingReview) {
    setReviewRating(existingReview.rating);
    setReviewComment(existingReview.comment || '');
  } else {
    setReviewRating(0);
    setReviewComment('');
  }
  setReviewModalVisible(true);
};

  const handleDateChange = (event: any, date?: Date) => {
    setShowDatePicker(false);
    if (date) {
      setSelectedDate(date);
    }
  };

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return '#007AFF';
      case 'completed': return '#34C759';
      case 'cancelled': return '#FF3B30';
      case 'pending': return '#FF9500';
      default: return '#8E8E93';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'scheduled': return 'calendar';
      case 'completed': return 'checkmark-circle';
      case 'cancelled': return 'close-circle';
      case 'pending': return 'time';
      default: return 'help-circle';
    }
  };

  const renderItem = ({ item }: { item: Appointment }) => {
    const canReview = item.status === 'completed';
    const hasReviewed = userReviews[item._id];
    
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.doctorInfo}>
            <LinearGradient
              colors={['#5E5CE6', '#0A84FF']}
              style={styles.avatar}
            >
              <Ionicons name="person" size={moderateScale(20)} color="#FFFFFF" />
            </LinearGradient>
            <View style={styles.doctorDetails}>
              <Text style={styles.doctorName} numberOfLines={1}>
                Dr. {item.doctor_id?.user_id?.name || 'Unknown Doctor'}
              </Text>
              <Text style={styles.specialty} numberOfLines={1}>
                {item.doctor_id?.specialty_id?.name || 'General Practice'}
              </Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Ionicons name={getStatusIcon(item.status) as any} size={moderateScale(14)} color="#FFFFFF" />
            <Text style={styles.statusText}>{item.status.charAt(0).toUpperCase() + item.status.slice(1)}</Text>
          </View>
        </View>

        <View style={styles.appointmentDetails}>
          <View style={styles.detailRow}>
            <Ionicons name="calendar" size={moderateScale(16)} color="#8E8E93" />
            <Text style={styles.detailText}>{formatDate(item.appointment_date)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="time" size={moderateScale(16)} color="#8E8E93" />
            <Text style={styles.detailText}>{item.time_slot}</Text>
          </View>
          {item.symptoms && (
            <View style={styles.detailRow}>
              <Ionicons name="medical" size={moderateScale(16)} color="#8E8E93" />
              <Text style={styles.detailText} numberOfLines={2}>{item.symptoms}</Text>
            </View>
          )}
        </View>

        {(item.status === 'scheduled' || item.status === 'pending') && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, styles.editButton]}
              onPress={() => openEditModal(item)}
            >
              <Ionicons name="create" size={moderateScale(16)} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Reschedule</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.cancelButton]}
              onPress={() => confirmCancel(item)}
            >
              <Ionicons name="close" size={moderateScale(16)} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {item.status === 'completed' && (
          <View style={{ marginTop: moderateScale(10) }}>
            <View style={styles.nonActionMessage}>
              <Ionicons name="checkmark-circle" size={moderateScale(16)} color="#34C759" />
              <Text style={[styles.nonActionText, { color: '#34C759' }]}>Appointment completed</Text>
            </View>
            <View style={{ flexDirection: 'row', marginTop: moderateScale(8), gap: moderateScale(8) }}>
              <TouchableOpacity
                style={{ 
                  flex: 1, 
                  backgroundColor: hasReviewed ? '#34C759' : '#FFD700', 
                  borderRadius: 10, 
                  padding: 10, 
                  alignItems: 'center', 
                  flexDirection: 'row', 
                  justifyContent: 'center' 
                }}
                onPress={() => openReviewModal(item)}
              >
                <Ionicons 
                  name={hasReviewed ? "create" : "star"} 
                  size={16} 
                  color="#fff" 
                  style={{ marginRight: 6 }} 
                />
                <Text style={{ color: '#fff', fontWeight: '600' }}>
                  {hasReviewed ? 'Edit Review' : 'Write Review'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: '#1976d2', borderRadius: 10, padding: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }}
                onPress={() => fetchDoctorReviews(item.doctor_id._id, item.doctor_id.user_id?.name || 'Doctor')}
              >
                <Ionicons name="chatbubbles" size={16} color="#fff" style={{ marginRight: 6 }} />
                <Text style={{ color: '#fff', fontWeight: '600' }}>View Reviews</Text>
              </TouchableOpacity>
            </View>
            {hasReviewed && (
              <TouchableOpacity
                style={{ 
                  marginTop: moderateScale(8),
                  backgroundColor: '#FF3B30', 
                  borderRadius: 10, 
                  padding: 10, 
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center'
                }}
                  onPress={() => handleDeleteReview(item._id)}
              >
                <Ionicons name="trash" size={16} color="#fff" style={{ marginRight: 6 }} />
                <Text style={{ color: '#fff', fontWeight: '600' }}>Delete Review</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {item.status === 'cancelled' && (
          <View style={[
            styles.nonActionMessage,
            { backgroundColor: 'rgba(255, 59, 48, 0.1)' }
          ]}>
            <Ionicons name="close-circle" size={moderateScale(16)} color="#FF3B30" />
            <Text style={[styles.nonActionText, { color: '#FF3B30' }]}>Appointment cancelled</Text>
          </View>
        )}
      </View>
    );
  };

const renderReviewModal = () => {
  const isEditing = !!(reviewTargetAppointmentId && userReviews[reviewTargetAppointmentId]);
  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={reviewModalVisible}
      onRequestClose={() => setReviewModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { maxWidth: 350 }]}>  
          <Text style={styles.modalTitle}>
            {isEditing ? 'Edit Your Review' : 'Write a Review'}
          </Text>
          <Text style={{ fontSize: 16, color: '#333', marginBottom: 12, textAlign: 'center' }}>
            How was your experience with this doctor?
          </Text>
          <StarRating rating={reviewRating} onChange={setReviewRating} size={32} />
          <View style={{ marginTop: 16, width: '100%' }}>
            <Text style={{ fontWeight: '600', marginBottom: 6 }}>Comment (optional)</Text>
            <View style={{ borderWidth: 1, borderColor: '#E5E5EA', borderRadius: 10, padding: 8, backgroundColor: '#F8F9FA' }}>
              <TextInput
                style={{ minHeight: 60, color: '#333' }}
                numberOfLines={4}
                multiline
                onChangeText={setReviewComment}
                value={reviewComment}
                placeholder="Share your feedback..."
                textAlignVertical="top"
                editable={!submittingReview}
                autoCorrect
              />
            </View>
          </View>
          <View style={{ flexDirection: 'row', marginTop: 20, gap: 12, width: '100%' }}>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalCancelButton]}
              onPress={() => setReviewModalVisible(false)}
              disabled={submittingReview}
            >
              <Text style={[styles.modalButtonText, { color: '#007AFF' }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: isEditing ? '#34C759' : '#FFD700' }]}
              onPress={isEditing ? handleUpdateReview : handleSubmitReview}
              disabled={submittingReview}
            >
              {submittingReview ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.modalButtonText}>
                  {isEditing ? 'Update Review' : 'Submit Review'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

  // Reviews Modal (View)
  const renderReviewsModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={reviewsModalVisible}
      onRequestClose={() => setReviewsModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { maxWidth: 350, alignItems: 'flex-start' }]}>  
          <View style={{ width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.modalTitle}>Reviews for Dr. {reviewsDoctorName}</Text>
            <TouchableOpacity onPress={() => setReviewsModalVisible(false)}>
              <Ionicons name="close" size={24} color="#8E8E93" />
            </TouchableOpacity>
          </View>
          {reviewLoading ? (
            <ActivityIndicator color="#1976d2" size="large" style={{ marginTop: 20 }} />
          ) : doctorReviews.length === 0 ? (
            <Text style={{ color: '#8E8E93', marginTop: 20 }}>No reviews yet.</Text>
          ) : (
            <ScrollView style={{ maxHeight: 300, width: '100%' }}>
              {doctorReviews.map((r) => (
                <View key={r._id} style={{ borderBottomWidth: 1, borderColor: '#eee', paddingVertical: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    <Ionicons name="person-circle" size={22} color="#1976d2" style={{ marginRight: 6 }} />
                    <Text style={{ fontWeight: '600', color: '#333' }}>{r.user_id?.name || 'User'}</Text>
                    <View style={{ marginLeft: 8 }}>
                      <StarRating rating={r.rating} size={16} disabled />
                    </View>
                  </View>
                  {r.comment ? <Text style={{ color: '#333', marginLeft: 28 }}>{r.comment}</Text> : null}
                  <Text style={{ color: '#8E8E93', fontSize: 12, marginLeft: 28, marginTop: 2 }}>{new Date(r.created_at).toLocaleDateString()}</Text>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );

  // Only show appointments that are not cancelled
  const visibleAppointments = appointments.filter(app => app.status !== 'cancelled');

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1976d2" />
          <Text style={styles.loadingText}>Loading appointment history...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.centered}>
          <Ionicons name="alert-circle" size={moderateScale(64)} color="#FF3B30" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.BookingButton} 
            onPress={() => navigation.navigate('FindDoctor')}
          >
            <Text style={styles.BookingButtonText}>Book Appointment</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      {/* Header */}
      <LinearGradient
        colors={['#FFFFFF', '#F8F9FA']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={moderateScale(24)} color="#1976d2" />
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Appointment History</Text>
            <Text style={styles.headerSubtitle}>
              {visibleAppointments.length} appointment{visibleAppointments.length !== 1 ? 's' : ''}
            </Text>
          </View>
          <TouchableOpacity 
            style={styles.refreshButton}
            onPress={onRefresh}
          >
            <Ionicons name="refresh" size={moderateScale(22)} color="#1976d2" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <FlatList
        data={visibleAppointments}
        renderItem={renderItem}
        keyExtractor={item => item._id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#1976d2"]}
            tintColor={"#1976d2"}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="calendar" size={moderateScale(64)} color="#C7C7CC" />
            <Text style={styles.emptyTitle}>No appointments yet</Text>
            <Text style={styles.emptyText}>You don't have any appointments scheduled</Text>
            <TouchableOpacity 
              style={styles.bookButton}
              onPress={() => navigation.navigate('FindDoctor')}
            >
              <Text style={styles.bookButtonText}>Book Appointment</Text>
            </TouchableOpacity>
          </View>
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      {/* Review Modal */}
      {renderReviewModal()}
      {/* Reviews Modal */}
      {renderReviewsModal()}

      {/* Cancel Confirmation Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconContainer}>
              <Ionicons name="warning" size={moderateScale(48)} color="#FF9500" />
            </View>
            <Text style={styles.modalTitle}>Cancel Appointment</Text>
            <Text style={styles.modalText}>
              Are you sure you want to cancel your appointment with Dr. {selectedAppointment?.doctor_id?.user_id?.name}?
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={[styles.modalButtonText, { color: '#007AFF' }]}>Keep Appointment</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalConfirmButton]}
                onPress={() => selectedAppointment && handleCancelAppointment(selectedAppointment._id)}
              >
                <Text style={styles.modalButtonText}>Yes, Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Appointment Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={editModalVisible}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.editModalContainer}>
            <ScrollView 
              contentContainerStyle={styles.editModalContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Reschedule Appointment</Text>
                <TouchableOpacity 
                  style={styles.modalCloseButton}
                  onPress={() => setEditModalVisible(false)}
                >
                  <Ionicons name="close" size={moderateScale(24)} color="#8E8E93" />
                </TouchableOpacity>
              </View>
              
              <Text style={styles.modalText}>
                Reschedule your appointment with Dr. {selectedAppointment?.doctor_id?.user_id?.name}
              </Text>

              <View style={styles.editSection}>
                <Text style={styles.sectionTitle}>Select Date</Text>
                <TouchableOpacity
                  style={styles.datePickerButton}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Ionicons name="calendar" size={moderateScale(20)} color="#007AFF" />
                  <Text style={styles.dateText}>
                    {selectedDate.toDateString()}
                  </Text>
                </TouchableOpacity>

                {showDatePicker && (
                  <DateTimePicker
                    value={selectedDate}
                    mode="date"
                    display="default"
                    onChange={handleDateChange}
                    minimumDate={new Date()}
                  />
                )}
              </View>

              <View style={styles.editSection}>
                <Text style={styles.sectionTitle}>Select Time</Text>
                <View style={styles.timeSlotsContainer}>
                  {timeSlots.map((time) => (
                    <TouchableOpacity
                      key={time}
                      style={[
                        styles.timeSlot,
                        selectedTime === time && styles.timeSlotSelected
                      ]}
                      onPress={() => setSelectedTime(time)}
                    >
                      <Text style={[
                        styles.timeSlotText,
                        selectedTime === time && styles.timeSlotTextSelected
                      ]}>
                        {time}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalCancelButton]}
                  onPress={() => setEditModalVisible(false)}
                >
                  <Text style={[styles.modalButtonText, { color: '#007AFF' }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalConfirmButton]}
                  onPress={handleUpdateAppointment}
                  disabled={updating}
                >
                  {updating ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={moderateScale(18)} color="#FFFFFF" />
                      <Text style={styles.modalButtonText}>Confirm Changes</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? verticalScale(10) : verticalScale(16),
    paddingBottom: verticalScale(16),
    borderBottomLeftRadius: moderateScale(20),
    borderBottomRightRadius: moderateScale(20),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: moderateScale(16),
  },
  headerTextContainer: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: moderateScale(8),
  },
  headerTitle: {
    fontSize: moderateScale(22),
    fontWeight: '700',
    color: '#000000',
    marginBottom: moderateScale(2),
  },
  headerSubtitle: {
    fontSize: moderateScale(14),
    color: '#8E8E93',
    fontWeight: '500',
  },
  backButton: {
    padding: moderateScale(8),
    borderRadius: moderateScale(20),
    backgroundColor: 'rgba(25, 118, 210, 0.1)',
  },
  refreshButton: {
    padding: moderateScale(8),
    borderRadius: moderateScale(20),
    backgroundColor: 'rgba(25, 118, 210, 0.1)',
  },
  listContent: {
    padding: moderateScale(16),
    paddingBottom: moderateScale(20),
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: moderateScale(16),
    padding: moderateScale(20),
    marginBottom: moderateScale(16),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: moderateScale(16),
  },
  doctorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: moderateScale(48),
    height: moderateScale(48),
    borderRadius: moderateScale(24),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: moderateScale(12),
  },
  doctorDetails: {
    flex: 1,
  },
  doctorName: {
    fontSize: moderateScale(16),
    fontWeight: '600',
    color: '#000000',
    marginBottom: moderateScale(2),
  },
  specialty: {
    fontSize: moderateScale(14),
    color: '#8E8E93',
    fontWeight: '500',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: moderateScale(10),
    paddingVertical: moderateScale(6),
    borderRadius: moderateScale(16),
    marginLeft: moderateScale(8),
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: moderateScale(12),
    fontWeight: '600',
    marginLeft: moderateScale(4),
  },
  appointmentDetails: {
    marginBottom: moderateScale(16),
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: moderateScale(12),
  },
  detailText: {
    fontSize: moderateScale(14),
    color: '#000000',
    marginLeft: moderateScale(12),
    flex: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: moderateScale(12),
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: moderateScale(12),
    paddingHorizontal: moderateScale(16),
    borderRadius: moderateScale(12),
    flex: 1,
    gap: moderateScale(6),
  },
  editButton: {
    backgroundColor: '#007AFF',
  },
  cancelButton: {
    backgroundColor: '#FF3B30',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: moderateScale(14),
  },
  nonActionMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: moderateScale(12),
    borderRadius: moderateScale(12),
    gap: moderateScale(8),
  },
  nonActionText: {
    fontSize: moderateScale(14),
    fontWeight: '500',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: moderateScale(20),
  },
  loadingText: {
    marginTop: moderateScale(16),
    fontSize: moderateScale(16),
    color: '#8E8E93',
    fontWeight: '500',
  },
  errorText: {
    fontSize: moderateScale(16),
    color: '#FF3B30',
    textAlign: 'center',
    marginVertical: moderateScale(16),
    fontWeight: '500',
  },
  BookingButton: {
    backgroundColor: '#1976d2',
    paddingHorizontal: moderateScale(24),
    paddingVertical: moderateScale(12),
    borderRadius: moderateScale(12),
    marginTop: moderateScale(16),
  },
  BookingButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: moderateScale(14),
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: verticalScale(40),
    paddingHorizontal: moderateScale(20),
  },
  emptyTitle: {
    fontSize: moderateScale(18),
    fontWeight: '600',
    color: '#000000',
    marginTop: moderateScale(16),
    marginBottom: moderateScale(8),
  },
  emptyText: {
    fontSize: moderateScale(14),
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: moderateScale(24),
    lineHeight: moderateScale(20),
  },
  bookButton: {
    backgroundColor: '#1976d2',
    paddingHorizontal: moderateScale(24),
    paddingVertical: moderateScale(14),
    borderRadius: moderateScale(12),
  },
  bookButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: moderateScale(14),
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: moderateScale(20),
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: moderateScale(20),
    padding: moderateScale(24),
    width: '100%',
    maxWidth: moderateScale(400),
    alignItems: 'center',
  },
  modalIconContainer: {
    marginBottom: moderateScale(16),
  },
  modalTitle: {
    fontSize: moderateScale(20),
    fontWeight: '700',
    color: '#000000',
    marginBottom: moderateScale(12),
    textAlign: 'center',
  },
  modalText: {
    fontSize: moderateScale(16),
    color: '#000000',
    marginBottom: moderateScale(24),
    textAlign: 'center',
    lineHeight: moderateScale(22),
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: moderateScale(12),
  },
  modalButton: {
    flex: 1,
    paddingVertical: moderateScale(14),
    borderRadius: moderateScale(12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelButton: {
    backgroundColor: 'rgba(120, 120, 128, 0.12)',
  },
  modalConfirmButton: {
    backgroundColor: '#FF3B30',
  },
  modalButtonText: {
    fontWeight: '600',
    fontSize: moderateScale(16),
    color: '#FFFFFF',
  },
  editModalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: moderateScale(20),
    maxHeight: '80%',
    width: '100%',
    maxWidth: moderateScale(400),
  },
  editModalContent: {
    padding: moderateScale(24),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: moderateScale(16),
  },
  modalCloseButton: {
    padding: moderateScale(4),
  },
  editSection: {
    marginBottom: moderateScale(24),
  },
  sectionTitle: {
    fontSize: moderateScale(16),
    fontWeight: '600',
    color: '#000000',
    marginBottom: moderateScale(12),
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: moderateScale(12),
    padding: moderateScale(16),
    gap: moderateScale(12),
  },
  dateText: {
    fontSize: moderateScale(16),
    color: '#000000',
    fontWeight: '500',
  },
  timeSlotsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: moderateScale(10),
    justifyContent: 'space-between',
  },
  timeSlot: {
    width: width * 0.27,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: moderateScale(12),
    padding: moderateScale(12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeSlotSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  timeSlotText: {
    fontSize: moderateScale(14),
    color: '#000000',
    fontWeight: '500',
  },
  timeSlotTextSelected: {
    color: '#FFFFFF',
  },
});

export default HistoryAppointment;