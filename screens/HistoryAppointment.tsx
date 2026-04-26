import React, { useEffect, useState, useRef } from "react";
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
  TextInput,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";

const { width, height } = Dimensions.get("window");

const scale = (size: number) => (width / 375) * size;
const verticalScale = (size: number) => (height / 812) * size;
const moderateScale = (size: number, factor = 0.5) =>
  size + (scale(size) - size) * factor;

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
  status: "scheduled" | "completed" | "cancelled" | "pending";
  created_at: string;
  symptoms?: string;
}

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

const API_BASE_URL = "http://localhost:3000";

// ── Smart suggestion specialties ──────────────────────────────────────────────
const SMART_SUGGESTIONS = [
  {
    icon: "fitness",
    label: "General\nCheckup",
    color: "#1976d2",
    bg: "#E3F2FD",
  },
  {
    icon: "heart",
    label: "Heart\nSpecialist",
    color: "#E53935",
    bg: "#FFEBEE",
  },
  { icon: "eye", label: "Eye\nDoctor", color: "#7B1FA2", bg: "#F3E5F5" },
  { icon: "body", label: "Derma-\ntologist", color: "#F57C00", bg: "#FFF3E0" },
  { icon: "medkit", label: "Dentist", color: "#00897B", bg: "#E0F2F1" },
  { icon: "pulse", label: "Neuro-\nlogist", color: "#5E35B1", bg: "#EDE7F6" },
];

// ── Star Rating ───────────────────────────────────────────────────────────────
const StarRating = ({
  rating,
  onChange,
  size = 24,
  disabled = false,
}: {
  rating: number;
  onChange?: (r: number) => void;
  size?: number;
  disabled?: boolean;
}) => (
  <View style={{ flexDirection: "row" }}>
    {[1, 2, 3, 4, 5].map((i) => (
      <TouchableOpacity
        key={i}
        disabled={disabled || !onChange}
        onPress={() => onChange && onChange(i)}
        activeOpacity={0.7}
      >
        <Ionicons
          name={i <= rating ? "star" : "star-outline"}
          size={size}
          color={i <= rating ? "#FFD700" : "#C7C7CC"}
          style={{ marginHorizontal: 2 }}
        />
      </TouchableOpacity>
    ))}
  </View>
);

