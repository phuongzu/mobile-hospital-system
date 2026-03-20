// screens/HomeScreen.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
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
} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { LinearGradient } from 'expo-linear-gradient';
import NetInfo from '@react-native-community/netinfo';
import OnboardingGuide from '../components/OnboardingGuide';

type NavigationProp = StackNavigationProp<RootStackParamList, 'Home'>;

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

const { width, height } = Dimensions.get('window');
const API_BASE_URL = 'http://localhost:3000';

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
  const [onboardingMode, setOnboardingMode] = useState<'slides' | 'spotlight'>('slides');

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isFetchingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const getAuthToken = async (): Promise<string | null> => {
    try { return await AsyncStorage.getItem('authToken'); } catch { return null; }
  };

  const checkOnboardingStatus = async () => {
    try {
      const hasSeenOnboarding = await AsyncStorage.getItem('hasSeenOnboarding');
      if (!hasSeenOnboarding) {
        setShowOnboarding(true);
        setOnboardingMode('slides');
      } else {
        const hasSeenSpotlight = await AsyncStorage.getItem('hasSeenSpotlight');
        if (!hasSeenSpotlight) {
          setTimeout(() => { setShowSpotlight(true); setOnboardingMode('spotlight'); }, 1200);
        }
      }
    } catch {}
  };

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    setTimeout(() => { setShowSpotlight(true); setOnboardingMode('spotlight'); }, 800);
  };

  const handleSpotlightComplete = async () => {
    setShowSpotlight(false);
    try { await AsyncStorage.setItem('hasSeenSpotlight', 'true'); } catch {}
  };

  const fetchMedicalRecords = async (force = false) => {
    if (isFetchingRef.current && !force) return;
    const token = await getAuthToken();
    if (!token) { setError('Authentication required'); setLoading(false); return; }

    if (abortControllerRef.current) abortControllerRef.current.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      isFetchingRef.current = true;
      const params: Record<string, any> = { _t: Date.now() };
      if (!force && lastUpdated > 0) params.updatedAfter = new Date(lastUpdated).toISOString();

      const response = await axios.get(
        `${API_BASE_URL}/api/patient/medical-records/my-records`,
        {
          headers: { Authorization: `Bearer ${token}`, 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
          params, signal: abortController.signal, timeout: 10000,
        }
      );

      const newRecords: MedicalRecord[] = response.data || [];
      if (newRecords.length > 0) {
        if (lastUpdated === 0 || force) {
          setRecords(newRecords);
        } else {
          setRecords(prevRecords => {
            const merged = [...prevRecords];
            const existingIds = new Set(prevRecords.map(r => r._id));
            newRecords.forEach(nr => {
              if (!existingIds.has(nr._id)) { merged.unshift(nr); setHasNewData(true); }
              else { const idx = merged.findIndex(r => r._id === nr._id); if (idx !== -1) merged[idx] = nr; }
            });
            return merged.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
          });
        }
        const latestUpdate = Math.max(...newRecords.map(r => new Date(r.updated_at).getTime()));
        if (latestUpdate > lastUpdated) {
          setLastUpdated(latestUpdate);
          await AsyncStorage.setItem('lastMedicalRecordsUpdate', latestUpdate.toString());
        }
      }
      setError(null);
    } catch (err: any) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') return;
      if (err.response?.status === 401) setError('Session expired');
      else if (err.response?.status === 404) { setRecords([]); setError(null); }
      else if (err.code === 'ECONNABORTED') setError('Request timeout');
      else if (!err.response && err.request) setError('Network error');
      else setError('Unable to load medical records');
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  };

  const stopPolling = () => {
    if (pollingIntervalRef.current) { clearInterval(pollingIntervalRef.current); pollingIntervalRef.current = null; }
  };

  const startPolling = () => {
    stopPolling();
    fetchMedicalRecords();
    pollingIntervalRef.current = setInterval(() => fetchMedicalRecords(), 120000);
  };

  const refreshRecords = async () => {
    setRefreshing(true);
    await fetchMedicalRecords(true);
    if (hasNewData) setTimeout(() => setHasNewData(false), 3000);
  };

  useEffect(() => {
    const init = async () => {
      try {
        const savedTime = await AsyncStorage.getItem('lastMedicalRecordsUpdate');
        if (savedTime) setLastUpdated(parseInt(savedTime));
      } catch {}
      checkOnboardingStatus();
      startPolling();
    };
    init();
    return () => { stopPolling(); abortControllerRef.current?.abort(); };
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') startPolling();
      else if (next === 'background') stopPolling();
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const unsub = NetInfo.addEventListener(state => { if (state.isConnected) fetchMedicalRecords(); });
    return () => unsub();
  }, []);

  return {
    records, setRecords, loading, refreshing, hasNewData, error,
    refreshRecords, setHasNewData, fetchMedicalRecords,
    showOnboarding, showSpotlight, onboardingMode,
    handleOnboardingComplete, handleSpotlightComplete,
  };
};

