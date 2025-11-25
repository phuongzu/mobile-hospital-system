import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Animated,
  ActivityIndicator,
  Easing,
  ScrollView,
  Modal,
  TouchableWithoutFeedback,
  FlatList
} from 'react-native';
import axios from 'axios';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigationTypes';
import DateTimePicker from '@react-native-community/datetimepicker';

type RegisterScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Register'>;

// Options for dropdowns
const GENDER_OPTIONS = [
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
  { label: 'Other', value: 'other' },
  { label: 'Prefer not to say', value: 'prefer_not_to_say' }
];

const BLOOD_TYPE_OPTIONS = [
  { label: 'A+', value: 'A+' },
  { label: 'A-', value: 'A-' },
  { label: 'B+', value: 'B+' },
  { label: 'B-', value: 'B-' },
  { label: 'AB+', value: 'AB+' },
  { label: 'AB-', value: 'AB-' },
  { label: 'O+', value: 'O+' },
  { label: 'O-', value: 'O-' },
  { label: 'Unknown', value: 'unknown' }
];

const RELATIONSHIP_OPTIONS = [
  { label: 'Spouse', value: 'Spouse' },
  { label: 'Parent', value: 'Parent' },
  { label: 'Child', value: 'Child' },
  { label: 'Sibling', value: 'Sibling' },
  { label: 'Friend', value: 'Friend' },
  { label: 'Other', value: 'Other' }
];

interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
  email: string;
}

interface Option {
  label: string;
  value: string;
}

// Custom Picker Component
const OptionPicker = ({
  label,
  value,
  options,
  onSelect,
  placeholder = "Select an option",
  iconName = "arrow-drop-down"
}: {
  label: string;
  value: string;
  options: Option[];
  onSelect: (value: string) => void;
  placeholder?: string;
  iconName?: string;
}) => {
  const [modalVisible, setModalVisible] = useState(false);

  const handleSelect = (selectedValue: string) => {
    onSelect(selectedValue);
    setModalVisible(false);
  };

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <View style={styles.inputWrapper}>
      <Icon name="list" size={20} color="#1976d2" style={styles.icon} />
      <TouchableOpacity
        style={styles.pickerButton}
        onPress={() => setModalVisible(true)}
      >
        <Text style={selectedOption ? styles.pickerText : styles.pickerPlaceholder}>
          {selectedOption ? `${label}: ${selectedOption.label}` : placeholder}
        </Text>
        <Icon name={iconName} size={20} color="#1976d2" />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Select {label}</Text>
                <FlatList
                  data={options}
                  keyExtractor={(item) => item.value}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[
                        styles.optionItem,
                        value === item.value && styles.optionItemSelected
                      ]}
                      onPress={() => handleSelect(item.value)}
                    >
                      <Text style={[
                        styles.optionText,
                        value === item.value && styles.optionTextSelected
                      ]}>
                        {item.label}
                      </Text>
                      {value === item.value && (
                        <Icon name="check" size={20} color="#1976d2" />
                      )}
                    </TouchableOpacity>
                  )}
                />
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.modalCloseText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
};