// ── Empty State Component ─────────────────────────────────────────────────────
const EmptyStateView = ({
  userName,
  onFindDoctor,
  onHome,
}: {
  userName: string;
  onFindDoctor: () => void;
  onHome: () => void;
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(28)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const cardAnims = useRef(
    SMART_SUGGESTIONS.map(() => new Animated.Value(0)),
  ).current;

  useEffect(() => {
    // Entrance
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 550,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 55,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    // Stagger suggestion cards
    Animated.stagger(
      70,
      cardAnims.map((anim) =>
        Animated.timing(anim, {
          toValue: 1,
          duration: 380,
          useNativeDriver: true,
        }),
      ),
    ).start();

    // Gentle pulse on illustration
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.07,
          duration: 1900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1.0,
          duration: 1900,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  const firstName = userName ? userName.trim().split(" ")[0] : "there";

  return (
    <Animated.ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.emptyRoot}
      style={{ opacity: fadeAnim }}
    >
      {/* ── Personalized greeting ── */}
      <Animated.View
        style={[styles.greetingRow, { transform: [{ translateY: slideAnim }] }]}
      >
        <Text style={styles.greetingText}>
          {greeting()}, <Text style={styles.greetingName}>{firstName} 👋</Text>
        </Text>
        <Text style={styles.greetingHint}>
          You haven't booked any appointments yet.
        </Text>
      </Animated.View>

      {/* ── Illustration ── */}
      <Animated.View
        style={[
          styles.illustrationWrapper,
          { transform: [{ scale: pulseAnim }] },
        ]}
      >
        <LinearGradient
          colors={["#BBDEFB", "#E3F2FD"]}
          style={styles.illustrationCircle}
        >
          <LinearGradient
            colors={["#1565C0", "#1976d2", "#42A5F5"]}
            style={styles.illustrationInner}
          >
            <Ionicons name="calendar" size={moderateScale(46)} color="#fff" />
          </LinearGradient>
          {/* Decorative orbiting dots */}
          <View
            style={[
              styles.orbitDot,
              {
                top: 10,
                right: 18,
                backgroundColor: "#FFD700",
                width: 13,
                height: 13,
              },
            ]}
          />
          <View
            style={[
              styles.orbitDot,
              {
                bottom: 14,
                left: 14,
                backgroundColor: "#34C759",
                width: 10,
                height: 10,
              },
            ]}
          />
          <View
            style={[
              styles.orbitDot,
              {
                top: 30,
                left: 6,
                backgroundColor: "#FF9500",
                width: 8,
                height: 8,
              },
            ]}
          />
        </LinearGradient>
      </Animated.View>

      {/* ── Title + subtitle ── */}
      <Animated.View
        style={{ alignItems: "center", transform: [{ translateY: slideAnim }] }}
      >
        <Text style={styles.emptyTitle}>
          Your health journey{"\n"}starts here
        </Text>
        <Text style={styles.emptySubtitle}>
          Book your first appointment and keep{"\n"}track of all your visits in
          one place.
        </Text>
      </Animated.View>

      {/* ── Primary CTA — single, prominent ── */}
      <TouchableOpacity
        style={styles.primaryCTA}
        onPress={onFindDoctor}
        activeOpacity={0.86}
      >
        <LinearGradient
          colors={["#1976d2", "#1565C0"]}
          style={styles.primaryCTAGradient}
        >
          <Ionicons name="search" size={moderateScale(20)} color="#fff" />
          <Text style={styles.primaryCTAText}>Find &amp; Book Appointment</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* ── Secondary text links ── */}
      <View style={styles.secondaryLinks}>
        <TouchableOpacity onPress={onFindDoctor} activeOpacity={0.7}>
          <Text style={styles.linkText}>Explore doctors</Text>
        </TouchableOpacity>
        <Text style={styles.linkDot}>·</Text>
        <TouchableOpacity onPress={onHome} activeOpacity={0.7}>
          <Text style={styles.linkText}>Go to Home</Text>
        </TouchableOpacity>
      </View>

      {/* ── Smart Suggestions ── */}
      <View style={styles.suggestionsCard}>
        <Text style={styles.suggestionsTitle}>Recommended for you</Text>
        <View style={styles.suggestionsGrid}>
          {SMART_SUGGESTIONS.map((item, index) => (
            <Animated.View
              key={item.label}
              style={[
                styles.suggestionCellWrapper,
                {
                  opacity: cardAnims[index],
                  transform: [
                    {
                      translateY: cardAnims[index].interpolate({
                        inputRange: [0, 1],
                        outputRange: [18, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <TouchableOpacity
                style={styles.suggestionCell}
                onPress={onFindDoctor}
                activeOpacity={0.78}
              >
                <View
                  style={[
                    styles.suggestionIconBox,
                    { backgroundColor: item.bg },
                  ]}
                >
                  <Ionicons
                    name={item.icon as any}
                    size={moderateScale(22)}
                    color={item.color}
                  />
                </View>
                <Text style={styles.suggestionLabel}>{item.label}</Text>
              </TouchableOpacity>
            </Animated.View>
          ))}
        </View>
      </View>

      {/* ── Value props strip ── */}
      <View style={styles.valueStrip}>
        <View style={styles.valuePill}>
          <Ionicons name="shield-checkmark" size={14} color="#34C759" />
          <Text style={styles.valuePillText}>Verified doctors</Text>
        </View>
        <View style={styles.valuePill}>
          <Ionicons name="time" size={14} color="#007AFF" />
          <Text style={styles.valuePillText}>Easy reschedule</Text>
        </View>
        <View style={styles.valuePill}>
          <Ionicons name="notifications" size={14} color="#FF9500" />
          <Text style={styles.valuePillText}>Smart reminders</Text>
        </View>
      </View>
    </Animated.ScrollView>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
const HistoryAppointment: React.FC = () => {
  const navigation = useNavigation<any>();

  // Review state
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewTargetDoctorId, setReviewTargetDoctorId] = useState<
    string | null
  >(null);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [doctorReviews, setDoctorReviews] = useState<Review[]>([]);
  const [reviewsModalVisible, setReviewsModalVisible] = useState(false);
  const [reviewsDoctorName, setReviewsDoctorName] = useState("");
  const [userReviews, setUserReviews] = useState<{ [id: string]: Review }>({});
  const [reviewTargetAppointmentId, setReviewTargetAppointmentId] = useState<
    string | null
  >(null);

  // Appointment state
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAppointment, setSelectedAppointment] =
    useState<Appointment | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [userName, setUserName] = useState("");

  const timeSlots = [
    "09:00",
    "09:30",
    "10:00",
    "10:30",
    "11:00",
    "11:30",
    "14:00",
    "14:30",
    "15:00",
    "15:30",
    "16:00",
    "16:30",
  ];

  // ── Fetch helpers ─────────────────────────────────────────────────────────
  const fetchUserName = async () => {
    try {
      const raw = await AsyncStorage.getItem("userData");
      if (raw) setUserName(JSON.parse(raw).name || "");
    } catch {}
  };

  const fetchAppointments = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await AsyncStorage.getItem("authToken");
      const res = await fetch(
        `${API_BASE_URL}/api/patient/appointments/history`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!res.ok) {
        const err = await res.json();
        setError(err.message || "Failed to fetch appointments");
        return;
      }
      setAppointments(await res.json());
    } catch {
      setError("Failed to load appointments. Please check your connection.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchUserReviews = async () => {
    try {
      const token = await AsyncStorage.getItem("authToken");
      const res = await fetch(`${API_BASE_URL}/api/patient/reviews/user`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      const map: { [id: string]: Review } = {};
      (data.reviews || []).forEach((r: any) => {
        const id =
          typeof r.appointment_id === "string"
            ? r.appointment_id
            : r.appointment_id?._id;
        if (id) map[id] = r;
      });
      setUserReviews(map);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchUserName();
    fetchAppointments();
    fetchUserReviews();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAppointments();
    fetchUserReviews();
  };

  // ── Appointment actions ───────────────────────────────────────────────────
  const handleCancelAppointment = async (id: string) => {
    try {
      const token = await AsyncStorage.getItem("authToken");
      const raw = await AsyncStorage.getItem("userData");
      const user_id = raw
        ? JSON.parse(raw)._id || JSON.parse(raw).user_id || JSON.parse(raw).id
        : null;
      const res = await fetch(
        `${API_BASE_URL}/api/patient/appointments/${id}/cancel`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ user_id }),
        },
      );
      if (res.ok) {
        Alert.alert("Success", "Appointment cancelled successfully.");
        setAppointments((p) =>
          p.map((a) => (a._id === id ? { ...a, status: "cancelled" } : a)),
        );
        setModalVisible(false);
      } else {
        Alert.alert("Error", (await res.json()).message || "Failed to cancel.");
      }
    } catch {
      Alert.alert("Error", "Failed to cancel appointment. Please try again.");
    }
  };

  const handleUpdateAppointment = async () => {
    if (!selectedAppointment || !selectedTime) {
      Alert.alert("Error", "Please select a time slot.");
      return;
    }
    setUpdating(true);
    try {
      const token = await AsyncStorage.getItem("authToken");
      const raw = await AsyncStorage.getItem("userData");
      const user_id = raw
        ? JSON.parse(raw)._id || JSON.parse(raw).user_id || JSON.parse(raw).id
        : null;
      const res = await fetch(
        `${API_BASE_URL}/api/patient/appointments/${selectedAppointment._id}/edit`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            user_id,
            appointment_date: selectedDate.toISOString().split("T")[0],
            time_slot: selectedTime,
          }),
        },
      );
      if (res.ok) {
        Alert.alert("Success", "Appointment rescheduled successfully.");
        setAppointments((p) =>
          p.map((a) =>
            a._id === selectedAppointment._id
              ? {
                  ...a,
                  appointment_date: selectedDate.toISOString().split("T")[0],
                  time_slot: selectedTime,
                }
              : a,
          ),
        );
        setEditModalVisible(false);
      } else {
        Alert.alert("Error", (await res.json()).message || "Failed to update.");
      }
    } catch {
      Alert.alert("Error", "Failed to update appointment. Please try again.");
    } finally {
      setUpdating(false);
    }
  };

  // ── Review actions ────────────────────────────────────────────────────────
  const handleSubmitReview = async () => {
    if (
      !reviewTargetAppointmentId ||
      !reviewTargetDoctorId ||
      reviewRating < 1
    ) {
      Alert.alert("Error", "Please select a rating.");
      return;
    }
    if (userReviews[reviewTargetAppointmentId]) {
      Alert.alert("Error", "You have already reviewed this appointment.");
      return;
    }
    setSubmittingReview(true);
    try {
      const token = await AsyncStorage.getItem("authToken");
      const res = await fetch(
        `${API_BASE_URL}/api/patient/doctors/${reviewTargetDoctorId}/reviews`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            rating: reviewRating,
            comment: reviewComment,
            appointment_id: reviewTargetAppointmentId,
          }),
        },
      );
      if (res.ok) {
        Alert.alert("Thank you!", "Your review has been submitted.");
        setReviewModalVisible(false);
        setReviewRating(0);
        setReviewComment("");
        setReviewTargetAppointmentId(null);
        setReviewTargetDoctorId(null);
        fetchUserReviews();
      } else {
        Alert.alert("Error", (await res.json()).message || "Failed to submit.");
      }
    } catch {
      Alert.alert("Error", "Failed to submit review. Please try again.");
    }
    setSubmittingReview(false);
  };

  const handleUpdateReview = async () => {
    if (!reviewTargetAppointmentId || reviewRating < 1) {
      Alert.alert("Error", "Please select a rating.");
      return;
    }
    setSubmittingReview(true);
    try {
      const token = await AsyncStorage.getItem("authToken");
      const rv = userReviews[reviewTargetAppointmentId];
      if (!rv) {
        Alert.alert("Error", "Review not found.");
        return;
      }
      const res = await fetch(`${API_BASE_URL}/api/patient/reviews/${rv._id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ rating: reviewRating, comment: reviewComment }),
      });
      if (res.ok) {
        Alert.alert("Success", "Your review has been updated.");
        setReviewModalVisible(false);
        setReviewRating(0);
        setReviewComment("");
        setReviewTargetAppointmentId(null);
        setReviewTargetDoctorId(null);
        fetchUserReviews();
      } else {
        Alert.alert("Error", (await res.json()).message || "Failed to update.");
      }
    } catch {
      Alert.alert("Error", "Failed to update review. Please try again.");
    }
    setSubmittingReview(false);
  };

  const handleDeleteReview = async (appointmentId: string) => {
    const rv = userReviews[appointmentId];
    if (!rv) return;
    Alert.alert(
      "Delete Review",
      "Are you sure you want to delete your review?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const token = await AsyncStorage.getItem("authToken");
            const res = await fetch(
              `${API_BASE_URL}/api/patient/reviews/${rv._id}`,
              {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
              },
            );
            if (res.ok) {
              Alert.alert("Success", "Review deleted.");
              fetchUserReviews();
            } else {
              Alert.alert("Error", "Failed to delete review.");
            }
          },
        },
      ],
    );
  };

  const fetchDoctorReviews = async (doctorId: string, doctorName: string) => {
    setReviewLoading(true);
    setDoctorReviews([]);
    setReviewsDoctorName(doctorName);
    setReviewsModalVisible(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/patient/doctors/${doctorId}/reviews`,
      );
      if (res.ok) setDoctorReviews((await res.json()).reviews || []);
    } catch (e) {
      console.error(e);
    } finally {
      setReviewLoading(false);
    }
  };

  // ── UI helpers ────────────────────────────────────────────────────────────
  const confirmCancel = (a: Appointment) => {
    setSelectedAppointment(a);
    setModalVisible(true);
  };
  const openEditModal = (a: Appointment) => {
    setSelectedAppointment(a);
    setSelectedDate(new Date(a.appointment_date));
    setSelectedTime(a.time_slot);
    setEditModalVisible(true);
  };
  const openReviewModal = (a: Appointment) => {
    setReviewTargetAppointmentId(a._id);
    setReviewTargetDoctorId(a.doctor_id._id);
    const ex = userReviews[a._id];
    setReviewRating(ex?.rating || 0);
    setReviewComment(ex?.comment || "");
    setReviewModalVisible(true);
  };
  const handleDateChange = (_: any, date?: Date) => {
    setShowDatePicker(false);
    if (date) setSelectedDate(date);
  };
  const formatDate = (ds: string) => {
    try {
      return new Date(ds).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return ds;
    }
  };
  const getStatusColor = (s: string) =>
    ({
      scheduled: "#007AFF",
      completed: "#34C759",
      cancelled: "#FF3B30",
      pending: "#FF9500",
    })[s] || "#8E8E93";
  const getStatusIcon = (s: string) =>
    ({
      scheduled: "calendar",
      completed: "checkmark-circle",
      cancelled: "close-circle",
      pending: "time",
    })[s] || "help-circle";

  const visible = appointments.filter((a) => a.status !== "cancelled");

  // ── Render card ───────────────────────────────────────────────────────────
  const renderItem = ({ item }: { item: Appointment }) => {
    const reviewed = userReviews[item._id];
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.doctorInfo}>
            <LinearGradient
              colors={["#5E5CE6", "#0A84FF"]}
              style={styles.avatar}
            >
              <Ionicons name="person" size={moderateScale(20)} color="#fff" />
            </LinearGradient>
            <View style={styles.doctorDetails}>
              <Text style={styles.doctorName} numberOfLines={1}>
                Dr. {item.doctor_id?.user_id?.name || "Unknown Doctor"}
              </Text>
              <Text style={styles.specialty} numberOfLines={1}>
                {item.doctor_id?.specialty_id?.name || "General Practice"}
              </Text>
            </View>
          </View>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(item.status) },
            ]}
          >
            <Ionicons
              name={getStatusIcon(item.status) as any}
              size={moderateScale(14)}
              color="#fff"
            />
            <Text style={styles.statusText}>
              {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
            </Text>
          </View>
        </View>

        <View style={styles.appointmentDetails}>
          <View style={styles.detailRow}>
            <Ionicons
              name="calendar"
              size={moderateScale(16)}
              color="#8E8E93"
            />
            <Text style={styles.detailText}>
              {formatDate(item.appointment_date)}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="time" size={moderateScale(16)} color="#8E8E93" />
            <Text style={styles.detailText}>{item.time_slot}</Text>
          </View>
          {item.symptoms && (
            <View style={styles.detailRow}>
              <Ionicons
                name="medical"
                size={moderateScale(16)}
                color="#8E8E93"
              />
              <Text style={styles.detailText} numberOfLines={2}>
                {item.symptoms}
              </Text>
            </View>
          )}
        </View>

        {(item.status === "scheduled" || item.status === "pending") && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, styles.editButton]}
              onPress={() => openEditModal(item)}
            >
              <Ionicons name="create" size={moderateScale(16)} color="#fff" />
              <Text style={styles.actionButtonText}>Reschedule</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.cancelButton]}
              onPress={() => confirmCancel(item)}
            >
              <Ionicons name="close" size={moderateScale(16)} color="#fff" />
              <Text style={styles.actionButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {item.status === "completed" && (
          <View style={{ marginTop: moderateScale(10) }}>
            <View style={styles.nonActionMessage}>
              <Ionicons
                name="checkmark-circle"
                size={moderateScale(16)}
                color="#34C759"
              />
              <Text style={[styles.nonActionText, { color: "#34C759" }]}>
                Appointment completed
              </Text>
            </View>
            <View
              style={{
                flexDirection: "row",
                marginTop: moderateScale(8),
                gap: moderateScale(8),
              }}
            >
              <TouchableOpacity
                style={[
                  styles.reviewButton,
                  { backgroundColor: reviewed ? "#34C759" : "#FFD700" },
                ]}
                onPress={() => openReviewModal(item)}
              >
                <Ionicons
                  name={reviewed ? "create" : "star"}
                  size={16}
                  color="#fff"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.reviewButtonText}>
                  {reviewed ? "Edit Review" : "Write Review"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.reviewButton, { backgroundColor: "#1976d2" }]}
                onPress={() =>
                  fetchDoctorReviews(
                    item.doctor_id._id,
                    item.doctor_id.user_id?.name || "Doctor",
                  )
                }
              >
                <Ionicons
                  name="chatbubbles"
                  size={16}
                  color="#fff"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.reviewButtonText}>View Reviews</Text>
              </TouchableOpacity>
            </View>
            {reviewed && (
              <TouchableOpacity
                style={[
                  styles.reviewButton,
                  { backgroundColor: "#FF3B30", marginTop: moderateScale(8) },
                ]}
                onPress={() => handleDeleteReview(item._id)}
              >
                <Ionicons
                  name="trash"
                  size={16}
                  color="#fff"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.reviewButtonText}>Delete Review</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {item.status === "cancelled" && (
          <View
            style={[
              styles.nonActionMessage,
              { backgroundColor: "rgba(255,59,48,0.1)" },
            ]}
          >
            <Ionicons
              name="close-circle"
              size={moderateScale(16)}
              color="#FF3B30"
            />
            <Text style={[styles.nonActionText, { color: "#FF3B30" }]}>
              Appointment cancelled
            </Text>
          </View>
        )}
      </View>
    );
  };

  // ── Modals ────────────────────────────────────────────────────────────────
  const renderReviewModal = () => {
    const editing = !!(
      reviewTargetAppointmentId && userReviews[reviewTargetAppointmentId]
    );
    return (
      <Modal
        animationType="slide"
        transparent
        visible={reviewModalVisible}
        onRequestClose={() => setReviewModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 350 }]}>
            <Text style={styles.modalTitle}>
              {editing ? "Edit Your Review" : "Write a Review"}
            </Text>
            <Text style={styles.modalSubText}>
              How was your experience with this doctor?
            </Text>
            <StarRating
              rating={reviewRating}
              onChange={setReviewRating}
              size={32}
            />
            <View style={{ marginTop: 16, width: "100%" }}>
              <Text style={styles.inputLabel}>Comment (optional)</Text>
              <View style={styles.textAreaWrapper}>
                <TextInput
                  style={styles.textArea}
                  numberOfLines={4}
                  multiline
                  onChangeText={setReviewComment}
                  value={reviewComment}
                  placeholder="Share your feedback..."
                  placeholderTextColor="#C7C7CC"
                  textAlignVertical="top"
                  editable={!submittingReview}
                  autoCorrect
                />
              </View>
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => setReviewModalVisible(false)}
                disabled={submittingReview}
              >
                <Text style={[styles.modalButtonText, { color: "#007AFF" }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  { backgroundColor: editing ? "#34C759" : "#FFD700" },
                ]}
                onPress={editing ? handleUpdateReview : handleSubmitReview}
                disabled={submittingReview}
              >
                {submittingReview ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalButtonText}>
                    {editing ? "Update Review" : "Submit Review"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  const renderReviewsModal = () => (
    <Modal
      animationType="slide"
      transparent
      visible={reviewsModalVisible}
      onRequestClose={() => setReviewsModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.modalContent,
            { maxWidth: 350, alignItems: "flex-start" },
          ]}
        >
          <View style={styles.reviewsModalHeader}>
            <Text style={styles.modalTitle}>
              Reviews for Dr. {reviewsDoctorName}
            </Text>
            <TouchableOpacity onPress={() => setReviewsModalVisible(false)}>
              <Ionicons name="close" size={24} color="#8E8E93" />
            </TouchableOpacity>
          </View>
          {reviewLoading ? (
            <ActivityIndicator
              color="#1976d2"
              size="large"
              style={{ marginTop: 20 }}
            />
          ) : doctorReviews.length === 0 ? (
            <Text style={styles.noReviewsText}>No reviews yet.</Text>
          ) : (
            <ScrollView style={{ maxHeight: 300, width: "100%" }}>
              {doctorReviews.map((r) => (
                <View key={r._id} style={styles.reviewItem}>
                  <View style={styles.reviewItemHeader}>
                    <Ionicons
                      name="person-circle"
                      size={22}
                      color="#1976d2"
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.reviewerName}>
                      {r.user_id?.name || "User"}
                    </Text>
                    <View style={{ marginLeft: 8 }}>
                      <StarRating rating={r.rating} size={16} disabled />
                    </View>
                  </View>
                  {r.comment ? (
                    <Text style={styles.reviewComment}>{r.comment}</Text>
                  ) : null}
                  <Text style={styles.reviewDate}>
                    {new Date(r.created_at).toLocaleDateString()}
                  </Text>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );

  // ── Loading / Error ───────────────────────────────────────────────────────
  if (loading)
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1976d2" />
          <Text style={styles.loadingText}>Loading appointment history...</Text>
        </View>
      </SafeAreaView>
    );

  if (error)
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.centered}>
          <Ionicons
            name="alert-circle"
            size={moderateScale(64)}
            color="#FF3B30"
          />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.bookingButton}
            onPress={() => navigation.navigate("FindDoctor")}
          >
            <Text style={styles.bookingButtonText}>Book Appointment</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />
      <LinearGradient colors={["#4A90E2", "#63A4FF"]} style={styles.header}>
        <SafeAreaView>
          <View style={styles.headerMain}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButton}
              activeOpacity={0.7}
            >
              <View style={styles.backButtonInner}>
                <Ionicons
                  name="arrow-back"
                  size={moderateScale(22)}
                  color="#fff"
                />
              </View>
            </TouchableOpacity>

            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>Appointment History</Text>
              <Text
                style={
                  visible.length > 0
                    ? styles.headerSubtitle
                    : styles.headerSubtitleCTA
                }
              >
                {visible.length > 0
                  ? `${visible.length} ${visible.length !== 1 ? "appointments" : "appointment"}`
                  : "Your Health Journey"}
              </Text>
            </View>

            <View style={styles.headerRightPlaceholder} />
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* List */}
      <FlatList
        data={visible}
        renderItem={renderItem}
        keyExtractor={(item) => item._id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#1976d2"]}
            tintColor="#1976d2"
          />
        }
        ListEmptyComponent={
          <EmptyStateView
            userName={userName}
            onFindDoctor={() => navigation.navigate("FindDoctor" as never)}
            onHome={() => navigation.navigate("Home" as never)}
          />
        }
        contentContainerStyle={
          visible.length === 0 ? styles.emptyListContent : styles.listContent
        }
        showsVerticalScrollIndicator={false}
      />

      {/* Modals */}
      {renderReviewModal()}
      {renderReviewsModal()}

      {/* Cancel modal */}
      <Modal
        animationType="fade"
        transparent
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconContainer}>
              <Ionicons
                name="warning"
                size={moderateScale(48)}
                color="#FF9500"
              />
            </View>
            <Text style={styles.modalTitle}>Cancel Appointment</Text>
            <Text style={styles.modalText}>
              Are you sure you want to cancel your appointment with Dr.{" "}
              {selectedAppointment?.doctor_id?.user_id?.name}?
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={[styles.modalButtonText, { color: "#007AFF" }]}>
                  Keep Appointment
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalConfirmButton]}
                onPress={() =>
                  selectedAppointment &&
                  handleCancelAppointment(selectedAppointment._id)
                }
              >
                <Text style={styles.modalButtonText}>Yes, Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit modal */}
      <Modal
        animationType="slide"
        transparent
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
                  <Ionicons
                    name="close"
                    size={moderateScale(24)}
                    color="#8E8E93"
                  />
                </TouchableOpacity>
              </View>
              <Text style={styles.modalText}>
                Reschedule your appointment with Dr.{" "}
                {selectedAppointment?.doctor_id?.user_id?.name}
              </Text>
              <View style={styles.editSection}>
                <Text style={styles.sectionTitle}>Select Date</Text>
                <TouchableOpacity
                  style={styles.datePickerButton}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Ionicons
                    name="calendar"
                    size={moderateScale(20)}
                    color="#007AFF"
                  />
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
                  {timeSlots.map((t) => (
                    <TouchableOpacity
                      key={t}
                      style={[
                        styles.timeSlot,
                        selectedTime === t && styles.timeSlotSelected,
                      ]}
                      onPress={() => setSelectedTime(t)}
                    >
                      <Text
                        style={[
                          styles.timeSlotText,
                          selectedTime === t && styles.timeSlotTextSelected,
                        ]}
                      >
                        {t}
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
                  <Text style={[styles.modalButtonText, { color: "#007AFF" }]}>
                    Cancel
                  </Text>
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
                      <Ionicons
                        name="checkmark"
                        size={moderateScale(18)}
                        color="#FFFFFF"
                      />
                      <Text style={styles.modalButtonText}>
                        Confirm Changes
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { backgroundColor: "#F2F2F7", flex: 1 },

  // Header
  header: {
    borderBottomLeftRadius: moderateScale(24),
    borderBottomRightRadius: moderateScale(24),
    elevation: 8,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  headerMain: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: verticalScale(20),
    paddingHorizontal: moderateScale(20),
  },
  headerCenter: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: moderateScale(20),
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    color: "rgba(255, 255, 255, 0.85)",
    fontSize: moderateScale(13),
    fontWeight: "600",
    marginTop: 2,
  },
  headerSubtitleCTA: {
    color: "rgba(97, 94, 94, 0.7)",
    fontSize: moderateScale(13),
    fontWeight: "600",
    marginTop: 2,
  },
  backButton: {
    alignItems: "center",
    height: moderateScale(40),
    justifyContent: "center",
    width: moderateScale(40),
  },
  backButtonInner: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: moderateScale(14),
    height: "100%",
    justifyContent: "center",
    width: "100%",
  },
  headerRightPlaceholder: {
    width: moderateScale(40),
  },
  listContent: {
    padding: moderateScale(16),
    paddingBottom: moderateScale(20),
  },
  emptyListContent: {
    flexGrow: 1,
  },

  // ── Empty State ──────────────────────────────────────────────────────────
  emptyRoot: {
    alignItems: "center",
    paddingBottom: moderateScale(40),
    paddingHorizontal: moderateScale(20),
    paddingTop: moderateScale(20),
  },
  greetingRow: { alignSelf: "flex-start", marginBottom: moderateScale(22) },
  greetingText: { color: "#555", fontSize: moderateScale(17) },
  greetingName: { color: "#000", fontWeight: "700" },
  greetingHint: { color: "#AAA", fontSize: moderateScale(13), marginTop: 4 },

  // Illustration
  illustrationWrapper: { marginBottom: moderateScale(22) },
  illustrationCircle: {
    alignItems: "center",
    borderRadius: moderateScale(74),
    height: moderateScale(148),
    justifyContent: "center",
    width: moderateScale(148),
  },
  illustrationInner: {
    alignItems: "center",
    borderRadius: moderateScale(44),
    height: moderateScale(88),
    justifyContent: "center",
    width: moderateScale(88),
  },
  orbitDot: { borderRadius: 99, position: "absolute" },

  // Text
  emptyTitle: {
    color: "#000",
    fontSize: moderateScale(24),
    fontWeight: "700",
    lineHeight: moderateScale(33),
    marginBottom: moderateScale(10),
    textAlign: "center",
  },
  emptySubtitle: {
    color: "#8E8E93",
    fontSize: moderateScale(15),
    lineHeight: moderateScale(22),
    marginBottom: moderateScale(26),
    textAlign: "center",
  },

  // Primary CTA
  primaryCTA: {
    borderRadius: moderateScale(16),
    elevation: 6,
    marginBottom: moderateScale(14),
    overflow: "hidden",
    shadowColor: "#1976d2",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    width: "100%",
  },
  primaryCTAGradient: {
    alignItems: "center",
    flexDirection: "row",
    gap: moderateScale(10),
    justifyContent: "center",
    paddingVertical: moderateScale(16),
  },
  primaryCTAText: {
    color: "#fff",
    fontSize: moderateScale(16),
    fontWeight: "700",
  },

  // Secondary links
  secondaryLinks: {
    alignItems: "center",
    flexDirection: "row",
    gap: moderateScale(10),
    marginBottom: moderateScale(28),
  },
  linkText: {
    color: "#1976d2",
    fontSize: moderateScale(14),
    fontWeight: "500",
  },
  linkDot: { color: "#C7C7CC", fontSize: moderateScale(16) },

  // Smart Suggestions
  suggestionsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: moderateScale(18),
    elevation: 2,
    marginBottom: moderateScale(16),
    padding: moderateScale(16),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    width: "100%",
  },
  suggestionsTitle: {
    color: "#000",
    fontSize: moderateScale(15),
    fontWeight: "700",
    marginBottom: moderateScale(14),
  },
  suggestionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: moderateScale(10),
    justifyContent: "space-between",
  },
  suggestionCellWrapper: { width: (width - moderateScale(72)) / 3 },
  suggestionCell: {
    alignItems: "center",
    backgroundColor: "#FAFAFA",
    borderColor: "#F0F0F0",
    borderRadius: moderateScale(14),
    borderWidth: 0.5,
    padding: moderateScale(10),
  },
  suggestionIconBox: {
    alignItems: "center",
    borderRadius: moderateScale(13),
    height: moderateScale(46),
    justifyContent: "center",
    marginBottom: moderateScale(8),
    width: moderateScale(46),
  },
  suggestionLabel: {
    color: "#333",
    fontSize: moderateScale(10.5),
    fontWeight: "600",
    lineHeight: moderateScale(14),
    textAlign: "center",
  },

  // Value strip
  valueStrip: {
    backgroundColor: "#FFFFFF",
    borderRadius: moderateScale(14),
    elevation: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: moderateScale(10),
    paddingVertical: moderateScale(12),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    width: "100%",
  },
  valuePill: { alignItems: "center", flex: 1, gap: moderateScale(5) },
  valuePillText: {
    color: "#555",
    fontSize: moderateScale(10.5),
    fontWeight: "500",
    textAlign: "center",
  },

  // Cards
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: moderateScale(16),
    elevation: 3,
    marginBottom: moderateScale(16),
    padding: moderateScale(20),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  cardHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: moderateScale(16),
  },
  doctorInfo: { alignItems: "center", flexDirection: "row", flex: 1 },
  avatar: {
    alignItems: "center",
    borderRadius: moderateScale(24),
    height: moderateScale(48),
    justifyContent: "center",
    marginRight: moderateScale(12),
    width: moderateScale(48),
  },
  doctorDetails: { flex: 1 },
  doctorName: {
    color: "#000",
    fontSize: moderateScale(16),
    fontWeight: "600",
    marginBottom: moderateScale(2),
  },
  specialty: {
    color: "#8E8E93",
    fontSize: moderateScale(14),
    fontWeight: "500",
  },
  statusBadge: {
    alignItems: "center",
    borderRadius: moderateScale(16),
    flexDirection: "row",
    marginLeft: moderateScale(8),
    paddingHorizontal: moderateScale(10),
    paddingVertical: moderateScale(6),
  },
  statusText: {
    color: "#fff",
    fontSize: moderateScale(12),
    fontWeight: "600",
    marginLeft: moderateScale(4),
  },
  appointmentDetails: { marginBottom: moderateScale(16) },
  detailRow: {
    alignItems: "center",
    flexDirection: "row",
    marginBottom: moderateScale(12),
  },
  detailText: {
    color: "#000",
    flex: 1,
    fontSize: moderateScale(14),
    marginLeft: moderateScale(12),
  },
  actionButtons: {
    flexDirection: "row",
    gap: moderateScale(12),
    justifyContent: "space-between",
  },
  actionButton: {
    alignItems: "center",
    borderRadius: moderateScale(12),
    flexDirection: "row",
    flex: 1,
    gap: moderateScale(6),
    justifyContent: "center",
    paddingHorizontal: moderateScale(16),
    paddingVertical: moderateScale(12),
  },
  editButton: { backgroundColor: "#007AFF" },
  cancelButton: { backgroundColor: "#FF3B30" },
  actionButtonText: {
    color: "#fff",
    fontSize: moderateScale(14),
    fontWeight: "600",
  },
  reviewButton: {
    alignItems: "center",
    borderRadius: 10,
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    padding: 10,
  },
  reviewButtonText: {
    color: "#fff",
    fontSize: moderateScale(13),
    fontWeight: "600",
  },
  nonActionMessage: {
    alignItems: "center",
    borderRadius: moderateScale(12),
    flexDirection: "row",
    gap: moderateScale(8),
    justifyContent: "center",
    padding: moderateScale(12),
  },
  nonActionText: { fontSize: moderateScale(14), fontWeight: "500" },

  // Loading / Error
  centered: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: moderateScale(20),
  },
  loadingText: {
    color: "#8E8E93",
    fontSize: moderateScale(16),
    fontWeight: "500",
    marginTop: moderateScale(16),
  },
  errorText: {
    color: "#FF3B30",
    fontSize: moderateScale(16),
    fontWeight: "500",
    marginVertical: moderateScale(16),
    textAlign: "center",
  },
  bookingButton: {
    backgroundColor: "#1976d2",
    borderRadius: moderateScale(12),
    marginTop: moderateScale(16),
    paddingHorizontal: moderateScale(24),
    paddingVertical: moderateScale(12),
  },
  bookingButtonText: {
    color: "#fff",
    fontSize: moderateScale(14),
    fontWeight: "600",
  },

  // Modals
  modalOverlay: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    flex: 1,
    justifyContent: "center",
    padding: moderateScale(20),
  },
  modalContent: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: moderateScale(20),
    maxWidth: moderateScale(400),
    padding: moderateScale(24),
    width: "100%",
  },
  modalIconContainer: { marginBottom: moderateScale(16) },
  modalTitle: {
    color: "#000",
    fontSize: moderateScale(20),
    fontWeight: "700",
    marginBottom: moderateScale(12),
    textAlign: "center",
  },
  modalSubText: {
    color: "#333",
    fontSize: 16,
    marginBottom: 12,
    textAlign: "center",
  },
  modalText: {
    color: "#000",
    fontSize: moderateScale(16),
    lineHeight: moderateScale(22),
    marginBottom: moderateScale(24),
    textAlign: "center",
  },
  modalButtons: {
    flexDirection: "row",
    gap: moderateScale(12),
    justifyContent: "space-between",
    marginTop: moderateScale(20),
    width: "100%",
  },
  modalButton: {
    alignItems: "center",
    borderRadius: moderateScale(12),
    flex: 1,
    justifyContent: "center",
    paddingVertical: moderateScale(14),
  },
  modalCancelButton: { backgroundColor: "rgba(120,120,128,0.12)" },
  modalConfirmButton: { backgroundColor: "#FF3B30" },
  modalButtonText: {
    color: "#fff",
    fontSize: moderateScale(16),
    fontWeight: "600",
  },
  modalHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: moderateScale(16),
  },
  modalCloseButton: { padding: moderateScale(4) },
  editModalContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: moderateScale(20),
    maxHeight: "80%",
    maxWidth: moderateScale(400),
    width: "100%",
  },
  editModalContent: { padding: moderateScale(24) },
  editSection: { marginBottom: moderateScale(24) },
  sectionTitle: {
    color: "#000",
    fontSize: moderateScale(16),
    fontWeight: "600",
    marginBottom: moderateScale(12),
  },
  datePickerButton: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#E5E5EA",
    borderRadius: moderateScale(12),
    borderWidth: 1,
    flexDirection: "row",
    gap: moderateScale(12),
    padding: moderateScale(16),
  },
  dateText: { color: "#000", fontSize: moderateScale(16), fontWeight: "500" },
  timeSlotsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: moderateScale(10),
    justifyContent: "space-between",
  },
  timeSlot: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#E5E5EA",
    borderRadius: moderateScale(12),
    borderWidth: 1,
    justifyContent: "center",
    padding: moderateScale(12),
    width: width * 0.27,
  },
  timeSlotSelected: { backgroundColor: "#007AFF", borderColor: "#007AFF" },
  timeSlotText: {
    color: "#000",
    fontSize: moderateScale(14),
    fontWeight: "500",
  },
  timeSlotTextSelected: { color: "#FFFFFF" },
  reviewsModalHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: moderateScale(12),
    width: "100%",
  },
  noReviewsText: { color: "#8E8E93", marginTop: 20 },
  reviewItem: {
    borderBottomWidth: 1,
    borderColor: "#eee",
    paddingVertical: 12,
  },
  reviewItemHeader: {
    alignItems: "center",
    flexDirection: "row",
    marginBottom: 4,
  },
  reviewerName: { color: "#333", fontWeight: "600" },
  reviewComment: { color: "#333", marginLeft: 28 },
  reviewDate: { color: "#8E8E93", fontSize: 12, marginLeft: 28, marginTop: 2 },
  inputLabel: { color: "#000", fontWeight: "600", marginBottom: 6 },
  textAreaWrapper: {
    backgroundColor: "#F8F9FA",
    borderColor: "#E5E5EA",
    borderRadius: 10,
    borderWidth: 1,
    padding: 8,
  },
  textArea: { color: "#333", minHeight: 60 },
});

export default HistoryAppointment;
