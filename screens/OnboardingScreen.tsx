import React, { useRef, useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  Image, 
  TouchableOpacity, 
  FlatList, 
  Dimensions, 
  StyleSheet,
  Animated,
  Easing,
  ViewToken
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigationTypes';

type OnboardingScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Onboarding'>;

const { width, height } = Dimensions.get('window');

const slides = [
  {
    id: '1',
    title: 'Welcome to MediCare',
    subtitle: 'Your personal healthcare companion',
    description: 'Chào mừng đến với MediCare – Người bạn đồng hành chăm sóc sức khỏe của bạn.',
    image: require('../assets/onboarding1.png'),
  },
  {
    id: '2',
    title: 'Book Appointments Easily',
    subtitle: 'Đặt lịch khám dễ dàng',
    description: 'Chọn bác sĩ, chọn thời gian và xác nhận trong vài giây',
    image: require('../assets/onboarding2.png'),
  },
  {
    id: '3',
    title: 'Stay On Track',
    subtitle: 'Duy trì đúng tiến độ',
    description: 'Nhận lời nhắc về việc kiểm tra và theo dõi',
    image: require('../assets/onboarding3.png'),
  },
  {
    id: '4',
    title: 'Medical History in Your Pocket',
    subtitle: 'Lịch sử bệnh án trong túi của bạn',
    description: 'Truy cập các lần khám trước, đơn thuốc và ghi chú',
    image: require('../assets/onboarding4.png'),
  },
  {
    id: '5',
    title: 'Let\'s Get Started!',
    subtitle: 'Hãy bắt đầu!',
    description: 'Tạo tài khoản để kiểm soát sức khỏe của bạn',
    image: require('../assets/onboarding5.png'),
  }
];

const OnboardingScreen = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const navigation = useNavigation<OnboardingScreenNavigationProp>();
  const fadeAnim = new Animated.Value(0);
  const slideAnim = new Animated.Value(30);

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        easing: Easing.out(Easing.back(1)),
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  const handleNext = () => {
    if (currentIndex < slides.length - 1 && flatListRef.current) {
      flatListRef.current.scrollToIndex({ index: currentIndex + 1 });
    } else {
      navigation.reset({
        index: 0,
        routes: [{ name: 'Register' }],
      });
    }
  };

  const handleSkip = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Register' }],
    });
  };

  const handleViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0) {
        setCurrentIndex(viewableItems[0].index || 0);
      }
    },
    []
  );

  const renderPagination = () => {
    return (
      <View style={styles.pagination}>
        {slides.map((_, index) => (
          <View 
            key={index}
            style={[
              styles.dot,
              currentIndex === index ? styles.activeDot : styles.inactiveDot
            ]}
          />
        ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
        <FlatList
          data={slides}
          keyExtractor={(item) => item.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          ref={flatListRef}
          onViewableItemsChanged={handleViewableItemsChanged}
          viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
          renderItem={({ item }) => (
            <View style={styles.slide}>
              <Image source={item.image} style={styles.image} />
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.subtitle}>{item.subtitle}</Text>
              <Text style={styles.description}>{item.description}</Text>
            </View>
          )}
        />

        {renderPagination()}

        <View style={styles.buttons}>
          {currentIndex === 0 ? (
            <TouchableOpacity onPress={handleSkip}>
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 60 }} />
          )}

          <TouchableOpacity 
            style={styles.nextButton}
            onPress={handleNext}
          >
            <Text style={styles.buttonText}>
              {currentIndex === slides.length - 1 ? "Let's Start" : 'Next'}
            </Text>
            <Icon 
              name={currentIndex === slides.length - 1 ? "check-circle" : "arrow-forward"} 
              size={20} 
              color="white" 
              style={{ marginLeft: 5 }} 
            />
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#e1f5fe',
    justifyContent: 'center',
  },
  slide: {
    width,
    paddingHorizontal: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: width * 0.8,
    height: height * 0.35,
    marginBottom: 30,
    resizeMode: 'contain',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0d47a1',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1976d2',
    textAlign: 'center',
    marginBottom: 15,
  },
  description: {
    fontSize: 16,
    color: '#424242',
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 24,
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingBottom: 50,
  },
  nextButton: {
    backgroundColor: '#1976d2',
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 3,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  skipText: {
    color: '#1976d2',
    fontSize: 16,
    fontWeight: '500',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 5,
  },
  activeDot: {
    backgroundColor: '#1976d2',
    width: 20,
  },
  inactiveDot: {
    backgroundColor: '#90caf9',
  },
});

export default OnboardingScreen;