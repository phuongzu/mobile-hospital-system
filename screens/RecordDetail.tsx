import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  Modal,
  TextInput,
  Animated,
  Dimensions,
  Platform,
  StatusBar,
  SafeAreaView,
  RefreshControl,
  FlatList,
  KeyboardAvoidingView,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import FlashMessage, { showMessage } from 'react-native-flash-message';
import { Message, TreatmentStep, Record } from '../types';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const API_BASE_URL = 'http://localhost:3000/api';

const RecordDetail: React.FC = () => {
  const route = useRoute<any>();
  const navigation = useNavigation();
  const [record, setRecord] = useState<Record>(route.params?.record || null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [selectedStep, setSelectedStep] = useState<TreatmentStep | null>(null);
  
  const [conditionDesc, setConditionDesc] = useState('');
  const [patientMsg, setPatientMsg] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (record?._id && record?._id !== 'HT-88291-EN') {
      fetchLatestData();
    }
    Animated.parallel([
      Animated.timing(fadeAnim, { 
        toValue: 1, 
        duration: 600, 
        useNativeDriver: true 
      }),
      Animated.timing(slideAnim, { 
        toValue: 0, 
        duration: 600, 
        useNativeDriver: true 
      }),
    ]).start();
    
    // Animate progress bar
    setTimeout(() => {
      Animated.timing(progressAnim, {
        toValue: calculateProgress(),
        duration: 1000,
        useNativeDriver: false,
      }).start();
    }, 300);
  }, []);

  const fetchLatestData = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const response = await axios.get(`${API_BASE_URL}/medical-records/my-records`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const current = response.data.find((r: Record) => r._id === record._id);
      if (current) setRecord(current);
    } catch (error) {
      console.error("Fetch Error:", error);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchLatestData();
    setRefreshing(false);
  }, []);

  const handleActivateStep = async (stepNumber: number) => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      await axios.patch(`${API_BASE_URL}/medical-records/${record._id}/steps/${stepNumber}/activate`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showMessage({ 
        message: "Phase Started Successfully!", 
        type: "success",
        floating: true 
      });
      fetchLatestData();
    } catch (error: any) {
      showMessage({ 
        message: "Failed to start phase", 
        type: "danger",
        floating: true 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteStep = async () => {
    if (!selectedStep || !conditionDesc.trim()) return;
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      await axios.patch(
        `${API_BASE_URL}/medical-records/${record._id}/steps/${selectedStep.stepNumber}/complete-with-message`,
        { patientMessage: patientMsg, conditionDescription: conditionDesc },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setShowCompleteModal(false);
      setConditionDesc('');
      setPatientMsg('');
      showMessage({ 
        message: "Health Report Sent Successfully!", 
        type: "success",
        floating: true 
      });
      fetchLatestData();
    } catch (error: any) {
      showMessage({ 
        message: "Failed to send report", 
        type: "danger",
        floating: true 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmArrival = async (stepNumber: number) => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      await axios.post(`${API_BASE_URL}/doctor/consultations/${record._id}/steps/${stepNumber}/confirm-arrival`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showMessage({ 
        message: "Arrival Confirmed Successfully!", 
        type: "success",
        floating: true 
      });
      fetchLatestData();
    } catch (error: any) {
      showMessage({ 
        message: "Confirmation Failed", 
        type: "danger",
        floating: true 
      });
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const res = await axios.get(`${API_BASE_URL}/messages/record/${record._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessages(res.data.data.messages || []);
    } catch (e) { 
      console.log("Load messages error:", e); 
    }
  };

  const sendChatMessage = async () => {
    if (!newMessage.trim()) return;
    const tempMessage = {
      _id: `temp_${Date.now()}`,
      sender_id: record.user_id._id,
      message: newMessage,
      timestamp: new Date().toISOString(),
      read: false
    };

    setMessages(prev => [...prev, tempMessage]);
    const messageToSend = newMessage;
    setNewMessage('');
    
    try {
      const token = await AsyncStorage.getItem('authToken');
      await axios.post(`${API_BASE_URL}/messages/send`, {
        receiver_id: record.doctor_id._id,
        message: messageToSend,
        medical_record_id: record._id
      }, { headers: { Authorization: `Bearer ${token}` } });
    } catch (e) { 
      showMessage({ 
        message: "Failed to send message", 
        type: "danger",
        floating: true 
      });
    }
  };

  const calculateProgress = () => {
    if (!record.treatment_plan?.length) return 0;
    const done = record.treatment_plan.filter(s => 
      s.status === 'approved' || s.status === 'completed'
    ).length;
    return (done / record.treatment_plan.length) * 100;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return '#10B981';
      case 'approved': return '#3B82F6';
      case 'in-progress': return '#F59E0B';
      case 'scheduled': return '#8B5CF6';
      case 'pending': return '#94A3B8';
      default: return '#CBD5E1';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return 'checkmark-circle';
      case 'approved': return 'shield-checkmark';
      case 'in-progress': return 'time';
      case 'scheduled': return 'calendar';
      case 'pending': return 'ellipsis-horizontal';
      default: return 'help-circle';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <FlashMessage position="top" />

      {/* Modern Header with Gradient */}
      <LinearGradient
        colors={['#FFFFFF', '#F8FAFC']}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={24} color="#1E293B" />
          </TouchableOpacity>
          
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Treatment Journey</Text>
            <Text style={styles.recordId}>#{record._id}</Text>
          </View>
          
          <TouchableOpacity 
            onPress={onRefresh} 
            style={styles.refreshButton}
            activeOpacity={0.7}
          >
            <Ionicons 
              name="refresh" 
              size={20} 
              color="#64748B" 
              style={{ transform: [{ rotate: refreshing ? '180deg' : '0deg' }] }}
            />
          </TouchableOpacity>
        </View>

        {/* Progress Section */}
        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Overall Progress</Text>
            <Animated.Text style={styles.progressPercentage}>
              {Math.round(progressAnim._value)}%
            </Animated.Text>
          </View>
          
          <View style={styles.progressBarContainer}>
            <View style={styles.progressBarBackground}>
              <Animated.View 
                style={[
                  styles.progressBarFill,
                  {
                    width: progressAnim.interpolate({
                      inputRange: [0, 100],
                      outputRange: ['0%', '100%']
                    })
                  }
                ]}
              />
            </View>
            <View style={styles.progressSteps}>
              {record.treatment_plan?.map((step, index) => (
                <View key={index} style={styles.stepDotContainer}>
                  <View 
                    style={[
                      styles.stepDot,
                      { 
                        backgroundColor: step.status === 'completed' || step.status === 'approved' 
                          ? '#3B82F6' 
                          : '#E2E8F0' 
                      }
                    ]} 
                  />
                  <Text style={styles.stepNumber}>Phase {index + 1}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </LinearGradient>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            tintColor="#3B82F6"
          />
        }
      >
        {/* Doctor Info Card */}
        <Animated.View 
          style={[
            styles.doctorCard,
            { 
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }] 
            }
          ]}
        >
          <View style={styles.doctorCardHeader}>
            <Text style={styles.sectionTitle}>Your Physician</Text>
            <TouchableOpacity 
              onPress={() => { 
                setShowChatModal(true); 
                loadMessages(); 
              }}
              style={styles.chatButton}
              activeOpacity={0.7}
            >
              <Ionicons name="chatbubble-ellipses" size={20} color="#3B82F6" />
              <Text style={styles.chatButtonText}>Message</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.doctorInfo}>
            <View style={styles.avatarContainer}>
              <LinearGradient 
                colors={['#3B82F6', '#2563EB']} 
                style={styles.doctorAvatar}
              >
                <Text style={styles.avatarText}>
                  {record.doctor_id.name.charAt(0)}
                </Text>
              </LinearGradient>
              <View style={styles.onlineIndicator} />
            </View>
            
            <View style={styles.doctorDetails}>
              <Text style={styles.doctorName}>Dr. {record.doctor_id.name}</Text>
              <Text style={styles.doctorSpecialty}>
                {record.doctor_id.specialty_id?.name || "Specialist"}
              </Text>
              <View style={styles.ratingContainer}>
              </View>
            </View>
          </View>
          
          <View style={styles.diagnosisContainer}>
            <View style={styles.diagnosisHeader}>
              <Ionicons name="medical" size={18} color="#e20c0c" />
              <Text style={styles.diagnosisTitle}>Diagnosis</Text>
            </View>
            <Text style={styles.diagnosisText}>{record.diagnosis}</Text>
            <View style={styles.severityBadge}>
              <Text style={styles.severityText}>
                {record.severity?.toUpperCase() || 'MODERATE'}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Treatment Timeline */}
        <View style={styles.timelineContainer}>
          <View style={styles.timelineHeader}>
            <Text style={styles.timelineTitle}>Treatment Phases</Text>
            <View style={styles.timelineLegend}>
              <View style={styles.legendItem}></View>
            </View>
          </View>
          
          {record.treatment_plan?.map((step, index) => {
            const isActive = step.status === 'in-progress';
            const isCompleted = step.status === 'completed' || step.status === 'approved';
            const isVisit = step.isPhysicalVisit;
            const statusColor = getStatusColor(step.status);
            
            return (
              <View key={index} style={styles.timelineItem}>
                {/* Timeline Connector */}
                {index > 0 && (
                  <View style={[
                    styles.timelineConnector,
                    isCompleted && { backgroundColor: statusColor }
                  ]} />
                )}
                
                {/* Timeline Node */}
                <View style={styles.timelineNodeContainer}>
                  <View 
                    style={[
                      styles.timelineNode,
                      { borderColor: statusColor },
                      isCompleted && { backgroundColor: statusColor }
                    ]}
                  >
                    <Ionicons 
                      name={getStatusIcon(step.status)} 
                      size={16} 
                      color={isCompleted ? "#FFFFFF" : statusColor} 
                    />
                  </View>
                </View>

                {/* Step Card */}
                <View style={[
                  styles.stepCard,
                  isActive && styles.activeStepCard,
                ]}>
                  {/* Card Left Border */}
                  <View style={[
                    styles.cardLeftBorder,
                    { backgroundColor: isVisit ? '#10B981' : '#3B82F6' }
                  ]} />
                  
                  <View style={styles.cardContent}>
                    <View style={styles.cardHeader}>
                      <View style={styles.headerLeft}>
                        <View style={[
                          styles.stepTypeBadge,
                          { backgroundColor: isVisit ? '#ECFDF5' : '#EFF6FF' }
                        ]}>
                          <Ionicons 
                            name={isVisit ? "calendar" : "medical-outline"} 
                            size={14} 
                            color={isVisit ? '#047857' : '#1D4ED8'} 
                          />
                          <Text style={[
                            styles.stepTypeText,
                            { color: isVisit ? '#047857' : '#1D4ED8' }
                          ]}>
                            {isVisit ? 'RE-EXAMINATION' : 'TREATMENT STEP'}
                          </Text>
                        </View>
                        <View style={styles.stepNumberContainer}>
                          <Text style={styles.stepNumberText}>Phase {step.stepNumber}</Text>
                        </View>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: `${statusColor}15` }]}>
                        <Text style={[styles.statusText, { color: statusColor }]}>
                          {step.status.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                    
                    <View style={styles.stepContent}>
                      <View style={styles.stepTitleRow}>
                        <Ionicons 
                          name={isVisit ? "location" : "home"} 
                          size={16} 
                          color={isVisit ? '#10B981' : '#3B82F6'} 
                          style={styles.stepIcon}
                        />
                        <Text style={styles.stepTitle}>{step.title}</Text>
                      </View>
                      <Text style={styles.stepDescription}>{step.description}</Text>
                    </View>
                    
                    {/* Visit Details */}
                    {isVisit && step.reExaminationDate && (
                      <View style={[
                        styles.visitDetails,
                        { backgroundColor: '#F0FDF4' }
                      ]}>
                        <View style={styles.visitDateTime}>
                          <View style={styles.dateTimeBlock}>
                            <Text style={[
                              styles.dateTimeLabel,
                              { color: '#047857' }
                            ]}>DATE</Text>
                            <Text style={styles.dateTimeValue}>
                              {new Date(step.reExaminationDate).toLocaleDateString('en-US', { 
                                weekday: 'short', 
                                month: 'short', 
                                day: 'numeric' 
                              })}
                            </Text>
                          </View>
                          <View style={styles.verticalDivider} />
                          <View style={styles.dateTimeBlock}>
                            <Text style={[
                              styles.dateTimeLabel,
                              { color: '#047857' }
                            ]}>TIME</Text>
                            <Text style={styles.dateTimeValue}>
                              {new Date(step.reExaminationDate).toLocaleTimeString('en-US', { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                            </Text>
                          </View>
                        </View>
                        
                        {step.status === 'scheduled' && !step.arrivalConfirmed && (
                          <TouchableOpacity
                            style={[
                              styles.arrivalButton,
                              { backgroundColor: '#10B981' }
                            ]}
                            onPress={() => handleConfirmArrival(step.stepNumber)}
                            activeOpacity={0.8}
                          >
                            <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                            <Text style={styles.arrivalButtonText}>Confirm Arrival</Text>
                          </TouchableOpacity>
                        )}
                        
                        {step.arrivalConfirmed && (
                          <View style={styles.confirmedContainer}>
                            <Ionicons name="checkmark-done-circle" size={18} color="#10B981" />
                            <Text style={[
                              styles.confirmedText,
                              { color: '#047857' }
                            ]}>Checked In</Text>
                          </View>
                        )}
                      </View>
                    )}
                    
                    {/* Medication Details */}
                    {!isVisit && step.medication && (
                      <View style={[
                        styles.medicationDetails,
                        { backgroundColor: '#F0F9FF' }
                      ]}>
                        <View style={styles.medicationHeader}>
                          <Ionicons name="medical-outline" size={16} color="#1D4ED8" />
                          <Text style={[
                            styles.medicationTitle,
                            { color: '#1D4ED8' }
                          ]}>Medication Plan</Text>
                        </View>
                        <View style={styles.medicationRow}>
                          <Ionicons name="medkit-outline" size={14} color="#475569" />
                          <Text style={styles.medicationName}>{step.medication}</Text>
                        </View>
                        <View style={styles.dosageContainer}>
                          <Ionicons name="time-outline" size={14} color="#475569" />
                          <Text style={styles.dosageText}>{step.dosage}</Text>
                        </View>
                        <View style={styles.durationContainer}>
                          <Ionicons name="calendar-outline" size={14} color="#475569" />
                          <Text style={styles.durationText}>Duration: {step.duration}</Text>
                        </View>
                      </View>
                    )}
                    
                    {/* Action Buttons */}
                    {step.status === 'pending' && !isVisit && (
                      <TouchableOpacity
                        style={[
                          styles.startButton,
                          { backgroundColor: '#0EA5E9' }
                        ]}
                        onPress={() => handleActivateStep(step.stepNumber)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="play-circle" size={18} color="#FFFFFF" />
                        <Text style={styles.startButtonText}>Start This Phase</Text>
                      </TouchableOpacity>
                    )}
                    
                    {step.status === 'in-progress' && !isVisit && (
                      <TouchableOpacity
                        style={styles.reportButton}
                        onPress={() => { 
                          setSelectedStep(step); 
                          setShowCompleteModal(true); 
                        }}
                        activeOpacity={0.8}
                      >
                        <LinearGradient
                          colors={['#3B82F6', '#2563EB']}
                          style={styles.reportButtonGradient}
                        >
                          <Ionicons name="document-text" size={18} color="#FFFFFF" />
                          <Text style={styles.reportButtonText}>Report Progress</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    )}
                    
                    {/* Doctor Notes */}
                    {step.doctorNotes && (
                      <View style={[
                        styles.notesContainer,
                        { backgroundColor: '#F8FAFC' }
                      ]}>
                        <View style={styles.notesHeader}>
                          <Ionicons name="information-circle" size={16} color="#475569" />
                          <Text style={[
                            styles.notesTitle,
                            { color: '#475569' }
                          ]}>Doctor's Notes</Text>
                        </View>
                        <Text style={styles.notesText}>{step.doctorNotes}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity 
        style={styles.floatingButton}
        onPress={() => { 
          setShowChatModal(true); 
          loadMessages(); 
        }}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={['#3B82F6', '#2563EB']}
          style={styles.floatingButtonGradient}
        >
          <Ionicons name="chatbubble-ellipses" size={24} color="#FFFFFF" />
        </LinearGradient>
      </TouchableOpacity>

      {/* Progress Report Modal */}
      <Modal
        visible={showCompleteModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCompleteModal(false)}
      >
        <BlurView intensity={20} style={styles.modalOverlay}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalContainer}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View style={styles.modalHandle} />
                <Text style={styles.modalTitle}>Daily Health Report</Text>
                <Text style={styles.modalSubtitle}>
                  Phase {selectedStep?.stepNumber}: {selectedStep?.title}
                </Text>
              </View>
              
              <ScrollView 
                style={styles.modalForm}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>
                    How are you feeling today? *
                  </Text>
                  <TextInput
                    style={[styles.textInput, styles.textArea]}
                    placeholder="Describe your current symptoms, side effects, or improvements..."
                    placeholderTextColor="#94A3B8"
                    multiline
                    numberOfLines={4}
                    value={conditionDesc}
                    onChangeText={setConditionDesc}
                  />
                </View>
                
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>
                    Additional Notes (Optional)
                  </Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Any questions or concerns for your doctor?"
                    placeholderTextColor="#94A3B8"
                    value={patientMsg}
                    onChangeText={setPatientMsg}
                  />
                </View>
                
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[
                      styles.submitButton,
                      (!conditionDesc.trim() || loading) && styles.submitButtonDisabled
                    ]}
                    onPress={handleCompleteStep}
                    disabled={!conditionDesc.trim() || loading}
                    activeOpacity={0.8}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                        <Text style={styles.submitButtonText}>Submit Report</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => setShowCompleteModal(false)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </BlurView>
      </Modal>

      {/* Chat Modal */}
      <Modal
        visible={showChatModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowChatModal(false)}
      >
        <View style={styles.chatModalOverlay}>
          <View style={styles.chatContainer}>
            {/* Chat Header */}
            <View style={styles.chatHeader}>
              <View style={styles.chatDoctorInfo}>
                <LinearGradient
                  colors={['#3B82F6', '#2563EB']}
                  style={styles.chatDoctorAvatar}
                >
                  <Text style={styles.chatAvatarText}>
                    {record.doctor_id.name.charAt(0)}
                  </Text>
                </LinearGradient>
                <View>
                  <Text style={styles.chatDoctorName}>
                    Dr. {record.doctor_id.name}
                  </Text>
                  <View style={styles.chatStatus}>
                    <View style={styles.activeStatusDot} />
                    <Text style={styles.chatStatusText}>Online</Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity
                style={styles.closeChatButton}
                onPress={() => setShowChatModal(false)}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>
            
            {/* Messages List */}
            <FlatList
              data={messages}
              keyExtractor={(item, index) => item._id || index.toString()}
              contentContainerStyle={styles.messagesList}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <View style={[
                  styles.messageBubble,
                  item.sender_id === record.user_id._id 
                    ? styles.myMessageBubble 
                    : styles.theirMessageBubble
                ]}>
                  <Text style={[
                    styles.messageText,
                    item.sender_id === record.user_id._id 
                      ? styles.myMessageText 
                      : styles.theirMessageText
                  ]}>
                    {item.message}
                  </Text>
                  <Text style={styles.messageTime}>
                    {new Date(item.timestamp).toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </Text>
                </View>
              )}
              ListEmptyComponent={
                <View style={styles.emptyChat}>
                  <Ionicons name="chatbubbles-outline" size={60} color="#CBD5E1" />
                  <Text style={styles.emptyChatTitle}>Start Conversation</Text>
                  <Text style={styles.emptyChatText}>
                    Send your first message to Dr. {record.doctor_id.name}
                  </Text>
                </View>
              }
            />
            
            {/* Message Input */}
            <View style={styles.messageInputContainer}>
              <TextInput
                style={styles.messageInput}
                placeholder="Type your message..."
                placeholderTextColor="#94A3B8"
                value={newMessage}
                onChangeText={setNewMessage}
                multiline
              />
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  !newMessage.trim() && styles.sendButtonDisabled
                ]}
                onPress={sendChatMessage}
                disabled={!newMessage.trim()}
                activeOpacity={0.8}
              >
                <Ionicons 
                  name="send" 
                  size={20} 
                  color={newMessage.trim() ? "#FFFFFF" : "#CBD5E1"} 
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  
  // Header Styles
  headerGradient: {
    paddingTop: Platform.OS === 'ios' ? 10 : StatusBar.currentHeight,
    paddingBottom: 24,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  recordId: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    letterSpacing: 1,
  },
  refreshButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Progress Section
  progressSection: {
    paddingHorizontal: 24,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressLabel: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
  progressPercentage: {
    fontSize: 18,
    fontWeight: '800',
    color: '#2563EB',
  },
  progressBarContainer: {
    marginBottom: 8,
  },
  progressBarBackground: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#2563EB',
    borderRadius: 3,
  },
  progressSteps: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  stepDotContainer: {
    alignItems: 'center',
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 4,
  },
  stepNumber: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600',
  },
  
  // Scroll Content
  scrollContent: {
    paddingBottom: 100,
  },
  
  // Doctor Card
  doctorCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    marginHorizontal: 20,
    marginTop: -20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 8,
  },
  doctorCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    gap: 6,
  },
  chatButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
  },
  doctorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarContainer: {
    position: 'relative',
  },
  doctorAvatar: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#10B981',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  doctorDetails: {
    flex: 1,
    marginLeft: 16,
  },
  doctorName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 4,
  },
  doctorSpecialty: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  diagnosisContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
  },
  diagnosisHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  diagnosisTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  diagnosisText: {
    fontSize: 16,
    color: '#1E293B',
    fontWeight: '600',
    marginBottom: 12,
    lineHeight: 24,
  },
  severityBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  severityText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#92400E',
  },
  
  // Timeline
  timelineContainer: {
    paddingHorizontal: 20,
    marginTop: 30,
  },
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  timelineTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  timelineLegend: {
    flexDirection: 'row',
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  timelineItem: {
    marginBottom: 32,
    position: 'relative',
  },
  timelineConnector: {
    position: 'absolute',
    left: 32,
    top: -32,
    width: 2,
    height: 32,
    backgroundColor: '#E2E8F0',
  },
  timelineNodeContainer: {
    position: 'absolute',
    left: 20,
    top: 0,
    zIndex: 2,
  },
  timelineNode: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  
  // Step Card
  stepCard: {
    marginLeft: 56,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    overflow: 'hidden',
    position: 'relative',
  },
  activeStepCard: {
    borderColor: '#DBEAFE',
    borderWidth: 2,
  },
  cardLeftBorder: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
  },
  cardContent: {
    padding: 20,
    marginLeft: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  headerLeft: {
    flex: 1,
    marginRight: 12,
  },
  stepTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 8,
    gap: 6,
  },
  stepTypeText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  stepNumberContainer: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  stepNumberText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748B',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  stepContent: {
    marginBottom: 20,
  },
  stepTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  stepIcon: {
    marginTop: 2,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E293B',
    flex: 1,
  },
  stepDescription: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 22,
  },
  
  // Visit Details
  visitDetails: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  visitDateTime: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  dateTimeBlock: {
    flex: 1,
    alignItems: 'center',
  },
  dateTimeLabel: {
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 4,
    letterSpacing: 1,
  },
  dateTimeValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#064E3B',
  },
  verticalDivider: {
    width: 1,
    height: '100%',
    backgroundColor: '#F1F5F9',
  },
  arrivalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  arrivalButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  confirmedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
  },
  confirmedText: {
    fontSize: 14,
    fontWeight: '700',
  },
  
  // Medication Details
  medicationDetails: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E0F2FE',
  },
  medicationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  medicationTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  medicationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  medicationName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#334155',
  },
  dosageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  dosageText: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '600',
  },
  durationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  durationText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  
  // Action Buttons
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    marginBottom: 16,
  },
  startButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  reportButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  reportButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  reportButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  
  // Notes Container
  notesContainer: {
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#CBD5E1',
  },
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  notesTitle: {
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  notesText: {
    fontSize: 14,
    color: '#1E293B',
    fontStyle: 'italic',
    lineHeight: 22,
  },
  
  // Bottom Spacer
  bottomSpacer: {
    height: 100,
  },
  
  // Floating Button
  floatingButton: {
    position: 'absolute',
    bottom: 30,
    right: 24,
    width: 64,
    height: 64,
    borderRadius: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  floatingButtonGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Modal Styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: '85%',
  },
  modalHeader: {
    padding: 28,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalHandle: {
    width: 40,
    height: 5,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 15,
    color: '#64748B',
  },
  modalForm: {
    padding: 28,
  },
  formGroup: {
    marginBottom: 24,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 12,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    color: '#1E293B',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  modalActions: {
    marginTop: 8,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    padding: 18,
    borderRadius: 16,
    gap: 10,
    marginBottom: 16,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  cancelButton: {
    padding: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#94A3B8',
  },
  
  // Chat Modal
  chatModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  chatContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    marginTop: 60,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  chatDoctorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  chatDoctorAvatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatAvatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  chatDoctorName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E293B',
  },
  chatStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  activeStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  chatStatusText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  closeChatButton: {
    padding: 8,
  },
  
  // Messages
  messagesList: {
    padding: 20,
    paddingBottom: 100,
  },
  messageBubble: {
    maxWidth: '80%',
    marginBottom: 16,
    padding: 16,
    borderRadius: 20,
  },
  myMessageBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#2563EB',
    borderBottomRightRadius: 4,
  },
  theirMessageBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#F1F5F9',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 4,
  },
  myMessageText: {
    color: '#FFFFFF',
  },
  theirMessageText: {
    color: '#1E293B',
  },
  messageTime: {
    fontSize: 11,
    opacity: 0.7,
  },
  emptyChat: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyChatTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyChatText: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  
  // Message Input
  messageInputContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  messageInput: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 20,
    borderRadius: 25,
    fontSize: 16,
    maxHeight: 100,
    paddingVertical: 12,
  },
  sendButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#F1F5F9',
  },
});

export default RecordDetail;