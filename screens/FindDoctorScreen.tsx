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
  SafeAreaView,
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

const specialtyIconMap: { [key: string]: { icon: string; gradient: string[] } } = {
  Cardiology: { icon: 'heart', gradient: ['#FF6B6B', '#EE5A6F'] },
  Dermatology: { icon: 'body', gradient: ['#4ECDC4', '#44A08D'] },
  Neurology: { icon: 'medkit', gradient: ['#45B7D1', '#3498DB'] },
  Pediatrics: { icon: 'happy', gradient: ['#F9A826', '#F77F00'] },
  Orthopedics: { icon: 'bandage', gradient: ['#9B59B6', '#8E44AD'] },
  Ophthalmology: { icon: 'eye', gradient: ['#AB47BC', '#8E24AA'] },
  Dentistry: { icon: 'medical', gradient: ['#42A5F5', '#1E88E5'] },
  Psychiatry: { icon: 'headset', gradient: ['#66BB6A', '#43A047'] },
  Surgery: { icon: 'cut', gradient: ['#EC407A', '#D81B60'] },
  Gynecology: { icon: 'female', gradient: ['#FF7043', '#F4511E'] },
  Endocrinology: { icon: 'pulse', gradient: ['#7E57C2', '#5E35B1'] },
  Gastroenterology: { icon: 'nutrition', gradient: ['#26A69A', '#00897B'] },
  Default: { icon: 'medical', gradient: ['#42A5F5', '#1E88E5'] },
};

const API_BASE_URL = 'http://localhost:3000';

