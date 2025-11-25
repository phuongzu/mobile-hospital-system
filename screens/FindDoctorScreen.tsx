import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Platform,
  SafeAreaView,
  Image,
  Animated,
  FlatList,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface Doctor {
  _id: string;
  user_id: {
    _id: string;
    name: string;
    email: string;
    phoneNumber?: string;
    status?: 'working' | 'not working' | 'busy';
  };
  specialty_id: {
    _id: string;
    name: string;
    description?: string;
  };
  license_number: string;
  years_of_experience: number;
  isAvailable: boolean;
  consultation_fee: number;
  languages?: string[];
  education?: string[];
  certifications?: string[];
  rating?: number;
  reviews?: number;
}

interface Specialty {
  _id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  isActive: boolean;
}

const { width, height } = Dimensions.get('window');
const moderateScale = (size: number, factor = 0.5) => size + ((width / 375) * size - size) * factor;
const verticalScale = (size: number) => (height / 812) * size;

const specialtyIconMap: { [key: string]: { icon: string; color: string } } = {
  Cardiology: { icon: 'heart', color: '#FF6B6B' },
  Dermatology: { icon: 'body', color: '#4ECDC4' },
  Neurology: { icon: 'medkit', color: '#45B7D1' },
  Pediatrics: { icon: 'happy', color: '#F9A826' },
  Orthopedics: { icon: 'bandage', color: '#6A0572' },
  Ophthalmology: { icon: 'eye', color: '#9C27B0' },
  Dentistry: { icon: 'medical', color: '#2196F3' },
  Psychiatry: { icon: 'headset', color: '#4CAF50' },
  Surgery: { icon: 'cut', color: '#E91E63' },
  Gynecology: { icon: 'female', color: '#FF5722' },
  Endocrinology: { icon: 'pulse', color: '#673AB7' },
  Gastroenterology: { icon: 'nutrition', color: '#009688' },
  Default: { icon: 'medical', color: '#1976d2' },
};

const API_BASE_URL = 'http://localhost:3000';

