import React, { useEffect, useMemo, useState, useCallback, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
  Alert,
  ScrollView,
  Animated,
  Easing,
  TextInput,
  Image,
  Platform,
  StatusBar,
  Modal,
  TouchableWithoutFeedback,
  FlatList
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';

const { width, height } = Dimensions.get('window');
const moderateScale = (size: number, factor = 0.5) => size + ((width / 375) * size - size) * factor;

const API_BASE_URL = 'http://localhost:3000';

interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
  email: string;
}

interface UserProfile {
  _id: string;
  name: string;
  email: string;
  phoneNumber?: string;
  role: string;
  dateOfBirth?: string;
  address?: string;
  gender?: string;
  avatar?: string;
  emergencyContact?: EmergencyContact;
  bloodType?: string;
  allergies?: string;
  medications?: string;
}

interface PatientInfo {
  height: number;
  weight: number;
  BMI: number;
  blood_type: string;
  allergist: string;
  current_medications: Array<{
    _id: string;
    name: string;
    dosage: string;
    frequency: string;
    start_date: string;
    reason: string;
    prescribed_by: string;
  }>;
  chronic_diseases: string[];
  emergency_contact: EmergencyContact;
}

interface Option {
  label: string;
  value: string;
}

const GENDER_OPTIONS: Option[] = [
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
  { label: 'Other', value: 'other' },
  { label: 'Prefer not to say', value: 'prefer_not_to_say' }
];

const BLOOD_TYPE_OPTIONS: Option[] = [
  { label: 'A+', value: 'A+' },
  { label: 'A-', value: 'A-' },
  { label: 'B+', value: 'B+' },
  { label: 'B-', value: 'B-' },
  { label: 'AB+', value: 'AB+' },
  { label: 'AB-', value: 'AB-' },
  { label: 'O+', value: 'O+' },
  { label: 'O-', value: 'O-' }
];

const RELATIONSHIP_OPTIONS: Option[] = [
  { label: 'Spouse', value: 'Spouse' },
  { label: 'Parent', value: 'Parent' },
  { label: 'Child', value: 'Child' },
  { label: 'Sibling', value: 'Sibling' },
  { label: 'Friend', value: 'Friend' },
  { label: 'Other', value: 'Other' }
];

const CHRONIC_DISEASE_OPTIONS: Option[] = [
  { label: 'Diabetes', value: 'Diabetes' },
  { label: 'Hypertension', value: 'Hypertension' },
  { label: 'Asthma', value: 'Asthma' },
  { label: 'Heart Disease', value: 'Heart Disease' },
  { label: 'Arthritis', value: 'Arthritis' },
  { label: 'Chronic Kidney Disease', value: 'Chronic Kidney Disease' },
  { label: 'COPD', value: 'COPD' },
  { label: 'Cancer', value: 'Cancer' },
  { label: 'Other', value: 'Other' }
];

// Enhanced Loading Component
const LoadingSpinner = memo(() => (
  <SafeAreaView style={styles.container}>
    <StatusBar barStyle="light-content" backgroundColor="#4A90E2" />
    <LinearGradient
      colors={['#4A90E2', '#7BB3F0']}
      style={StyleSheet.absoluteFill}
    />
    <View style={styles.centered}>
      <View style={styles.loadingCard}>
        <View style={styles.loadingAnimation}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <View style={styles.loadingDots}>
            <View style={[styles.dot, styles.dot1]} />
            <View style={[styles.dot, styles.dot2]} />
            <View style={[styles.dot, styles.dot3]} />
          </View>
        </View>
        <Text style={styles.loadingText}>Loading your profile</Text>
        <Text style={styles.loadingSubtext}>Getting everything ready for you</Text>
      </View>
    </View>
  </SafeAreaView>
));

// Enhanced Error Component
const ErrorView = memo(({ error, onRetry }: { error: string; onRetry: () => void }) => (
  <SafeAreaView style={styles.container}>
    <StatusBar barStyle="light-content" backgroundColor="#E74C3C" />
    <LinearGradient
      colors={['#E74C3C', '#EC7063']}
      style={StyleSheet.absoluteFill}
    />
    <View style={styles.centered}>
      <View style={styles.errorCard}>
        <View style={styles.errorIcon}>
          <Ionicons name="warning-outline" size={moderateScale(60)} color="#FFFFFF" />
        </View>
        <Text style={styles.errorTitle}>Unable to Load Profile</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
          <LinearGradient
            colors={['#FFFFFF', '#F8FAFC']}
            style={styles.retryButtonGradient}
          >
            <Ionicons name="refresh" size={moderateScale(20)} color="#E74C3C" />
            <Text style={styles.retryButtonText}>Try Again</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  </SafeAreaView>
));

// BMI Indicator Component
const BMIIndicator = memo(({ bmi }: { bmi: number }) => {
  let status = '';
  let color = '#64748B';
  let description = '';

  if (bmi > 0) {
    if (bmi < 18.5) {
      status = 'Underweight';
      color = '#F59E0B';
      description = 'Consider consulting a nutritionist';
    } else if (bmi >= 18.5 && bmi < 25) {
      status = 'Normal';
      color = '#10B981';
      description = 'Healthy weight range';
    } else if (bmi >= 25 && bmi < 30) {
      status = 'Overweight';
      color = '#F59E0B';
      description = 'Consider lifestyle changes';
    } else {
      status = 'Obese';
      color = '#EF4444';
      description = 'Consult healthcare provider';
    }
  }

  return (
    <View style={styles.bmiContainer}>
      <View style={styles.bmiHeader}>
        <Text style={styles.bmiLabel}>Body Mass Index (BMI)</Text>
        <Text style={styles.bmiValue}>{bmi > 0 ? bmi.toFixed(1) : '--'}</Text>
      </View>
      {bmi > 0 && (
        <>
          <View style={styles.bmiStatusContainer}>
            <View style={[styles.bmiStatusDot, { backgroundColor: color }]} />
            <Text style={[styles.bmiStatus, { color }]}>{status}</Text>
          </View>
          <Text style={styles.bmiDescription}>{description}</Text>
          <View style={styles.bmiScale}>
            <View style={[styles.bmiRange, bmi < 18.5 && styles.bmiRangeActive]}>
              <Text style={styles.bmiRangeText}>Underweight</Text>
              <Text style={styles.bmiRangeText}>&lt;18.5</Text>
            </View>
            <View style={[styles.bmiRange, bmi >= 18.5 && bmi < 25 && styles.bmiRangeActive]}>
              <Text style={styles.bmiRangeText}>Normal</Text>
              <Text style={styles.bmiRangeText}>18.5-24.9</Text>
            </View>
            <View style={[styles.bmiRange, bmi >= 25 && bmi < 30 && styles.bmiRangeActive]}>
              <Text style={styles.bmiRangeText}>Overweight</Text>
              <Text style={styles.bmiRangeText}>25-29.9</Text>
            </View>
            <View style={[styles.bmiRange, bmi >= 30 && styles.bmiRangeActive]}>
              <Text style={styles.bmiRangeText}>Obese</Text>
              <Text style={styles.bmiRangeText}>30+</Text>
            </View>
          </View>
        </>
      )}
    </View>
  );
});

