import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  Dimensions,
  StatusBar,
  Alert,
  SafeAreaView
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

const { width, height } = Dimensions.get('window');
const moderateScale = (size: number, factor = 0.5) => size + ((width / 375) * size - size) * factor;
const API_BASE_URL = 'http://localhost:3000/api';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  id?: string;
  category?: string;
  confidence?: number;
  suggestedActions?: string[];
  emergencyAlert?: boolean;
  relatedSpecialties?: string[];
  language?: 'en' | 'vi';
}

interface AIResponse {
  success: boolean;
  data: {
    response: string;
    confidence: number;
    suggestedActions?: string[];
    emergencyAlert?: boolean;
    category?: string;
    relatedSpecialties?: string[];
    language?: 'en' | 'vi';
  };
}

interface ChatWidgetProps {
  onBackToHome?: () => void;
  showBackButton?: boolean;
  isFullScreen?: boolean;
}

type RootStackParamList = {
  Home: undefined;
  Login: undefined;
  ChatOption: undefined;
  // ... other screens
};

type NavigationProp = StackNavigationProp<RootStackParamList>;

// Message Item Component
const MessageItem = ({ 
  item, 
  index, 
  isUser, 
  showAvatar,
  colors,
  isExiting 
}: { 
  item: ChatMessage; 
  index: number;
  isUser: boolean;
  showAvatar: boolean;
  colors: any;
  isExiting: boolean;
}) => {
  const messageAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (!isExiting) {
      Animated.spring(messageAnim, {
        toValue: 1,
        delay: index * 100,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }).start();
    }
  }, [isExiting]);

  const getCategoryColor = (category?: string) => {
    if (!category) return colors.gradientPrimary;
    
    const categoryColors: { [key: string]: string[] } = {
      cardiology: ['#00BCD4', '#00ACC1'],
      dermatology: ['#26C6DA', '#00ACC1'],
      neurology: ['#4DD0E1', '#26C6DA'],
      pediatrics: ['#00ACC1', '#0097A7'],
      orthopedics: ['#00BCD4', '#0097A7'],
      ophthalmology: ['#26C6DA', '#0097A7'],
      medications: ['#00BCD4', '#006064'],
      emergency: ['#FF5252', '#D32F2F'],
      general: colors.gradientPrimary
    };

    return categoryColors[category] || colors.gradientPrimary;
  };

  return (
    <Animated.View
      style={[
        styles.messageContainer,
        isUser ? styles.userContainer : styles.botContainer,
        {
          opacity: messageAnim,
          transform: [{
            translateY: messageAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [20, 0]
            })
          }]
        }
      ]}
    >
      {!isUser && showAvatar && (
        <LinearGradient
          colors={getCategoryColor(item.category)}
          style={styles.botAvatarGradient}
        >
          <View style={styles.avatarGlass} />
          <Ionicons 
            name={item.emergencyAlert ? "warning" : "medical"} 
            size={18} 
            color="#FFFFFF" 
          />
        </LinearGradient>
      )}

      <View style={[styles.messageContent, isUser ? styles.userContent : styles.botContent]}>
        <View style={styles.messageBubbleWrapper}>
          {isUser ? (
            <LinearGradient
              colors={colors.gradientPrimary}
              style={[styles.messageBubble, styles.userBubble]}
            >
              <View style={styles.messageGlass} />
              <Text style={styles.userMessageText}>
                {item.content}
              </Text>
            </LinearGradient>
          ) : (
            <View style={[styles.messageBubble, styles.botBubble]}>
              <View style={styles.botMessageGlass} />
              <Text style={[styles.messageText, { color: colors.textPrimary }]}>
                {item.content}
              </Text>
              
              {/* Confidence Indicator */}
              {item.confidence && (
                <View style={styles.confidenceContainer}>
                  <View style={styles.confidenceBar}>
                    <View 
                      style={[
                        styles.confidenceFill,
                        { 
                          width: `${item.confidence * 100}%`,
                          backgroundColor: item.confidence > 0.7 ? '#00BCD4' : 
                                         item.confidence > 0.5 ? '#FF9800' : '#FF5252'
                        }
                      ]} 
                    />
                  </View>
                  <Text style={styles.confidenceText}>
                    {Math.round(item.confidence * 100)}% confidence
                  </Text>
                </View>
              )}

              {/* Suggested Actions */}
              {item.suggestedActions && item.suggestedActions.length > 0 && (
                <View style={styles.actionsContainer}>
                  <Text style={styles.actionsTitle}>Suggested Actions:</Text>
                  {item.suggestedActions.map((action, idx) => (
                    <View key={idx} style={styles.actionChip}>
                      <Ionicons name="checkmark-circle" size={14} color="#00BCD4" />
                      <Text style={styles.actionText}>{action}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Emergency Alert */}
              {item.emergencyAlert && (
                <View style={styles.emergencyContainer}>
                  <Ionicons name="warning" size={16} color="#FF5252" />
                  <Text style={styles.emergencyText}>MEDICAL EMERGENCY - SEEK IMMEDIATE HELP</Text>
                </View>
              )}
            </View>
          )}
        </View>
        <Text style={[styles.timestamp, { color: colors.textLight }]}>
          {new Date(item.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
          })}
        </Text>
      </View>

      {isUser && showAvatar && (
        <LinearGradient
          colors={colors.gradientSecondary}
          style={styles.userAvatarGradient}
        >
          <View style={styles.avatarGlass} />
          <Ionicons name="person" size={16} color="#FFFFFF" />
        </LinearGradient>
      )}
    </Animated.View>
  );
};

// Typing Indicator Component
const TypingIndicator = ({ isTyping, isExiting, colors }: { 
  isTyping: boolean; 
  isExiting: boolean;
  colors: any;
}) => {
  const [dots, setDots] = useState('');
  const typingAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isTyping && !isExiting) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(typingAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(typingAnim, {
            toValue: 0.5,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [isTyping, isExiting]);

  useEffect(() => {
    if (!isTyping || isExiting) {
      setDots('');
      return;
    }

    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);

    return () => clearInterval(interval);
  }, [isTyping, isExiting]);

  if (!isTyping || isExiting) return null;

  return (
    <Animated.View style={[styles.typingContainer, { opacity: typingAnim }]}>
      <LinearGradient
        colors={colors.gradientPrimary}
        style={styles.botAvatarGradient}
      >
        <View style={styles.avatarGlass} />
        <Ionicons name="medical" size={18} color="#FFFFFF" />
      </LinearGradient>
      <View style={styles.typingBubble}>
        <View style={styles.typingBubbleGlass} />
        <Text style={[styles.typingText, { color: colors.textSecondary }]}>
          Analyzing medical query{dots}
        </Text>
        <View style={styles.typingDots}>
          {[0, 1, 2].map((i) => (
            <Animated.View
              key={i}
              style={[
                styles.typingDot,
                {
                  opacity: typingAnim,
                  transform: [{
                    scale: typingAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.8, 1.2]
                    })
                  }]
                }
              ]}
            />
          ))}
        </View>
      </View>
    </Animated.View>
  );
};

