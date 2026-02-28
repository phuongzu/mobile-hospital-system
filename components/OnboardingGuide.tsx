// components/OnboardingGuide.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
  Modal,
  SafeAreaView,
  StatusBar,
  FlatList,
  Platform,
  Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path, Rect, Ellipse, Defs, RadialGradient, Stop } from 'react-native-svg';

const { width, height } = Dimensions.get('window');

// ─── SVG Illustrations ──────────────────────────────────────────────────────
// Slide 1: Book Appointment – Calendar with doctor icon
const BookAppointmentIllustration = () => (
  <Svg width={220} height={200} viewBox="0 0 220 200">
    {/* Calendar base */}
    <Rect x="20" y="30" width="130" height="120" rx="12" fill="white" opacity="0.95" />
    {/* Calendar header bar */}
    <Rect x="20" y="30" width="130" height="38" rx="12" fill="white" opacity="1" />
    <Rect x="20" y="55" width="130" height="13" fill="white" opacity="1" />
    {/* Calendar red top strip */}
    <Rect x="20" y="30" width="130" height="34" rx="12" fill="#FF6B6B" opacity="0.9" />
    <Rect x="20" y="50" width="130" height="14" fill="#FF6B6B" opacity="0.9" />
    {/* Calendar rings */}
    <Rect x="52" y="22" width="10" height="20" rx="5" fill="white" opacity="0.8" />
    <Rect x="108" y="22" width="10" height="20" rx="5" fill="white" opacity="0.8" />
    {/* Month text */}
    <Rect x="62" y="38" width="46" height="8" rx="4" fill="white" opacity="0.85" />
    {/* Calendar grid dots */}
    {[0, 1, 2, 3, 4, 5, 6].map(col => (
      <Rect key={`h-${col}`} x={30 + col * 17} y={74} width="10" height="7" rx="3.5" fill="#E0E0E0" opacity="0.8" />
    ))}
    {[0, 1, 2, 3, 4, 5, 6].map(col => (
      <Rect key={`r1-${col}`} x={30 + col * 17} y={88} width="10" height="7" rx="3.5" fill={col === 2 ? '#0A84FF' : '#E0E0E0'} opacity={col === 2 ? 1 : 0.8} />
    ))}
    {[0, 1, 2, 3, 4, 5, 6].map(col => (
      <Rect key={`r2-${col}`} x={30 + col * 17} y={102} width="10" height="7" rx="3.5" fill={col === 5 ? '#34C759' : '#E0E0E0'} opacity={col === 5 ? 1 : 0.8} />
    ))}
    {[0, 1, 2, 3, 4].map(col => (
      <Rect key={`r3-${col}`} x={30 + col * 17} y={116} width="10" height="7" rx="3.5" fill="#E0E0E0" opacity="0.8" />
    ))}
    {/* Selected day highlight */}
    <Circle cx="57" cy="92" r="8" fill="#0A84FF" opacity="1" />
    <Rect x="53" y="88" width="8" height="8" fill="#0A84FF" />
    {/* Doctor figure on right */}
    <Circle cx="168" cy="72" r="28" fill="white" opacity="0.2" />
    <Circle cx="168" cy="62" r="16" fill="white" opacity="0.9" />
    {/* Doctor face */}
    <Circle cx="168" cy="62" r="14" fill="#FFD4B2" />
    {/* Stethoscope */}
    <Path d="M155 95 Q160 110 168 112 Q176 110 181 95" stroke="white" strokeWidth="3" fill="none" opacity="0.9" />
    <Circle cx="168" cy="116" r="5" fill="white" opacity="0.9" />
    {/* Doctor coat */}
    <Path d="M150 92 Q158 84 168 82 Q178 84 186 92 L183 130 Q168 138 153 130 Z" fill="white" opacity="0.9" />
    <Rect x="163" y="86" width="10" height="30" fill="#0A84FF" opacity="0.3" />
    {/* Checkmark on calendar */}
    <Circle cx="95" cy="92" r="6" fill="#34C759" />
    <Path d="M92 92 L94.5 94.5 L98 90" stroke="white" strokeWidth="2" strokeLinecap="round" />
  </Svg>
);

