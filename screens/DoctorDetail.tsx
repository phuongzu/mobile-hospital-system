import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

const DoctorDetail = ({ route, navigation }) => {
  const { doctor } = route.params;

  // Handle missing doctor object gracefully
  if (!doctor || !doctor.user_id) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Doctor Details</Text>
        </View>
        <View style={styles.profileSection}>
          <Text style={styles.name}>Doctor information not found.</Text>
        </View>
      </View>
    );
  }

  // Get status details
  const getStatusDetails = () => {
    const status = doctor.user_id?.status;
    if (status === 'working') {
      return { text: 'Available', color: '#4caf50', icon: 'checkmark-circle' };
    } else if (status === 'busy') {
      return { text: 'Busy', color: '#ff9800', icon: 'time' };
    } else {
      return { text: 'Not Available', color: '#f44336', icon: 'close-circle' };
    }
  };
  
  const statusDetails = getStatusDetails();

  return (
    <View style={styles.container}>
      {/* Header with gradient background */}
      <LinearGradient
        colors={['#1976d2', '#42a5f5']}
        style={styles.headerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Doctor Profile</Text>
          <TouchableOpacity style={styles.headerIcon}>
            <Ionicons name="ellipsis-vertical" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            {doctor.avatar ? (
              <Image source={{ uri: doctor.avatar }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={50} color="#1976d2" />
              </View>
            )}
            <View style={[styles.statusBadge, { backgroundColor: statusDetails.color }]}>
              <Ionicons name={statusDetails.icon} size={14} color="#fff" />
            </View>
          </View>
          
          <Text style={styles.name}>Dr. {doctor.user_id?.name || 'Unknown Doctor'}</Text>
          <Text style={styles.specialty}>{doctor.specialty_id?.name || 'General Practice'}</Text>
          
          <View style={styles.ratingContainer}>
            <Ionicons name="star" size={16} color="#FFD700" />
            <Text style={styles.ratingText}>4.8</Text>
            <Text style={styles.reviewText}>(128 reviews)</Text>
          </View>
          
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>5+</Text>
              <Text style={styles.statLabel}>Years Exp</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>1.2k</Text>
              <Text style={styles.statLabel}>Patients</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>98%</Text>
              <Text style={styles.statLabel}>Satisfaction</Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="call-outline" size={20} color="#1976d2" />
            <Text style={styles.actionButtonText}>Call</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="chatbubble-outline" size={20} color="#1976d2" />
            <Text style={styles.actionButtonText}>Message</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="videocam-outline" size={20} color="#1976d2" />
            <Text style={styles.actionButtonText}>Video</Text>
          </TouchableOpacity>
        </View>

        {/* Information Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About Doctor</Text>
          <Text style={styles.aboutText}>
            Dr. {doctor.user_id?.name?.split(' ')[0]} is a dedicated {doctor.specialty_id?.name || 'physician'} with over {doctor.years_of_experience || '5'} years of experience. 
            Known for excellent patient care and detailed diagnosis.
          </Text>
        </View>

        {/* Details Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Details</Text>
          
          <InfoRow 
            label="Email" 
            value={doctor.user_id?.email} 
            icon="mail-outline" 
          />
          <InfoRow 
            label="Phone" 
            value={doctor.user_id?.phoneNumber} 
            icon="call-outline" 
          />
          <InfoRow 
            label="Experience" 
            value={`${doctor.years_of_experience ?? 'N/A'} years`} 
            icon="school-outline" 
          />
          <InfoRow 
            label="Consultation Fee" 
            value={doctor.consultation_fee ? `$${doctor.consultation_fee}` : 'N/A'} 
            icon="cash-outline" 
          />
          <InfoRow 
            label="Languages" 
            value={doctor.languages?.join(', ')} 
            icon="language-outline" 
          />
          <InfoRow 
            label="Education" 
            value={doctor.education?.join(', ')} 
            icon="book-outline" 
          />
          <InfoRow 
            label="Address" 
            value={doctor.user_id?.address} 
            icon="location-outline" 
          />
        </View>

        {/* Availability Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Availability</Text>
          {doctor.available_hours ? (
            <View style={styles.scheduleContainer}>
              {Object.entries(doctor.available_hours).map(([day, hours]) => (
                <View key={day} style={styles.scheduleItem}>
                  <Text style={styles.dayText}>
                    {day.charAt(0).toUpperCase() + day.slice(1)}
                  </Text>
                  <Text style={[
                    styles.timeText,
                    { color: typeof hours === 'string' || hours.isAvailable ? '#4caf50' : '#f44336' }
                  ]}>
                    {typeof hours === 'string'
                      ? hours
                      : hours.isAvailable
                      ? `${hours.start} - ${hours.end}`
                      : 'Not Available'}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.noAvailability}>No availability information</Text>
          )}
        </View>

        {/* Reviews Preview */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Reviews</Text>
            <TouchableOpacity>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.reviewItem}>
            <View style={styles.reviewHeader}>
              <Image 
                source={{ uri: 'https://randomuser.me/api/portraits/men/32.jpg' }} 
                style={styles.reviewerAvatar}
              />
              <View>
                <Text style={styles.reviewerName}>Robert Johnson</Text>
                <View style={styles.reviewStars}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Ionicons key={star} name="star" size={16} color="#FFD700" />
                  ))}
                </View>
              </View>
            </View>
            <Text style={styles.reviewText}>
              Dr. {doctor.user_id?.name?.split(' ')[0]} was very professional and took time to explain everything clearly. Highly recommended!
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Fixed Book Button */}
      <View style={styles.footer}>
        <View style={styles.priceContainer}>
          <Text style={styles.priceLabel}>Consultation Fee</Text>
          <Text style={styles.priceValue}>
            {doctor.consultation_fee ? `$${doctor.consultation_fee}` : 'N/A'}
          </Text>
        </View>
        <TouchableOpacity
          style={[
            styles.bookButton,
            doctor.user_id?.status !== 'working' && styles.bookButtonDisabled,
          ]}
          disabled={doctor.user_id?.status !== 'working'}
          onPress={() => navigation.navigate('Appointments', { doctor })}
        >
          <Text style={styles.bookButtonText}>
            {doctor.user_id?.status === 'working' ? 'Book Appointment' : 'Not Available'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const InfoRow = ({ label, value, icon }) => (
  <View style={styles.infoRow}>
    <View style={styles.infoIcon}>
      <Ionicons name={icon} size={18} color="#1976d2" />
    </View>
    <View style={styles.infoContent}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || 'N/A'}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerGradient: {
    paddingTop: 50,
    paddingBottom: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  headerIcon: {
    padding: 8,
  },
  scrollContainer: {
    flex: 1,
    marginTop: -20,
  },
  profileCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 20,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#E3F2FD',
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  statusBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1976d2',
    marginBottom: 4,
    textAlign: 'center',
  },
  specialty: {
    fontSize: 16,
    color: '#666',
    marginBottom: 12,
    textAlign: 'center',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  ratingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 4,
    marginRight: 8,
  },
  reviewText: {
    fontSize: 14,
    color: '#666',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 8,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1976d2',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#E0E0E0',
  },
  actionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  actionButton: {
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#E3F2FD',
    minWidth: 80,
  },
  actionButtonText: {
    color: '#1976d2',
    fontWeight: '600',
    marginTop: 4,
    fontSize: 12,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1976d2',
  },
  seeAllText: {
    color: '#42a5f5',
    fontWeight: '600',
  },
  aboutText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#666',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  scheduleContainer: {
    marginTop: 8,
  },
  scheduleItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  dayText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  timeText: {
    fontSize: 14,
    fontWeight: '500',
  },
  noAvailability: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: 16,
  },
  reviewItem: {
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  reviewerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  reviewStars: {
    flexDirection: 'row',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  priceContainer: {
    flex: 1,
  },
  priceLabel: {
    fontSize: 12,
    color: '#666',
  },
  priceValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1976d2',
  },
  bookButton: {
    backgroundColor: '#1976d2',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 28,
    shadowColor: '#1976d2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  bookButtonDisabled: {
    backgroundColor: '#B0BEC5',
  },
  bookButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

export default DoctorDetail;