// Medical Header Component
const ChatHeader = ({
  onBackToHome,
  onClearChat,
  isTyping,
  isExiting
}: {
  onBackToHome: () => void;
  onClearChat: () => void;
  isTyping: boolean;
  isExiting: boolean;
}) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isTyping) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isTyping]);

  return (
    <View style={styles.headerWrapper}>
      <StatusBar barStyle="light-content" backgroundColor="#00BCD4" />
      <LinearGradient
        colors={['#00BCD4', '#00ACC1', '#0097A7']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <View style={styles.glassmorphismOverlay} />
        <SafeAreaView>
          <View style={styles.headerContainer}>
            <View style={styles.headerTopBar}>
              <TouchableOpacity
                style={styles.glassButton}
                onPress={onBackToHome}
                activeOpacity={0.8}
                disabled={isExiting}
              >
                <View style={styles.buttonGlass} />
                <Ionicons name="chevron-back" size={moderateScale(24)} color="#FFFFFF" />
              </TouchableOpacity>

              <View style={styles.headerCenter}>
                <Animated.View style={[
                  styles.avatarContainer,
                  { transform: [{ scale: pulseAnim }] }
                ]}>
                  <LinearGradient
                    colors={['#00BCD4', '#00ACC1', '#0097A7']}
                    style={styles.aiAvatar}
                  >
                    <Ionicons name="medical" size={moderateScale(20)} color="#FFFFFF" />
                  </LinearGradient>
                </Animated.View>
                <View style={styles.headerTextContainer}>
                  <Text style={styles.headerTitle}>HealthAI Assistant</Text>
                  <View style={styles.statusContainer}>
                    <View style={[styles.statusDot, isTyping && styles.statusDotActive]} />
                    <Text style={styles.headerSubtitle}>
                      {isTyping ? 'Analyzing...' : 'Ready to assist'}
                    </Text>
                  </View>
                </View>
              </View>

              <TouchableOpacity
                style={styles.glassButton}
                onPress={onClearChat}
                activeOpacity={0.8}
                disabled={isExiting}
              >
                <View style={styles.buttonGlass} />
                <Ionicons name="refresh-outline" size={moderateScale(22)} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
};

const ChatWidget: React.FC<ChatWidgetProps> = ({
  onBackToHome,
  showBackButton = true,
  isFullScreen = false
}) => {
  const navigation = useNavigation<NavigationProp>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [currentSession, setCurrentSession] = useState<any>(null);
  const flatListRef = useRef<FlatList>(null);
  const [currentLanguage, setCurrentLanguage] = useState<'en' | 'vi'>('en');
  const inputAnim = useRef(new Animated.Value(0)).current;  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isExiting, setIsExiting] = useState(false);

  const colors = {
    primary: '#00BCD4',
    primaryLight: '#4DD0E1',
    primaryDark: '#0097A7',
    secondary: '#00ACC1',
    accent: '#0097A7',
    background: '#FAFAFA',
    surface: '#FFFFFF',
    surfaceLight: '#F5F5F5',
    textPrimary: '#212121',
    textSecondary: '#757575',
    textLight: '#9E9E9E',
    error: '#FF5252',
    success: '#00BCD4',
    warning: '#FF9800',
    border: '#E0E0E0',
    glass: 'rgba(255, 255, 255, 0.1)',
    glassLight: 'rgba(255, 255, 255, 0.05)',
    gradientPrimary: ['#00BCD4', '#00ACC1'],
    gradientSecondary: ['#00ACC1', '#0097A7'],
    gradientWarm: ['#FF9800', '#FF5252']
  };

  const getAuthToken = async (): Promise<string | null> => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      return token;
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  };

  const getOrCreateSession = async (): Promise<any> => {
    try {
      const token = await getAuthToken();
      if (!token) return null;

      const response = await fetch(`${API_BASE_URL}/ai-medical/session`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          return data.data.session;
        }
      }
      return null;
    } catch (error) {
      console.error('Error getting session:', error);
      return null;
    }
  };

  useEffect(() => {
    initializeChat();

    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isInitialized && !isExiting) {
      startEntranceAnimation();
    }
  }, [isInitialized, isExiting]);

  useEffect(() => {
    Animated.spring(inputAnim, {
      toValue: input.length > 0 ? 1 : 0,
      useNativeDriver: true,
      tension: 200,
      friction: 12,
    }).start();
  }, [input]);

  const startEntranceAnimation = useCallback(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      })
    ]).start();
  }, [fadeAnim, slideAnim]);

  const startExitAnimation = useCallback(() => {
    return new Promise<void>((resolve) => {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        })
      ]).start(() => {
        resolve();
      });
    });
  }, [fadeAnim, slideAnim]);

  const detectMessageLanguage = (message: string): 'en' | 'vi' => {
    const vietnameseRegex = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
    const vietnameseKeywords = [
      'tôi', 'bạn', 'của', 'và', 'có', 'là', 'trong', 'cho', 'với', 'không',
      'bị', 'đau', 'thuốc', 'bệnh', 'khám', 'bác sĩ', 'bệnh viện', 'điều trị'
    ];

    if (vietnameseRegex.test(message)) {
      return 'vi';
    }

    const lowerMessage = message.toLowerCase();
    const vietnameseCount = vietnameseKeywords.filter(k => lowerMessage.includes(k)).length;

    return vietnameseCount > 2 ? 'vi' : 'en';
  };

  const initializeChat = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getAuthToken();
      if (!token) {
        setError('Please login to use HealthAI Assistant');
        setIsInitialized(true);
        return;
      }

      await loadChatHistory();
      setIsInitialized(true);
    } catch (err) {
      setError('Failed to initialize medical assistant');
      console.error('Initialize chat error:', err);
      setIsInitialized(true);
    } finally {
      setLoading(false);
    }
  };

  const loadChatHistory = async () => {
    try {
      const session = await getOrCreateSession();
      if (session) {
        setCurrentSession(session);
        
        const response = await fetch(`${API_BASE_URL}/ai-medical/session/${session.session_id}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${await getAuthToken()}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data.messages && data.data.messages.length > 0) {
            const formattedMessages: ChatMessage[] = data.data.messages.map((msg: any) => ({
              role: msg.role,
              content: msg.content,
              timestamp: new Date(msg.timestamp).toISOString(),
              id: `${msg.timestamp}-${msg.role}`,
              category: msg.category,
              confidence: msg.confidence,
              suggestedActions: msg.suggestedActions,
              emergencyAlert: msg.emergencyAlert,
              relatedSpecialties: msg.relatedSpecialties,
              language: msg.language
            }));
            setMessages(formattedMessages);
            return;
          }
        }
      }
      
      const welcomeMessage: ChatMessage = {
        role: 'assistant',
        content: 'Hello! I\'m your HealthAI Assistant. How can I help you with health-related questions today?\n\nNote: I provide information only, not medical diagnoses.',
        timestamp: new Date().toISOString(),
        id: `welcome-${Date.now()}`,
        category: 'general',
        confidence: 0.9,
        language: 'en'
      };
      setMessages([welcomeMessage]);
    } catch (err) {
      console.error('Error loading chat history:', err);
      const welcomeMessage: ChatMessage = {
        role: 'assistant',
        content: 'Hello! I\'m your HealthAI Assistant. How can I help you today?',
        timestamp: new Date().toISOString(),
        id: `welcome-fallback-${Date.now()}`,
        category: 'general',
        language: 'en'
      };
      setMessages([welcomeMessage]);
    }
  };

  const scrollToBottom = useCallback((animated = true) => {
    if (flatListRef.current && messages.length > 0) {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      scrollTimeoutRef.current = setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated });
      }, 100);
    }
  }, [messages.length]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    setLoading(true);
    setError(null);

    const detectedLang = detectMessageLanguage(input.trim());
    setCurrentLanguage(detectedLang);

    const userMsg: ChatMessage = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
      id: `user-${Date.now()}-${Math.random()}`,
      language: detectedLang
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error('Authentication required. Please login again.');
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      let response;
      try {
        response = await fetch(`${API_BASE_URL}/ai-medical/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            message: userMsg.content,
            language: detectedLang
          }),
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeoutId);
      }

      if (!response.ok) {
        if (response.status === 401) {
          await AsyncStorage.removeItem('authToken');
          await AsyncStorage.removeItem('userData');
          throw new Error('Session expired. Please login again.');
        }
        
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to process medical query');
      }

      const data: AIResponse = await response.json();

      if (!data.success) {
        throw new Error(data.data?.response || 'HealthAI service error');
      }

      if (data.data.session_id && !currentSession) {
        const session = await getOrCreateSession();
        setCurrentSession(session);
      }

      setTimeout(() => {
        setIsTyping(false);
        const botMsg: ChatMessage = {
          role: 'assistant',
          content: data.data.response,
          timestamp: new Date().toISOString(),
          id: `bot-${Date.now()}-${Math.random()}`,
          category: data.data.category,
          confidence: data.data.confidence,
          suggestedActions: data.data.suggestedActions,
          emergencyAlert: data.data.emergencyAlert,
          relatedSpecialties: data.data.relatedSpecialties,
          language: data.data.language || detectedLang
        };
        setMessages(prev => [...prev, botMsg]);

        if (data.data.emergencyAlert) {
          Alert.alert(
            "🚨 MEDICAL EMERGENCY",
            "This appears to be a medical emergency. Please seek immediate medical attention or call emergency services.",
            [
              {
                text: "Call Emergency",
                onPress: () => {
                  console.log("Emergency call initiated");
                },
                style: 'destructive'
              },
              {
                text: "I Understand",
                style: 'cancel'
              }
            ]
          );
        }
      }, 1000 + Math.random() * 500);

    } catch (err: any) {
      setIsTyping(false);
      
      let errorMsg = 'Failed to process medical query.';
      
      if (err.name === 'AbortError') {
        errorMsg = 'Request timed out. Please try again.';
      } else if (err.message.includes('Authentication') || err.message.includes('Session')) {
        errorMsg = err.message;
        setTimeout(() => {
          navigation.navigate('Login');
        }, 2000);
      } else {
        errorMsg = err.message || 'Please check your connection.';
      }

      setError(errorMsg);
      
      const fallbackMsg: ChatMessage = {
        role: 'assistant',
        content: 'I apologize, but I\'m having trouble processing your medical query. Please try again or consult with a healthcare professional directly for urgent matters.',
        timestamp: new Date().toISOString(),
        id: `fallback-${Date.now()}`,
        category: 'general',
        confidence: 0.3,
        language: 'en'
      };
      setMessages(prev => [...prev, fallbackMsg]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = async () => {
    Alert.alert(
      "Clear Conversation",
      "Start a new medical consultation? All current messages will be cleared and a new session will be created.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            try {
              const token = await getAuthToken();
              if (token && currentSession) {
                await fetch(`${API_BASE_URL}/ai-medical/session/${currentSession.session_id}/close`, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                  }
                });
              }

              const newSession = await getOrCreateSession();
              setCurrentSession(newSession);

              setMessages([{
                role: 'assistant',
                content: '🆕 New consultation started! How can I assist you with medical information today? Remember, I provide educational information only - always consult healthcare professionals for medical decisions.',
                timestamp: new Date().toISOString(),
                id: `clear-${Date.now()}`,
                category: 'general',
                confidence: 0.9,
                language: 'en'
              }]);
            } catch (err) {
              setError('Failed to clear chat');
            }
          }
        }
      ],
      { cancelable: true }
    );
  };

  const handleBackToHome = useCallback(async () => {
    if (isExiting) return;
    
    setIsExiting(true);

    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    try {
      await startExitAnimation();
      
      if (onBackToHome && typeof onBackToHome === 'function') {
        onBackToHome();
      } else if (navigation && navigation.goBack) {
        navigation.goBack();
      } else if (navigation && navigation.navigate) {
        navigation.navigate('ChatOption');
      } else {
        setIsExiting(false);
        Alert.alert('Navigation Error', 'Unable to navigate back');
      }
    } catch (error) {
      console.error('Error in handleBackToHome:', error);
      setIsExiting(false);
    }
  }, [onBackToHome, navigation, isExiting, startExitAnimation]);

  const getQuickReplies = () => {
    return [
      { text: "🤒 Explain common cold symptoms", icon: "thermometer" },
      { text: "💊 Ask about medication side effects", icon: "medical" },
      { text: "🩺 Understanding blood pressure", icon: "pulse" },
      { text: "🍎 Healthy diet recommendations", icon: "nutrition" },
      { text: "💪 Exercise for beginners", icon: "barbell" },
      { text: "😴 Sleep improvement tips", icon: "moon" },
      { text: "🧘 Stress management techniques", icon: "leaf" },
      { text: "📋 Pre-appointment preparation", icon: "document" }
    ];
  };

  const handleQuickReply = (reply: string) => {
    setInput(reply);
  };

  const renderQuickReplies = () => {
    if (messages.length > 1 || loading || !isInitialized || isExiting) return null;

    const quickReplies = getQuickReplies();

    return (
      <Animated.View
        style={[
          styles.quickRepliesContainer,
          {
            opacity: fadeAnim,
            transform: [{
              translateY: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [30, 0]
              })
            }]
          }
        ]}
      >
        <Text style={[styles.quickRepliesTitle, { color: colors.textSecondary }]}>
          💡 Common Medical Questions
        </Text>
        <View style={styles.quickReplies}>
          {quickReplies.map((reply, index) => (
            <TouchableOpacity
              key={index}
              style={styles.quickReplyChip}
              onPress={() => handleQuickReply(reply.text)}
              disabled={loading}
            >
              <LinearGradient
                colors={index % 2 === 0 ? colors.gradientPrimary : colors.gradientSecondary}
                style={styles.quickReplyGradient}
              >
                <View style={styles.quickReplyGlass} />
                <Text style={styles.quickReplyText}>
                  {reply.text}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </View>
      </Animated.View>
    );
  };

  const renderMessage = ({ item, index }: { item: ChatMessage; index: number }) => {
    const isUser = item.role === 'user';
    return (
      <MessageItem
        item={item}
        index={index}
        isUser={isUser}
        showAvatar={true}
        colors={colors}
        isExiting={isExiting}
      />
    );
  };

  const keyExtractor = (item: ChatMessage, index: number) => {
    return item.id || `${item.timestamp}-${item.role}-${index}`;
  };

  const sendButtonScale = inputAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.9, 1]
  });

  const sendButtonRotation = inputAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  const containerTranslateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [height, 0]
  });

  if (!isInitialized) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <LinearGradient
          colors={[colors.background, colors.surface]}
          style={styles.loadingGradient}
        >
          <Animated.View style={[styles.loadingContent, { opacity: fadeAnim }]}>
            <LinearGradient
              colors={colors.gradientPrimary}
              style={styles.loadingIcon}
            >
              <Ionicons name="medical" size={40} color="#FFFFFF" />
            </LinearGradient>
            <Text style={[styles.loadingTitle, { color: colors.textPrimary }]}>HealthAI Assistant</Text>
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Initializing medical knowledge base...</Text>
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
          </Animated.View>
        </LinearGradient>
      </View>
    );
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: containerTranslateY }],
          opacity: fadeAnim
        }
      ]}
    >
      <LinearGradient
        colors={[colors.background, colors.surface]}
        style={styles.backgroundGradient}
      >
        <KeyboardAvoidingView
          style={styles.keyboardAvoidingView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? (isFullScreen ? 0 : 90) : 0}
        >
          <SafeAreaView style={styles.safeArea}>
            <ChatHeader
              onBackToHome={handleBackToHome}
              onClearChat={clearChat}
              isTyping={isTyping}
              isExiting={isExiting}
            />

            <View style={styles.messagesContainer}>
              <FlatList
                ref={flatListRef}
                data={messages}
                renderItem={renderMessage}
                keyExtractor={keyExtractor}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                  !loading && !isExiting ? (
                    <Animated.View style={[styles.emptyState, { opacity: fadeAnim }]}>
                      <LinearGradient
                        colors={colors.gradientPrimary}
                        style={styles.emptyStateIcon}
                      >
                        <Ionicons name="medical" size={60} color="#FFFFFF" />
                      </LinearGradient>
                      <Text style={[styles.emptyStateTitle, { color: colors.textPrimary }]}>
                        HealthAI Ready
                      </Text>
                      <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
                        Your AI medical assistant is ready to provide health information and education.
                      </Text>
                    </Animated.View>
                  ) : null
                }
                ListHeaderComponent={renderQuickReplies()}
                ListFooterComponent={<TypingIndicator isTyping={isTyping} isExiting={isExiting} colors={colors} />}
              />
            </View>

            {error && !isExiting && (
              <Animated.View
                style={[
                  styles.errorContainer,
                  { opacity: fadeAnim }
                ]}
              >
                <LinearGradient
                  colors={['#FFEBEE', '#FFCDD2']}
                  style={styles.errorGradient}
                >
                  <View style={styles.errorGlass} />
                  <Ionicons name="warning" size={20} color={colors.error} />
                  <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
                  <TouchableOpacity
                    onPress={() => setError(null)}
                    disabled={isExiting}
                  >
                    <Ionicons name="close" size={20} color={colors.error} />
                  </TouchableOpacity>
                </LinearGradient>
              </Animated.View>
            )}

        <Animated.View style={[
          styles.inputContainer,
          { opacity: fadeAnim }
        ]}>
          <View style={styles.inputWrapper}>
            <View style={styles.textInputContainer}>
              <TextInput
                style={[styles.input, { 
                  color: colors.textPrimary,
                  backgroundColor: colors.surfaceLight,
                  borderColor: colors.border
                }]}
                value={input}
                onChangeText={setInput}
                placeholder="Ask about medical information..."
                placeholderTextColor={colors.textLight}
                editable={!loading && !isExiting}
                multiline
                maxLength={500}
                onSubmitEditing={sendMessage}
                returnKeyType="send"
                blurOnSubmit={false}
              />
            </View>
            
            <Animated.View style={{
              transform: [
                { scale: sendButtonScale },
                { rotate: sendButtonRotation }
              ]
            }}>
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  (!input.trim() || loading || isExiting) && styles.sendButtonDisabled
                ]}
                onPress={sendMessage}
                disabled={!input.trim() || loading || isExiting}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={(!input.trim() || loading || isExiting) ? 
                    [colors.textLight, colors.textLight] : 
                    colors.gradientPrimary}
                  style={styles.sendButtonGradient}
                >
                  {loading && !isExiting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Ionicons
                      name="send"
                      size={20}
                      color="#FFFFFF"
                    />
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          </View>

          {/* Fixed Input Footer */}
          <View style={styles.inputFooter}>
            <View style={styles.inputFooterLeft}>
              <Text style={[styles.charCount, { color: colors.textLight }]}>
                {input.length}/500
              </Text>
            </View>
            <View style={styles.inputFooterRight}>
              <View style={styles.securityInfo}>
                <Ionicons name="shield-checkmark" size={12} color={colors.success} />
                <Text style={[styles.securityText, { color: colors.textLight }]}>
                  Medical Information Only
                </Text>
              </View>
            </View>
          </View>
        </Animated.View>          
        </SafeAreaView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
  backgroundGradient: {
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  
  // Loading Styles
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingGradient: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContent: {
    alignItems: 'center',
    padding: moderateScale(40),
  },
  loadingIcon: {
    width: moderateScale(80),
    height: moderateScale(80),
    borderRadius: moderateScale(40),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: moderateScale(24),
  },
  loadingTitle: {
    fontSize: moderateScale(28),
    fontWeight: '700',
    marginBottom: moderateScale(8),
    letterSpacing: 0.5,
  },
  loadingText: {
    fontSize: moderateScale(16),
    fontWeight: '400',
    textAlign: 'center',
  },

  // Header Styles
  headerWrapper: {
    zIndex: 1000,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  headerGradient: {
    paddingBottom: moderateScale(16),
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    position: 'relative',
  },
  glassmorphismOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerContainer: {
    paddingHorizontal: moderateScale(20),
  },
  headerTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: moderateScale(16),
  },
  glassButton: {
    width: moderateScale(48),
    height: moderateScale(48),
    borderRadius: moderateScale(24),
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  buttonGlass: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: moderateScale(24),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: moderateScale(20),
  },
  avatarContainer: {
    marginRight: moderateScale(12),
  },
  aiAvatar: {
    width: moderateScale(44),
    height: moderateScale(44),
    borderRadius: moderateScale(22),
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: moderateScale(20),
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: moderateScale(2),
  },
  statusDot: {
    width: moderateScale(8),
    height: moderateScale(8),
    borderRadius: moderateScale(4),
    backgroundColor: '#FFFFFF',
    marginRight: moderateScale(6),
  },
  statusDotActive: {
    backgroundColor: '#FFEB3B',
  },
  headerSubtitle: {
    fontSize: moderateScale(13),
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },

  // Messages Container
  messagesContainer: {
    flex: 1,
    paddingHorizontal: moderateScale(16),
  },
  listContent: {
    paddingVertical: moderateScale(20),
    paddingBottom: moderateScale(100),
  },

  // Message Styles
  messageContainer: {
    marginVertical: moderateScale(8),
    paddingHorizontal: moderateScale(4),
  },
  userContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
  },
  botContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  messageContent: {
    maxWidth: '80%',
    marginHorizontal: moderateScale(8),
  },
  userContent: {
    alignItems: 'flex-end',
  },
  botContent: {
    alignItems: 'flex-start',
  },
  messageBubbleWrapper: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: moderateScale(20),
  },
  messageBubble: {
    paddingHorizontal: moderateScale(16),
    paddingVertical: moderateScale(12),
    position: 'relative',
    overflow: 'hidden',
  },
  userBubble: {
    borderRadius: moderateScale(20),
    borderBottomRightRadius: moderateScale(6),
  },
  botBubble: {
    backgroundColor: '#FFFFFF',
    borderRadius: moderateScale(20),
    borderBottomLeftRadius: moderateScale(6),
    borderWidth: 1,
    borderColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  messageGlass: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  botMessageGlass: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  messageText: {
    fontSize: moderateScale(15),
    lineHeight: moderateScale(22),
    fontWeight: '400',
    letterSpacing: 0.2,
  },
  userMessageText: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  timestamp: {
    fontSize: moderateScale(11),
    marginTop: moderateScale(4),
    color: '#9E9E9E',
  },
  userAvatarGradient: {
    width: moderateScale(32),
    height: moderateScale(32),
    borderRadius: moderateScale(16),
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  avatarGlass: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: moderateScale(16),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },

  // Typing Indicator Styles
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: moderateScale(8),
    paddingHorizontal: moderateScale(4),
  },
  botAvatarGradient: {
    width: moderateScale(36),
    height: moderateScale(36),
    borderRadius: moderateScale(18),
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
    marginRight: moderateScale(8),
  },
  typingBubble: {
    backgroundColor: '#FFFFFF',
    borderRadius: moderateScale(20),
    paddingHorizontal: moderateScale(16),
    paddingVertical: moderateScale(10),
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  typingBubbleGlass: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  typingText: {
    fontSize: moderateScale(14),
    color: '#757575',
    fontWeight: '500',
  },
  typingDots: {
    flexDirection: 'row',
    marginTop: moderateScale(6),
  },
  typingDot: {
    width: moderateScale(6),
    height: moderateScale(6),
    borderRadius: moderateScale(3),
    backgroundColor: '#9E9E9E',
    marginHorizontal: moderateScale(4),
  },

  // Quick Replies Styles
  quickRepliesContainer: {
    marginBottom: moderateScale(16),
  },
  quickRepliesTitle: {
    fontSize: moderateScale(16),
    fontWeight: '600',
    marginBottom: moderateScale(8),
    textAlign: 'center',
  },
  quickReplies: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  quickReplyChip: {
    margin: moderateScale(6),
    borderRadius: moderateScale(20),
    overflow: 'hidden',
  },
  quickReplyGradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: moderateScale(20),
  },
  quickReplyGlass: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: moderateScale(20),
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  quickReplyText: {
    fontSize: moderateScale(14),
    fontWeight: '500',
    color: '#FFFFFF',
    textAlign: 'center',
    padding: moderateScale(8),
  },
  
  // Error Styles
  errorContainer: {
    backgroundColor: 'rgba(255, 82, 82, 0.1)',
    borderRadius: moderateScale(8),
    padding: moderateScale(12),
    marginVertical: moderateScale(8),
    marginHorizontal: moderateScale(16),
  },
  errorGradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: moderateScale(8),
  },
  errorGlass: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: moderateScale(8),
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  errorText: {
    flex: 1,
    marginHorizontal: moderateScale(8),
    fontSize: moderateScale(13),
    fontWeight: '500',
  },

  // Input Styles