// Slide 2: Chat with Doctors
const ChatIllustration = () => (
  <Svg width={220} height={200} viewBox="0 0 220 200">
    {/* Phone shape */}
    <Rect x="55" y="20" width="110" height="165" rx="18" fill="white" opacity="0.15" />
    <Rect x="60" y="25" width="100" height="155" rx="14" fill="white" opacity="0.9" />
    {/* Screen */}
    <Rect x="64" y="45" width="92" height="120" rx="8" fill="#F0F4FF" />
    {/* Doctor bubble */}
    <Rect x="68" y="52" width="60" height="28" rx="10" fill="#0A84FF" />
    <Path d="M78 80 L73 86 L85 80 Z" fill="#0A84FF" />
    <Rect x="72" y="58" width="40" height="5" rx="2.5" fill="white" opacity="0.9" />
    <Rect x="72" y="67" width="30" height="5" rx="2.5" fill="white" opacity="0.7" />
    {/* User bubble */}
    <Rect x="88" y="90" width="60" height="28" rx="10" fill="#E8F5E9" />
    <Path d="M138 118 L143 124 L131 118 Z" fill="#E8F5E9" />
    <Rect x="92" y="96" width="45" height="5" rx="2.5" fill="#34C759" opacity="0.9" />
    <Rect x="92" y="105" width="35" height="5" rx="2.5" fill="#34C759" opacity="0.7" />
    {/* Doctor bubble 2 */}
    <Rect x="68" y="128" width="55" height="22" rx="10" fill="#0A84FF" opacity="0.85" />
    <Path d="M78 150 L73 156 L83 150 Z" fill="#0A84FF" opacity="0.85" />
    <Rect x="72" y="134" width="35" height="4" rx="2" fill="white" opacity="0.9" />
    <Rect x="72" y="141" width="25" height="4" rx="2" fill="white" opacity="0.7" />
    {/* Input bar */}
    <Rect x="64" y="152" width="92" height="7" rx="3.5" fill="#E0E0E0" opacity="0.7" />
    {/* Doctor avatar */}
    <Circle cx="182" cy="68" r="22" fill="white" opacity="0.25" />
    <Circle cx="182" cy="60" r="14" fill="#FFD4B2" opacity="0.95" />
    <Path d="M168 88 Q175 78 182 76 Q189 78 196 88" fill="#34C759" opacity="0.9" />
    {/* Wifi/signal icons */}
    <Circle cx="182" cy="150" r="14" fill="white" opacity="0.2" />
    <Path d="M175 153 Q182 143 189 153" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    <Path d="M178 156 Q182 150 186 156" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    <Circle cx="182" cy="158" r="2" fill="white" opacity="0.9" />
  </Svg>
);