const RegisterScreen = () => {
  const navigation = useNavigation<RegisterScreenNavigationProp>();
  
  // Basic account info
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Additional required information
  const [phone, setPhone] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('');
  const [address, setAddress] = useState('');
  const [bloodType, setBloodType] = useState('');
  const [allergies, setAllergies] = useState('');
  const [currentMedications, setCurrentMedications] = useState('');
  const [emergencyContact, setEmergencyContact] = useState<EmergencyContact>({
    name: '',
    relationship: '',
    phone: '',
    email: ''
  });

  const [isLoading, setIsLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [currentStep, setCurrentStep] = useState(1); // 1: Basic info, 2: Additional info
  
  // Fix: Use useRef for animated values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(100)).current;

  useEffect(() => {
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

    // Cleanup
    return () => {
      setShowDatePicker(false);
    };
  }, [fadeAnim, slideAnim]);

  // Validation functions
  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const isValidPhone = (phone: string) => {
    const phoneRegex = /^\+?[\d\s-()]{10,}$/;
    return phoneRegex.test(phone);
  };

  const isPasswordValid = (password: string) => {
    return password.length >= 6;
  };

  const isValidDateOfBirth = (dob: string) => {
    if (!dob) return false;
    const birthDate = new Date(dob);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    return age >= 0 && age <= 120; // Reasonable age range
  };

  const validateStep1 = () => {
    if (!name || !email || !password) {
      Alert.alert('Missing Information', 'Please fill all required fields');
      return false;
    }

    if (!isValidEmail(email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address');
      return false;
    }

    if (!isPasswordValid(password)) {
      Alert.alert('Invalid Password', 'Password must be at least 6 characters long');
      return false;
    }

    return true;
  };

  const validateStep2 = () => {
    if (!phone || !dateOfBirth || !gender || !address) {
      Alert.alert('Missing Information', 'Please fill all required personal information');
      return false;
    }

    if (!isValidPhone(phone)) {
      Alert.alert('Invalid Phone', 'Please enter a valid phone number');
      return false;
    }

    if (!isValidDateOfBirth(dateOfBirth)) {
      Alert.alert('Invalid Date of Birth', 'Please enter a valid date of birth');
      return false;
    }

    if (!emergencyContact.name || !emergencyContact.phone) {
      Alert.alert('Emergency Contact Required', 'Please provide at least name and phone number for emergency contact');
      return false;
    }

    // Fix: Validate emergency contact phone
    if (!isValidPhone(emergencyContact.phone)) {
      Alert.alert('Invalid Emergency Contact Phone', 'Please enter a valid phone number for emergency contact');
      return false;
    }

    // Fix: Validate emergency contact email if provided
    if (emergencyContact.email && !isValidEmail(emergencyContact.email)) {
      Alert.alert('Invalid Emergency Contact Email', 'Please enter a valid email address for emergency contact');
      return false;
    }

    return true;
  };

  const handleNextStep = () => {
    if (validateStep1()) {
      setCurrentStep(2);
    }
  };

  const handlePreviousStep = () => {
    setCurrentStep(1);
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setDateOfBirth(selectedDate.toISOString().split('T')[0]);
    }
  };

  const handleRegister = async () => {
    if (!validateStep2()) {
      return;
    }

    setIsLoading(true);
    
    try {
      // First, register the basic account
      const registerResponse = await axios.post('http://localhost:3000/api/auth/register', {
        name,
        email,
        password,
        role: 'patient'
      });

      if (registerResponse.data.success) {
        // Login to get token
        const loginResponse = await axios.post('http://localhost:3000/api/auth/login', {
          email,
          password
        });

        const { accessToken } = loginResponse.data.data;

        // Update profile with additional information
        await axios.put('http://localhost:3000/api/patient/profile', 
          {
            phoneNumber: phone,
            dateOfBirth,
            gender,
            address,
            bloodType: bloodType || 'unknown',
            allergies: allergies || 'None',
            currentMedications: currentMedications || 'None'
          },
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        // Add emergency contact
        await axios.post('http://localhost:3000/api/patient/emergency-contact',
          emergencyContact,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        Alert.alert(
          '✅ Registration Successful', 
          'Your patient account has been created with all required information.',
          [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
        );
      }
    } catch (error: any) {      
      let errorMessage = 'An error occurred during registration. Please try again.';
      
      if (error.response?.status === 400) {
        errorMessage = 'Invalid registration data. Please check your information.';
      } else if (error.response?.status === 409) {
        errorMessage = 'An account with this email already exists.';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
        // Fix: Correct error code for axios
        errorMessage = 'Network connection error. Please check your internet connection.';
      }
      
      Alert.alert('❌ Registration Failed', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Basic Account Information</Text>
      
      <View style={styles.inputWrapper}>
        <Icon name="person" size={20} color="#1976d2" style={styles.icon} />
        <TextInput
          style={styles.input}
          placeholder="Full Name *"
          placeholderTextColor="#90a4ae"
          onChangeText={setName}
          value={name}
        />
      </View>

      <View style={styles.inputWrapper}>
        <Icon name="email" size={20} color="#1976d2" style={styles.icon} />
        <TextInput
          style={styles.input}
          placeholder="Email Address *"
          placeholderTextColor="#90a4ae"
          autoCapitalize="none"
          keyboardType="email-address"
          onChangeText={setEmail}
          value={email}
        />
      </View>

      <View style={styles.inputWrapper}>
        <Icon name="lock" size={20} color="#1976d2" style={styles.icon} />
        <TextInput
          style={styles.input}
          placeholder="Password *"
          placeholderTextColor="#90a4ae"
          secureTextEntry
          onChangeText={setPassword}
          value={password}
        />
      </View>

      <TouchableOpacity 
        style={styles.nextButton}
        onPress={handleNextStep}
        disabled={isLoading}
      >
        <Text style={styles.buttonText}>Next: Personal Information</Text>
        <Icon name="arrow-forward" size={20} color="white" style={styles.buttonIcon} />
      </TouchableOpacity>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Personal & Medical Information</Text>
      <Text style={styles.stepSubtitle}>This information helps doctors provide better care</Text>

      {/* Personal Information */}
      <Text style={styles.sectionTitle}>Personal Information</Text>
      
      <View style={styles.inputWrapper}>
        <Icon name="phone" size={20} color="#1976d2" style={styles.icon} />
        <TextInput
          style={styles.input}
          placeholder="Phone Number *"
          placeholderTextColor="#90a4ae"
          keyboardType="phone-pad"
          onChangeText={setPhone}
          value={phone}
        />
      </View>

      <View style={styles.inputWrapper}>
        <Icon name="cake" size={20} color="#1976d2" style={styles.icon} />
        <TouchableOpacity
          style={styles.pickerButton}
          onPress={() => setShowDatePicker(true)}
        >
          <Text style={dateOfBirth ? styles.pickerText : styles.pickerPlaceholder}>
            {dateOfBirth ? `Date of Birth: ${new Date(dateOfBirth).toLocaleDateString()}` : 'Date of Birth *'}
          </Text>
          <Icon name="calendar-today" size={20} color="#1976d2" />
        </TouchableOpacity>
        {showDatePicker && (
          <DateTimePicker
            value={dateOfBirth ? new Date(dateOfBirth) : new Date()}
            mode="date"
            display="default"
            onChange={handleDateChange}
            maximumDate={new Date()}
          />
        )}
      </View>

      <OptionPicker
        label="Gender"
        value={gender}
        options={GENDER_OPTIONS}
        onSelect={setGender}
        placeholder="Select Gender *"
      />

      <View style={styles.inputWrapper}>
        <Icon name="home" size={20} color="#1976d2" style={styles.icon} />
        <TextInput
          style={[styles.input, styles.multilineInput]}
          placeholder="Home Address *"
          placeholderTextColor="#90a4ae"
          multiline
          numberOfLines={3}
          onChangeText={setAddress}
          value={address}
        />
      </View>

      {/* Medical Information */}
      <Text style={styles.sectionTitle}>Medical Information</Text>

      <OptionPicker
        label="Blood Type"
        value={bloodType}
        options={BLOOD_TYPE_OPTIONS}
        onSelect={setBloodType}
        placeholder="Select Blood Type"
      />

      <View style={styles.inputWrapper}>
        <Icon name="warning" size={20} color="#1976d2" style={styles.icon} />
        <TextInput
          style={[styles.input, styles.multilineInput]}
          placeholder="Allergies (if any)"
          placeholderTextColor="#90a4ae"
          multiline
          numberOfLines={2}
          onChangeText={setAllergies}
          value={allergies}
        />
      </View>

      <View style={styles.inputWrapper}>
        <Icon name="medication" size={20} color="#1976d2" style={styles.icon} />
        <TextInput
          style={[styles.input, styles.multilineInput]}
          placeholder="Current Medications (if any)"
          placeholderTextColor="#90a4ae"
          multiline
          numberOfLines={2}
          onChangeText={setCurrentMedications}
          value={currentMedications}
        />
      </View>

      {/* Emergency Contact */}
      <Text style={styles.sectionTitle}>Emergency Contact *</Text>

      <View style={styles.inputWrapper}>
        <Icon name="person" size={20} color="#1976d2" style={styles.icon} />
        <TextInput
          style={styles.input}
          placeholder="Emergency Contact Name *"
          placeholderTextColor="#90a4ae"
          onChangeText={(text) => setEmergencyContact(prev => ({ ...prev, name: text }))}
          value={emergencyContact.name}
        />
      </View>

      <OptionPicker
        label="Relationship"
        value={emergencyContact.relationship}
        options={RELATIONSHIP_OPTIONS}
        onSelect={(value) => setEmergencyContact(prev => ({ ...prev, relationship: value }))}
        placeholder="Select Relationship"
      />

      <View style={styles.inputWrapper}>
        <Icon name="phone" size={20} color="#1976d2" style={styles.icon} />
        <TextInput
          style={styles.input}
          placeholder="Emergency Contact Phone *"
          placeholderTextColor="#90a4ae"
          keyboardType="phone-pad"
          onChangeText={(text) => setEmergencyContact(prev => ({ ...prev, phone: text }))}
          value={emergencyContact.phone}
        />
      </View>

      <View style={styles.inputWrapper}>
        <Icon name="email" size={20} color="#1976d2" style={styles.icon} />
        <TextInput
          style={styles.input}
          placeholder="Emergency Contact Email"
          placeholderTextColor="#90a4ae"
          keyboardType="email-address"
          autoCapitalize="none"
          onChangeText={(text) => setEmergencyContact(prev => ({ ...prev, email: text }))}
          value={emergencyContact.email}
        />
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={handlePreviousStep}
          disabled={isLoading}
        >
          <Icon name="arrow-back" size={20} color="#1976d2" style={styles.buttonIcon} />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.registerButton}
          onPress={handleRegister}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Text style={styles.buttonText}>Complete Registration</Text>
              <Icon name="check" size={20} color="white" style={styles.buttonIcon} />
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <Animated.View 
            style={[
              styles.content,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }]
              }
            ]}
          >
            <View style={styles.logoContainer}>
              <Image 
                source={require('../assets/logo.jpg')} 
                style={styles.logo}
                resizeMode="contain"
              />
              <Text style={styles.title}>Patient Registration</Text>
              <View style={styles.stepIndicator}>
                <View style={[styles.stepDot, currentStep >= 1 && styles.stepDotActive]} />
                <View style={styles.stepLine} />
                <View style={[styles.stepDot, currentStep >= 2 && styles.stepDotActive]} />
              </View>
              <Text style={styles.stepText}>Step {currentStep} of 2</Text>
            </View>

            <View style={styles.inputContainer}>
              {currentStep === 1 ? renderStep1() : renderStep2()}
            </View>

            <View style={styles.loginLink}>
              <Text style={styles.footerText}>Already have an account?</Text>
              <TouchableOpacity 
                onPress={() => navigation.navigate('Login')}
                style={styles.loginButton}
              >
                <Text style={styles.loginText}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#e3f2fd',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  content: {
    padding: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#0d47a1',
    textAlign: 'center',
    marginBottom: 16,
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#90a4ae',
  },
  stepDotActive: {
    backgroundColor: '#1976d2',
  },
  stepLine: {
    width: 40,
    height: 2,
    backgroundColor: '#90a4ae',
    marginHorizontal: 8,
  },
  stepText: {
    fontSize: 14,
    color: '#546e7a',
    fontWeight: '500',
  },
  inputContainer: {
    marginBottom: 24,
  },
  stepContainer: {
    marginBottom: 16,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#0d47a1',
    marginBottom: 8,
    textAlign: 'center',
  },
  stepSubtitle: {
    fontSize: 14,
    color: '#546e7a',
    textAlign: 'center',
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976d2',
    marginTop: 16,
    marginBottom: 12,
    paddingLeft: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 10,
    paddingHorizontal: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  icon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: 50,
    color: '#424242',
    fontSize: 16,
  },
  multilineInput: {
    height: 80,
    textAlignVertical: 'top',
    paddingVertical: 12,
  },
  pickerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 50,
  },
  pickerText: {
    fontSize: 16,
    color: '#424242',
  },
  pickerPlaceholder: {
    fontSize: 16,
    color: '#90a4ae',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    borderRadius: 10,
    backgroundColor: '#1976d2',
    height: 50,
    elevation: 3,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    gap: 12,
  },
  backButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: 'white',
    height: 50,
    borderWidth: 2,
    borderColor: '#1976d2',
  },
  backButtonText: {
    color: '#1976d2',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  registerButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#1976d2',
    height: 50,
    elevation: 3,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonIcon: {
    marginLeft: 8,
  },
  loginLink: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  footerText: {
    color: '#424242',
    marginRight: 8,
  },
  loginButton: {
    padding: 4,
  },
  loginText: {
    color: '#1976d2',
    fontWeight: '500',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0d47a1',
    marginBottom: 16,
    textAlign: 'center',
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  optionItemSelected: {
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
  },
  optionText: {
    fontSize: 16,
    color: '#424242',
  },
  optionTextSelected: {
    color: '#1976d2',
    fontWeight: '600',
  },
  modalCloseButton: {
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  modalCloseText: {
    color: '#1976d2',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default RegisterScreen;