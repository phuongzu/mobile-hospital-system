// screens/HomeScreen.tsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  FlatList,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Dimensions,
  Animated,
  PanResponder,
  AppState,
  AppStateStatus,
} from "react-native";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Icon from "react-native-vector-icons/MaterialIcons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../App";
import { LinearGradient } from "expo-linear-gradient";
import NetInfo from "@react-native-community/netinfo";
import OnboardingGuide from "../components/OnboardingGuide";

type NavigationProp = StackNavigationProp<RootStackParamList, "Home">;

interface MedicalRecord {
  _id: string;
  diagnosis: string;
  treatment: string;
  symptoms: string[];
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
  patient_id?: {
    _id: string;
    name: string;
    email: string;
    phoneNumber?: string;
  };
  doctor_id?: {
    _id: string;
    name: string;
    email: string;
  };
  appointment_id?: {
    _id: string;
    appointment_date?: string;
    appointment_time?: string;
  };
}

const { width, height } = Dimensions.get("window");
const API_BASE_URL = "http://localhost:3000";

// ── useMedicalRecords hook (unchanged) ──────────────────────────────────────
const useMedicalRecords = () => {
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number>(0);
  const [hasNewData, setHasNewData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showSpotlight, setShowSpotlight] = useState(false);
  const [onboardingMode, setOnboardingMode] = useState<"slides" | "spotlight">(
    "slides",
  );

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isFetchingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const getAuthToken = async (): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem("authToken");
    } catch {
      return null;
    }
  };

  const checkOnboardingStatus = async () => {
    try {
      const hasSeenOnboarding = await AsyncStorage.getItem("hasSeenOnboarding");
      if (!hasSeenOnboarding) {
        setShowOnboarding(true);
        setOnboardingMode("slides");
      } else {
        const hasSeenSpotlight = await AsyncStorage.getItem("hasSeenSpotlight");
        if (!hasSeenSpotlight) {
          setTimeout(() => {
            setShowSpotlight(true);
            setOnboardingMode("spotlight");
          }, 1200);
        }
      }
    } catch { }
  };

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    setTimeout(() => {
      setShowSpotlight(true);
      setOnboardingMode("spotlight");
    }, 800);
  };

  const handleSpotlightComplete = async () => {
    setShowSpotlight(false);
    try {
      await AsyncStorage.setItem("hasSeenSpotlight", "true");
    } catch { }
  };

  const fetchMedicalRecords = async (force = false) => {
    if (isFetchingRef.current && !force) return;
    const token = await getAuthToken();
    if (!token) {
      setError("Authentication required");
      setLoading(false);
      return;
    }

    if (abortControllerRef.current) abortControllerRef.current.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      isFetchingRef.current = true;
      const params: Record<string, any> = { _t: Date.now() };
      if (!force && lastUpdated > 0)
        params.updatedAfter = new Date(lastUpdated).toISOString();

      const response = await axios.get(
        `${API_BASE_URL}/api/patient/medical-records/my-records`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Cache-Control": "no-cache",
            Pragma: "no-cache",
          },
          params,
          signal: abortController.signal,
          timeout: 10000,
        },
      );

      const newRecords: MedicalRecord[] = response.data || [];
      if (newRecords.length > 0) {
        if (lastUpdated === 0 || force) {
          setRecords(newRecords);
        } else {
          setRecords((prevRecords) => {
            const merged = [...prevRecords];
            const existingIds = new Set(prevRecords.map((r) => r._id));
            newRecords.forEach((nr) => {
              if (!existingIds.has(nr._id)) {
                merged.unshift(nr);
                setHasNewData(true);
              } else {
                const idx = merged.findIndex((r) => r._id === nr._id);
                if (idx !== -1) merged[idx] = nr;
              }
            });
            return merged.sort(
              (a, b) =>
                new Date(b.updated_at).getTime() -
                new Date(a.updated_at).getTime(),
            );
          });
        }
        const latestUpdate = Math.max(
          ...newRecords.map((r) => new Date(r.updated_at).getTime()),
        );
        if (latestUpdate > lastUpdated) {
          setLastUpdated(latestUpdate);
          await AsyncStorage.setItem(
            "lastMedicalRecordsUpdate",
            latestUpdate.toString(),
          );
        }
      }
      setError(null);
    } catch (err: any) {
      if (err.name === "CanceledError" || err.name === "AbortError") return;
      if (err.response?.status === 401) setError("Session expired");
      else if (err.response?.status === 404) {
        setRecords([]);
        setError(null);
      } else if (err.code === "ECONNABORTED") setError("Request timeout");
      else if (!err.response && err.request) setError("Network error");
      else setError("Unable to load medical records");
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  };

  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  const startPolling = () => {
    stopPolling();
    fetchMedicalRecords();
    pollingIntervalRef.current = setInterval(
      () => fetchMedicalRecords(),
      120000,
    );
  };

  const refreshRecords = async () => {
    setRefreshing(true);
    await fetchMedicalRecords(true);
    if (hasNewData) setTimeout(() => setHasNewData(false), 3000);
  };

  useEffect(() => {
    const init = async () => {
      try {
        const savedTime = await AsyncStorage.getItem(
          "lastMedicalRecordsUpdate",
        );
        if (savedTime) setLastUpdated(parseInt(savedTime));
      } catch { }
      checkOnboardingStatus();
      startPolling();
    };
    init();
    return () => {
      stopPolling();
      abortControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (next === "active") startPolling();
      else if (next === "background") stopPolling();
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      if (state.isConnected) fetchMedicalRecords();
    });
    return () => unsub();
  }, []);

  return {
    records,
    setRecords,
    loading,
    refreshing,
    hasNewData,
    error,
    refreshRecords,
    setHasNewData,
    fetchMedicalRecords,
    showOnboarding,
    showSpotlight,
    onboardingMode,
    handleOnboardingComplete,
    handleSpotlightComplete,
  };
};