inputContainer: {
  paddingHorizontal: moderateScale(16),
  paddingTop: moderateScale(8),
  paddingBottom: Platform.OS === 'ios' ? moderateScale(20) : moderateScale(12),
  backgroundColor: 'transparent',
},
inputWrapper: {
  flexDirection: 'row',
  alignItems: 'flex-end',
  position: 'relative',
},
textInputContainer: {
  flex: 1,
  marginRight: moderateScale(12),
},
input: {
  flex: 1,
  borderRadius: 25,
  paddingHorizontal: 20,
  paddingVertical: 12,
  fontSize: 16,
  maxHeight: 100,
  borderWidth: 1,
  textAlignVertical: 'center',
  fontWeight: '400',
  includeFontPadding: false,
},
sendButton: {
  width: moderateScale(50),
  height: moderateScale(50),
  borderRadius: moderateScale(25),
  justifyContent: 'center',
  alignItems: 'center',
  position: 'relative',
  overflow: 'hidden',
  marginBottom: moderateScale(2),
},
sendButtonDisabled: {
  opacity: 0.5,
},
sendButtonGradient: {
  ...StyleSheet.absoluteFillObject,
  borderRadius: moderateScale(25),
  justifyContent: 'center',
  alignItems: 'center',
},
inputFooter: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginTop: moderateScale(8),
  paddingHorizontal: moderateScale(4),
},
inputFooterLeft: {
  flex: 1,
},
inputFooterRight: {
  flex: 1,
  alignItems: 'flex-end',
},
charCount: {
  fontSize: moderateScale(12),
  fontWeight: '500',
},
securityInfo: {
  flexDirection: 'row',
  alignItems: 'center',
},
securityText: {
  fontSize: moderateScale(12),
  fontWeight: '500',
  marginLeft: moderateScale(4),
},

  // Empty State Styles
  emptyState: {
    alignItems: 'center',
    marginTop: moderateScale(40),
    paddingHorizontal: moderateScale(20),
  },
  emptyStateIcon: {
    width: moderateScale(80),
    height: moderateScale(80),
    borderRadius: moderateScale(40),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: moderateScale(16),
  },
  emptyStateTitle: {
    fontSize: moderateScale(22),
    fontWeight: '700',
    marginBottom: moderateScale(8),
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: moderateScale(15),
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: moderateScale(22),
  },

  // Additional Styles
  confidenceContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  confidenceBar: {
    height: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  confidenceFill: {
    height: '100%',
    borderRadius: 3,
  },
  confidenceText: {
    fontSize: 11,
    color: '#757575',
    fontWeight: '500',
  },
  actionsContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  actionsTitle: {
    fontSize: 12,
    color: '#757575',
    fontWeight: '600',
    marginBottom: 6,
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 188, 212, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 4,
    alignSelf: 'flex-start',
  },
  actionText: {
    fontSize: 11,
    color: '#00BCD4',
    fontWeight: '500',
    marginLeft: 4,
  },
  emergencyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 82, 82, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 82, 82, 0.3)',
  },
  emergencyText: {
    fontSize: 12,
    color: '#FF5252',
    fontWeight: '700',
    marginLeft: 6,
    flex: 1,
  },
});

export default ChatWidget;