// Slide 3: Smart Notifications
const NotificationsIllustration = () => (
  <Svg width={220} height={200} viewBox="0 0 220 200">
    {/* Phone */}
    <Rect x="65" y="20" width="90" height="160" rx="16" fill="white" opacity="0.15" />
    <Rect x="70" y="25" width="80" height="150" rx="12" fill="white" opacity="0.9" />
    {/* Bell icon centered */}
    <Path d="M110 45 C110 45 95 52 95 75 L90 90 L130 90 L125 75 C125 52 110 45 110 45 Z" fill="#FF9F0A" opacity="0.15" />
    <Path d="M110 45 C110 45 97 53 97 75 L92 88 L128 88 L123 75 C123 53 110 45 110 45 Z" fill="#FF9F0A" />
    <Circle cx="110" cy="42" r="5" fill="#FF9F0A" />
    <Rect x="104" y="88" width="12" height="5" rx="2.5" fill="#FF9F0A" />
    <Circle cx="110" cy="93" r="4" fill="#FF9F0A" />
    {/* Notification cards */}
    <Rect x="78" y="105" width="64" height="22" rx="8" fill="#FFF3CD" />
    <Circle cx="90" cy="116" r="6" fill="#FF9F0A" />
    <Rect x="100" y="111" width="35" height="4" rx="2" fill="#666" opacity="0.7" />
    <Rect x="100" y="118" width="25" height="3" rx="1.5" fill="#999" opacity="0.6" />

    <Rect x="78" y="132" width="64" height="22" rx="8" fill="#D4EDDA" />
    <Circle cx="90" cy="143" r="6" fill="#34C759" />
    <Rect x="100" y="138" width="35" height="4" rx="2" fill="#666" opacity="0.7" />
    <Rect x="100" y="145" width="25" height="3" rx="1.5" fill="#999" opacity="0.6" />

    {/* Floating notification badge */}
    <Circle cx="174" cy="55" r="22" fill="white" opacity="0.2" />
    <Circle cx="174" cy="55" r="16" fill="#FF3B30" />
    <Rect x="168" y="51" width="12" height="4" rx="2" fill="white" />
    <Rect x="171" y="48" width="6" height="14" rx="3" fill="white" opacity="0" />
    <Rect x="169" y="57" width="10" height="4" rx="2" fill="white" />
    {/* Star decorations */}
    <Circle cx="40" cy="70" r="4" fill="white" opacity="0.5" />
    <Circle cx="52" cy="130" r="3" fill="white" opacity="0.4" />
    <Circle cx="185" cy="130" r="5" fill="white" opacity="0.4" />
    <Circle cx="35" cy="155" r="3" fill="white" opacity="0.3" />
  </Svg>
);

// Slide 4: Medical History
const MedicalHistoryIllustration = () => (
  <Svg width={220} height={200} viewBox="0 0 220 200">
    {/* Folder base */}
    <Rect x="30" y="55" width="130" height="100" rx="10" fill="white" opacity="0.9" />
    <Path d="M30 68 Q30 55 42 55 L85 55 L93 68 Z" fill="white" opacity="0.95" />
    <Rect x="30" y="68" width="130" height="87" rx="0" fill="white" opacity="0" />
    {/* Folder tab */}
    <Path d="M30 68 Q30 55 42 55 L85 55 L93 68 L30 68 Z" fill="#BF5AF2" opacity="0.4" />
    <Rect x="30" y="68" width="130" height="87" rx="0" fill="white" opacity="0.0" />
    {/* Document lines */}
    <Rect x="44" y="82" width="90" height="6" rx="3" fill="#E0E0E0" />
    <Rect x="44" y="94" width="72" height="5" rx="2.5" fill="#E0E0E0" />
    <Rect x="44" y="105" width="85" height="5" rx="2.5" fill="#E0E0E0" />
    <Rect x="44" y="116" width="60" height="5" rx="2.5" fill="#BF5AF2" opacity="0.6" />
    <Rect x="44" y="127" width="78" height="5" rx="2.5" fill="#E0E0E0" />
    <Rect x="44" y="138" width="50" height="5" rx="2.5" fill="#BF5AF2" opacity="0.4" />
    {/* Medical cross */}
    <Circle cx="150" cy="72" r="22" fill="white" opacity="0.25" />
    <Circle cx="150" cy="72" r="18" fill="white" opacity="0.85" />
    <Rect x="144" y="63" width="12" height="18" rx="3" fill="#BF5AF2" />
    <Rect x="141" y="66" width="18" height="10" rx="3" fill="#BF5AF2" />
    {/* Heartbeat line */}
    <Path d="M30 165 Q50 165 60 165 L70 148 L80 175 L90 155 L100 165 Q120 165 160 165" 
          stroke="#FF375F" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.8" />
    {/* Lock icon */}
    <Circle cx="178" cy="145" r="16" fill="white" opacity="0.2" />
    <Rect x="170" y="144" width="16" height="12" rx="3" fill="white" opacity="0.85" />
    <Path d="M174 144 Q174 138 178 138 Q182 138 182 144" stroke="white" strokeWidth="2.5" fill="none" />
    <Circle cx="178" cy="150" r="2" fill="#BF5AF2" />
  </Svg>
);

