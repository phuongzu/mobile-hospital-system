import React, { useEffect, useState } from "react";
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
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { StackScreenProps } from "@react-navigation/stack";
import { RootStackParamList } from "../navigationTypes";

const API_BASE_URL = "http://localhost:3000";

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

const StarRating = ({
  rating,
  size = 20,
}: {
  rating: number;
  size?: number;
}) => (
  <View style={{ flexDirection: "row", alignItems: "center" }}>
    {[1, 2, 3, 4, 5].map((i) => (
      <Ionicons
        key={i}
        name={i <= rating ? "star" : "star-outline"}
        size={size}
        color={i <= rating ? "#FFB800" : "#E5E5EA"}
        style={{ marginHorizontal: 2 }}
      />
    ))}
    <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
  </View>
);

type Props = StackScreenProps<RootStackParamList, "Feedback">;

const FeedbackScreen: React.FC<Props> = ({ navigation, route }) => {
  const [doctorReviews, setDoctorReviews] = useState<
    {
      doctor: Doctor;
      reviews: Review[];
    }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fadeAnim] = useState(new Animated.Value(0));

  const fetchAllDoctorReviews = async () => {
    setLoading(true);
    setError(null);
    try {
      const doctorRes = await fetch(`${API_BASE_URL}/api/patient/doctors`);
      if (!doctorRes.ok) throw new Error("Failed to fetch doctors");
      const doctors: Doctor[] = await doctorRes.json();

      const allDoctorReviews: { doctor: Doctor; reviews: Review[] }[] = [];
      for (const doctor of doctors) {
        const reviewRes = await fetch(
          `${API_BASE_URL}/api/patient/doctors/${doctor._id}/reviews`,
        );
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
      setError("Failed to load feedback. Please check your connection.");
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

  const getRandomGradient = (): [string, string, ...string[]] => {
    const gradients: [string, string, ...string[]][] = [
      ["#4A90E2", "#357ABD"],
      ["#4A90E2", "#63A4FF"],
      ["#4A90E2", "#2E75B6"],
      ["#63A4FF", "#4A90E2"],
      ["#357ABD", "#4A90E2"],
    ];
    return gradients[Math.floor(Math.random() * gradients.length)];
  };

  const ReviewCard = ({
    review,
    doctor,
  }: {
    review: Review;
    doctor: Doctor;
  }) => {
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
            opacity: fadeAnim,
          },
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
                  <Text style={styles.userName}>
                    {review.user_id?.name || "User"}
                  </Text>
                  <Text style={styles.doctorName}>
                    for Dr. {doctor.user_id?.name || "Doctor"}
                  </Text>
                </View>
              </View>
              <StarRating rating={review.rating} />
            </View>

            {review.comment ? (
              <View style={styles.commentContainer}>
                <Ionicons
                  name="chatbubble-outline"
                  size={16}
                  color="#4A90E2"
                  style={styles.commentIcon}
                />
                <Text style={styles.comment}>{review.comment}</Text>
              </View>
            ) : null}

            <View style={styles.cardFooter}>
              <View style={styles.dateContainer}>
                <Ionicons name="time-outline" size={14} color="#8E8E93" />
                <Text style={styles.date}>
                  {new Date(review.created_at).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </Text>
              </View>
              <TouchableOpacity style={styles.likeButton} onPress={handleLike}>
                <Ionicons
                  name={isLiked ? "heart" : "heart-outline"}
                  size={18}
                  color={isLiked ? "#FF3B30" : "#8E8E93"}
                />
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>
    );
  };

  const ReviewStats = () => {
    const totalReviews = doctorReviews.reduce(
      (sum, dr) => sum + dr.reviews.length,
      0,
    );
    const averageRating =
      doctorReviews
        .flatMap((dr) => dr.reviews)
        .reduce((sum, review) => sum + review.rating, 0) / totalReviews || 0;

    if (totalReviews === 0) return null;

    return (
      <Animated.View style={[styles.statsContainer, { opacity: fadeAnim }]}>
        <LinearGradient
          colors={["#4A90E2", "#357ABD"]}
          style={styles.statsGradient}
        >
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
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      <LinearGradient colors={["#4A90E2", "#63A4FF"]} style={styles.header}>
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
          <TouchableOpacity
            style={styles.retryButton}
            onPress={fetchAllDoctorReviews}
          >
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
              ? reviews.map((review) => (
                <ReviewCard
                  key={review._id}
                  review={review}
                  doctor={doctor}
                />
              ))
              : [],
          )}

          {doctorReviews.every((dr) => dr.reviews.length === 0) && (
            <Animated.View style={[styles.centered, { opacity: fadeAnim }]}>
              <Ionicons name="chatbubbles-outline" size={80} color="#4A90E2" />
              <Text style={styles.emptyTitle}>No Feedback Yet</Text>
              <Text style={styles.emptyText}>
                Patient feedback will appear here once reviews are submitted.
              </Text>
            </Animated.View>
          )}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  avatarContainer: {
    marginRight: 12,
  },
  backButton: {
    padding: 8,
  },
  card: {
    borderRadius: 20,
    elevation: 6,
    marginBottom: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
  },
  cardContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 20,
  },
  cardFooter: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  cardHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  centered: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: 40,
  },
  comment: {
    color: "#2D3748",
    flex: 1,
    fontSize: 15,
    fontWeight: "400",
    lineHeight: 20,
  },
  commentContainer: {
    alignItems: "flex-start",
    backgroundColor: "#F0F7FF",
    borderLeftColor: "#4A90E2",
    borderLeftWidth: 3,
    borderRadius: 12,
    flexDirection: "row",
    marginBottom: 16,
    padding: 12,
  },
  commentIcon: {
    marginRight: 8,
    marginTop: 2,
  },
  container: {
    backgroundColor: "#F8FAFC",
    flex: 1,
  },
  date: {
    color: "#8E8E93",
    fontSize: 13,
    fontWeight: "500",
    marginLeft: 6,
  },
  dateContainer: {
    alignItems: "center",
    flexDirection: "row",
  },
  doctorName: {
    color: "#4A90E2",
    fontSize: 13,
    fontWeight: "600",
  },
  emptyText: {
    color: "#666",
    fontSize: 15,
    fontWeight: "400",
    lineHeight: 20,
    textAlign: "center",
  },
  emptyTitle: {
    color: "#4A90E2",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
    marginTop: 16,
  },
  errorText: {
    color: "#2D3748",
    fontSize: 16,
    fontWeight: "500",
    lineHeight: 22,
    marginVertical: 16,
    textAlign: "center",
  },
  gradientBorder: {
    borderRadius: 20,
    padding: 2,
  },
  header: {
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    elevation: 8,
    paddingBottom: 20,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  headerContent: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
  },
  likeButton: {
    padding: 6,
  },
  listContent: {
    padding: 16,
    paddingBottom: 20,
  },
  loadingText: {
    color: "#4A90E2",
    fontSize: 16,
    fontWeight: "500",
    marginTop: 16,
  },
  nameContainer: {
    flex: 1,
  },
  ratingText: {
    color: "#1A1A1A",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 8,
  },
  retryButton: {
    backgroundColor: "#4A90E2",
    borderRadius: 12,
    elevation: 4,
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    shadowColor: "#4A90E2",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  retryText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  statDivider: {
    backgroundColor: "rgba(255,255,255,0.3)",
    height: 40,
    width: 1,
  },
  statItem: {
    alignItems: "center",
  },
  statLabel: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 14,
    fontWeight: "500",
  },
  statValue: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "800",
    marginVertical: 4,
  },
  statsContainer: {
    borderRadius: 20,
    elevation: 5,
    marginBottom: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  statsGradient: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-around",
    padding: 24,
  },
  userInfo: {
    alignItems: "center",
    flexDirection: "row",
    flex: 1,
  },
  userName: {
    color: "#1A1A1A",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 2,
  },
});

export default FeedbackScreen;