const FindDoctorScreen = ({ navigation }: any) => {
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [doctorsBySpecialty, setDoctorsBySpecialty] = useState<{ [key: string]: Doctor[] }>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

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

  const getDoctorCount = (specialtyId: string) => {
    return doctorsBySpecialty[specialtyId]?.length || 0;
  };

  const renderDoctorItem = ({ item: doctor }: { item: Doctor }) => {
    const iconInfo = getSpecialtyIcon(doctor.specialty_id?.name || 'Default');

    return (
      <TouchableOpacity
        style={styles.doctorCard}
        onPress={() => navigation.navigate('DoctorDetail', { doctor })}
        activeOpacity={0.7}
      >
        <View style={styles.doctorCardInner}>
          <View style={styles.doctorAvatarContainer}>
            <LinearGradient
              colors={iconInfo.gradient}
              style={styles.doctorAvatar}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="person" size={moderateScale(32)} color="white" />
            </LinearGradient>

            {/* Status Badge */}
            <View style={[styles.statusBadge, {
              backgroundColor:
                doctor.user_id?.status === 'working' ? '#10B981' :
                  doctor.user_id?.status === 'busy' ? '#F59E0B' : '#EF4444',
            }]}>
              <View style={styles.statusDot} />
            </View>
          </View>

          {/* Doctor Info */}
          <View style={styles.doctorContent}>
            <View style={styles.doctorMainInfo}>
              <Text style={styles.doctorName} numberOfLines={1}>
                Dr. {doctor.user_id?.name || 'Unknown'}
              </Text>

              <View style={styles.specialtyTag}>
                <LinearGradient
                  colors={[iconInfo.gradient[0] + '20', iconInfo.gradient[1] + '20']}
                  style={styles.specialtyTagGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Ionicons name={iconInfo.icon as any} size={moderateScale(12)} color={iconInfo.gradient[0]} />
                  <Text style={[styles.specialtyTagText, { color: iconInfo.gradient[0] }]}>
                    {doctor.specialty_id?.name}
                  </Text>
                </LinearGradient>
              </View>
            </View>

            {/* Doctor Details */}
            <View style={styles.doctorDetails}>
              {doctor.years_of_experience > 0 && (
                <View style={styles.detailItem}>
                  <View style={styles.detailIconContainer}>
                    <Ionicons name="briefcase-outline" size={moderateScale(14)} color="#64748B" />
                  </View>
                  <Text style={styles.detailText}>{doctor.years_of_experience}+ years</Text>
                </View>
              )}

              <View style={styles.detailItem}>
                <View style={styles.detailIconContainer}>
                  <Ionicons
                    name={doctor.user_id?.status === 'working' ? 'checkmark-circle' : 'close-circle'}
                    size={moderateScale(14)}
                    color={doctor.user_id?.status === 'working' ? '#10B981' : '#EF4444'}
                  />
                </View>
                <Text style={[styles.detailText, {
                  color: doctor.user_id?.status === 'working' ? '#10B981' : '#64748B'
                }]}>
                  {doctor.user_id?.status === 'working' ? 'Available Now' :
                    doctor.user_id?.status === 'busy' ? 'Busy' : 'Offline'}
                </Text>
              </View>
            </View>

            {/* Fee and Action */}
            <View style={styles.doctorFooter}>
              <View style={styles.feeBox}>
                <Text style={styles.feeLabel}>Fee</Text>
                <Text style={styles.feeAmount}>${doctor.consultation_fee}</Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.bookButton,
                  doctor.user_id?.status !== 'working' && styles.bookButtonDisabled
                ]}
                onPress={() => navigation.navigate('Appointments', { doctor })}
                disabled={doctor.user_id?.status !== 'working'}
              >
                <LinearGradient
                  colors={doctor.user_id?.status === 'working' ? ['#3B82F6', '#2563EB'] : ['#E2E8F0', '#CBD5E1']}
                  style={styles.bookButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Ionicons
                    name="calendar"
                    size={moderateScale(16)}
                    color={doctor.user_id?.status === 'working' ? 'white' : '#94A3B8'}
                  />
                  <Text style={[
                    styles.bookButtonText,
                    doctor.user_id?.status !== 'working' && styles.bookButtonTextDisabled
                  ]}>
                    Book Now
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderSpecialtyItem = ({ item: specialty }: { item: Specialty }) => {
    const isActive = activeCategory === specialty._id;
    const iconInfo = getSpecialtyIcon(specialty.name);
    const count = getDoctorCount(specialty._id);

    return (
      <TouchableOpacity
        style={[styles.specialtyCard, isActive && styles.specialtyCardActive]}
        onPress={() => setActiveCategory(specialty._id)}
        activeOpacity={0.7}
      >
        {isActive ? (
          <LinearGradient
            colors={iconInfo.gradient}
            style={styles.specialtyCardGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.specialtyIcon}>
              <Ionicons name={iconInfo.icon as any} size={moderateScale(20)} color="white" />
            </View>
            <Text style={styles.specialtyNameActive} numberOfLines={2}>
              {specialty.name}
            </Text>
            {count > 0 && (
              <View style={styles.countBadgeActive}>
                <Text style={styles.countBadgeTextActive}>{count}</Text>
              </View>
            )}
          </LinearGradient>
        ) : (
          <View style={styles.specialtyCardContent}>
            <View style={[styles.specialtyIconInactive, { backgroundColor: iconInfo.gradient[0] + '15' }]}>
              <Ionicons name={iconInfo.icon as any} size={moderateScale(20)} color={iconInfo.gradient[0]} />
            </View>
            <Text style={styles.specialtyName} numberOfLines={2}>
              {specialty.name}
            </Text>
            {count > 0 && (
              <View style={[styles.countBadge, { backgroundColor: iconInfo.gradient[0] }]}>
                <Text style={styles.countBadgeText}>{count}</Text>
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <LinearGradient
          colors={['#4A90E2', '#63A4FF']}
          style={StyleSheet.absoluteFill}
        >
          <SafeAreaView style={styles.loadingContent}>
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color="#3B82F6" />
              <Text style={styles.loadingText}>Finding the best doctors for you...</Text>
            </View>
          </SafeAreaView>
        </LinearGradient>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
        <SafeAreaView style={styles.errorContent}>
          <View style={styles.errorBox}>
            <View style={styles.errorIconContainer}>
              <Ionicons name="alert-circle" size={moderateScale(64)} color="#EF4444" />
            </View>
            <Text style={styles.errorTitle}>Oops! Something went wrong</Text>
            <Text style={styles.errorMessage}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={fetchSpecialtiesAndDoctors}>
              <LinearGradient
                colors={['#4A90E2', '#63A4FF']}
                style={styles.retryButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Ionicons name="refresh" size={moderateScale(20)} color="white" />
                <Text style={styles.retryButtonText}>Try Again</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Modern Header with Gradient */}
      <LinearGradient
        colors={['#4A90E2', '#63A4FF']}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <SafeAreaView>
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
              <View style={styles.headerButtonInner}>
                <Ionicons name="arrow-back" size={moderateScale(24)} color="white" />
              </View>
            </TouchableOpacity>

            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>Start Your Health Journey</Text>
              <Text style={styles.headerSubtitle}>Connect with specialists</Text>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* Main Content */}
      <View style={styles.mainContent}>
        {/* Specialties Section */}
        <View style={styles.specialtiesSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Medical Specialties</Text>
            <TouchableOpacity>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={specialties}
            renderItem={renderSpecialtyItem}
            keyExtractor={item => item._id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.specialtiesList}
          />
        </View>

        {/* Doctors Section */}
        <View style={styles.doctorsSection}>
          <View style={styles.doctorsHeader}>
            <View>
              <Text style={styles.doctorsTitle}>
                {activeCategory ? specialties.find(s => s._id === activeCategory)?.name : 'All'} Doctors
              </Text>
              <Text style={styles.doctorsSubtitle}>
                {activeCategory ? getDoctorCount(activeCategory) :
                  specialties.reduce((acc, s) => acc + getDoctorCount(s._id), 0)} doctors available
              </Text>
            </View>
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
                  colors={["#3B82F6"]}
                  tintColor="#3B82F6"
                />
              }
              contentContainerStyle={styles.doctorsList}
            />
          ) : (
            <ScrollView
              contentContainerStyle={styles.emptyScrollContent}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  colors={["#3B82F6"]}
                  tintColor="#3B82F6"
                />
              }
            >
              <View style={styles.emptyState}>
                <View style={styles.emptyIconContainer}>
                  <LinearGradient
                    colors={['#DBEAFE', '#BFDBFE']}
                    style={styles.emptyIconGradient}
                  >
                    <Ionicons name="medical-outline" size={moderateScale(48)} color="#3B82F6" />
                  </LinearGradient>
                </View>
                <Text style={styles.emptyTitle}>No Doctors Available</Text>
                <Text style={styles.emptyMessage}>
                  There are currently no doctors available in this specialty. Please try another specialty or refresh.
                </Text>
                <TouchableOpacity style={styles.emptyButton} onPress={onRefresh}>
                  <LinearGradient
                    colors={['#4A90E2', '#63A4FF']}
                    style={styles.emptyButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Ionicons name="refresh" size={moderateScale(18)} color="white" />
                    <Text style={styles.emptyButtonText}>Refresh List</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },

  // Header Styles
  header: {
    paddingTop: verticalScale(20),
    paddingBottom: verticalScale(20),
    borderBottomLeftRadius: moderateScale(24),
    borderBottomRightRadius: moderateScale(24),
    shadowColor: '#4A90E2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerButton: {
    width: moderateScale(44),
    height: moderateScale(44),
    marginTop: verticalScale(20),
    marginBottom: verticalScale(10),
    borderRadius: moderateScale(20),
  },
  headerButtonInner: {
    marginLeft: moderateScale(10),
    marginBottom: moderateScale(10),
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: moderateScale(12),
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: moderateScale(20),
    fontWeight: '700',
    color: 'white',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: moderateScale(16),
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: verticalScale(2),
    fontWeight: '500',
  },

  // Main Content
  mainContent: {
    flex: 1,
    marginTop: verticalScale(-20),
  },

  // Specialties Section
  specialtiesSection: {
    paddingTop: verticalScale(24),
    paddingBottom: verticalScale(20),
    backgroundColor: 'white',
    borderTopLeftRadius: moderateScale(30),
    borderTopRightRadius: moderateScale(30),
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: moderateScale(20),
    marginBottom: verticalScale(16),
  },
  sectionTitle: {
    fontSize: moderateScale(20),
    fontWeight: '700',
    color: '#1E293B',
    letterSpacing: 0.3,
  },
  seeAllText: {
    fontSize: moderateScale(14),
    color: '#3B82F6',
    fontWeight: '600',
  },
  specialtiesList: {
    paddingHorizontal: moderateScale(20),
  },
  specialtyCard: {
    width: moderateScale(110),
    height: verticalScale(130),
    marginRight: moderateScale(12),
    borderRadius: moderateScale(20),
    overflow: 'hidden',
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#F1F5F9',
  },
  specialtyCardActive: {
    borderColor: 'transparent',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  specialtyCardGradient: {
    flex: 1,
    padding: moderateScale(14),
    justifyContent: 'space-between',
  },
  specialtyCardContent: {
    flex: 1,
    padding: moderateScale(14),
    justifyContent: 'space-between',
    backgroundColor: 'white',
  },
  specialtyIcon: {
    width: moderateScale(48),
    height: moderateScale(48),
    borderRadius: moderateScale(14),
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  specialtyIconInactive: {
    width: moderateScale(48),
    height: moderateScale(48),
    borderRadius: moderateScale(14),
    justifyContent: 'center',
    alignItems: 'center',
  },
  specialtyName: {
    fontSize: moderateScale(13),
    fontWeight: '600',
    color: '#334155',
    lineHeight: moderateScale(16),
  },
  specialtyNameActive: {
    fontSize: moderateScale(13),
    fontWeight: '700',
    color: 'white',
    lineHeight: moderateScale(16),
  },
  countBadge: {
    position: 'absolute',
    top: moderateScale(10),
    right: moderateScale(10),
    minWidth: moderateScale(24),
    height: moderateScale(24),
    borderRadius: moderateScale(12),
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: moderateScale(6),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  countBadgeActive: {
    position: 'absolute',
    top: moderateScale(10),
    right: moderateScale(10),
    minWidth: moderateScale(24),
    height: moderateScale(24),
    borderRadius: moderateScale(12),
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: moderateScale(6),
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  countBadgeText: {
    fontSize: moderateScale(11),
    fontWeight: '700',
    color: 'white',
  },
  countBadgeTextActive: {
    fontSize: moderateScale(11),
    fontWeight: '700',
    color: 'white',
  },

  // Doctors Section
  doctorsSection: {
    flex: 1,
    paddingHorizontal: moderateScale(20),
    paddingTop: verticalScale(20),
  },
  doctorsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(16),
  },
  doctorsTitle: {
    fontSize: moderateScale(20),
    fontWeight: '700',
    color: '#1E293B',
    letterSpacing: 0.3,
  },
  doctorsSubtitle: {
    fontSize: moderateScale(13),
    color: '#64748B',
    marginTop: verticalScale(2),
    fontWeight: '500',
  },
  doctorsList: {
    paddingBottom: verticalScale(20),
  },

  // Doctor Card
  doctorCard: {
    marginBottom: verticalScale(16),
    borderRadius: moderateScale(20),
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    overflow: 'hidden',
  },
  doctorCardInner: {
    padding: moderateScale(16),
  },
  doctorAvatarContainer: {
    position: 'relative',
    marginBottom: verticalScale(14),
  },
  doctorAvatar: {
    width: moderateScale(68),
    height: moderateScale(68),
    borderRadius: moderateScale(20),
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  statusBadge: {
    position: 'absolute',
    bottom: moderateScale(2),
    right: moderateScale(2),
    width: moderateScale(20),
    height: moderateScale(20),
    borderRadius: moderateScale(10),
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'white',
  },
  statusDot: {
    width: moderateScale(8),
    height: moderateScale(8),
    borderRadius: moderateScale(4),
    backgroundColor: 'white',
  },
  doctorContent: {
    flex: 1,
  },
  doctorMainInfo: {
    marginBottom: verticalScale(12),
  },
  doctorName: {
    fontSize: moderateScale(18),
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: verticalScale(8),
    letterSpacing: 0.3,
  },
  specialtyTag: {
    alignSelf: 'flex-start',
    borderRadius: moderateScale(10),
    overflow: 'hidden',
  },
  specialtyTagGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: moderateScale(12),
    paddingVertical: verticalScale(6),
    gap: moderateScale(6),
  },
  specialtyTagText: {
    fontSize: moderateScale(13),
    fontWeight: '600',
  },
  doctorDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: moderateScale(12),
    marginBottom: verticalScale(14),
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(6),
  },
  detailIconContainer: {
    width: moderateScale(24),
    height: moderateScale(24),
    borderRadius: moderateScale(8),
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailText: {
    fontSize: moderateScale(13),
    color: '#64748B',
    fontWeight: '500',
  },
  doctorFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: verticalScale(14),
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  feeBox: {
    flex: 1,
  },
  feeLabel: {
    fontSize: moderateScale(12),
    color: '#64748B',
    fontWeight: '500',
    marginBottom: verticalScale(4),
  },
  feeAmount: {
    fontSize: moderateScale(22),
    fontWeight: '700',
    color: '#1E293B',
    letterSpacing: 0.3,
  },
  bookButton: {
    borderRadius: moderateScale(14),
    overflow: 'hidden',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  bookButtonDisabled: {
    shadowColor: '#94A3B8',
    shadowOpacity: 0.1,
    elevation: 2,
  },
  bookButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: moderateScale(20),
    paddingVertical: verticalScale(12),
    gap: moderateScale(8),
  },
  bookButtonText: {
    fontSize: moderateScale(15),
    fontWeight: '700',
    color: 'white',
    letterSpacing: 0.3,
  },
  bookButtonTextDisabled: {
    color: '#94A3B8',
  },

  // Empty State
  emptyScrollContent: {
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: verticalScale(60),
    paddingHorizontal: moderateScale(30),
  },
  emptyIconContainer: {
    marginBottom: verticalScale(24),
  },
  emptyIconGradient: {
    width: moderateScale(100),
    height: moderateScale(100),
    borderRadius: moderateScale(30),
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: moderateScale(22),
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: verticalScale(8),
    letterSpacing: 0.3,
  },
  emptyMessage: {
    fontSize: moderateScale(15),
    color: '#64748B',
    textAlign: 'center',
    lineHeight: moderateScale(22),
    marginBottom: verticalScale(32),
    fontWeight: '500',
  },
  emptyButton: {
    borderRadius: moderateScale(14),
    overflow: 'hidden',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  emptyButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: moderateScale(28),
    paddingVertical: verticalScale(14),
    gap: moderateScale(8),
  },
  emptyButtonText: {
    fontSize: moderateScale(15),
    fontWeight: '700',
    color: 'white',
    letterSpacing: 0.3,
  },

  // Loading State
  loadingContainer: {
    flex: 1,
  },
  loadingContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingBox: {
    backgroundColor: 'white',
    borderRadius: moderateScale(24),
    padding: moderateScale(40),
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
  },
  loadingText: {
    marginTop: verticalScale(20),
    fontSize: moderateScale(16),
    color: '#64748B',
    fontWeight: '600',
    textAlign: 'center',
  },

  // Error State
  errorContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  errorContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: moderateScale(30),
  },
  errorBox: {
    backgroundColor: 'white',
    borderRadius: moderateScale(24),
    padding: moderateScale(30),
    alignItems: 'center',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
  },
  errorIconContainer: {
    width: moderateScale(100),
    height: moderateScale(100),
    borderRadius: moderateScale(50),
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: verticalScale(20),
  },
  errorTitle: {
    fontSize: moderateScale(22),
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: verticalScale(8),
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  errorMessage: {
    fontSize: moderateScale(15),
    color: '#64748B',
    textAlign: 'center',
    lineHeight: moderateScale(22),
    marginBottom: verticalScale(28),
    fontWeight: '500',
  },
  retryButton: {
    borderRadius: moderateScale(14),
    overflow: 'hidden',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  retryButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: moderateScale(32),
    paddingVertical: verticalScale(14),
    gap: moderateScale(8),
  },
  retryButtonText: {
    fontSize: moderateScale(15),
    fontWeight: '700',
    color: 'white',
    letterSpacing: 0.3,
  },
});

export default FindDoctorScreen;