// ── HomeScreen ───────────────────────────────────────────────────────────────
const HomeScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "resolved">("all");
  const [updatingRecord, setUpdatingRecord] = useState<string | null>(null);

  // ── Separate unread counts for Messages vs AI Chat ──────────────────────
  const [unreadMessages, setUnreadMessages] = useState(0); // real doctor messages
  const [aiPulse] = useState(new Animated.Value(1)); // subtle AI button pulse

  const position = useState(
    new Animated.ValueXY({ x: width - 80, y: height - 200 }),
  )[0];

  const {
    records,
    setRecords,
    loading,
    refreshing,
    hasNewData,
    error,
    refreshRecords,
    setHasNewData,
    fetchMedicalRecords,
    showOnboarding,
    showSpotlight,
    onboardingMode,
    handleOnboardingComplete,
    handleSpotlightComplete,
  } = useMedicalRecords();

  // Gentle pulse animation for AI FAB
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(aiPulse, {
          toValue: 1.08,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(aiPulse, {
          toValue: 1,
          duration: 1800,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderMove: Animated.event(
      [null, { dx: position.x, dy: position.y }],
      { useNativeDriver: false },
    ),
    onPanResponderRelease: () => {
      const x = (position.x as any).__getValue();
      const y = (position.y as any).__getValue();
      Animated.spring(position, {
        toValue: {
          x: Math.min(Math.max(x, 0), width - 76),
          y: Math.min(Math.max(y, 100), height - 120),
        },
        useNativeDriver: false,
      }).start();
    },
  });

  useEffect(() => {
    loadUserData();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchMedicalRecords();
      if (hasNewData) {
        const t = setTimeout(() => setHasNewData(false), 3000);
        return () => clearTimeout(t);
      }
    }, [hasNewData]),
  );

  const loadUserData = async () => {
    try {
      const name = await AsyncStorage.getItem("userName");
      const role = await AsyncStorage.getItem("userRole");
      if (name) setUserName(name);
      if (role) setUserRole(role);
    } catch { }
  };

  const updateRecordStatus = async (recordId: string, newStatus: string) => {
    try {
      setUpdatingRecord(recordId);
      const token = await AsyncStorage.getItem("authToken");
      if (!token) {
        Alert.alert("Error", "Please login again");
        navigation.navigate("Login");
        return;
      }

      await axios.patch(
        `${API_BASE_URL}/api/patient/medical-records/${recordId}/status`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` }, timeout: 5000 },
      );

      setRecords((prev) =>
        prev
          .map((r) =>
            r._id === recordId
              ? {
                ...r,
                status: newStatus,
                updated_at: new Date().toISOString(),
              }
              : r,
          )
          .sort(
            (a, b) =>
              new Date(b.updated_at).getTime() -
              new Date(a.updated_at).getTime(),
          ),
      );
      setTimeout(() => fetchMedicalRecords(), 1000);
    } catch {
      Alert.alert("Error", "Failed to update record status");
      fetchMedicalRecords(true);
    } finally {
      setUpdatingRecord(null);
    }
  };

  const handleLogout = async () => {
    try {
      const token = await AsyncStorage.getItem("authToken");
      if (token)
        await axios.post(
          `${API_BASE_URL}/api/auth/logout`,
          {},
          { headers: { Authorization: `Bearer ${token}` }, timeout: 5000 },
        );
    } catch { }
    await AsyncStorage.multiRemove([
      "authToken",
      "refreshToken",
      "userName",
      "userEmail",
      "userRole",
      "userData",
    ]);
    navigation.navigate("Login");
  };

  const confirmLogout = () => {
    Alert.alert("Logout", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Logout", onPress: handleLogout, style: "destructive" },
    ]);
  };

  const navigateToProfile = () => navigation.navigate("Profile");
  const navigateToSettings = () => navigation.navigate("Settings");
  const navigateToFindDoctor = () => navigation.navigate("FindDoctor");
  const navigateToHistoryAppointment = () =>
    navigation.navigate("HistoryAppointment");
  const navigateToFeedback = () => navigation.navigate("Feedback");

  // Navigates to the real doctor–patient message inbox
  const navigateToMessages = () => {
    setUnreadMessages(0);
    navigation.navigate("Message");
  };

  // Navigates to AI chatbot assistant
  const navigateToAIChat = () => navigation.navigate("ChatOption");

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMins = Math.floor((now.getTime() - date.getTime()) / 60000);
      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins} min ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24)
        return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  const getPriorityIcon = (priority: string) => {
    const map: Record<string, { icon: string; color: string; label: string }> =
    {
      urgent: { icon: "warning", color: "#FF3B30", label: "Urgent" },
      high: { icon: "error", color: "#FF9500", label: "High" },
      medium: { icon: "info", color: "#FFCC00", label: "Medium" },
      low: { icon: "low-priority", color: "#34C759", label: "Low" },
    };
    return (
      map[priority] || { icon: "help", color: "#8E8E93", label: "Unknown" }
    );
  };

  const getStatusIcon = (status: string) => {
    const map: Record<string, { icon: string; color: string; label: string }> =
    {
      active: { icon: "access-time", color: "#007AFF", label: "Active" },
      resolved: { icon: "check-circle", color: "#34C759", label: "Resolved" },
    };
    return map[status] || { icon: "help", color: "#8E8E93", label: "Unknown" };
  };

  const filteredRecords = records.filter((r) =>
    filter === "all" ? true : r.status === filter,
  );

  // ── Record card ────────────────────────────────────────────────────────────
  const renderRecord = ({ item }: { item: MedicalRecord }) => {
    const isExpanded = expandedId === item._id;
    const priorityInfo = getPriorityIcon(item.priority);
    const statusInfo = getStatusIcon(item.status);
    const isUpdating = updatingRecord === item._id;

    return (
      <TouchableOpacity
        style={[styles.card, isExpanded && styles.cardExpanded]}
        onPress={() => setExpandedId(isExpanded ? null : item._id)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View
              style={[styles.statusDot, { backgroundColor: statusInfo.color }]}
            />
            <View style={styles.cardTitleContainer}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {item.diagnosis}
              </Text>
              <Text style={styles.cardDoctor}>
                {item.doctor_id?.name || "Unknown Doctor"}
              </Text>
            </View>
          </View>
          <Text style={styles.cardDate}>{formatDate(item.updated_at)}</Text>
        </View>

        <View style={styles.cardPreview}>
          <View style={styles.previewRow}>
            <Icon name="description" size={16} color="#8E8E93" />
            <Text style={styles.previewText} numberOfLines={1}>
              {item.treatment || "No treatment information"}
            </Text>
          </View>
          {item.symptoms?.length > 0 && (
            <View style={styles.previewRow}>
              <Icon name="sick" size={16} color="#8E8E93" />
              <Text style={styles.previewText} numberOfLines={1}>
                {item.symptoms.join(", ")}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.tagContainer}>
            <View
              style={[
                styles.tag,
                { backgroundColor: `${priorityInfo.color}15` },
              ]}
            >
              <Icon
                name={priorityInfo.icon}
                size={12}
                color={priorityInfo.color}
              />
              <Text style={[styles.tagText, { color: priorityInfo.color }]}>
                {priorityInfo.label}
              </Text>
            </View>
            <View
              style={[styles.tag, { backgroundColor: `${statusInfo.color}15` }]}
            >
              <Icon name={statusInfo.icon} size={12} color={statusInfo.color} />
              <Text style={[styles.tagText, { color: statusInfo.color }]}>
                {statusInfo.label}
              </Text>
            </View>
          </View>

          <View style={styles.cardActions}>
            {userRole === "doctor" && item.status === "active" && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => updateRecordStatus(item._id, "resolved")}
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <ActivityIndicator size="small" color="#34C759" />
                ) : (
                  <Icon name="check-circle" size={20} color="#34C759" />
                )}
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() =>
                navigation.navigate("RecordDetail", { record: item })
              }
            >
              <Icon name="chevron-right" size={20} color="#8E8E93" />
            </TouchableOpacity>
          </View>
        </View>

        {isExpanded && (
          <View style={styles.expandedContent}>
            <View style={styles.expandedSection}>
              <Text style={styles.expandedSectionTitle}>Diagnosis</Text>
              <Text style={styles.expandedText}>{item.diagnosis}</Text>
            </View>
            {item.treatment && (
              <View style={styles.expandedSection}>
                <Text style={styles.expandedSectionTitle}>Treatment</Text>
                <Text style={styles.expandedText}>{item.treatment}</Text>
              </View>
            )}
            {item.symptoms?.length > 0 && (
              <View style={styles.expandedSection}>
                <Text style={styles.expandedSectionTitle}>Symptoms</Text>
                <View style={styles.symptomsContainer}>
                  {item.symptoms.map((symptom, index) => (
                    <View key={index} style={styles.symptomItem}>
                      <Text style={styles.symptomItemText}>{symptom}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
            {item.appointment_id && (
              <View style={styles.expandedSection}>
                <Text style={styles.expandedSectionTitle}>Appointment</Text>
                <View style={styles.appointmentInfo}>
                  <Icon name="event" size={16} color="#007AFF" />
                  <Text style={styles.appointmentText}>
                    {item.appointment_id.appointment_date || "Date not set"}
                    {item.appointment_id.appointment_time &&
                      ` at ${item.appointment_id.appointment_time}`}
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // ── AI Chat floating action button ────────────────────────────────────────
  // Clearly branded as "AI" — visually distinct from the message icon in header
  const AIChatFAB = () => (
    <Animated.View
      style={[
        styles.fabWrapper,
        { transform: [{ translateX: position.x }, { translateY: position.y }] },
      ]}
      {...panResponder.panHandlers}
    >
      <TouchableOpacity
        onPress={navigateToAIChat}
        activeOpacity={0.85}
        accessibilityLabel="Open AI Medical Assistant"
        accessibilityRole="button"
      >
        {/* Outer glow ring */}
        <Animated.View
          style={[styles.fabGlow, { transform: [{ scale: aiPulse }] }]}
        />

        <LinearGradient
          colors={["#06b6d4", "#0891b2", "#0e7490"]}
          style={styles.fabGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {/* Stethoscope + sparkle combo makes it clearly AI-medical */}
          <Icon name="psychology" size={26} color="#FFFFFF" />
        </LinearGradient>

        {/* "AI" label badge — unmistakable identifier */}
        <View style={styles.fabAIBadge}>
          <Text style={styles.fabAIBadgeText}>AI</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading && records.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0891b2" />
          <Text style={styles.loadingText}>
            Loading your medical records...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {hasNewData && (
        <View style={styles.newDataBanner}>
          <Icon name="fiber-new" size={18} color="#FFF" />
          <Text style={styles.newDataText}>New records available</Text>
          <TouchableOpacity onPress={() => setHasNewData(false)}>
            <Icon name="close" size={18} color="#FFF" />
          </TouchableOpacity>
        </View>
      )}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.userInfo}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {userName ? userName.charAt(0).toUpperCase() : "U"}
              </Text>
            </View>
            <View style={styles.userTextContainer}>
              <Text style={styles.greeting}>Welcome back,</Text>
              <Text style={styles.userName}>{userName || "Patient"}</Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            {/*
              Message icon → real doctor-patient inbox.
              Tooltip-style label underneath removes ambiguity.
            */}
            <TouchableOpacity
              style={styles.iconButtonLabeled}
              onPress={navigateToMessages}
              accessibilityLabel="Open Messages"
              accessibilityRole="button"
            >
              <View style={styles.iconButtonInner}>
                <Icon name="chat" size={22} color="#374151" />
                {unreadMessages > 0 && (
                  <View style={styles.messageBadge}>
                    <Text style={styles.messageBadgeText}>
                      {unreadMessages}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.iconButtonLabel}>Messages</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.iconButtonLabeled}
              onPress={confirmLogout}
              accessibilityLabel="Logout"
              accessibilityRole="button"
            >
              <View style={styles.iconButtonInner}>
                <Icon name="logout" size={22} color="#374151" />
              </View>
              <Text style={styles.iconButtonLabel}>Logout</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{records.length}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {records.filter((r) => r.status === "active").length}
            </Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {records.filter((r) => r.status === "resolved").length}
            </Text>
            <Text style={styles.statLabel}>Resolved</Text>
          </View>
        </View>
      </View>

      {/* ── Quick Actions ───────────────────────────────────────────────────── */}
      <View style={styles.quickActions}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity
            style={styles.quickActionItem}
            onPress={navigateToFindDoctor}
          >
            <View
              style={[styles.quickActionIcon, { backgroundColor: "#e0f2fe" }]}
            >
              <Icon name="search" size={24} color="#0891b2" />
            </View>
            <Text style={styles.quickActionLabel}>Find Doctor</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionItem}
            onPress={navigateToHistoryAppointment}
          >
            <View
              style={[styles.quickActionIcon, { backgroundColor: "#fae8ff" }]}
            >
              <Icon name="history" size={24} color="#a855f7" />
            </View>
            <Text style={styles.quickActionLabel}>History</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionItem}
            onPress={navigateToProfile}
          >
            <View
              style={[styles.quickActionIcon, { backgroundColor: "#dcfce7" }]}
            >
              <Icon name="person" size={24} color="#22c55e" />
            </View>
            <Text style={styles.quickActionLabel}>Profile</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionItem}
            onPress={navigateToFeedback}
          >
            <View
              style={[styles.quickActionIcon, { backgroundColor: "#fff3cd" }]}
            >
              <Icon name="star" size={24} color="#fbbf24" />
            </View>
            <Text style={styles.quickActionLabel}>Feedback</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionItem}
            onPress={navigateToSettings}
          >
            <View
              style={[styles.quickActionIcon, { backgroundColor: "#fee2e2" }]}
            >
              <Icon name="settings" size={24} color="#ef4444" />
            </View>
            <Text style={styles.quickActionLabel}>Settings</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* ── Filter tabs ─────────────────────────────────────────────────────── */}
      <View style={styles.filterTabs}>
        {(["active", "resolved", "all"] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.filterTab, filter === tab && styles.filterTabActive]}
            onPress={() => setFilter(tab)}
          >
            <Text
              style={[
                styles.filterTabText,
                filter === tab && styles.filterTabTextActive,
              ]}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Error banner ────────────────────────────────────────────────────── */}
      {error && (
        <View style={styles.errorContainer}>
          <Icon name="error-outline" size={20} color="#ef4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={refreshRecords}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Records list ─────────────────────────────────────────────────────── */}
      <FlatList
        data={filteredRecords}
        keyExtractor={(item) => item._id}
        renderItem={renderRecord}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshRecords}
            colors={["#0891b2"]}
            tintColor="#0891b2"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Icon name="folder-open" size={64} color="#d1d5db" />
            <Text style={styles.emptyTitle}>No records found</Text>
            <Text style={styles.emptySubtitle}>
              {filter !== "all"
                ? `No ${filter} medical records available`
                : "You don't have any medical records yet"}
            </Text>
          </View>
        }
      />

      {/* ── AI Chat FAB (draggable, clearly labelled) ──────────────────────── */}
      <AIChatFAB />

      <OnboardingGuide
        visible={showOnboarding}
        mode="slides"
        onComplete={handleOnboardingComplete}
        onSpotlightComplete={handleSpotlightComplete}
      />
      <OnboardingGuide
        visible={showSpotlight}
        mode="spotlight"
        onComplete={handleOnboardingComplete}
        onSpotlightComplete={handleSpotlightComplete}
      />
    </SafeAreaView>
  );
};

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { backgroundColor: "#f9fafb", flex: 1 },
  loadingContainer: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    flex: 1,
    justifyContent: "center",
  },
  loadingText: {
    color: "#6b7280",
    fontSize: 16,
    fontWeight: "500",
    marginTop: 12,
  },

  newDataBanner: {
    alignItems: "center",
    backgroundColor: "#0891b2",
    flexDirection: "row",
    justifyContent: "space-between",
    left: 0,
    paddingHorizontal: 16,
    paddingVertical: 10,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 1000,
  },
  newDataText: {
    color: "#FFFFFF",
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 8,
  },

  // Header
  header: {
    backgroundColor: "#FFFFFF",
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    elevation: 3,
    paddingBottom: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  headerTop: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  userInfo: { alignItems: "center", flexDirection: "row" },
  avatar: {
    alignItems: "center",
    backgroundColor: "#0891b2",
    borderRadius: 24,
    height: 48,
    justifyContent: "center",
    marginRight: 12,
    width: 48,
  },
  avatarText: { color: "#FFFFFF", fontSize: 20, fontWeight: "600" },
  userTextContainer: { justifyContent: "center" },
  greeting: { color: "#6b7280", fontSize: 14, marginBottom: 2 },
  userName: { color: "#111827", fontSize: 18, fontWeight: "700" },
  headerActions: { alignItems: "flex-end", flexDirection: "row", gap: 6 },

  // Header icon buttons — now with visible labels to disambiguate
  iconButtonLabeled: { alignItems: "center", gap: 3 },
  iconButtonInner: {
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    borderRadius: 22,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  iconButtonLabel: { color: "#6b7280", fontSize: 10, fontWeight: "500" },

  messageBadge: {
    alignItems: "center",
    backgroundColor: "#ef4444",
    borderColor: "#FFFFFF",
    borderRadius: 9,
    borderWidth: 2,
    height: 18,
    justifyContent: "center",
    minWidth: 18,
    position: "absolute",
    right: -2,
    top: -2,
  },
  messageBadgeText: { color: "#FFFFFF", fontSize: 10, fontWeight: "700" },

  // Stats
  statsContainer: {
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    flexDirection: "row",
    justifyContent: "space-around",
    padding: 16,
  },
  statItem: { alignItems: "center", flex: 1 },
  statValue: {
    color: "#0891b2",
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 4,
  },
  statLabel: { color: "#6b7280", fontSize: 13, fontWeight: "500" },
  statDivider: { backgroundColor: "#e5e7eb", height: "100%", width: 1 },

  // Quick actions
  quickActions: { paddingHorizontal: 16, paddingVertical: 20 },
  quickActionItem: { alignItems: "center", marginRight: 20, width: 70 },
  quickActionIcon: {
    alignItems: "center",
    borderRadius: 28,
    height: 56,
    justifyContent: "center",
    marginBottom: 8,
    width: 56,
  },
  quickActionLabel: {
    color: "#374151",
    fontSize: 12,
    fontWeight: "500",
    textAlign: "center",
  },

  // Filter tabs
  filterTabs: { flexDirection: "row", marginBottom: 16, paddingHorizontal: 16 },
  filterTab: {
    alignItems: "center",
    borderBottomColor: "transparent",
    borderBottomWidth: 2,
    flex: 1,
    paddingVertical: 10,
  },
  filterTabActive: { borderBottomColor: "#0891b2" },
  filterTabText: { color: "#9ca3af", fontSize: 14, fontWeight: "600" },
  filterTabTextActive: { color: "#0891b2" },

  // Error
  errorContainer: {
    alignItems: "center",
    backgroundColor: "#fee2e2",
    borderRadius: 12,
    flexDirection: "row",
    marginBottom: 16,
    marginHorizontal: 16,
    padding: 12,
  },
  errorText: { color: "#991b1b", flex: 1, fontSize: 14, marginLeft: 8 },
  retryText: {
    color: "#991b1b",
    fontSize: 14,
    fontWeight: "600",
    textDecorationLine: "underline",
  },

  // Records list
  listContent: { paddingBottom: 120, paddingHorizontal: 16 },

  // Card
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    elevation: 2,
    marginBottom: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  cardExpanded: { elevation: 4, shadowOpacity: 0.1, shadowRadius: 12 },

  cardHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  cardHeaderLeft: { alignItems: "center", flexDirection: "row", flex: 1 },
  statusDot: { borderRadius: 5, height: 10, marginRight: 10, width: 10 },
  cardTitleContainer: { flex: 1 },
  cardTitle: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },
  cardDoctor: { color: "#6b7280", fontSize: 13 },
  cardDate: { color: "#9ca3af", fontSize: 12 },

  cardPreview: { marginBottom: 12 },
  previewRow: { alignItems: "center", flexDirection: "row", marginBottom: 6 },
  previewText: { color: "#4b5563", flex: 1, fontSize: 13, marginLeft: 8 },

  cardFooter: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  tagContainer: { flexDirection: "row", gap: 8 },
  tag: {
    alignItems: "center",
    borderRadius: 12,
    flexDirection: "row",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagText: { fontSize: 11, fontWeight: "600", marginLeft: 4 },
  cardActions: { alignItems: "center", flexDirection: "row", gap: 8 },
  actionButton: {
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    width: 36,
  },

  expandedContent: {
    borderTopColor: "#f3f4f6",
    borderTopWidth: 1,
    marginTop: 16,
    paddingTop: 16,
  },
  expandedSection: { marginBottom: 16 },
  expandedSectionTitle: {
    color: "#6b7280",
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  expandedText: { color: "#1f2937", fontSize: 15, lineHeight: 22 },

  symptomsContainer: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  symptomItem: {
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  symptomItemText: { color: "#374151", fontSize: 13 },

  appointmentInfo: {
    alignItems: "center",
    backgroundColor: "#f0f9ff",
    borderRadius: 12,
    flexDirection: "row",
    padding: 12,
  },
  appointmentText: { color: "#0369a1", flex: 1, fontSize: 14, marginLeft: 8 },

  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyTitle: {
    color: "#374151",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
    marginTop: 16,
  },
  emptySubtitle: {
    color: "#9ca3af",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },

  // ── AI Chat FAB ────────────────────────────────────────────────────────────
  // Deliberately different from the plain grey message icon in the header:
  //   • Gradient teal background (not grey)
  //   • "psychology" brain icon (not chat bubble)
  //   • Prominent orange "AI" badge
  //   • Subtle glow ring + pulse animation
  fabWrapper: {
    elevation: 10,
    position: "absolute",
    zIndex: 1000,
  },
  fabGlow: {
    backgroundColor: "rgba(8, 145, 178, 0.18)",
    borderRadius: 34,
    height: 68,
    left: -4,
    position: "absolute",
    top: -4,
    width: 68,
  },
  fabGradient: {
    alignItems: "center",
    borderRadius: 30,
    elevation: 8,
    height: 60,
    justifyContent: "center",
    shadowColor: "#0891b2",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.38,
    shadowRadius: 10,
    width: 60,
  },
  fabAIBadge: {
    backgroundColor: "#f97316",
    borderColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 2,
    elevation: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    position: "absolute",
    right: -6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    top: -4,
  },
  fabAIBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
});

export default HomeScreen;