// Slide 5: Follow-up Reminders
const FollowUpIllustration = () => (
  <Svg width={220} height={200} viewBox="0 0 220 200">
    {/* Clock */}
    <Circle cx="100" cy="100" r="68" fill="white" opacity="0.15" />
    <Circle cx="100" cy="100" r="58" fill="white" opacity="0.9" />
    <Circle cx="100" cy="100" r="52" fill="#FFF8F0" />
    {/* Clock marks */}
    {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg, i) => {
      const rad = (deg * Math.PI) / 180;
      const isHour = i % 3 === 0;
      const r1 = isHour ? 42 : 45;
      const r2 = 48;
      return (
        <Path
          key={deg}
          d={`M${100 + r1 * Math.sin(rad)} ${100 - r1 * Math.cos(rad)} L${100 + r2 * Math.sin(rad)} ${100 - r2 * Math.cos(rad)}`}
          stroke={isHour ? '#FF9F0A' : '#E0E0E0'}
          strokeWidth={isHour ? 3 : 1.5}
          strokeLinecap="round"
        />
      );
    })}
    {/* Hour hand (pointing to 10) */}
    <Path d="M100 100 L85 68" stroke="#333" strokeWidth="3.5" strokeLinecap="round" />
    {/* Minute hand (pointing to 2) */}
    <Path d="M100 100 L118 72" stroke="#333" strokeWidth="2.5" strokeLinecap="round" />
    <Circle cx="100" cy="100" r="5" fill="#FF9F0A" />
    {/* Alarm bells */}
    <Circle cx="86" cy="54" r="6" fill="#FF9F0A" opacity="0.8" />
    <Circle cx="114" cy="54" r="6" fill="#FF9F0A" opacity="0.8" />
    <Rect x="82" y="48" width="36" height="6" rx="3" fill="#FF9F0A" opacity="0.5" />
    {/* Repeat arrows (follow-up symbol) */}
    <Circle cx="170" cy="80" r="24" fill="white" opacity="0.2" />
    <Path d="M158 80 Q158 68 170 68 Q182 68 182 80 L178 80 L183 87 L188 80 L184 80 Q184 64 170 64 Q156 64 156 80 Z"
          fill="white" opacity="0.9" />
    <Path d="M182 80 Q182 92 170 92 Q158 92 158 80 L162 80 L157 73 L152 80 L156 80 Q156 96 170 96 Q184 96 184 80 Z"
          fill="white" opacity="0.9" />
    {/* Check items */}
    <Rect x="30" y="152" width="85" height="14" rx="7" fill="white" opacity="0.9" />
    <Circle cx="40" cy="159" r="5" fill="#34C759" />
    <Path d="M37 159 L39.5 161.5 L43 157" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
    <Rect x="49" y="155" width="55" height="4" rx="2" fill="#CCC" opacity="0.8" />
    <Rect x="49" y="161" width="38" height="3" rx="1.5" fill="#CCC" opacity="0.5" />
  </Svg>
);

// ─── Slide Data ──────────────────────────────────────────────────────────────
const onboardingSlides = [
  {
    id: '1',
    icon: 'calendar-today',
    title: 'Book Appointments',
    description: 'Schedule with your preferred doctors instantly.\nChoose from available time slots that work for you.',
    gradientColors: ['#1A73E8', '#0A84FF', '#5E5CE6'] as [string, string, string],
    accentColor: '#5E5CE6',
    IllustrationComponent: BookAppointmentIllustration,
  },
  {
    id: '2',
    icon: 'chat',
    title: 'Chat with Doctors',
    description: 'Get quick medical advice through secure chat.\nDiscuss symptoms and receive guidance anytime.',
    gradientColors: ['#0D7A3E', '#32D74B', '#30DB84'] as [string, string, string],
    accentColor: '#30DB84',
    IllustrationComponent: ChatIllustration,
  },
  {
    id: '3',
    icon: 'notifications',
    title: 'Smart Notifications',
    description: 'Receive reminders for appointments and medication\nschedules. Never miss an important follow-up.',
    gradientColors: ['#CC6600', '#FF9F0A', '#FFCC00'] as [string, string, string],
    accentColor: '#FFCC00',
    IllustrationComponent: NotificationsIllustration,
  },
  {
    id: '4',
    icon: 'history',
    title: 'Medical History',
    description: 'Access your complete medical records, prescriptions\nand treatment history in one secure place.',
    gradientColors: ['#6B2FA0', '#BF5AF2', '#FF375F'] as [string, string, string],
    accentColor: '#FF375F',
    IllustrationComponent: MedicalHistoryIllustration,
  },
  {
    id: '5',
    icon: 'refresh',
    title: 'Follow-up Reminders',
    description: 'Get timely reminders for follow-ups, medication\nrefills and regular health checkups.',
    gradientColors: ['#CC2200', '#FF453A', '#FF375F'] as [string, string, string],
    accentColor: '#FF9F0A',
    IllustrationComponent: FollowUpIllustration,
  },
];