// Enhanced Profile Header
const ProfileHeader = memo(({ 
  name, 
  onBack, 
  onLogout 
}: { 
  name: string;
  onBack: () => void; 
  onLogout: () => void; 
}) => (
  <View style={styles.headerWrapper}>
    <StatusBar barStyle="light-content" backgroundColor="#4A90E2" />
    <LinearGradient
      colors={['#4A90E2', '#63A4FF']}
      style={styles.headerGradient}
    >
      <SafeAreaView>
        <View style={styles.headerContainer}>
          <View style={styles.headerTopBar}>
            <TouchableOpacity 
              style={styles.headerButton} 
              onPress={onBack}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={moderateScale(22)} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Profile</Text>
            <TouchableOpacity 
              style={styles.headerButton} 
              onPress={onLogout}
              activeOpacity={0.7}
            >
              <Ionicons name="exit-outline" size={moderateScale(22)} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  </View>
));

// Utility function to build avatar URL with cache busting
const buildImageUrl = (filename: string | null): string => {
  if (!filename) return '';
  
  // If already a full URL
  if (filename.startsWith('http')) {
    return `${filename}?t=${Date.now()}`;
  }
  
  // If just a filename
  const timestamp = Date.now();
  return `${API_BASE_URL}/uploads/avatars/${filename}?t=${timestamp}`;
};

// Profile Card Component
const ProfileCard = memo(({ 
  avatar, 
  name, 
  email,
  isEditing, 
  onPickImage,
  avatarUpdated,
}: { 
  avatar: string | null; 
  name: string;
  email: string;
  isEditing: boolean;
  onPickImage: () => void;
  avatarUpdated: boolean;
}) => {
  const [imageKey, setImageKey] = useState(Date.now());
  
  // Force re-render when avatarUpdated changes
  useEffect(() => {
    setImageKey(Date.now());
  }, [avatarUpdated]);
  
  // Build avatar URL with cache busting
  const avatarUrl = useMemo(() => {
    return buildImageUrl(avatar);
  }, [avatar, avatarUpdated]);
  
  return (
    <View style={styles.profileCard}>
      <LinearGradient
        colors={['#4A90E2', '#63A4FF']}
        style={styles.profileCardGradient}
      >
        <View style={styles.profileCardContent}>
          <TouchableOpacity 
            onPress={isEditing ? onPickImage : undefined} 
            activeOpacity={isEditing ? 0.8 : 1}
            style={styles.avatarContainer}
          >
            <View style={styles.avatarWrapper}>
              {avatar ? (
                <Image 
                  source={{ 
                    uri: avatarUrl,
                    cache: 'reload'
                  }} 
                  style={styles.avatarImage}
                  key={`avatar-${imageKey}`} // Force re-render with new key
                  onError={(e) => {
                    console.error('❌ Failed to load avatar:', e.nativeEvent.error);
                  }}
                  onLoad={() => {
                    console.log('✅ Avatar loaded successfully');
                  }}
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarInitial}>{name?.charAt(0)?.toUpperCase() || 'P'}</Text>
                </View>
              )}
              {isEditing && (
                <View style={styles.editBadge}>
                  <Ionicons name="camera" size={moderateScale(14)} color="#4A90E2" />
                </View>
              )}
            </View>
          </TouchableOpacity>
        
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{name || 'Patient'}</Text>
          <Text style={styles.profileEmail}>{email || 'patient@example.com'}</Text>
          <View style={styles.profileBadge}>
            <Ionicons name="medical" size={moderateScale(12)} color="#4A90E2" />
            <Text style={styles.profileBadgeText}>Patient Account</Text>
          </View>
        </View>
      </View>
    </LinearGradient>
  </View>
  );
});

// Section Header Component
const SectionHeader = memo(({
  title,
  icon,
  color = '#4A90E2'
}: {
  title: string;
  icon: string;
  color?: string;
}) => (
  <View style={styles.sectionHeader}>
    <View style={[styles.sectionIcon, { backgroundColor: color }]}>
      <Ionicons name={icon as any} size={moderateScale(16)} color="#FFFFFF" />
    </View>
    <Text style={styles.sectionTitle}>{title}</Text>
    <View style={styles.sectionLine} />
  </View>
));

// Enhanced Info Item
const InfoItem = memo(({ 
  icon, 
  label, 
  value, 
  isEditing, 
  onChangeText,
  placeholder,
  keyboardType = 'default',
  multiline = false,
  required = false,
  iconColor = '#4A90E2',
  lastItem = false,
  unit = ''
}: {
  icon: string;
  label: string;
  value: string;
  isEditing: boolean;
  onChangeText?: (text: string) => void;
  placeholder?: string;
  keyboardType?: any;
  multiline?: boolean;
  required?: boolean;
  iconColor?: string;
  lastItem?: boolean;
  unit?: string;
}) => (
  <View style={[styles.infoItem, lastItem && styles.lastInfoItem]}>
    <View style={styles.infoItemHeader}>
      <View style={styles.infoItemIconContainer}>
        <Ionicons name={icon as any} size={moderateScale(18)} color={iconColor} />
      </View>
      <Text style={styles.infoItemLabel}>
        {label} {required && <Text style={styles.requiredStar}>*</Text>}
      </Text>
    </View>
    
    {isEditing ? (
      <View style={styles.inputWithUnit}>
        <TextInput
          style={[styles.infoItemInput, multiline && styles.multilineInput, unit && styles.inputWithUnitField]}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          placeholder={placeholder}
          placeholderTextColor="#A0A0A0"
          multiline={multiline}
          numberOfLines={multiline ? 3 : 1}
          editable={isEditing}
        />
        {unit && <Text style={styles.unitText}>{unit}</Text>}
      </View>
    ) : (
      <Text style={styles.infoItemValue} numberOfLines={multiline ? 3 : 1}>
        {value || 'Not provided'} {unit && value && unit}
      </Text>
    )}
  </View>
));

