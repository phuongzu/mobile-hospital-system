import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

const { width } = Dimensions.get("window");
const API_BASE_URL = "http://localhost:3000";

interface Review {
  _id: string;
  user_id: {
    _id: string;
    name: string;
    avatar?: string;
  };
  rating: number;
  comment?: string;
  created_at: string;
}

interface User {
  _id: string;
  name: string;
  email: string;
  phoneNumber?: string;
  address?: string;
  avatar?: string;
  status?: string;
}

interface Specialty {
  _id: string;
  name: string;
}

interface Doctor {
  _id: string;
  user_id: User;
  specialty_id?: Specialty;
  consultation_fee?: number;
  rating?: number;
  years_of_experience?: number;
  isAvailable?: boolean;
  languages?: string[];
  education?: string[];
  available_hours?: {
    [key: string]:
      | string
      | { isAvailable: boolean; start: string; end: string };
  };
}

const StarRating = ({
  rating,
  size = 16,
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
        style={{ marginRight: 2 }}
      />
    ))}
    <Text style={[styles.ratingText, { fontSize: size - 2 }]}>
      {rating.toFixed(1)}
    </Text>
  </View>
);

const DoctorDetail = ({
  route,
  navigation,
}: {
  route: any;
  navigation: any;
}) => {
  const { doctor } = route.params as { doctor: Doctor };
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [doctorDetails, setDoctorDetails] = useState<Doctor | null>(null);

  // Handle missing doctor object gracefully
  if (!doctor || !doctor.user_id) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
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

  useEffect(() => {
    fetchDoctorReviews();
    fetchDoctorDetails();
  }, []);

  const fetchDoctorReviews = async () => {
    try {
      setLoadingReviews(true);
      const response = await fetch(
        `${API_BASE_URL}/api/patient/doctors/${doctor._id}/reviews`,
      );

      if (response.ok) {
        const data = await response.json();
        setReviews(data.reviews || []);
      }
    } catch (error) {
      console.error("Error fetching reviews:", error);
      setReviews([]);
    } finally {
      setLoadingReviews(false);
      setRefreshing(false);
    }
  };

  const fetchDoctorDetails = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/patient/doctors/${doctor._id}`,
      );

      if (response.ok) {
        const data = await response.json();
        setDoctorDetails(data);
      }
    } catch (error) {
      console.error("Error fetching doctor details:", error);
      setDoctorDetails(doctor);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchDoctorReviews();
    fetchDoctorDetails();
  };

  // Get status details
  const getStatusDetails = () => {
    const status = doctor.user_id?.status || doctorDetails?.user_id?.status;
    if (status === "working") {
      return { text: "Available", color: "#4caf50", icon: "checkmark-circle" };
    } else if (status === "busy") {
      return { text: "Busy", color: "#ff9800", icon: "time" };
    } else {
      return { text: "Not Available", color: "#f44336", icon: "close-circle" };
    }
  };

  const statusDetails = getStatusDetails();

  // Calculate average rating from reviews
  const calculateAverageRating = () => {
    if (reviews.length === 0) return 0;
    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    return totalRating / reviews.length;
  };

  const averageRating = calculateAverageRating();
  const totalReviews = reviews.length;

  return (
    <View style={styles.container}>
      {/* Header with gradient background */}
      <LinearGradient
        colors={["#1976d2", "#42a5f5"]}
        style={styles.headerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Doctor Profile</Text>
          <TouchableOpacity style={styles.headerIcon}>
            <Ionicons name="ellipsis-vertical" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            {doctor.user_id.avatar ? (
              <Image
                source={{ uri: doctor.user_id.avatar }}
                style={styles.avatar}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={50} color="#1976d2" />
              </View>
            )}
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: statusDetails.color },
              ]}
            >
              <Ionicons name={statusDetails.icon} size={14} color="#fff" />
            </View>
          </View>

          <Text style={styles.name}>
            Dr. {doctor.user_id?.name || "Unknown Doctor"}
          </Text>
          <Text style={styles.specialty}>
            {doctor.specialty_id?.name || "General Practice"}
          </Text>

          <View style={styles.ratingContainer}>
            <StarRating rating={averageRating || doctor.rating || 0} />
            {totalReviews > 0 && (
              <Text style={styles.reviewCount}>({totalReviews} reviews)</Text>
            )}
          </View>

          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {doctor.years_of_experience ||
                  doctorDetails?.years_of_experience ||
                  "5+"}
              </Text>
              <Text style={styles.statLabel}>Years Exp</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {doctor.consultation_fee
                  ? `$${doctor.consultation_fee}`
                  : "N/A"}
              </Text>
              <Text style={styles.statLabel}>Fee</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{totalReviews}</Text>
              <Text style={styles.statLabel}>Reviews</Text>
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
            Dr. {doctor.user_id?.name?.split(" ")[0] || "Doctor"} is a dedicated{" "}
            {doctor.specialty_id?.name || "physician"}
            with over{" "}
            {doctor.years_of_experience ||
              doctorDetails?.years_of_experience ||
              "5"}{" "}
            years of experience. Known for excellent patient care and detailed
            diagnosis.
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
            value={`${doctor.years_of_experience || doctorDetails?.years_of_experience || "N/A"} years`}
            icon="school-outline"
          />
          <InfoRow
            label="Consultation Fee"
            value={
              doctor.consultation_fee ? `$${doctor.consultation_fee}` : "N/A"
            }
            icon="cash-outline"
          />
          <InfoRow
            label="Languages"
            value={
              doctor.languages?.join(", ") ||
              doctorDetails?.languages?.join(", ")
            }
            icon="language-outline"
          />
          <InfoRow
            label="Education"
            value={
              doctor.education?.join(", ") ||
              doctorDetails?.education?.join(", ")
            }
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
                  <Text
                    style={[
                      styles.timeText,
                      {
                        color:
                          typeof hours === "string" ||
                          (hours as any)?.isAvailable
                            ? "#4caf50"
                            : "#f44336",
                      },
                    ]}
                  >
                    {typeof hours === "string"
                      ? hours
                      : (hours as any)?.isAvailable
                        ? `${(hours as any).start} - ${(hours as any).end}`
                        : "Not Available"}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.noAvailability}>
              No availability information
            </Text>
          )}
        </View>

        {/* Reviews Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Patient Reviews</Text>
            <TouchableOpacity
              onPress={() =>
                navigation.navigate("Feedback", { doctorId: doctor._id })
              }
            >
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>

          {loadingReviews ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#1976d2" />
              <Text style={styles.loadingText}>Loading reviews...</Text>
            </View>
          ) : reviews.length > 0 ? (
            <View>
              {reviews.slice(0, 3).map((review) => (
                <ReviewItem key={review._id} review={review} />
              ))}
            </View>
          ) : (
            <Text style={styles.noReviews}>No reviews yet</Text>
          )}
        </View>
      </ScrollView>

      {/* Fixed Book Button */}
      <View style={styles.footer}>
        <View style={styles.priceContainer}>
          <Text style={styles.priceLabel}>Consultation Fee</Text>
          <Text style={styles.priceValue}>
            {doctor.consultation_fee ? `$${doctor.consultation_fee}` : "N/A"}
          </Text>
        </View>
        <TouchableOpacity
          style={[
            styles.bookButton,
            doctor.user_id?.status !== "working" && styles.bookButtonDisabled,
          ]}
          disabled={doctor.user_id?.status !== "working"}
          onPress={() => navigation.navigate("Appointments", { doctor })}
        >
          <Text style={styles.bookButtonText}>
            {doctor.user_id?.status === "working"
              ? "Book Appointment"
              : "Not Available"}
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
      <Text style={styles.infoValue}>{value || "N/A"}</Text>
    </View>
  </View>
);

const ReviewItem = ({ review }: { review: Review }) => (
  <View style={styles.reviewItem}>
    <View style={styles.reviewHeader}>
      <View style={styles.reviewerAvatar}>
        {review.user_id?.avatar ? (
          <Image
            source={{ uri: review.user_id.avatar }}
            style={styles.avatarSmall}
          />
        ) : (
          <Ionicons name="person-circle" size={40} color="#1976d2" />
        )}
      </View>
      <View style={styles.reviewerInfo}>
        <Text style={styles.reviewerName}>
          {review.user_id?.name || "Anonymous"}
        </Text>
        <StarRating rating={review.rating} size={14} />
      </View>
      <Text style={styles.reviewDate}>
        {new Date(review.created_at).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}
      </Text>
    </View>
    {review.comment && (
      <Text style={styles.reviewComment}>{review.comment}</Text>
    )}
  </View>
);

const styles = StyleSheet.create({
  aboutText: {
    color: "#666",
    fontSize: 14,
    lineHeight: 20,
  },
  actionButton: {
    alignItems: "center",
    backgroundColor: "#E3F2FD",
    borderRadius: 12,
    minWidth: 80,
    padding: 12,
  },
  actionButtonText: {
    color: "#1976d2",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
  },
  actionContainer: {
    backgroundColor: "#fff",
    borderRadius: 16,
    elevation: 3,
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 16,
    marginHorizontal: 20,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  avatar: {
    borderColor: "#E3F2FD",
    borderRadius: 50,
    borderWidth: 3,
    height: 100,
    width: 100,
  },
  avatarContainer: {
    marginBottom: 16,
    position: "relative",
  },
  avatarPlaceholder: {
    alignItems: "center",
    backgroundColor: "#E3F2FD",
    borderColor: "#fff",
    borderRadius: 50,
    borderWidth: 3,
    height: 100,
    justifyContent: "center",
    width: 100,
  },
  avatarSmall: {
    borderRadius: 20,
    height: 40,
    width: 40,
  },
  backButton: {
    padding: 8,
  },
  bookButton: {
    backgroundColor: "#1976d2",
    borderRadius: 28,
    elevation: 3,
    paddingHorizontal: 24,
    paddingVertical: 14,
    shadowColor: "#1976d2",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  bookButtonDisabled: {
    backgroundColor: "#B0BEC5",
  },
  bookButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  container: {
    backgroundColor: "#F8FAFC",
    flex: 1,
  },
  dayText: {
    color: "#333",
    fontSize: 14,
    fontWeight: "500",
  },
  footer: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderTopColor: "#E0E0E0",
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
  },
  headerGradient: {
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    paddingBottom: 20,
    paddingTop: 50,
  },
  headerIcon: {
    padding: 8,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
  },
  infoContent: {
    flex: 1,
  },
  infoIcon: {
    alignItems: "center",
    backgroundColor: "#E3F2FD",
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    marginRight: 12,
    width: 36,
  },
  infoLabel: {
    color: "#999",
    fontSize: 12,
    marginBottom: 2,
  },
  infoRow: {
    alignItems: "center",
    borderBottomColor: "#F5F5F5",
    borderBottomWidth: 1,
    flexDirection: "row",
    paddingVertical: 12,
  },
  infoValue: {
    color: "#333",
    fontSize: 14,
    fontWeight: "500",
  },
  loadingContainer: {
    alignItems: "center",
    padding: 20,
  },
  loadingText: {
    color: "#666",
    fontSize: 14,
    marginTop: 8,
  },
  name: {
    color: "#1976d2",
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 4,
    textAlign: "center",
  },
  noAvailability: {
    color: "#999",
    fontSize: 14,
    fontStyle: "italic",
    marginVertical: 16,
    textAlign: "center",
  },
  noReviews: {
    color: "#999",
    fontSize: 14,
    fontStyle: "italic",
    marginVertical: 16,
    textAlign: "center",
  },
  priceContainer: {
    flex: 1,
  },
  priceLabel: {
    color: "#666",
    fontSize: 12,
  },
  priceValue: {
    color: "#1976d2",
    fontSize: 18,
    fontWeight: "700",
  },
  profileCard: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    elevation: 3,
    marginBottom: 16,
    marginHorizontal: 20,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  profileSection: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  ratingContainer: {
    alignItems: "center",
    flexDirection: "row",
    marginBottom: 16,
  },
  ratingText: {
    color: "#333",
    fontWeight: "600",
    marginLeft: 4,
  },
  reviewComment: {
    color: "#666",
    fontSize: 14,
    lineHeight: 20,
  },
  reviewCount: {
    color: "#666",
    fontSize: 14,
    marginLeft: 8,
  },
  reviewDate: {
    color: "#999",
    fontSize: 12,
  },
  reviewHeader: {
    alignItems: "center",
    flexDirection: "row",
    marginBottom: 8,
  },
  reviewItem: {
    backgroundColor: "#F9F9F9",
    borderRadius: 12,
    marginBottom: 12,
    padding: 16,
  },
  reviewerAvatar: {
    marginRight: 12,
  },
  reviewerInfo: {
    flex: 1,
  },
  reviewerName: {
    color: "#333",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  scheduleContainer: {
    marginTop: 8,
  },
  scheduleItem: {
    alignItems: "center",
    borderBottomColor: "#F5F5F5",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  scrollContainer: {
    flex: 1,
    marginTop: -20,
  },
  section: {
    backgroundColor: "#fff",
    borderRadius: 16,
    elevation: 3,
    marginBottom: 16,
    marginHorizontal: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  sectionTitle: {
    color: "#1976d2",
    fontSize: 18,
    fontWeight: "700",
  },
  seeAllText: {
    color: "#42a5f5",
    fontWeight: "600",
  },
  specialty: {
    color: "#666",
    fontSize: 16,
    marginBottom: 12,
    textAlign: "center",
  },
  statDivider: {
    backgroundColor: "#E0E0E0",
    height: 30,
    width: 1,
  },
  statItem: {
    alignItems: "center",
  },
  statLabel: {
    color: "#666",
    fontSize: 12,
    marginTop: 4,
  },
  statNumber: {
    color: "#1976d2",
    fontSize: 18,
    fontWeight: "700",
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 8,
    width: "100%",
  },
  statusBadge: {
    alignItems: "center",
    borderColor: "#fff",
    borderRadius: 12,
    borderWidth: 2,
    bottom: 0,
    height: 24,
    justifyContent: "center",
    position: "absolute",
    right: 0,
    width: 24,
  },
  timeText: {
    fontSize: 14,
    fontWeight: "500",
  },
});

export default DoctorDetail;
