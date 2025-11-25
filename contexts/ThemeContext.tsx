import React, { useState, useEffect, createContext, useContext } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  Switch, 
  TouchableOpacity, 
  Linking,
  Alert,
  Platform,
  Appearance,
  useColorScheme
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Notifications from 'expo-notifications';

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Create ThemeContext
const ThemeContext = createContext({
  isDarkMode: false,
  toggleDarkMode: () => {},
});

// ThemeProvider component
const ThemeProvider = ({ children }) => {
  const colorScheme = useColorScheme();
  const [isDarkMode, setIsDarkMode] = useState(colorScheme === 'dark');

  useEffect(() => {
    loadThemePreference();
  }, []);

  const loadThemePreference = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('themePreference');
      if (savedTheme !== null) {
        setIsDarkMode(savedTheme === 'dark');
      } else {
        // Use system preference if no saved preference
        setIsDarkMode(colorScheme === 'dark');
      }
    } catch (error) {
      console.error('Error loading theme preference:', error);
    }
  };

  const toggleDarkMode = async () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    try {
      await AsyncStorage.setItem('themePreference', newTheme ? 'dark' : 'light');
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  };

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

const SettingsScreen = () => {
  const navigation = useNavigation();
  const { isDarkMode, toggleDarkMode } = useContext(ThemeContext);
  
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [language, setLanguage] = useState('English');
  const [userEmail, setUserEmail] = useState('user@example.com');

  // Load settings and check biometric availability on component mount
  useEffect(() => {
    checkBiometricAvailability();
    loadSettings();
    checkNotificationPermissions();
  }, []);

  const checkNotificationPermissions = async () => {
    const { status } = await Notifications.getPermissionsAsync();
    setNotificationsEnabled(status === 'granted');
  };

  const checkBiometricAvailability = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
      
      setBiometricAvailable(hasHardware && isEnrolled && supportedTypes.length > 0);
      
      // Load biometric setting if available
      if (hasHardware && isEnrolled) {
        const savedBiometric = await AsyncStorage.getItem('biometricEnabled');
        if (savedBiometric !== null) {
          setBiometricEnabled(JSON.parse(savedBiometric));
        }
      }
    } catch (error) {
      console.error('Error checking biometric availability:', error);
    }
  };

  // Load saved settings from storage
  const loadSettings = async () => {
    try {
      const settings = await AsyncStorage.getItem('userSettings');
      if (settings) {
        const parsedSettings = JSON.parse(settings);
        setNotificationsEnabled(parsedSettings.notificationsEnabled ?? true);
        setLanguage(parsedSettings.language || 'English');
        
        // Load user email if available
        const userData = await AsyncStorage.getItem('userData');
        if (userData) {
          const parsedUserData = JSON.parse(userData);
          setUserEmail(parsedUserData.email || 'user@example.com');
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const handleNotificationToggle = async (value: boolean) => {
    if (value) {
      // Request notification permissions
      const { status } = await Notifications.requestPermissionsAsync();
      if (status === 'granted') {
        setNotificationsEnabled(true);
        await AsyncStorage.setItem('userSettings', JSON.stringify({
          notificationsEnabled: true,
          language
        }));
        
        // Schedule a demo notification
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "Notifications Enabled",
            body: "You'll now receive important updates from HealthApp.",
          },
          trigger: { seconds: 2 },
        });
      } else {
        Alert.alert(
          "Permission Required",
          "Please enable notifications in your device settings to receive alerts.",
          [{ text: "OK" }]
        );
      }
    } else {
      setNotificationsEnabled(false);
      await AsyncStorage.setItem('userSettings', JSON.stringify({
        notificationsEnabled: false,
        language
      }));
    }
  };

  const handleBiometricToggle = async (value: boolean) => {
    if (value) {
      // If enabling biometric, authenticate first
      try {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Authenticate to enable biometric login',
          fallbackLabel: 'Use passcode instead',
        });
        
        if (result.success) {
          setBiometricEnabled(true);
          await AsyncStorage.setItem('biometricEnabled', JSON.stringify(true));
          Alert.alert(
            "Biometric Login Enabled",
            "You can now use your biometric data to log in to the app.",
            [{ text: "OK" }]
          );
        }
      } catch (error) {
        console.error('Biometric authentication error:', error);
        Alert.alert(
          "Authentication Failed",
          "Could not enable biometric login. Please try again.",
          [{ text: "OK" }]
        );
      }
    } else {
      setBiometricEnabled(false);
      await AsyncStorage.setItem('biometricEnabled', JSON.stringify(false));
    }
  };

  const handleLanguageSelect = async (newLanguage: string) => {
    setLanguage(newLanguage);
    await AsyncStorage.setItem('userSettings', JSON.stringify({
      notificationsEnabled,
      language: newLanguage
    }));
    Alert.alert("Language Changed", `App language set to ${newLanguage}`, [{ text: "OK" }]);
  };

  const handleContactUs = () => {
    Linking.openURL(`mailto:support@yourhealthapp.com?subject=App Support&body=Hello, I need help with...`);
  };

  const handleHelpCenter = () => {
    Linking.openURL('https://yourhealthapp.com/help');
  };

  const handlePrivacyPolicy = () => {
    Linking.openURL('https://yourhealthapp.com/privacy');
  };

  const handleTermsOfService = () => {
    Linking.openURL('https://yourhealthapp.com/terms');
  };

  const handleLogout = () => {
    Alert.alert(
      "Log Out",
      "Are you sure you want to log out?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Log Out", 
          style: "destructive",
          onPress: async () => {
            // Clear sensitive data
            await AsyncStorage.multiRemove(['userToken', 'biometricEnabled']);
            // Navigate to login
            navigation.reset({
              index: 0,
              routes: [{ name: 'Login' }],
            });
          }
        }
      ]
    );
  };

  // Mock navigation functions for demonstration
  const navigateToScreen = (screenName: string) => {
    Alert.alert(
      "Navigation",
      `This would navigate to the ${screenName} screen.`,
      [{ text: "OK" }]
    );
  };

  const settingsSections = [
    {
      title: 'Account',
      items: [
        {
          id: 1,
          title: 'Personal Information',
          icon: 'person-outline',
          action: () => navigateToScreen('PersonalInfo'),
          value: userEmail,
        },
        {
          id: 2,
          title: 'Change Password',
          icon: 'lock-closed-outline',
          action: () => navigateToScreen('ChangePassword'),
        },
        {
          id: 3,
          title: 'Payment Methods',
          icon: 'card-outline',
          action: () => navigateToScreen('PaymentMethods'),
          value: '3 cards',
        },
        {
          id: 4,
          title: 'Address',
          icon: 'location-outline',
          action: () => navigateToScreen('AddressSettings'),
          value: 'Home, Work',
        },
      ],
    },
    {
      title: 'Preferences',
      items: [
        {
          id: 5,
          title: 'Notifications',
          icon: 'notifications-outline',
          action: () => {},
          hasSwitch: true,
          switchValue: notificationsEnabled,
          onSwitchChange: handleNotificationToggle,
        },
        {
          id: 6,
          title: 'Dark Mode',
          icon: 'moon-outline',
          action: () => {},
          hasSwitch: true,
          switchValue: isDarkMode,
          onSwitchChange: toggleDarkMode,
        },
        {
          id: 7,
          title: 'Language',
          icon: 'language-outline',
          action: () => {
            Alert.alert(
              "Select Language",
              "Choose your preferred language",
              [
                { text: "English", onPress: () => handleLanguageSelect('English') },
                { text: "Spanish", onPress: () => handleLanguageSelect('Spanish') },
                { text: "French", onPress: () => handleLanguageSelect('French') },
                { text: "Cancel", style: "cancel" },
              ]
            );
          },
          value: language,
        },
      ],
    },
    {
      title: 'Security',
      items: [
        {
          id: 8,
          title: Platform.OS === 'ios' ? 'Face ID' : 'Fingerprint',
          icon: Platform.OS === 'ios' ? 'face-id-outline' : 'finger-print-outline',
          action: () => {},
          hasSwitch: true,
          switchValue: biometricEnabled,
          onSwitchChange: handleBiometricToggle,
          disabled: !biometricAvailable,
        },
        {
          id: 9,
          title: 'Two-Factor Authentication',
          icon: 'shield-checkmark-outline',
          action: () => navigateToScreen('TwoFactorAuth'),
          value: 'Inactive',
        },
        {
          id: 10,
          title: 'App Lock',
          icon: 'phone-portrait-outline',
          action: () => navigateToScreen('AppLock'),
          value: 'Off',
        },
      ],
    },
    {
      title: 'Support',
      items: [
        {
          id: 11,
          title: 'Help Center',
          icon: 'help-circle-outline',
          action: handleHelpCenter,
        },
        {
          id: 12,
          title: 'Contact Us',
          icon: 'chatbubble-ellipses-outline',
          action: handleContactUs,
        },
        {
          id: 13,
          title: 'Privacy Policy',
          icon: 'document-text-outline',
          action: handlePrivacyPolicy,
        },
        {
          id: 14,
          title: 'Terms of Service',
          icon: 'document-lock-outline',
          action: handleTermsOfService,
        },
      ],
    },
    {
      title: 'About',
      items: [
        {
          id: 15,
          title: 'App Version',
          icon: 'information-circle-outline',
          action: () => {},
          value: '1.2.4 (Build 102)',
        },
        {
          id: 16,
          title: 'Rate This App',
          icon: 'star-outline',
          action: () => {
            Linking.openURL(Platform.OS === 'ios' 
              ? 'itms-apps://itunes.apple.com/app/idYOUR_APP_ID' 
              : 'market://details?id=com.yourapp.package'
            );
          },
        },
        {
          id: 17,
          title: 'Log Out',
          icon: 'log-out-outline',
          action: handleLogout,
          isDestructive: true,
        },
      ],
    },
  ];

  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      <ScrollView style={styles.scrollView}>
        <View style={[styles.header, isDarkMode && styles.headerDark]}>
          <Text style={[styles.headerTitle, isDarkMode && styles.headerTitleDark]}>Settings</Text>
          <Text style={[styles.headerSubtitle, isDarkMode && styles.headerSubtitleDark]}>
            Manage your account preferences
          </Text>
        </View>

        {settingsSections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>{section.title}</Text>
            <View style={[styles.sectionContent, isDarkMode && styles.sectionContentDark]}>
              {section.items.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.settingItem,
                    isDarkMode && styles.settingItemDark,
                    item.disabled && styles.disabledItem
                  ]}
                  onPress={item.action}
                  disabled={item.disabled}
                >
                  <Ionicons 
                    name={item.icon as any} 
                    size={22} 
                    color={item.isDestructive ? '#ff3b30' : (item.disabled ? '#999' : (isDarkMode ? '#64b5f6' : '#1976d2'))} 
                  />
                  <Text style={[
                    styles.settingText,
                    isDarkMode && styles.settingTextDark,
                    item.isDestructive && styles.destructiveText,
                    item.disabled && styles.disabledText
                  ]}>
                    {item.title}
                  </Text>
                  <View style={styles.settingRight}>
                    {item.value && <Text style={[styles.settingValue, isDarkMode && styles.settingValueDark]}>{item.value}</Text>}
                    {item.hasSwitch ? (
                      <Switch
                        value={item.switchValue}
                        onValueChange={item.onSwitchChange}
                        trackColor={{ false: '#767577', true: '#81b0ff' }}
                        thumbColor={item.switchValue ? '#1976d2' : '#f4f3f4'}
                        disabled={item.disabled}
                      />
                    ) : (
                      !item.value && <Ionicons name="chevron-forward" size={20} color={isDarkMode ? '#666' : '#ccc'} />
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
        
        <View style={styles.footer}>
          <Text style={[styles.footerText, isDarkMode && styles.footerTextDark]}>
            HealthApp © {new Date().getFullYear()}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  containerDark: {
    backgroundColor: '#121212',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerDark: {
    backgroundColor: '#1e1e1e',
    borderBottomColor: '#333',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1976d2',
    marginBottom: 4,
  },
  headerTitleDark: {
    color: '#64b5f6',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  headerSubtitleDark: {
    color: '#aaa',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    paddingHorizontal: 20,
    paddingVertical: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionTitleDark: {
    color: '#888',
  },
  sectionContent: {
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  sectionContentDark: {
    backgroundColor: '#1e1e1e',
    borderTopColor: '#333',
    borderBottomColor: '#333',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  settingItemDark: {
    borderBottomColor: '#333',
  },
  disabledItem: {
    opacity: 0.5,
  },
  settingText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    marginLeft: 16,
  },
  settingTextDark: {
    color: '#e0e0e0',
  },
  destructiveText: {
    color: '#ff3b30',
  },
  disabledText: {
    color: '#999',
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingValue: {
    fontSize: 14,
    color: '#666',
    marginRight: 8,
  },
  settingValueDark: {
    color: '#aaa',
  },
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#999',
  },
  footerTextDark: {
    color: '#666',
  },
});

export { ThemeContext, ThemeProvider };