// Enhanced Option Picker
const OptionPicker = ({
  icon,
  label,
  value,
  options,
  isEditing,
  onSelect,
  placeholder = "Select an option",
  iconColor = '#4A90E2',
  lastItem = false
}: {
  icon: string;
  label: string;
  value: string;
  options: Option[];
  isEditing: boolean;
  onSelect: (value: string) => void;
  placeholder?: string;
  iconColor?: string;
  lastItem?: boolean;
}) => {
  const [modalVisible, setModalVisible] = useState(false);

  const handleSelect = (selectedValue: string) => {
    onSelect(selectedValue);
    setModalVisible(false);
  };

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <View style={[styles.infoItem, lastItem && styles.lastInfoItem]}>
      <View style={styles.infoItemHeader}>
        <View style={styles.infoItemIconContainer}>
          <Ionicons name={icon as any} size={moderateScale(18)} color={iconColor} />
        </View>
        <Text style={styles.infoItemLabel}>{label}</Text>
      </View>

      {isEditing ? (
        <TouchableOpacity
          style={styles.optionPickerButton}
          onPress={() => setModalVisible(true)}
          activeOpacity={0.7}
          disabled={!isEditing}
        >
          <Text style={selectedOption ? styles.optionPickerText : styles.optionPickerPlaceholder}>
            {selectedOption ? selectedOption.label : placeholder}
          </Text>
          <Ionicons name="chevron-down" size={moderateScale(18)} color="#4A5568" />
        </TouchableOpacity>
      ) : (
        <Text style={styles.infoItemValue}>
          {selectedOption ? selectedOption.label : 'Not provided'}
        </Text>
      )}

      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalCard}>
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
                        <Ionicons name="checkmark-circle" size={moderateScale(20)} color="#4A90E2" />
                      )}
                    </TouchableOpacity>
                  )}
                  style={styles.optionsList}
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

// Enhanced Date Picker
const DatePickerField = ({
  icon,
  label,
  value,
  isEditing,
  onChange,
  iconColor = '#4A90E2',
  lastItem = false
}: {
  icon: string;
  label: string;
  value: string;
  isEditing: boolean;
  onChange: (date: string) => void;
  iconColor?: string;
  lastItem?: boolean;
}) => {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(value ? new Date(value) : new Date());

  const handleDateChange = (event: any, date?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (date) {
      setSelectedDate(date);
      onChange(date.toISOString().split('T')[0]);
    }
  };

  const displayValue = value ? new Date(value).toLocaleDateString() : '';

  return (
    <View style={[styles.infoItem, lastItem && styles.lastInfoItem]}>
      <View style={styles.infoItemHeader}>
        <View style={styles.infoItemIconContainer}>
          <Ionicons name={icon as any} size={moderateScale(18)} color={iconColor} />
        </View>
        <Text style={styles.infoItemLabel}>{label}</Text>
      </View>

      {isEditing ? (
        <>
          <TouchableOpacity
            style={styles.optionPickerButton}
            onPress={() => setShowDatePicker(true)}
            activeOpacity={0.7}
            disabled={!isEditing}
          >
            <Text style={value ? styles.optionPickerText : styles.optionPickerPlaceholder}>
              {value ? displayValue : 'Select date'}
            </Text>
            <Ionicons name="calendar" size={moderateScale(18)} color="#4A5568" />
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={selectedDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleDateChange}
              maximumDate={new Date()}
            />
          )}
        </>
      ) : (
        <Text style={styles.infoItemValue}>{value ? displayValue : 'Not provided'}</Text>
      )}
    </View>
  );
};

// Multi-select Component for Chronic Diseases
const MultiSelectField = ({
  icon,
  label,
  selectedValues,
  options,
  isEditing,
  onSelect,
  iconColor = '#4A90E2',
  lastItem = false
}: {
  icon: string;
  label: string;
  selectedValues: string[];
  options: Option[];
  isEditing: boolean;
  onSelect: (values: string[]) => void;
  iconColor?: string;
  lastItem?: boolean;
}) => {
  const [modalVisible, setModalVisible] = useState(false);

  const toggleSelection = (value: string) => {
    const newSelected = selectedValues.includes(value)
      ? selectedValues.filter(v => v !== value)
      : [...selectedValues, value];
    onSelect(newSelected);
  };

  const displayText = selectedValues.length > 0 
    ? selectedValues.map(val => options.find(opt => opt.value === val)?.label).join(', ')
    : 'None selected';

  return (
    <View style={[styles.infoItem, lastItem && styles.lastInfoItem]}>
      <View style={styles.infoItemHeader}>
        <View style={styles.infoItemIconContainer}>
          <Ionicons name={icon as any} size={moderateScale(18)} color={iconColor} />
        </View>
        <Text style={styles.infoItemLabel}>{label}</Text>
      </View>

      {isEditing ? (
        <TouchableOpacity
          style={styles.optionPickerButton}
          onPress={() => setModalVisible(true)}
          activeOpacity={0.7}
          disabled={!isEditing}
        >
          <Text style={selectedValues.length > 0 ? styles.optionPickerText : styles.optionPickerPlaceholder}>
            {selectedValues.length > 0 ? `${selectedValues.length} selected` : 'Select options'}
          </Text>
          <Ionicons name="chevron-down" size={moderateScale(18)} color="#4A5568" />
        </TouchableOpacity>
      ) : (
        <Text style={styles.infoItemValue}>
          {selectedValues.length > 0 ? displayText : 'None'}
        </Text>
      )}

      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>Select {label}</Text>
                <FlatList
                  data={options}
                  keyExtractor={(item) => item.value}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[
                        styles.optionItem,
                        selectedValues.includes(item.value) && styles.optionItemSelected
                      ]}
                      onPress={() => toggleSelection(item.value)}
                    >
                      <Text style={[
                        styles.optionText,
                        selectedValues.includes(item.value) && styles.optionTextSelected
                      ]}>
                        {item.label}
                      </Text>
                      {selectedValues.includes(item.value) && (
                        <Ionicons name="checkmark-circle" size={moderateScale(20)} color="#4A90E2" />
                      )}
                    </TouchableOpacity>
                  )}
                  style={styles.optionsList}
                />
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.modalCloseText}>Done</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
};

// Floating Action Button
const FloatingActionButton = memo(({
  onPress,
  icon,
  variant = 'primary'
}: {
  onPress: () => void;
  icon: string;
  variant?: 'primary' | 'secondary';
}) => (
  <TouchableOpacity
    style={[
      styles.fab,
      variant === 'primary' ? styles.fabPrimary : styles.fabSecondary
    ]}
    onPress={onPress}
    activeOpacity={0.8}
  >
    <Ionicons 
      name={icon as any} 
      size={moderateScale(24)} 
      color={variant === 'primary' ? '#FFFFFF' : '#4A90E2'} 
    />
  </TouchableOpacity>
));