// ─── Spotlight/Coach Marks ───────────────────────────────────────────────────
const spotlightItems = [
  {
    id: 'find_doctor',
    title: '🔍 Find a Doctor',
    description: 'Search and book appointments with specialists near you',
    icon: 'search',
    targetArea: { x: 16, y: 340, width: 72, height: 86 },
    gradientColors: ['#32D74B', '#30DB84'] as [string, string],
  },
  {
    id: 'appointments',
    title: '📅 Appointment History',
    description: 'View all your past and upcoming appointments at a glance',
    icon: 'history',
    targetArea: { x: 104, y: 340, width: 72, height: 86 },
    gradientColors: ['#BF5AF2', '#FF375F'] as [string, string],
  },
  {
    id: 'messages',
    title: '💬 Messages',
    description: 'Start a conversation with your healthcare provider',
    icon: 'message',
    targetArea: { x: 192, y: 340, width: 72, height: 86 },
    gradientColors: ['#FF9F0A', '#FFCC00'] as [string, string],
  },
  {
    id: 'chat_widget',
    title: '🤖 AI Chat Assistant',
    description: 'Drag and drop the chat button anywhere. Tap to get instant AI medical assistance',
    icon: 'chat',
    targetArea: { x: width - 76, y: height - 210, width: 60, height: 60 },
    gradientColors: ['#00BFFF', '#1976d2'] as [string, string],
  },
];

// ─── Props ───────────────────────────────────────────────────────────────────
interface OnboardingGuideProps {
  visible: boolean;
  onComplete: () => void;
  mode: 'slides' | 'spotlight';
  onSpotlightComplete?: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────
const OnboardingGuide: React.FC<OnboardingGuideProps> = ({
  visible,
  onComplete,
  mode,
  onSpotlightComplete,
}) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [currentSpotlightIndex, setCurrentSpotlightIndex] = useState(0);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;   // slide-in from bottom
  const scaleAnim = useRef(new Animated.Value(0.88)).current;
  const illustrationAnim = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

  const flatListRef = useRef<FlatList>(null);