const FindDoctorScreen = ({ navigation }: any) => {
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [doctorsBySpecialty, setDoctorsBySpecialty] = useState<{ [key: string]: Doctor[] }>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const scrollY = new Animated.Value(0);

  const headerHeight = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [verticalScale(180), verticalScale(100)],
    extrapolate: 'clamp',
  });

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 80],
    outputRange: [1, 0.9],
    extrapolate: 'clamp',
  });

  // Fetch specialties and doctors immediately after mount and after refresh
  const fetchSpecialtiesAndDoctors = async () => {
    setLoading(true);
    setError(null);
    try {
      const specRes = await fetch(`${API_BASE_URL}/api/specialties`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      const specData = await specRes.json();
      let activeSpecialties: Specialty[] = [];
      if (specData.success) {
        activeSpecialties = specData.data.filter((s: Specialty) => s.isActive);
        setSpecialties(activeSpecialties);
        if (activeSpecialties.length > 0 && !activeCategory) {
          setActiveCategory(activeSpecialties[0]._id);
        }
      } else {
        setError(specData.message || 'Failed to fetch specialties');
        setLoading(false);
        return;
      }
      // Fetch doctors for all specialties in parallel
      const doctorFetches = activeSpecialties.map(spec =>
        fetch(`${API_BASE_URL}/api/doctors/specialty/${spec._id}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        })
          .then(res => res.json())
          .then(data => (data.success ? data.data : []))
          .catch(() => [])
      );
      const doctorsArr = await Promise.all(doctorFetches);
      const doctorsMap: { [key: string]: Doctor[] } = {};
      activeSpecialties.forEach((spec, idx) => {
        doctorsMap[spec._id] = doctorsArr[idx];
      });
      setDoctorsBySpecialty(doctorsMap);
    } catch (err) {
      setError('Failed to load data');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSpecialtiesAndDoctors();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchSpecialtiesAndDoctors();
    setRefreshing(false);
  }, []);

  const getSpecialtyIcon = (specialtyName: string) => {
    return specialtyIconMap[specialtyName] || specialtyIconMap['Default'];
  };

  // Count of doctors for badge is always the length of doctorsBySpecialty[s._id]
  const getDoctorCount = (specialtyId: string) => {
    return doctorsBySpecialty[specialtyId]?.length || 0;
  };

  const renderDoctorItem = ({ item: doctor }: { item: Doctor }) => (
    <TouchableOpacity
      style={styles.doctorCard}
      onPress={() => navigation.navigate('DoctorDetail', { doctor })}
      activeOpacity={0.8}
    >
      <View style={styles.doctorImageContainer}>
        <LinearGradient
          colors={['#f0f4ff', '#e1e9ff']}
          style={styles.doctorImageGradient}
        >
          <Ionicons name="person" size={moderateScale(40)} color="#1976d2" />
        </LinearGradient>
      </View>
      
      <View style={styles.doctorInfo}>
        <View style={styles.doctorHeader}>
          <Text style={styles.doctorName}>Dr. {doctor.user_id?.name || 'Unknown Doctor'}</Text>
          <View style={styles.ratingContainer}>
          </View>
        </View>
        
        <Text style={styles.doctorSpecialty}>{doctor.specialty_id?.name || 'General Practice'}</Text>
        
        {doctor.years_of_experience > 0 && (
          <View style={styles.experienceContainer}>
            <Ionicons name="briefcase" size={moderateScale(14)} color="#666" />
            <Text style={styles.experienceText}>{doctor.years_of_experience} years experience</Text>
          </View>
        )}
        
        <View style={styles.availabilityContainer}>
          <View style={[styles.availabilityDot, {
            backgroundColor:
              doctor.user_id?.status === 'working' ? '#4caf50' :
              doctor.user_id?.status === 'busy' ? '#ff9800' : '#f44336',
          }]} />
          <Text style={[styles.availabilityText, {
            color:
              doctor.user_id?.status === 'working' ? '#4caf50' :
              doctor.user_id?.status === 'busy' ? '#ff9800' : '#f44336',
          }]}> 
            {doctor.user_id?.status === 'working' ? 'Available' : doctor.user_id?.status === 'busy' ? 'Busy' : 'Not Working'}
          </Text>
        </View>
        
        <View style={styles.feeContainer}>
          <Text style={styles.feeLabel}>Consultation Fee:</Text>
          <Text style={styles.feeText}>${doctor.consultation_fee}</Text>
        </View>
      </View>
      
      <TouchableOpacity
        style={[styles.bookButton, (doctor.user_id?.status !== 'working') && styles.bookButtonDisabled]}
        onPress={() => navigation.navigate('Appointments', { doctor })}
        disabled={doctor.user_id?.status !== 'working'}
      >
        <Text style={[styles.bookButtonText, (doctor.user_id?.status !== 'working') && styles.bookButtonTextDisabled]}>
          {doctor.user_id?.status === 'working' ? 'Book Now' : 'Not Available'}
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderSpecialtyItem = ({ item: specialty }: { item: Specialty }) => {
    const isActive = activeCategory === specialty._id;
    const iconInfo = getSpecialtyIcon(specialty.name);
    
    return (
      <TouchableOpacity
        style={[styles.specialtyItem, isActive && styles.specialtyItemActive]}
        onPress={() => setActiveCategory(specialty._id)}
        activeOpacity={0.7}
      >
        <LinearGradient
          colors={isActive ? ['#1976d2', '#1565c0'] : ['#f8f9fa', '#e9ecef']}
          style={styles.specialtyIconContainer}
        >
          <Ionicons 
            name={iconInfo.icon as any} 
            size={moderateScale(22)} 
            color={isActive ? 'white' : iconInfo.color} 
          />
        </LinearGradient>
        <Text style={[styles.specialtyItemText, isActive && styles.specialtyItemTextActive]}>
          {specialty.name}
        </Text>
        {getDoctorCount(specialty._id) > 0 && (
          <View style={[styles.specialtyBadge, isActive && styles.specialtyBadgeActive]}>
            <Text style={styles.specialtyBadgeText}>{getDoctorCount(specialty._id)}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
        <ActivityIndicator size="large" color="#1976d2" />
        <Text style={styles.loadingText}>Loading doctors...</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
        <Ionicons name="alert-circle" size={moderateScale(64)} color="#f44336" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchSpecialtiesAndDoctors}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1976d2" />
      
      <Animated.View style={[styles.header, { height: headerHeight, opacity: headerOpacity }]}>
        <LinearGradient
          colors={['#1976d2', '#1565c0']}
          style={styles.headerGradient}
        >
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={moderateScale(24)} color="white" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Find a Doctor</Text>
            <TouchableOpacity style={styles.searchButton}>
              <Ionicons name="search" size={moderateScale(24)} color="white" />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.headerSubtitle}>Book an appointment with our specialists</Text>
        </LinearGradient>
      </Animated.View>

      <View style={styles.content}>
        <View style={styles.categoriesSection}>
          <Text style={styles.sectionTitle}>Specialties</Text>
          <FlatList
            data={specialties}
            renderItem={renderSpecialtyItem}
            keyExtractor={item => item._id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesList}
          />
        </View>

        <View style={styles.doctorsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {activeCategory ? specialties.find(s => s._id === activeCategory)?.name : 'All'} Doctors
            </Text>
            <Text style={styles.doctorsCount}>
              {activeCategory ? getDoctorCount(activeCategory) : specialties.reduce((acc, s) => acc + getDoctorCount(s._id), 0)} available
            </Text>
          </View>

          {activeCategory && doctorsBySpecialty[activeCategory] && doctorsBySpecialty[activeCategory].length > 0 ? (
            <FlatList
              data={doctorsBySpecialty[activeCategory]}
              renderItem={renderDoctorItem}
              keyExtractor={item => item._id}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  colors={["#1976d2"]}
                  tintColor="#1976d2"
                />
              }
              contentContainerStyle={styles.doctorsList}
            />
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="medical-outline" size={moderateScale(64)} color="#e0e0e0" />
              <Text style={styles.emptyTitle}>No doctors available</Text>
              <Text style={styles.emptyText}>There are no doctors available for this specialty at the moment.</Text>
              <TouchableOpacity style={styles.emptyButton} onPress={onRefresh}>
                <Text style={styles.emptyButtonText}>Refresh</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    overflow: 'hidden',
  },
  headerGradient: {
    flex: 1,
    paddingHorizontal: moderateScale(16),
    paddingTop: Platform.OS === 'ios' ? verticalScale(10) : verticalScale(20),
    paddingBottom: verticalScale(20),
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: verticalScale(10),
  },
  backButton: {
    padding: moderateScale(4),
  },
  headerTitle: {
    fontSize: moderateScale(22),
    fontWeight: 'bold',
    color: 'white',
  },
  searchButton: {
    padding: moderateScale(4),
  },
  headerSubtitle: {
    fontSize: moderateScale(14),
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: verticalScale(4),
  },
  content: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderTopLeftRadius: moderateScale(20),
    borderTopRightRadius: moderateScale(20),
    marginTop: verticalScale(-20),
    paddingTop: verticalScale(20),
  },
  categoriesSection: {
    paddingHorizontal: moderateScale(16),
    marginBottom: verticalScale(16),
  },
  sectionTitle: {
    fontSize: moderateScale(18),
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: verticalScale(12),
  },
  categoriesList: {
    paddingBottom: verticalScale(8),
  },
  specialtyItem: {
    alignItems: 'center',
    marginRight: moderateScale(16),
    padding: moderateScale(12),
    backgroundColor: 'white',
    borderRadius: moderateScale(16),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    width: moderateScale(80),
  },
  specialtyItemActive: {
    backgroundColor: '#1976d2',
    shadowColor: '#1976d2',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 6,
    elevation: 4,
  },
  specialtyIconContainer: {
    width: moderateScale(44),
    height: moderateScale(44),
    borderRadius: moderateScale(22),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: verticalScale(8),
  },
  specialtyItemText: {
    fontSize: moderateScale(12),
    fontWeight: '600',
    color: '#4a5568',
    textAlign: 'center',
  },
  specialtyItemTextActive: {
    color: 'white',
  },
  specialtyBadge: {
    position: 'absolute',
    top: moderateScale(8),
    right: moderateScale(8),
    backgroundColor: '#e53e3e',
    borderRadius: moderateScale(10),
    width: moderateScale(18),
    height: moderateScale(18),
    justifyContent: 'center',
    alignItems: 'center',
  },
  specialtyBadgeActive: {
    backgroundColor: 'white',
  },
  specialtyBadgeText: {
    color: 'white',
    fontSize: moderateScale(10),
    fontWeight: 'bold',
  },
  doctorsSection: {
    flex: 1,
    paddingHorizontal: moderateScale(16),
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(16),
  },
  doctorsCount: {
    fontSize: moderateScale(14),
    color: '#718096',
  },
  doctorsList: {
    paddingBottom: verticalScale(20),
  },
  doctorCard: {
    backgroundColor: 'white',
    borderRadius: moderateScale(16),
    padding: moderateScale(16),
    marginBottom: verticalScale(16),
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  doctorImageContainer: {
    marginRight: moderateScale(16),
  },
  doctorImageGradient: {
    width: moderateScale(60),
    height: moderateScale(60),
    borderRadius: moderateScale(30),
    justifyContent: 'center',
    alignItems: 'center',
  },
  doctorInfo: {
    flex: 1,
    marginRight: moderateScale(8),
  },
  doctorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: verticalScale(4),
  },
  doctorName: {
    fontSize: moderateScale(16),
    fontWeight: 'bold',
    color: '#2d3748',
    flex: 1,
    marginRight: moderateScale(8),
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: moderateScale(12),
    fontWeight: '600',
    color: '#2d3748',
    marginLeft: moderateScale(4),
  },
  reviewsText: {
    fontSize: moderateScale(12),
    color: '#718096',
    marginLeft: moderateScale(4),
  },
  doctorSpecialty: {
    fontSize: moderateScale(14),
    color: '#1976d2',
    fontWeight: '500',
    marginBottom: verticalScale(8),
  },
  experienceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: verticalScale(8),
  },
  experienceText: {
    fontSize: moderateScale(13),
    color: '#666',
    marginLeft: moderateScale(6),
  },
  availabilityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: verticalScale(8),
  },
  availabilityDot: {
    width: moderateScale(8),
    height: moderateScale(8),
    borderRadius: moderateScale(4),
    marginRight: moderateScale(6),
  },
  availabilityText: {
    fontSize: moderateScale(12),
    fontWeight: '500',
  },
  feeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  feeLabel: {
    fontSize: moderateScale(12),
    color: '#718096',
    marginRight: moderateScale(4),
  },
  feeText: {
    fontSize: moderateScale(14),
    fontWeight: 'bold',
    color: '#2d3748',
  },
  bookButton: {
    backgroundColor: '#1976d2',
    paddingHorizontal: moderateScale(12),
    paddingVertical: verticalScale(8),
    borderRadius: moderateScale(8),
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-start',
    minWidth: moderateScale(80),
  },
  bookButtonDisabled: {
    backgroundColor: '#cbd5e0',
  },
  bookButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: moderateScale(12),
  },
  bookButtonTextDisabled: {
    color: '#718096',
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: verticalScale(40),
  },
  emptyTitle: {
    fontSize: moderateScale(18),
    fontWeight: '600',
    color: '#4a5568',
    marginTop: verticalScale(16),
    marginBottom: verticalScale(8),
  },
  emptyText: {
    fontSize: moderateScale(14),
    color: '#718096',
    textAlign: 'center',
    marginBottom: verticalScale(24),
    paddingHorizontal: moderateScale(20),
  },
  emptyButton: {
    backgroundColor: '#1976d2',
    paddingHorizontal: moderateScale(24),
    paddingVertical: verticalScale(12),
    borderRadius: moderateScale(8),
  },
  emptyButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: moderateScale(14),
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: verticalScale(16),
    fontSize: moderateScale(16),
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: moderateScale(20),
  },
  errorText: {
    fontSize: moderateScale(16),
    color: '#4a5568',
    textAlign: 'center',
    marginVertical: verticalScale(16),
  },
  retryButton: {
    backgroundColor: '#1976d2',
    paddingHorizontal: moderateScale(24),
    paddingVertical: verticalScale(12),
    borderRadius: moderateScale(8),
  },
  retryButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: moderateScale(14),
  },
});

export default FindDoctorScreen;