// Enhanced Physical Metrics Section with BMI Calculation
const PhysicalMetricsSection = memo(({ 
  patientInfo, 
  isEditing, 
  onUpdateMetrics 
}: { 
  patientInfo: PatientInfo | null;
  isEditing: boolean;
  onUpdateMetrics: (metrics: any) => Promise<void>;
}) => {
  const [height, setHeight] = useState(patientInfo?.height?.toString() || '');
  const [weight, setWeight] = useState(patientInfo?.weight?.toString() || '');
  const [saving, setSaving] = useState(false);

  // Calculate BMI whenever height or weight changes
  const calculateBMI = useCallback((h: number, w: number): number => {
    if (h > 0 && w > 0) {
      const heightInMeters = h / 100;
      return parseFloat((w / (heightInMeters * heightInMeters)).toFixed(1));
    }
    return 0;
  }, []);

  const currentBMI = calculateBMI(parseFloat(height) || 0, parseFloat(weight) || 0);

  const handleSave = useCallback(async () => {
    const heightNum = parseFloat(height);
    const weightNum = parseFloat(weight);

    if (heightNum && heightNum < 50) {
      Alert.alert('Invalid Height', 'Please enter height in centimeters (minimum 50 cm)');
      return;
    }

    if (weightNum && weightNum < 2) {
      Alert.alert('Invalid Weight', 'Please enter weight in kilograms (minimum 2 kg)');
      return;
    }

    setSaving(true);
    try {
      await onUpdateMetrics({
        height: heightNum || 0,
        weight: weightNum || 0,
        BMI: currentBMI
      });
      Alert.alert('Success', 'Physical metrics updated successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to update physical metrics');
    } finally {
      setSaving(false);
    }
  }, [height, weight, currentBMI, onUpdateMetrics]);

  return (
    <View style={styles.section}>
      <SectionHeader title="Physical Metrics" icon="fitness-outline" color="#8B5CF6" />
      <View style={styles.sectionCard}>
        <View style={styles.metricsRow}>
          <View style={styles.metricColumn}>
            <InfoItem
              icon="resize-outline"
              label="Height"
              value={height}
              isEditing={isEditing}
              onChangeText={setHeight}
              placeholder="Enter height"
              keyboardType="numeric"
              iconColor="#8B5CF6"
              unit="cm"
            />
          </View>
          <View style={styles.metricColumn}>
            <InfoItem
              icon="scale-outline"
              label="Weight"
              value={weight}
              isEditing={isEditing}
              onChangeText={setWeight}
              placeholder="Enter weight"
              keyboardType="numeric"
              iconColor="#8B5CF6"
              unit="kg"
            />
          </View>
        </View>

        <BMIIndicator bmi={currentBMI} />

        {isEditing && (
          <TouchableOpacity 
            style={[styles.saveSectionButton, saving && styles.saveSectionButtonDisabled]} 
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.saveSectionButtonText}>
              {saving ? "Saving..." : "Save Physical Metrics"}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
});

// Enhanced Medical Information Section
const MedicalInformationSection = memo(({ 
  patientInfo, 
  isEditing, 
  onUpdateMedicalInfo 
}: { 
  patientInfo: PatientInfo | null;
  isEditing: boolean;
  onUpdateMedicalInfo: (medicalInfo: any) => Promise<void>;
}) => {
  const [bloodType, setBloodType] = useState(patientInfo?.blood_type || '');
  const [allergies, setAllergies] = useState(patientInfo?.allergist || '');
  const [chronicDiseases, setChronicDiseases] = useState<string[]>(patientInfo?.chronic_diseases || []);
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await onUpdateMedicalInfo({
        blood_type: bloodType,
        allergist: allergies,
        chronic_diseases: chronicDiseases
      });
      Alert.alert('Success', 'Medical information updated successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to update medical information');
    } finally {
      setSaving(false);
    }
  }, [bloodType, allergies, chronicDiseases, onUpdateMedicalInfo]);

  return (
    <View style={styles.section}>
      <SectionHeader title="Medical Information" icon="medical-outline" color="#4ECDC4" />
      <View style={styles.sectionCard}>
        <OptionPicker
          icon="water-outline"
          label="Blood Type"
          value={bloodType}
          options={BLOOD_TYPE_OPTIONS}
          isEditing={isEditing}
          onSelect={setBloodType}
          iconColor="#4ECDC4"
        />

        <InfoItem
          icon="warning-outline"
          label="Allergies"
          value={allergies}
          isEditing={isEditing}
          onChangeText={setAllergies}
          placeholder="List any allergies"
          multiline
          iconColor="#4ECDC4"
        />

        <MultiSelectField
          icon="heart-dislike-outline"
          label="Chronic Diseases"
          selectedValues={chronicDiseases}
          options={CHRONIC_DISEASE_OPTIONS}
          isEditing={isEditing}
          onSelect={setChronicDiseases}
          iconColor="#4ECDC4"
          lastItem={!isEditing}
        />

        {isEditing && (
          <TouchableOpacity 
            style={[styles.saveSectionButton, saving && styles.saveSectionButtonDisabled]} 
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.saveSectionButtonText}>
              {saving ? "Saving..." : "Save Medical Info"}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
});

// Enhanced Emergency Contact Section
const EmergencyContactSection = memo(({ 
  patientInfo, 
  isEditing, 
  onUpdateContact 
}: { 
  patientInfo: PatientInfo | null;
  isEditing: boolean;
  onUpdateContact: (contact: any) => Promise<void>;
}) => {
  const [emergencyContact, setEmergencyContact] = useState<EmergencyContact>({
    name: patientInfo?.emergency_contact?.name || '',
    relationship: patientInfo?.emergency_contact?.relationship || 'Family',
    phone: patientInfo?.emergency_contact?.phone || '',
    email: patientInfo?.emergency_contact?.email || ''
  });

  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    if (!emergencyContact.name || !emergencyContact.phone) {
      Alert.alert('Error', 'Please fill in at least name and phone number');
      return;
    }

    setSaving(true);
    try {
      await onUpdateContact(emergencyContact);
      Alert.alert('Success', 'Emergency contact updated successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to update emergency contact');
    } finally {
      setSaving(false);
    }
  }, [emergencyContact, onUpdateContact]);

  const displayValue = patientInfo?.emergency_contact 
    ? `${patientInfo.emergency_contact.name} (${patientInfo.emergency_contact.relationship}) - ${patientInfo.emergency_contact.phone}`
    : 'Not provided';

  return (
    <View style={styles.section}>
      <SectionHeader title="Emergency Contact" icon="people-outline" color="#FF6B6B" />
      <View style={styles.sectionCard}>
        {isEditing ? (
          <>
            <InfoItem
              icon="person-outline"
              label="Contact Name"
              value={emergencyContact.name}
              isEditing={isEditing}
              onChangeText={(text) => setEmergencyContact(prev => ({ ...prev, name: text }))}
              placeholder="Full name"
              iconColor="#FF6B6B"
              required
            />
            
            <OptionPicker
              icon="people-circle-outline"
              label="Relationship"
              value={emergencyContact.relationship}
              options={RELATIONSHIP_OPTIONS}
              isEditing={isEditing}
              onSelect={(value) => setEmergencyContact(prev => ({ ...prev, relationship: value }))}
              iconColor="#FF6B6B"
            />
            
            <InfoItem
              icon="call-outline"
              label="Phone Number"
              value={emergencyContact.phone}
              isEditing={isEditing}
              onChangeText={(text) => setEmergencyContact(prev => ({ ...prev, phone: text }))}
              placeholder="Phone number"
              keyboardType="phone-pad"
              iconColor="#FF6B6B"
              required
            />
            
            <InfoItem
              icon="mail-outline"
              label="Email Address"
              value={emergencyContact.email}
              isEditing={isEditing}
              onChangeText={(text) => setEmergencyContact(prev => ({ ...prev, email: text }))}
              placeholder="Email address"
              keyboardType="email-address"
              iconColor="#FF6B6B"
              lastItem={true}
            />
            
            <TouchableOpacity 
              style={[styles.saveSectionButton, saving && styles.saveSectionButtonDisabled]} 
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={styles.saveSectionButtonText}>
                {saving ? "Saving..." : "Save Emergency Contact"}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <InfoItem
            icon="person-add-outline"
            label="Emergency Contact"
            value={displayValue}
            isEditing={false}
            iconColor="#FF6B6B"
            lastItem={true}
          />
        )}
      </View>
    </View>
  );
});