  // Floating animation loop for illustrations
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: -12, duration: 1800, useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Enter animation
  useEffect(() => {
    if (visible) {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.88);
      slideAnim.setValue(80);
      illustrationAnim.setValue(0);

      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, friction: 7, tension: 45, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 50, useNativeDriver: true }),
        Animated.timing(illustrationAnim, { toValue: 1, duration: 600, delay: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  // Re-animate illustration when slide changes
  const animateSlideChange = () => {
    illustrationAnim.setValue(0);
    Animated.timing(illustrationAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  };

  // ── Handlers ──
  const handleComplete = async () => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 0.92, duration: 250, useNativeDriver: true }),
    ]).start(() => {
      if (mode === 'slides') onComplete();
      else onSpotlightComplete?.();
    });
    try { await AsyncStorage.setItem('hasSeenOnboarding', 'true'); } catch (_) {}
  };

  const handleNextSlide = () => {
    if (currentSlide < onboardingSlides.length - 1) {
      const next = currentSlide + 1;
      flatListRef.current?.scrollToIndex({ index: next, animated: true });
      setCurrentSlide(next);
      animateSlideChange();
    } else {
      handleComplete();
    }
  };

  const handlePrevSlide = () => {
    if (currentSlide > 0) {
      const prev = currentSlide - 1;
      flatListRef.current?.scrollToIndex({ index: prev, animated: true });
      setCurrentSlide(prev);
      animateSlideChange();
    }
  };

  const handleSpotlightNext = () => {
    if (currentSpotlightIndex < spotlightItems.length - 1) {
      setCurrentSpotlightIndex(i => i + 1);
    } else {
      handleComplete();
    }
  };

  // ── Render slide item ──
  const renderSlide = ({ item }: { item: typeof onboardingSlides[0] }) => {
    const { IllustrationComponent } = item;
    return (
      <View style={styles.slideWrapper}>
        <LinearGradient colors={item.gradientColors} style={styles.slideGradient} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }}>
          {/* Decorative circles */}
          <View style={[styles.decorCircle, styles.decorCircle1, { backgroundColor: item.accentColor }]} />
          <View style={[styles.decorCircle, styles.decorCircle2, { backgroundColor: item.accentColor }]} />

          {/* Illustration */}
          <Animated.View style={[styles.illustrationContainer, {
            opacity: illustrationAnim,
            transform: [
              { translateY: floatAnim },
              { scale: illustrationAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) },
            ],
          }]}>
            <View style={[styles.illustrationBg, { backgroundColor: item.accentColor }]}>
              <IllustrationComponent />
            </View>
          </Animated.View>

          {/* Text */}
          <Animated.View style={[styles.slideTextContainer, {
            opacity: illustrationAnim,
            transform: [{ translateY: illustrationAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }],
          }]}>
            <View style={styles.slideIconBadge}>
              <Icon name={item.icon} size={20} color="#FFFFFF" />
            </View>
            <Text style={styles.slideTitle}>{item.title}</Text>
            <Text style={styles.slideDescription}>{item.description}</Text>
          </Animated.View>
        </LinearGradient>
      </View>
    );
  };

  // ── Pagination dots ──
  const renderDots = () => (
    <View style={styles.dotsRow}>
      {onboardingSlides.map((_, i) => (
        <TouchableOpacity key={i} onPress={() => {
          flatListRef.current?.scrollToIndex({ index: i, animated: true });
          setCurrentSlide(i);
          animateSlideChange();
        }}>
          <Animated.View style={[styles.dot, i === currentSlide && styles.dotActive, {
            backgroundColor: i === currentSlide ? '#FFFFFF' : 'rgba(255,255,255,0.4)',
            width: i === currentSlide ? 24 : 8,
          }]} />
        </TouchableOpacity>
      ))}
    </View>
  );

  // ── Slides mode ──
  const renderSlides = () => (
    <Animated.View style={[styles.fullscreen, {
      opacity: fadeAnim,
      transform: [{ scale: scaleAnim }, { translateY: slideAnim }],
    }]}>
      <StatusBar barStyle="light-content" />

      {/* Skip */}
      <TouchableOpacity style={styles.skipBtn} onPress={handleComplete}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      {/* Slide counter */}
      <View style={styles.counterBadge}>
        <Text style={styles.counterText}>{currentSlide + 1} / {onboardingSlides.length}</Text>
      </View>

      <FlatList
        ref={flatListRef}
        data={onboardingSlides}
        renderItem={renderSlide}
        keyExtractor={item => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        style={{ flex: 1 }}
      />

      {/* Bottom controls */}
      <View style={styles.bottomControls}>
        {renderDots()}

        <View style={styles.navRow}>
          {currentSlide > 0 ? (
            <TouchableOpacity style={styles.backBtn} onPress={handlePrevSlide}>
              <Icon name="arrow-back-ios" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          ) : <View style={styles.backBtn} />}

          <TouchableOpacity
            style={[styles.nextBtn, currentSlide === onboardingSlides.length - 1 && styles.getStartedBtn]}
            onPress={handleNextSlide}
          >
            <Text style={styles.nextBtnText}>
              {currentSlide === onboardingSlides.length - 1 ? 'Get Started 🎉' : 'Next'}
            </Text>
            {currentSlide < onboardingSlides.length - 1 && (
              <Icon name="arrow-forward-ios" size={16} color="#FFFFFF" style={{ marginLeft: 4 }} />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );

  // ── Spotlight mode ──
  const renderSpotlight = () => {
    const item = spotlightItems[currentSpotlightIndex];
    const isLast = currentSpotlightIndex === spotlightItems.length - 1;
    const isFirst = currentSpotlightIndex === 0;
    const tipBelow = item.targetArea.y < height / 2;
    const tipLeft = item.targetArea.x + item.targetArea.width / 2 < width / 2;

    const tipTop = tipBelow
      ? item.targetArea.y + item.targetArea.height + 18
      : item.targetArea.y - 160;
    const tipLeft2 = Math.min(
      Math.max(item.targetArea.x + item.targetArea.width / 2 - 140, 12),
      width - 292
    );

    return (
      <Animated.View style={[styles.spotOverlay, { opacity: fadeAnim }]}>
        {/* Semi-transparent backdrop */}
        <View style={StyleSheet.absoluteFill}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.72)' }} />
        </View>

        {/* Glowing cutout ring */}
        <View style={[styles.cutout, {
          left: item.targetArea.x - 8,
          top: item.targetArea.y - 8,
          width: item.targetArea.width + 16,
          height: item.targetArea.height + 16,
          borderRadius: item.targetArea.height < 70 ? (item.targetArea.height + 16) / 2 : 20,
        }]}>
          <View style={styles.cutoutInner} />
        </View>

        {/* Tooltip card */}
        <Animated.View style={[styles.tooltip, { top: tipTop, left: tipLeft2 }, { opacity: fadeAnim }]}>
          <LinearGradient colors={item.gradientColors} style={styles.tooltipGrad}>
            {/* Arrow */}
            <View style={[
              styles.tooltipArrow,
              tipBelow ? styles.arrowTop : styles.arrowBottom,
              { left: Math.min(item.targetArea.x + item.targetArea.width / 2 - tipLeft2 - 10, 260) }
            ]} />
            {/* Progress pills */}
            <View style={styles.tooltipProgress}>
              {spotlightItems.map((_, i) => (
                <View key={i} style={[styles.progressPill, i === currentSpotlightIndex && styles.progressPillActive]} />
              ))}
            </View>
            {/* Icon */}
            <View style={styles.tooltipIconBox}>
              <Icon name={item.icon} size={28} color="#FFFFFF" />
            </View>
            <Text style={styles.tooltipTitle}>{item.title}</Text>
            <Text style={styles.tooltipDesc}>{item.description}</Text>
          </LinearGradient>
        </Animated.View>

        {/* Footer nav */}
        <View style={styles.spotFooter}>
          <TouchableOpacity style={styles.spotSkipBtn} onPress={handleComplete}>
            <Text style={styles.spotSkipText}>Skip tour</Text>
          </TouchableOpacity>

          <View style={styles.spotNavRow}>
            {!isFirst && (
              <TouchableOpacity style={styles.spotPrevBtn} onPress={() => setCurrentSpotlightIndex(i => i - 1)}>
                <Icon name="chevron-left" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.spotNextBtn, isLast && styles.spotDoneBtn]}
              onPress={handleSpotlightNext}
            >
              <Text style={styles.spotNextText}>{isLast ? 'Done ✓' : 'Next'}</Text>
              {!isLast && <Icon name="chevron-right" size={18} color="#FFFFFF" />}
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    );
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={handleComplete}>
      <SafeAreaView style={styles.modalRoot}>
        {mode === 'slides' ? renderSlides() : renderSpotlight()}
      </SafeAreaView>
    </Modal>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  modalRoot: { flex: 1 },
  fullscreen: { flex: 1 },

  // Skip / counter
  skipBtn: {
    position: 'absolute', top: Platform.OS === 'ios' ? 54 : 34, right: 20, zIndex: 99,
    paddingHorizontal: 18, paddingVertical: 9, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  skipText: { color: '#FFFFFF', fontWeight: '600', fontSize: 15 },

  counterBadge: {
    position: 'absolute', top: Platform.OS === 'ios' ? 57 : 37, left: 20, zIndex: 99,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  counterText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },

  // Slide
  slideWrapper: { width, height: '100%' },
  slideGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  decorCircle: { position: 'absolute', borderRadius: 999, opacity: 0.12 },
  decorCircle1: { width: 320, height: 320, top: -80, right: -80 },
  decorCircle2: { width: 250, height: 250, bottom: -60, left: -60 },

  illustrationContainer: { alignItems: 'center', marginBottom: 28 },
  illustrationBg: {
    width: 240, height: 220, borderRadius: 32, alignItems: 'center', justifyContent: 'center',
    opacity: 0.22,
    // will be overridden by inline backgroundColor
  },

  slideTextContainer: { alignItems: 'center', paddingHorizontal: 36, paddingBottom: 20 },
  slideIconBadge: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, marginBottom: 16,
  },
  slideTitle: {
    fontSize: 30, fontWeight: '800', color: '#FFFFFF', textAlign: 'center',
    marginBottom: 14, letterSpacing: 0.2,
  },
  slideDescription: {
    fontSize: 16, color: 'rgba(255,255,255,0.88)', textAlign: 'center',
    lineHeight: 24, fontWeight: '400',
  },

  // Bottom controls
  bottomControls: {
    position: 'absolute', bottom: Platform.OS === 'ios' ? 48 : 28, left: 0, right: 0,
    alignItems: 'center', paddingHorizontal: 24,
  },
  dotsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 24 },
  dot: { height: 8, borderRadius: 4 },
  dotActive: { height: 8 },

  navRow: { flexDirection: 'row', alignItems: 'center', width: '100%', justifyContent: 'space-between' },
  backBtn: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  nextBtn: {
    flex: 1, marginLeft: 16, height: 54, borderRadius: 27,
    backgroundColor: 'rgba(255,255,255,0.28)', flexDirection: 'row',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)',
  },
  getStartedBtn: { backgroundColor: '#FFFFFF' },
  nextBtnText: {
    fontSize: 17, fontWeight: '700', color: '#FFFFFF',
  },

  // ── Spotlight ──
  spotOverlay: { flex: 1 },

  cutout: {
    position: 'absolute', borderWidth: 3, borderColor: '#FFFFFF',
    backgroundColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#FFFFFF', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 16, elevation: 12,
  },
  cutoutInner: { flex: 1, borderRadius: 999, backgroundColor: 'transparent' },

  tooltip: {
    position: 'absolute', width: 280, borderRadius: 20, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 12,
  },
  tooltipGrad: { padding: 20 },
  tooltipArrow: {
    position: 'absolute', width: 0, height: 0,
    borderLeftWidth: 12, borderRightWidth: 12,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
  },
  arrowTop: { top: -12, borderBottomWidth: 12, borderBottomColor: '#32D74B' },
  arrowBottom: { bottom: -12, borderTopWidth: 12, borderTopColor: '#32D74B' },

  tooltipProgress: { flexDirection: 'row', gap: 6, marginBottom: 14 },
  progressPill: { height: 4, width: 18, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)' },
  progressPillActive: { width: 28, backgroundColor: '#FFFFFF' },

  tooltipIconBox: {
    width: 52, height: 52, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.22)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 14,
  },
  tooltipTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', marginBottom: 8 },
  tooltipDesc: { fontSize: 14, color: 'rgba(255,255,255,0.9)', lineHeight: 21 },

  spotFooter: {
    position: 'absolute', bottom: Platform.OS === 'ios' ? 50 : 28, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20,
  },
  spotSkipBtn: { paddingVertical: 10, paddingHorizontal: 4 },
  spotSkipText: { color: 'rgba(255,255,255,0.7)', fontSize: 15, fontWeight: '500' },

  spotNavRow: { flexDirection: 'row', gap: 10 },
  spotPrevBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  spotNextBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: 22, backgroundColor: '#0A84FF',
  },
  spotDoneBtn: { backgroundColor: '#34C759' },
  spotNextText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});

export default OnboardingGuide;