// ── HomeScreen ───────────────────────────────────────────────────────────────
const HomeScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'resolved'>('all');
  const [updatingRecord, setUpdatingRecord] = useState<string | null>(null);

  // ── Separate unread counts for Messages vs AI Chat ──────────────────────
  const [unreadMessages, setUnreadMessages] = useState(0);   // real doctor messages
  const [aiPulse] = useState(new Animated.Value(1));          // subtle AI button pulse

  const position = useState(
    new Animated.ValueXY({ x: width - 80, y: height - 200 })
  )[0];

  const {
    records, setRecords, loading, refreshing, hasNewData, error,
    refreshRecords, setHasNewData, fetchMedicalRecords,
    showOnboarding, showSpotlight, onboardingMode,
    handleOnboardingComplete, handleSpotlightComplete,
  } = useMedicalRecords();

  // Gentle pulse animation for AI FAB
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(aiPulse, { toValue: 1.08, duration: 1800, useNativeDriver: true }),
        Animated.timing(aiPulse, { toValue: 1,    duration: 1800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderMove: Animated.event(
      [null, { dx: position.x, dy: position.y }],
      { useNativeDriver: false }
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

  useEffect(() => { loadUserData(); }, []);

  useFocusEffect(
    useCallback(() => {
      fetchMedicalRecords();
      if (hasNewData) {
        const t = setTimeout(() => setHasNewData(false), 3000);
        return () => clearTimeout(t);
      }
    }, [hasNewData])
  );

  const loadUserData = async () => {
    try {
      const name = await AsyncStorage.getItem('userName');
      const role = await AsyncStorage.getItem('userRole');
      if (name) setUserName(name);
      if (role) setUserRole(role);
    } catch {}
  };

  const updateRecordStatus = async (recordId: string, newStatus: string) => {
    try {
      setUpdatingRecord(recordId);
      const token = await AsyncStorage.getItem('authToken');
      if (!token) { Alert.alert('Error', 'Please login again'); navigation.navigate('Login'); return; }

      await axios.patch(
        `${API_BASE_URL}/api/patient/medical-records/${recordId}/status`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` }, timeout: 5000 }
      );

      setRecords(prev =>
        prev
          .map(r => r._id === recordId ? { ...r, status: newStatus, updated_at: new Date().toISOString() } : r)
          .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      );
      setTimeout(() => fetchMedicalRecords(), 1000);
    } catch {
      Alert.alert('Error', 'Failed to update record status');
      fetchMedicalRecords(true);
    } finally {
      setUpdatingRecord(null);
    }
  };

  const handleLogout = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (token) await axios.post(`${API_BASE_URL}/api/auth/logout`, {}, { headers: { Authorization: `Bearer ${token}` }, timeout: 5000 });
    } catch {}
    await AsyncStorage.multiRemove(['authToken', 'refreshToken', 'userName', 'userEmail', 'userRole', 'userData']);
    navigation.navigate('Login');
  };

  const confirmLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', onPress: handleLogout, style: 'destructive' },
    ]);
  };

  const navigateToProfile            = () => navigation.navigate('Profile');
  const navigateToSettings           = () => navigation.navigate('Settings');
  const navigateToFindDoctor         = () => navigation.navigate('FindDoctor');
  const navigateToHistoryAppointment = () => navigation.navigate('HistoryAppointment');
  const navigateToFeedback           = () => navigation.navigate('Feedback');

  // Navigates to the real doctor–patient message inbox
  const navigateToMessages = () => {
    setUnreadMessages(0);
    navigation.navigate('Message');
  };

  // Navigates to AI chatbot assistant
  const navigateToAIChat = () => navigation.navigate('ChatOption');

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now  = new Date();
      const diffMins = Math.floor((now.getTime() - date.getTime()) / 60000);
      if (diffMins < 1)  return 'Just now';
      if (diffMins < 60) return `${diffMins} min ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 7)  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch { return dateString; }
  };

  const getPriorityIcon = (priority: string) => {
    const map: Record<string, { icon: string; color: string; label: string }> = {
      urgent: { icon: 'warning',      color: '#FF3B30', label: 'Urgent' },
      high:   { icon: 'error',        color: '#FF9500', label: 'High'   },
      medium: { icon: 'info',         color: '#FFCC00', label: 'Medium' },
      low:    { icon: 'low-priority', color: '#34C759', label: 'Low'    },
    };
    return map[priority] || { icon: 'help', color: '#8E8E93', label: 'Unknown' };
  };

  const getStatusIcon = (status: string) => {
    const map: Record<string, { icon: string; color: string; label: string }> = {
      active:   { icon: 'access-time',  color: '#007AFF', label: 'Active'   },
      resolved: { icon: 'check-circle', color: '#34C759', label: 'Resolved' },
    };
    return map[status] || { icon: 'help', color: '#8E8E93', label: 'Unknown' };
  };

  const filteredRecords = records.filter(r => filter === 'all' ? true : r.status === filter);

  // ── Record card ────────────────────────────────────────────────────────────
  const renderRecord = ({ item }: { item: MedicalRecord }) => {
    const isExpanded   = expandedId === item._id;
    const priorityInfo = getPriorityIcon(item.priority);
    const statusInfo   = getStatusIcon(item.status);
    const isUpdating   = updatingRecord === item._id;

    return (
      <TouchableOpacity
        style={[styles.card, isExpanded && styles.cardExpanded]}
        onPress={() => setExpandedId(isExpanded ? null : item._id)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View style={[styles.statusDot, { backgroundColor: statusInfo.color }]} />
            <View style={styles.cardTitleContainer}>
              <Text style={styles.cardTitle} numberOfLines={1}>{item.diagnosis}</Text>
              <Text style={styles.cardDoctor}>
                {item.doctor_id?.name || 'Unknown Doctor'}
              </Text>
            </View>
          </View>
          <Text style={styles.cardDate}>{formatDate(item.updated_at)}</Text>
        </View>

        <View style={styles.cardPreview}>
          <View style={styles.previewRow}>
            <Icon name="description" size={16} color="#8E8E93" />
            <Text style={styles.previewText} numberOfLines={1}>
              {item.treatment || 'No treatment information'}
            </Text>
          </View>
          {item.symptoms?.length > 0 && (
            <View style={styles.previewRow}>
              <Icon name="sick" size={16} color="#8E8E93" />
              <Text style={styles.previewText} numberOfLines={1}>{item.symptoms.join(', ')}</Text>
            </View>
          )}
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.tagContainer}>
            <View style={[styles.tag, { backgroundColor: `${priorityInfo.color}15` }]}>
              <Icon name={priorityInfo.icon} size={12} color={priorityInfo.color} />
              <Text style={[styles.tagText, { color: priorityInfo.color }]}>{priorityInfo.label}</Text>
            </View>
            <View style={[styles.tag, { backgroundColor: `${statusInfo.color}15` }]}>
              <Icon name={statusInfo.icon} size={12} color={statusInfo.color} />
              <Text style={[styles.tagText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
            </View>
          </View>

          <View style={styles.cardActions}>
            {userRole === 'doctor' && item.status === 'active' && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => updateRecordStatus(item._id, 'resolved')}
                disabled={isUpdating}
              >
                {isUpdating
                  ? <ActivityIndicator size="small" color="#34C759" />
                  : <Icon name="check-circle" size={20} color="#34C759" />}
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => navigation.navigate('RecordDetail', { record: item })}
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
                    {item.appointment_id.appointment_date || 'Date not set'}
                    {item.appointment_id.appointment_time && ` at ${item.appointment_id.appointment_time}`}
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
        <Animated.View style={[styles.fabGlow, { transform: [{ scale: aiPulse }] }]} />

        <LinearGradient
          colors={['#06b6d4', '#0891b2', '#0e7490']}
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
          <Text style={styles.loadingText}>Loading your medical records...</Text>
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
                {userName ? userName.charAt(0).toUpperCase() : 'U'}
              </Text>
            </View>
            <View style={styles.userTextContainer}>
              <Text style={styles.greeting}>Welcome back,</Text>
              <Text style={styles.userName}>{userName || 'Patient'}</Text>
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
                    <Text style={styles.messageBadgeText}>{unreadMessages}</Text>
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
            <Text style={styles.statValue}>{records.filter(r => r.status === 'active').length}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{records.filter(r => r.status === 'resolved').length}</Text>
            <Text style={styles.statLabel}>Resolved</Text>
          </View>
        </View>
      </View>

      {/* ── Quick Actions ───────────────────────────────────────────────────── */}
      <View style={styles.quickActions}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity style={styles.quickActionItem} onPress={navigateToFindDoctor}>
            <View style={[styles.quickActionIcon, { backgroundColor: '#e0f2fe' }]}>
              <Icon name="search" size={24} color="#0891b2" />
            </View>
            <Text style={styles.quickActionLabel}>Find Doctor</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.quickActionItem} onPress={navigateToHistoryAppointment}>
            <View style={[styles.quickActionIcon, { backgroundColor: '#fae8ff' }]}>
              <Icon name="history" size={24} color="#a855f7" />
            </View>
            <Text style={styles.quickActionLabel}>History</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.quickActionItem} onPress={navigateToProfile}>
            <View style={[styles.quickActionIcon, { backgroundColor: '#dcfce7' }]}>
              <Icon name="person" size={24} color="#22c55e" />
            </View>
            <Text style={styles.quickActionLabel}>Profile</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.quickActionItem} onPress={navigateToFeedback}>
            <View style={[styles.quickActionIcon, { backgroundColor: '#fff3cd' }]}>
              <Icon name="star" size={24} color="#fbbf24" />
            </View>
            <Text style={styles.quickActionLabel}>Feedback</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.quickActionItem} onPress={navigateToSettings}>
            <View style={[styles.quickActionIcon, { backgroundColor: '#fee2e2' }]}>
              <Icon name="settings" size={24} color="#ef4444" />
            </View>
            <Text style={styles.quickActionLabel}>Settings</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* ── Filter tabs ─────────────────────────────────────────────────────── */}
      <View style={styles.filterTabs}>
        {(['active', 'resolved','all'] as const).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.filterTab, filter === tab && styles.filterTabActive]}
            onPress={() => setFilter(tab)}
          >
            <Text style={[styles.filterTabText, filter === tab && styles.filterTabTextActive]}>
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
        keyExtractor={item => item._id}
        renderItem={renderRecord}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refreshRecords} colors={['#0891b2']} tintColor="#0891b2" />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Icon name="folder-open" size={64} color="#d1d5db" />
            <Text style={styles.emptyTitle}>No records found</Text>
            <Text style={styles.emptySubtitle}>
              {filter !== 'all'
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
  safeArea:         { flex: 1, backgroundColor: '#f9fafb' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' },
  loadingText:      { marginTop: 12, fontSize: 16, color: '#6b7280', fontWeight: '500' },

  newDataBanner: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1000,
    backgroundColor: '#0891b2', flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10,
  },
  newDataText: { flex: 1, color: '#FFFFFF', fontSize: 14, fontWeight: '600', marginLeft: 8 },

  // Header
  header: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 10, elevation: 3,
  },
  headerTop:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  userInfo:            { flexDirection: 'row', alignItems: 'center' },
  avatar:              { width: 48, height: 48, borderRadius: 24, backgroundColor: '#0891b2', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText:          { fontSize: 20, fontWeight: '600', color: '#FFFFFF' },
  userTextContainer:   { justifyContent: 'center' },
  greeting:            { fontSize: 14, color: '#6b7280', marginBottom: 2 },
  userName:            { fontSize: 18, fontWeight: '700', color: '#111827' },
  headerActions:       { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },

  // Header icon buttons — now with visible labels to disambiguate
  iconButtonLabeled: { alignItems: 'center', gap: 3 },
  iconButtonInner:   {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center',
  },
  iconButtonLabel: { fontSize: 10, color: '#6b7280', fontWeight: '500' },

  messageBadge: {
    position: 'absolute', top: -2, right: -2,
    backgroundColor: '#ef4444', minWidth: 18, height: 18, borderRadius: 9,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#FFFFFF',
  },
  messageBadgeText: { fontSize: 10, fontWeight: '700', color: '#FFFFFF' },

  // Stats
  statsContainer: {
    flexDirection: 'row', justifyContent: 'space-around',
    backgroundColor: '#f8fafc', borderRadius: 16, padding: 16,
  },
  statItem:   { alignItems: 'center', flex: 1 },
  statValue:  { fontSize: 24, fontWeight: '700', color: '#0891b2', marginBottom: 4 },
  statLabel:  { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  statDivider:{ width: 1, height: '100%', backgroundColor: '#e5e7eb' },

  // Quick actions
  quickActions:       { paddingHorizontal: 16, paddingVertical: 20 },
  quickActionItem:    { alignItems: 'center', marginRight: 20, width: 70 },
  quickActionIcon:    { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  quickActionLabel:   { fontSize: 12, color: '#374151', fontWeight: '500', textAlign: 'center' },

  // Filter tabs
  filterTabs:         { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 16 },
  filterTab:          { flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  filterTabActive:    { borderBottomColor: '#0891b2' },
  filterTabText:      { fontSize: 14, color: '#9ca3af', fontWeight: '600' },
  filterTabTextActive:{ color: '#0891b2' },

  // Error
  errorContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fee2e2',
    marginHorizontal: 16, marginBottom: 16, padding: 12, borderRadius: 12,
  },
  errorText:  { flex: 1, fontSize: 14, color: '#991b1b', marginLeft: 8 },
  retryText:  { fontSize: 14, color: '#991b1b', fontWeight: '600', textDecorationLine: 'underline' },

  // Records list
  listContent: { paddingHorizontal: 16, paddingBottom: 120 },

  // Card
  card:         { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  cardExpanded: { shadowOpacity: 0.1, shadowRadius: 12, elevation: 4 },

  cardHeader:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  cardHeaderLeft:     { flexDirection: 'row', alignItems: 'center', flex: 1 },
  statusDot:          { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  cardTitleContainer: { flex: 1 },
  cardTitle:          { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 2 },
  cardDoctor:         { fontSize: 13, color: '#6b7280' },
  cardDate:           { fontSize: 12, color: '#9ca3af' },

  cardPreview:  { marginBottom: 12 },
  previewRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  previewText:  { fontSize: 13, color: '#4b5563', marginLeft: 8, flex: 1 },

  cardFooter:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tagContainer: { flexDirection: 'row', gap: 8 },
  tag:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  tagText:      { fontSize: 11, fontWeight: '600', marginLeft: 4 },
  cardActions:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center' },

  expandedContent:      { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  expandedSection:      { marginBottom: 16 },
  expandedSectionTitle: { fontSize: 13, fontWeight: '600', color: '#6b7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  expandedText:         { fontSize: 15, color: '#1f2937', lineHeight: 22 },

  symptomsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  symptomItem:       { backgroundColor: '#f3f4f6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  symptomItemText:   { fontSize: 13, color: '#374151' },

  appointmentInfo: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f9ff', padding: 12, borderRadius: 12 },
  appointmentText: { fontSize: 14, color: '#0369a1', marginLeft: 8, flex: 1 },

  emptyState:    { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyTitle:    { fontSize: 18, fontWeight: '600', color: '#374151', marginTop: 16, marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#9ca3af', textAlign: 'center', lineHeight: 20 },

  // ── AI Chat FAB ────────────────────────────────────────────────────────────
  // Deliberately different from the plain grey message icon in the header:
  //   • Gradient teal background (not grey)
  //   • "psychology" brain icon (not chat bubble)
  //   • Prominent orange "AI" badge
  //   • Subtle glow ring + pulse animation
  fabWrapper: {
    position: 'absolute',
    zIndex: 1000,
    elevation: 10,
  },
  fabGlow: {
    position: 'absolute',
    width: 68, height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(8, 145, 178, 0.18)',
    top: -4, left: -4,
  },
  fabGradient: {
    width: 60, height: 60, borderRadius: 30,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#0891b2', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.38, shadowRadius: 10, elevation: 8,
  },
  fabAIBadge: {
    position: 'absolute',
    top: -4, right: -6,
    backgroundColor: '#f97316',          
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 2, borderColor: '#FFFFFF',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2, shadowRadius: 2, elevation: 4,
  },
  fabAIBadgeText: { fontSize: 10, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.4 },
});

export default HomeScreen;