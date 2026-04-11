import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  RefreshControl,
  ScrollView,
  Animated,
  TouchableOpacity,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StackScreenProps } from '@react-navigation/stack';
import { RootStackParamList } from '../navigationTypes';

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

interface Doctor {
  _id: string;
  user_id: {
    name: string;
    avatar?: string;
  };
}

const StarRating = ({ rating, size = 20 }: { rating: number; size?: number }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
    {[1, 2, 3, 4, 5].map(i => (
      <Ionicons
        key={i}
        name={i <= rating ? 'star' : 'star-outline'}
        size={size}
        color={i <= rating ? '#FFB800' : '#E5E5EA'}
        style={{ marginHorizontal: 2 }}
      />
    ))}
    <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
  </View>
);

type Props = StackScreenProps<RootStackParamList, 'Feedback'>;

const FeedbackScreen: React.FC<Props> = ({ navigation, route }) => {
  const [doctorReviews, setDoctorReviews] = useState<{
    doctor: Doctor;
    reviews: Review[];
  }[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fadeAnim] = useState(new Animated.Value(0));

  const fetchAllDoctorReviews = async () => {
    setLoading(true);
    setError(null);
    try {
      const doctorRes = await fetch(`${API_BASE_URL}/api/patient/doctors`);
      if (!doctorRes.ok) throw new Error('Failed to fetch doctors');
      const doctors: Doctor[] = await doctorRes.json();

      const allDoctorReviews: { doctor: Doctor; reviews: Review[] }[] = [];
      for (const doctor of doctors) {
        const reviewRes = await fetch(`${API_BASE_URL}/api/patient/doctors/${doctor._id}/reviews`);
        let reviews: Review[] = [];
        if (reviewRes.ok) {
          const data = await reviewRes.json();
          reviews = data.reviews || [];
        }
        allDoctorReviews.push({ doctor, reviews });
      }
      setDoctorReviews(allDoctorReviews);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }).start();
    } catch (err) {
      setError('Failed to load feedback. Please check your connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };



  useEffect(() => {
    fetchAllDoctorReviews();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fadeAnim.setValue(0);
    fetchAllDoctorReviews();
  };

  const getRandomGradient = () => {
    const gradients = [
      ['#4A90E2', '#357ABD'],
      ['#4A90E2', '#63A4FF'],
      ['#4A90E2', '#2E75B6'],
      ['#63A4FF', '#4A90E2'],
      ['#357ABD', '#4A90E2']
    ];
    return gradients[Math.floor(Math.random() * gradients.length)];
  };

  const ReviewCard = ({ review, doctor }: { review: Review; doctor: Doctor }) => {
    const [cardScale] = useState(new Animated.Value(0.95));
    const [isLiked, setIsLiked] = useState(false);

    useEffect(() => {
      Animated.spring(cardScale, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }).start();
    }, []);

    const handleLike = () => {
      setIsLiked(!isLiked);
    };

    return (
      <Animated.View
        style={[
          styles.card,
          {
            transform: [{ scale: cardScale }],
            opacity: fadeAnim
          }
        ]}
      >
        <LinearGradient
          colors={getRandomGradient()}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientBorder}
        >
          <View style={styles.cardContent}>
            <View style={styles.cardHeader}>
              <View style={styles.userInfo}>
                <View style={styles.avatarContainer}>
                  <Ionicons name="person-circle" size={36} color="#4A90E2" />
                </View>
                <View style={styles.nameContainer}>
                  <Text style={styles.userName}>{review.user_id?.name || 'User'}</Text>
                  <Text style={styles.doctorName}>for Dr. {doctor.user_id?.name || 'Doctor'}</Text>
                </View>
              </View>
              <StarRating rating={review.rating} />
            </View>

            {review.comment ? (
              <View style={styles.commentContainer}>
                <Ionicons name="chatbubble-outline" size={16} color="#4A90E2" style={styles.commentIcon} />
                <Text style={styles.comment}>{review.comment}</Text>
              </View>
            ) : null}

            <View style={styles.cardFooter}>
              <View style={styles.dateContainer}>
                <Ionicons name="time-outline" size={14} color="#8E8E93" />
                <Text style={styles.date}>
                  {new Date(review.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  })}
                </Text>
              </View>
              <TouchableOpacity style={styles.likeButton} onPress={handleLike}>
                <Ionicons
                  name={isLiked ? 'heart' : 'heart-outline'}
                  size={18}
                  color={isLiked ? '#FF3B30' : '#8E8E93'}
                />
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>
    );
  };

  const ReviewStats = () => {
    const totalReviews = doctorReviews.reduce((sum, dr) => sum + dr.reviews.length, 0);
    const averageRating = doctorReviews.flatMap(dr => dr.reviews)
      .reduce((sum, review) => sum + review.rating, 0) / totalReviews || 0;

    if (totalReviews === 0) return null;

    return (
      <Animated.View style={[styles.statsContainer, { opacity: fadeAnim }]}>
        <LinearGradient colors={['#4A90E2', '#357ABD']} style={styles.statsGradient}>
          <View style={styles.statItem}>
            <Ionicons name="stats-chart" size={24} color="#FFFFFF" />
            <Text style={styles.statValue}>{totalReviews}</Text>
            <Text style={styles.statLabel}>Total Reviews</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="star" size={24} color="#FFB800" />
            <Text style={styles.statValue}>{averageRating.toFixed(1)}</Text>
            <Text style={styles.statLabel}>Average Rating</Text>
          </View>
        </LinearGradient>
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <LinearGradient colors={['#4A90E2', '#63A4FF']} style={styles.header}>
        <SafeAreaView>
          <View style={styles.headerContent}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Doctor's Feedback</Text>
            <Ionicons name="heart-circle" size={28} color="#FFFFFF" />
          </View>
        </SafeAreaView>
      </LinearGradient>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#4A90E2" />
          <Text style={styles.loadingText}>Loading feedback...</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={64} color="#4A90E2" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchAllDoctorReviews}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#4A90E2", "#357ABD"]}
              tintColor={"#4A90E2"}
            />
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          <ReviewStats />

          {doctorReviews.flatMap(({ doctor, reviews }) =>
            reviews.length > 0
              ? reviews.map(review => (
                <ReviewCard key={review._id} review={review} doctor={doctor} />
              ))
              : []
          )}

          {doctorReviews.every(dr => dr.reviews.length === 0) && (
            <Animated.View style={[styles.centered, { opacity: fadeAnim }]}>
              <Ionicons name="chatbubbles-outline" size={80} color="#4A90E2" />
              <Text style={styles.emptyTitle}>No Feedback Yet</Text>
              <Text style={styles.emptyText}>Patient feedback will appear here once reviews are submitted.</Text>
            </Animated.View>
          )}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 20,
  },
  statsContainer: {
    marginBottom: 20,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  statsGradient: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    padding: 24,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    marginVertical: 4,
  },
  statLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  card: {
    marginBottom: 16,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 6,
  },
  gradientBorder: {
    borderRadius: 20,
    padding: 2,
  },
  cardContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    marginRight: 12,
  },
  nameContainer: {
    flex: 1,
  },
  userName: {
    fontWeight: '700',
    fontSize: 16,
    color: '#1A1A1A',
    marginBottom: 2,
  },
  doctorName: {
    fontSize: 13,
    color: '#4A90E2',
    fontWeight: '600',
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginLeft: 8,
  },
  commentContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    backgroundColor: '#F0F7FF',
    padding: 12,
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#4A90E2',
  },
  commentIcon: {
    marginRight: 8,
    marginTop: 2,
  },
  comment: {
    fontSize: 15,
    color: '#2D3748',
    lineHeight: 20,
    flex: 1,
    fontWeight: '400',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  date: {
    fontSize: 13,
    color: '#8E8E93',
    marginLeft: 6,
    fontWeight: '500',
  },
  likeButton: {
    padding: 6,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#4A90E2',
    fontWeight: '500',
  },
  errorText: {
    fontSize: 16,
    color: '#2D3748',
    textAlign: 'center',
    marginVertical: 16,
    fontWeight: '500',
    lineHeight: 22,
  },
  retryButton: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
    shadowColor: '#4A90E2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#4A90E2',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '400',
  },
});

export default FeedbackScreen;