const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList, 'Profile'>>();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [patientInfo, setPatientInfo] = useState<PatientInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedProfile, setEditedProfile] = useState<UserProfile | null>(null);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [avatarUpdated, setAvatarUpdated] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(30))[0];

  // Fetch profile data
  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        setError('Authentication token not found');
        return;
      }

      // Fetch user profile
      const response = await fetch(`${API_BASE_URL}/api/patient/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch profile: ${response.status}`);
      }
      
      const profileData = await response.json();
      const userProfile = profileData.data;
      
      // Set avatar from profile data
      if (userProfile.avatar) {
        setAvatar(userProfile.avatar);
      }
      
      // QUAN TRỌNG: Đảm bảo cả profile và editedProfile được cập nhật
      setProfile(userProfile);
      setEditedProfile(userProfile);
      setIsEditing(false); // Đảm bảo tắt chế độ chỉnh sửa khi fetch
      
      // Fetch patient info
      const patientInfoResponse = await fetch(`${API_BASE_URL}/api/patient/patient-info`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (patientInfoResponse.ok) {
        const patientInfoData = await patientInfoResponse.json();
        setPatientInfo(patientInfoData.data);
      }
      
      // Animation
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        })
      ]).start();
    } catch (err) {
      console.error('Fetch profile error:', err);
      setError('Unable to connect. Please check your internet connection.');
    } finally {
      setLoading(false);
    }
  }, [fadeAnim, slideAnim]);

  // Function to delete old avatar
  const deleteOldAvatar = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) return;

      // Call API to delete avatar
      const response = await fetch(`${API_BASE_URL}/api/patient/avatar`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        console.log('⚠️ No old avatar to delete or delete failed');
      }
    } catch (error) {
      console.error('❌ Error deleting old avatar:', error);
    }
  }, []);

  // Function to upload avatar to server
  const uploadAvatarToServer = useCallback(async (imageUri: string) => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        Alert.alert('Error', 'Please login again');
        return null;
      }

      // Delete old avatar before uploading new one
      await deleteOldAvatar();

      // Create FormData
      const formData = new FormData();
      
      // Create filename with timestamp
      const timestamp = Date.now();
      const extension = imageUri.split('.').pop() || 'jpg';
      const filename = `avatar_${timestamp}.${extension}`;
      
      formData.append('avatar', {
        uri: imageUri,
        type: 'image/jpeg',
        name: filename,
      });

      console.log('📤 Uploading avatar with filename:', filename);

      // Upload to server
      const response = await fetch(`${API_BASE_URL}/api/patient/upload-avatar`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const responseText = await response.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('❌ Error parsing response:', parseError);
        throw new Error('Invalid response from server');
      }
      
      if (!response.ok) {
        throw new Error(data.message || `Upload failed with status ${response.status}`);
      }

      console.log('✅ Upload successful:', data);
      return data;
    } catch (error: any) {
      console.error('❌ Upload error:', error);
      throw error;
    }
  }, [deleteOldAvatar]);

  // Function to refresh avatar
  const refreshAvatar = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) return;

      // Fetch latest avatar info
      const response = await fetch(`${API_BASE_URL}/api/patient/avatar-url`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.data.avatar) {
          const newAvatarUrl = buildImageUrl(data.data.avatar);
          setAvatar(newAvatarUrl);
          setAvatarUpdated(prev => !prev);
        }
      }
    } catch (error) {
      console.error('Error refreshing avatar:', error);
    }
  }, []);

  // Function to pick image from gallery
  const pickImage = useCallback(async () => {
    try {
      console.log('📸 Starting pickImage function');
      
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'We need access to your photo library to update your profile picture.',
          [{ text: 'OK' }]
        );
        return;
      }
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      
      if (!result.canceled && result.assets[0]) {
        const selectedImage = result.assets[0];
        
        // Show confirmation dialog
        Alert.alert(
          'Update Profile Picture',
          'Do you want to update your profile picture?',
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'Update',
              onPress: async () => {
                // Show loading
                Alert.alert(
                  'Uploading',
                  'Uploading your new profile picture...',
                  [],
                  { cancelable: false }
                );
                
                try {
                  // Upload image to server
                  const uploadResult = await uploadAvatarToServer(selectedImage.uri);
                  
                  if (uploadResult?.success) {
                    // Update state immediately with new avatar
                    const newAvatarUrl = `${API_BASE_URL}/uploads/avatars/${uploadResult.data.avatar}?t=${Date.now()}`;
                    
                    // Update all related states
                    setAvatar(newAvatarUrl);
                    setProfile(prev => prev ? { 
                      ...prev, 
                      avatar: newAvatarUrl 
                    } : null);
                    setEditedProfile(prev => prev ? { 
                      ...prev, 
                      avatar: newAvatarUrl 
                    } : null);
                    
                    // Force re-render
                    setAvatarUpdated(prev => !prev);
                    
                    // Close loading alert and show success
                    Alert.alert(
                      'Success',
                      'Profile picture updated successfully!',
                      [{ text: 'OK' }]
                    );
                  }
                } catch (uploadError: any) {
                  console.error('Upload failed:', uploadError);
                  Alert.alert(
                    'Upload Failed',
                    uploadError.message || 'Failed to upload image. Please try again.',
                    [{ text: 'OK' }]
                  );
                }
              },
            },
          ]
        );
      }
    } catch (error) {
      console.error('🔥 Error in pickImage:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  }, [uploadAvatarToServer]);

  // Update emergency contact
  const updateEmergencyContact = useCallback(async (contactInfo: EmergencyContact) => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const response = await fetch(`${API_BASE_URL}/api/patient/emergency-contact`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(contactInfo),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update emergency contact');
      }
      
      const data = await response.json();
      setPatientInfo(prev => prev ? { 
        ...prev, 
        emergency_contact: contactInfo 
      } : null);
      return data;
    } catch (error) {
      console.error('Update emergency contact error:', error);
      throw error;
    }
  }, []);

  // Update physical metrics
  const updatePhysicalMetrics = useCallback(async (metrics: any) => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const response = await fetch(`${API_BASE_URL}/api/patient/patient-info`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          height: metrics.height,
          weight: metrics.weight,
          BMI: metrics.BMI
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update physical metrics');
      }
      
      const data = await response.json();
      setPatientInfo(prev => prev ? { 
        ...prev, 
        height: metrics.height,
        weight: metrics.weight,
        BMI: metrics.BMI
      } : null);
      return data;
    } catch (error) {
      console.error('Update physical metrics error:', error);
      throw error;
    }
  }, []);

  // Update medical information
  const updateMedicalInformation = useCallback(async (medicalInfo: any) => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const response = await fetch(`${API_BASE_URL}/api/patient/patient-info`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(medicalInfo),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update medical information');
      }
      
      const data = await response.json();
      setPatientInfo(prev => prev ? { 
        ...prev, 
        ...medicalInfo
      } : null);
      return data;
    } catch (error) {
      console.error('Update medical information error:', error);
      throw error;
    }
  }, []);

  // Save profile
  const handleSave = useCallback(async () => {
    if (saving) return;
    
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const body = {
        name: editedProfile?.name,
        email: editedProfile?.email,
        phoneNumber: editedProfile?.phoneNumber,
        dateOfBirth: editedProfile?.dateOfBirth,
        gender: editedProfile?.gender,
        address: editedProfile?.address,
        bloodType: editedProfile?.bloodType,
      };

      const response = await fetch(`${API_BASE_URL}/api/patient/profile`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update profile');
      }

      const data = await response.json();
      
      // QUAN TRỌNG: Cập nhật state với dữ liệu mới
      const updatedProfile = data.data;
      setProfile(updatedProfile);
      setEditedProfile(updatedProfile);
      
      // Force re-render avatar nếu có thay đổi
      if (updatedProfile.avatar) {
        setAvatar(updatedProfile.avatar);
        setAvatarUpdated(prev => !prev);
      }
      
      // Tắt chế độ chỉnh sửa và reset saving state
      setIsEditing(false);
      
      // Hiển thị thông báo thành công
      Alert.alert(
        'Success!',
        'Your profile has been updated successfully.',
        [
          { 
            text: 'OK',
            onPress: () => {
              // Refresh lại profile để đảm bảo dữ liệu đồng bộ
              setTimeout(() => {
                fetchProfile();
              }, 100);
            }
          }
        ]
      );
    } catch (err: any) {
      Alert.alert(
        'Update Failed',
        err.message || 'We couldn\'t update your profile. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setSaving(false);
    }
  }, [editedProfile, saving, fetchProfile]);

  // Logout
  const handleLogout = useCallback(() => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out of your account?',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        { 
          text: 'Sign Out', 
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.removeItem('authToken');
            navigation.reset({
              index: 0,
              routes: [{ name: 'Login' }],
            });
          }
        }
      ]
    );
  }, [navigation]);

  // Field change handler
  const handleFieldChange = useCallback((field: keyof UserProfile, value: string) => {
    setEditedProfile(prev => prev ? { ...prev, [field]: value } : null);
  }, []);

  // Effects
  useEffect(() => {
    console.log('🔄 ProfileScreen mounted, fetching profile...');
    fetchProfile();
  }, [fetchProfile]);

  // Đồng bộ editedProfile khi profile thay đổi
  useEffect(() => {
    if (profile) {
      setEditedProfile(profile);
      if (profile.avatar) {
        setAvatar(profile.avatar);
      }
    }
  }, [profile]);

  // Reset editing state khi component unmount
  useEffect(() => {
    return () => {
      setIsEditing(false);
      setEditedProfile(null);
      setAvatar(null);
      setAvatarUpdated(false);
    };
  }, []);

  // Render loading/error
  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorView error={error} onRetry={fetchProfile} />;

  // Main render
  return (
    <View style={styles.container}>
      <ProfileHeader 
        name={profile?.name || 'Patient'}
        onBack={() => navigation.goBack()} 
        onLogout={handleLogout}
      />

      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <Animated.View 
          style={[
            styles.profileContent,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <ProfileCard 
            avatar={avatar}
            name={profile?.name || 'Patient'}
            email={profile?.email || ''}
            isEditing={isEditing}
            onPickImage={pickImage}
            avatarUpdated={avatarUpdated}
          />

          {/* Action Buttons */}
          <View style={styles.actionSection}>
            {!isEditing ? (
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => setIsEditing(true)}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#4A90E2', '#63A4FF']}
                  style={styles.editButtonGradient}
                >
                  <Ionicons name="create-outline" size={moderateScale(20)} color="#FFFFFF" />
                  <Text style={styles.editButtonText}>Edit Profile</Text>
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <View style={styles.editActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setIsEditing(false);
                    setEditedProfile(profile);
                    if (profile?.avatar) {
                      setAvatar(profile.avatar);
                    }
                    setAvatarUpdated(prev => !prev);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                  onPress={handleSave}
                  disabled={saving}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={saving ? ['#CBD5E0', '#A0A0A0'] : ['#4A90E2', '#63A4FF']}
                    style={styles.saveButtonGradient}
                  >
                    <Ionicons name="checkmark-outline" size={moderateScale(20)} color="#FFFFFF" />
                    <Text style={styles.saveButtonText}>
                      {saving ? "Saving..." : "Save Changes"}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Physical Metrics Section */}
          <PhysicalMetricsSection 
            patientInfo={patientInfo}
            isEditing={isEditing}
            onUpdateMetrics={updatePhysicalMetrics}
          />

          {/* Personal Information Section */}
          <View style={styles.section}>
            <SectionHeader title="Personal Information" icon="person-outline" color="#4A90E2" />
            <View style={styles.sectionCard}>
              <InfoItem
                icon="mail-outline"
                label="Email Address"
                value={isEditing ? editedProfile?.email ?? '' : profile?.email ?? ''}
                isEditing={false}
                placeholder="Enter your email"
                keyboardType="email-address"
                required
                iconColor="#4A90E2"
              />

              <InfoItem
                icon="call-outline"
                label="Phone Number"
                value={isEditing ? editedProfile?.phoneNumber ?? '' : profile?.phoneNumber ?? ''}
                isEditing={isEditing}
                onChangeText={(text) => handleFieldChange('phoneNumber', text)}
                placeholder="Enter your phone number"
                keyboardType="phone-pad"
                iconColor="#4A90E2"
              />

              <DatePickerField
                icon="calendar-outline"
                label="Date of Birth"
                value={isEditing ? editedProfile?.dateOfBirth ?? '' : profile?.dateOfBirth ?? ''}
                isEditing={isEditing}
                onChange={(date) => handleFieldChange('dateOfBirth', date)}
                iconColor="#4A90E2"
              />

              <OptionPicker
                icon="body-outline"
                label="Gender"
                value={isEditing ? editedProfile?.gender ?? '' : profile?.gender ?? ''}
                options={GENDER_OPTIONS}
                isEditing={isEditing}
                onSelect={(value) => handleFieldChange('gender', value)}
                iconColor="#4A90E2"
              />

              <InfoItem
                icon="location-outline"
                label="Home Address"
                value={isEditing ? editedProfile?.address ?? '' : profile?.address ?? ''}
                isEditing={isEditing}
                onChangeText={(text) => handleFieldChange('address', text)}
                placeholder="Enter your address"
                multiline
                iconColor="#4A90E2"
                lastItem={true}
              />
            </View>
          </View>

          {/* Medical Information Section */}
          <MedicalInformationSection
            patientInfo={patientInfo}
            isEditing={isEditing}
            onUpdateMedicalInfo={updateMedicalInformation}
          />

          {/* Emergency Contact Section */}
          <EmergencyContactSection 
            patientInfo={patientInfo}
            isEditing={isEditing}
            onUpdateContact={updateEmergencyContact}
          />

          <View style={styles.bottomSpacer} />
        </Animated.View>
      </ScrollView>

      {/* Floating Action Button for Quick Actions */}
      {!isEditing && (
        <FloatingActionButton
          onPress={() => setIsEditing(true)}
          icon="create-outline"
          variant="primary"
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerWrapper: {
    zIndex: 1000,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  headerGradient: {
    paddingBottom: moderateScale(10),
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  headerContainer: {
    paddingHorizontal: moderateScale(20),
  },
  headerTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: moderateScale(12),
  },
  headerButton: {
    width: moderateScale(44),
    height: moderateScale(44),
    borderRadius: moderateScale(22),
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  headerTitle: {
    fontSize: moderateScale(20),
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: moderateScale(20),
  },
  profileContent: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: moderateScale(20),
  },

  // Loading Styles
  loadingCard: {
    alignItems: 'center',
    padding: moderateScale(40),
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: moderateScale(24),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  loadingAnimation: {
    alignItems: 'center',
    marginBottom: moderateScale(20),
  },
  loadingDots: {
    flexDirection: 'row',
    marginTop: moderateScale(10),
  },
  dot: {
    width: moderateScale(6),
    height: moderateScale(6),
    borderRadius: moderateScale(3),
    backgroundColor: '#FFFFFF',
    marginHorizontal: moderateScale(2),
  },
  dot1: { opacity: 0.6 },
  dot2: { opacity: 0.8 },
  dot3: { opacity: 1 },
  loadingText: {
    fontSize: moderateScale(18),
    color: '#FFFFFF',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: moderateScale(8),
  },
  loadingSubtext: {
    fontSize: moderateScale(14),
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },

  // Error Styles
  errorCard: {
    alignItems: 'center',
    padding: moderateScale(30),
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: moderateScale(24),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  errorIcon: {
    marginBottom: moderateScale(20),
  },
  errorTitle: {
    fontSize: moderateScale(20),
    color: '#FFFFFF',
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: moderateScale(10),
  },
  errorText: {
    fontSize: moderateScale(16),
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginBottom: moderateScale(30),
    lineHeight: moderateScale(24),
  },
  retryButton: {
    borderRadius: moderateScale(25),
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  retryButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: moderateScale(24),
    paddingVertical: moderateScale(14),
    borderRadius: moderateScale(25),
  },
  retryButtonText: {
    color: '#E74C3C',
    fontSize: moderateScale(16),
    fontWeight: '600',
    marginLeft: moderateScale(8),
  },

  // Profile Card Styles
  profileCard: {
    margin: moderateScale(20),
    borderRadius: moderateScale(24),
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  profileCardGradient: {
    padding: moderateScale(24),
  },
  profileCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    marginRight: moderateScale(16),
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarImage: {
    width: moderateScale(80),
    height: moderateScale(80),
    borderRadius: moderateScale(40),
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  avatarPlaceholder: {
    width: moderateScale(80),
    height: moderateScale(80),
    borderRadius: moderateScale(40),
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  avatarInitial: {
    fontSize: moderateScale(32),
    fontWeight: '700',
    color: '#FFFFFF',
  },
  editBadge: {
    position: 'absolute',
    right: moderateScale(-2),
    bottom: moderateScale(-2),
    width: moderateScale(28),
    height: moderateScale(28),
    borderRadius: moderateScale(14),
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#4A90E2',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: moderateScale(24),
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: moderateScale(4),
  },
  profileEmail: {
    fontSize: moderateScale(14),
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: moderateScale(8),
  },
  profileBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: moderateScale(12),
    paddingVertical: moderateScale(6),
    borderRadius: moderateScale(16),
    alignSelf: 'flex-start',
  },
  profileBadgeText: {
    fontSize: moderateScale(12),
    color: '#FFFFFF',
    fontWeight: '600',
    marginLeft: moderateScale(4),
  },

  // Action Section Styles
  actionSection: {
    paddingHorizontal: moderateScale(20),
    marginBottom: moderateScale(24),
  },
  editButton: {
    borderRadius: moderateScale(16),
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  editButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: moderateScale(16),
    paddingHorizontal: moderateScale(24),
    borderRadius: moderateScale(16),
  },
  editButtonText: {
    color: '#FFFFFF',
    fontSize: moderateScale(16),
    fontWeight: '600',
    marginLeft: moderateScale(8),
  },
  editActions: {
    flexDirection: 'row',
    gap: moderateScale(12),
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: moderateScale(16),
    paddingHorizontal: moderateScale(24),
    borderRadius: moderateScale(16),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cancelButtonText: {
    color: '#64748B',
    fontSize: moderateScale(16),
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    borderRadius: moderateScale(16),
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: moderateScale(16),
    paddingHorizontal: moderateScale(24),
    borderRadius: moderateScale(16),
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: moderateScale(16),
    fontWeight: '600',
    marginLeft: moderateScale(8),
  },

  // Section Styles
  section: {
    marginBottom: moderateScale(24),
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: moderateScale(20),
    marginBottom: moderateScale(12),
  },
  sectionIcon: {
    width: moderateScale(32),
    height: moderateScale(32),
    borderRadius: moderateScale(16),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: moderateScale(12),
  },
  sectionTitle: {
    fontSize: moderateScale(18),
    fontWeight: '700',
    color: '#1E293B',
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
    marginLeft: moderateScale(12),
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: moderateScale(20),
    borderRadius: moderateScale(16),
    padding: moderateScale(16),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },

  // Metrics Row Styles
  metricsRow: {
    flexDirection: 'row',
    gap: moderateScale(12),
  },
  metricColumn: {
    flex: 1,
  },

  // BMI Styles
  bmiContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: moderateScale(12),
    padding: moderateScale(16),
    marginTop: moderateScale(16),
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  bmiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: moderateScale(12),
  },
  bmiLabel: {
    fontSize: moderateScale(16),
    fontWeight: '600',
    color: '#1E293B',
  },
  bmiValue: {
    fontSize: moderateScale(20),
    fontWeight: '700',
    color: '#4A90E2',
  },
  bmiStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: moderateScale(8),
  },
  bmiStatusDot: {
    width: moderateScale(8),
    height: moderateScale(8),
    borderRadius: moderateScale(4),
    marginRight: moderateScale(8),
  },
  bmiStatus: {
    fontSize: moderateScale(14),
    fontWeight: '600',
  },
  bmiDescription: {
    fontSize: moderateScale(12),
    color: '#64748B',
    marginBottom: moderateScale(12),
  },
  bmiScale: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  bmiRange: {
    alignItems: 'center',
    padding: moderateScale(4),
    borderRadius: moderateScale(6),
    flex: 1,
  },
  bmiRangeActive: {
    backgroundColor: '#EFF6FF',
  },
  bmiRangeText: {
    fontSize: moderateScale(10),
    color: '#64748B',
    textAlign: 'center',
  },

  // Info Item Styles
  infoItem: {
    paddingVertical: moderateScale(16),
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  lastInfoItem: {
    borderBottomWidth: 0,
    paddingBottom: moderateScale(8),
  },
  infoItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: moderateScale(8),
  },
  infoItemIconContainer: {
    width: moderateScale(24),
    alignItems: 'center',
    marginRight: moderateScale(12),
  },
  infoItemLabel: {
    fontSize: moderateScale(14),
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  requiredStar: {
    color: '#E74C3C',
  },
  infoItemValue: {
    fontSize: moderateScale(16),
    color: '#1E293B',
    fontWeight: '500',
    lineHeight: moderateScale(24),
  },
  infoItemInput: {
    fontSize: moderateScale(16),
    color: '#1E293B',
    fontWeight: '500',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: moderateScale(8),
    paddingHorizontal: moderateScale(12),
    paddingVertical: moderateScale(8),
    marginTop: moderateScale(4),
  },
  multilineInput: {
    minHeight: moderateScale(80),
    textAlignVertical: 'top',
  },
  inputWithUnit: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputWithUnitField: {
    flex: 1,
    marginRight: moderateScale(8),
  },
  unitText: {
    fontSize: moderateScale(14),
    color: '#64748B',
    fontWeight: '500',
    marginTop: moderateScale(4),
  },

  // Option Picker Styles
  optionPickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: moderateScale(8),
    paddingHorizontal: moderateScale(12),
    paddingVertical: moderateScale(12),
    marginTop: moderateScale(4),
  },
  optionPickerText: {
    fontSize: moderateScale(16),
    color: '#1E293B',
    fontWeight: '500',
  },
  optionPickerPlaceholder: {
    fontSize: moderateScale(16),
    color: '#A0A0A0',
    fontWeight: '500',
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: moderateScale(20),
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: moderateScale(16),
    padding: moderateScale(20),
    width: '100%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  modalTitle: {
    fontSize: moderateScale(18),
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: moderateScale(16),
    textAlign: 'center',
  },
  optionsList: {
    maxHeight: moderateScale(300),
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: moderateScale(16),
    paddingHorizontal: moderateScale(12),
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  optionItemSelected: {
    backgroundColor: '#F8FAFC',
    borderRadius: moderateScale(8),
  },
  optionText: {
    fontSize: moderateScale(16),
    color: '#1E293B',
    fontWeight: '500',
  },
  optionTextSelected: {
    color: '#4A90E2',
    fontWeight: '600',
  },
  modalCloseButton: {
    paddingVertical: moderateScale(16),
    alignItems: 'center',
    marginTop: moderateScale(8),
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  modalCloseText: {
    fontSize: moderateScale(16),
    color: '#64748B',
    fontWeight: '600',
  },

  // Save Section Button Styles
  saveSectionButton: {
    backgroundColor: '#4A90E2',
    paddingVertical: moderateScale(12),
    paddingHorizontal: moderateScale(16),
    borderRadius: moderateScale(8),
    alignItems: 'center',
    marginTop: moderateScale(16),
  },
  saveSectionButtonDisabled: {
    backgroundColor: '#CBD5E0',
  },
  saveSectionButtonText: {
    color: '#FFFFFF',
    fontSize: moderateScale(14),
    fontWeight: '600',
  },

  // Floating Action Button Styles
  fab: {
    position: 'absolute',
    bottom: moderateScale(30),
    right: moderateScale(20),
    width: moderateScale(56),
    height: moderateScale(56),
    borderRadius: moderateScale(28),
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabPrimary: {
    backgroundColor: '#4A90E2',
  },
  fabSecondary: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#4A90E2',
  },

  bottomSpacer: {
    height: moderateScale(30),
  },
});

export default ProfileScreen;